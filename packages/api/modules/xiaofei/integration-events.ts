import { timingSafeEqual } from "node:crypto";

import { runXiaofeiTurn } from "@repo/ai";
import {
	acceptInboundEvent,
	appendXiaofeiSupportInboundMessage,
	claimXiaofeiInboundEventProcessing,
	createXiaofeiCustomer,
	getXiaofeiCustomer,
	getXiaofeiOrganizationConfigByExternalMerchantId,
	getInboundEvent,
	listInboundEvents,
	updateXiaofeiInboundEventStatus,
	updateXiaofeiCustomer,
	updateXiaofeiSupportConversation,
	XiaofeiInboundEventConflictError,
	XiaofeiSupportConversationConflictError,
	listXiaofeiOrganizationEmailMirrorMetadata,
	getXiaofeiOrganizationEmailMirrorDetail,
	acceptMirroredEmailMessage,
	listXiaofeiOrganizationEmailChannelBindings,
	XiaofeiChannelBindingNotFoundError,
	type Prisma,
} from "@repo/database";
import {
	ConversationStateSchema,
	SupportMessageSchema,
	TraceEventSchema,
	EmailMessageIngestV1Schema,
	createConversationState,
} from "@repo/xiaofei";
import { z } from "zod";

import {
	getOrCreatePublicXiaofeiWorkspace,
	createKnowledgeWorkspaceBinding,
	getOrCreateXiaofeiWorkspaceByTenantKey,
	getOrCreateXiaofeiWorkspace,
	getXiaofeiOrganizationId,
	type XiaofeiAuthContext,
} from "./service";

export const MAX_INBOUND_EVENT_BYTES = 1024 * 1024;

/**
 * These headers are correlation metadata, not credentials or customer data.
 * Keep this list small: persisted event details are visible to support users.
 */
const SAFE_METADATA_HEADER_NAMES = new Set([
	"content-type",
	"traceparent",
	"tracestate",
	"x-correlation-id",
	"x-message-id",
	"x-request-id",
]);

const optionalText = z.string().trim().min(1).max(500).optional();
export const channelEnvelopeSchema = z
	.object({
		schemaVersion: z.literal("v1"),
		source: z.string().trim().min(1).max(100),
		eventId: z.string().trim().min(1).max(200),
		transport: z
			.object({
				kind: z.string().trim().min(1).max(50),
				topic: optionalText,
				partition: z.number().int().min(0).optional(),
				offset: z.union([z.string().trim().min(1).max(100), z.number().int().min(0)]).optional(),
				messageKey: optionalText,
			})
			.strict(),
		eventType: z.string().trim().min(1).max(200).default("message"),
		occurredAt: z.iso.datetime().optional(),
		payload: z.unknown(),
		metadata: z
			.object({ headers: z.record(z.string(), z.string().max(500)).optional() })
			.strict()
			.optional(),
	})
	.strict();

export type ChannelEnvelope = z.infer<typeof channelEnvelopeSchema>;

const mockMessagePayloadSchema = z.object({
	externalMerchantId: z.string().trim().min(1).max(120),
	externalCustomerId: z.string().trim().min(1).max(120),
	channel: z.enum(["email", "whatsapp"]),
	externalConversationId: z.string().trim().min(1).max(200),
	externalMessageId: z.string().trim().min(1).max(200),
	title: z.string().trim().max(300).optional(),
	text: z.string().trim().min(1).max(10_000),
	direction: z.literal("inbound"),
	origin: z.enum(["customer", "xiaofei"]),
});

export function safeInboundHeaders(headers: Record<string, string> | undefined) {
	if (!headers) return {};
	return Object.fromEntries(
		Object.entries(headers).flatMap(([name, value]) => {
			const normalizedName = name.toLowerCase();
			return SAFE_METADATA_HEADER_NAMES.has(normalizedName)
				? [[normalizedName, value] as const]
				: [];
		}),
	);
}

export async function ingestChannelEnvelope(input: unknown) {
	const envelope = channelEnvelopeSchema.parse(input);
	const { workspace } = await getOrCreatePublicXiaofeiWorkspace();
	return await acceptEnvelope(workspace.id, envelope);
}

export async function simulateOrganizationChannelEnvelope(
	context: XiaofeiAuthContext,
	input: unknown,
) {
	const envelope = channelEnvelopeSchema.parse(input);
	const { workspace } = await getOrCreateXiaofeiWorkspace(context);
	return await acceptEnvelope(workspace.id, envelope);
}

/**
 * Preview-only, organization-scoped channel worker. It deliberately accepts no
 * workspace ID: merchant resolution is the trust boundary for every message.
 */
export async function runMockWorker(context: XiaofeiAuthContext, input: unknown) {
	const payload = mockMessagePayloadSchema.parse(input);
	const { workspace } = await getOrCreateXiaofeiWorkspace(context);
	const eventId = `mock:${payload.externalMessageId}`;
	const accepted = await acceptEnvelope(workspace.id, {
		schemaVersion: "v1",
		source: "mock-worker",
		eventId,
		transport: { kind: "manual", topic: `mock.${payload.channel}` },
		eventType: "message.received",
		payload,
	});
	const event = accepted.event;
	if (!(await claimXiaofeiInboundEventProcessing(workspace.id, event.id)))
		return { ...accepted, outcome: "duplicate" as const };
	try {
		const config = await getXiaofeiOrganizationConfigByExternalMerchantId(
			payload.externalMerchantId,
		);
		if (!config || config.organizationId !== workspace.tenantKey.slice("organization:".length)) {
			await updateXiaofeiInboundEventStatus(workspace.id, event.id, {
				status: "merchant_unknown",
				processedAt: new Date(),
				lastError: "Unknown merchant.",
			});
			return { ...accepted, outcome: "merchant_unknown" as const };
		}
		await updateXiaofeiInboundEventStatus(workspace.id, event.id, {
			status: "organization_resolved",
		});
		let customer = await getXiaofeiCustomer(config.organizationId, payload.externalCustomerId);
		if (!customer)
			customer = await createXiaofeiCustomer({
				organizationId: config.organizationId,
				externalCustomerId: payload.externalCustomerId,
				lastSeenAt: new Date(),
			});
		else
			customer = await updateXiaofeiCustomer(config.organizationId, payload.externalCustomerId, {
				lastSeenAt: new Date(),
			});
		await updateXiaofeiInboundEventStatus(workspace.id, event.id, { status: "customer_upserted" });
		if (payload.origin === "xiaofei") {
			await updateXiaofeiInboundEventStatus(workspace.id, event.id, {
				status: "echo_ignored",
				processedAt: new Date(),
			});
			return { ...accepted, outcome: "echo_ignored" as const };
		}
		const loaded = await getOrCreateXiaofeiWorkspaceByTenantKey(workspace.tenantKey);
		const now = new Date();
		const inboundText = normalizeInboundText(payload.title, payload.text);
		const initialState = createConversationState({
			id: payload.externalConversationId,
			tenantId: workspace.tenantKey,
			agentId: loaded.snapshot.agent.id,
			maxFollowUps: loaded.snapshot.agent.maxFollowUps,
			now: () => now.toISOString(),
		});
		const inbound = SupportMessageSchema.parse({
			id: payload.externalMessageId,
			role: "customer",
			authorName: customer.name ?? payload.externalCustomerId,
			text: inboundText,
			createdAt: now.toISOString(),
		});
		const persisted = await appendXiaofeiSupportInboundMessage({
			workspaceId: workspace.id,
			externalId: payload.externalConversationId,
			customerId: customer.id,
			channel: payload.channel,
			customerName: customer.name ?? payload.externalCustomerId,
			initialState: toJson(initialState),
			message: toJson(inbound),
			lastCustomerSeenAt: now,
			lastMessageAt: now,
		});
		await updateXiaofeiInboundEventStatus(workspace.id, event.id, {
			status: "conversation_updated",
		});
		if (!config.xiaofeiEnabled) {
			await updateXiaofeiInboundEventStatus(workspace.id, event.id, {
				status: "ai_disabled",
				processedAt: new Date(),
			});
			return { ...accepted, outcome: "ai_disabled" as const };
		}
		const persistedState = ConversationStateSchema.parse(persisted.state);
		if (persistedState.ownerType !== "ai") {
			await updateXiaofeiInboundEventStatus(workspace.id, event.id, {
				status: "conversation_updated",
				processedAt: new Date(),
			});
			return { ...accepted, outcome: "human_owned" as const };
		}
		const persistedMessages = z.array(SupportMessageSchema).parse(persisted.messages);
		const replyId = `xiaofei:${payload.externalMessageId}`;
		if (!persistedMessages.some((message) => message.id === replyId)) {
			const result = await runXiaofeiTurn({
				message: inboundText,
				state: persistedState,
				snapshot: loaded.snapshot,
				knowledgeWorkspaceBinding: createKnowledgeWorkspaceBinding({
					workspace: loaded.workspace,
					snapshot: loaded.snapshot,
					conversationId: persistedState.id,
					channelId: `mock:${payload.channel}`,
				}),
			});
			const reply = SupportMessageSchema.parse({
				id: replyId,
				role: "ai",
				authorName: loaded.snapshot.agent.name,
				text: result.reply,
				createdAt: new Date().toISOString(),
			});
			await updateXiaofeiSupportConversation(
				workspace.id,
				payload.externalConversationId,
				{
					expectedRevision: persisted.revision,
					expectedOwnerType: persisted.ownerType,
					expectedOwnerEpoch: persisted.ownerEpoch,
				},
				{
					state: toJson(result.state),
					traceEvents: toJson(
						[
							...z.array(TraceEventSchema).parse(persisted.traceEvents),
							...result.metadata.traces,
						].slice(-80),
					),
					messages: toJson([...persistedMessages, reply].slice(-160)),
					lastMessageAt: new Date(),
				},
			);
		}
		await updateXiaofeiInboundEventStatus(workspace.id, event.id, {
			status: "ai_replied",
		});
		const echoPayload = {
			...payload,
			externalMessageId: `xiaofei:${payload.externalMessageId}`,
			origin: "xiaofei" as const,
		};
		const echo = await acceptEnvelope(workspace.id, {
			schemaVersion: "v1",
			source: "mock-worker",
			eventId: `mock:${echoPayload.externalMessageId}`,
			transport: { kind: "manual", topic: `mock.${payload.channel}` },
			eventType: "message.echo",
			payload: echoPayload,
		});
		await updateXiaofeiInboundEventStatus(workspace.id, echo.event.id, {
			status: "echo_ignored",
			processedAt: new Date(),
		});
		await updateXiaofeiInboundEventStatus(workspace.id, event.id, {
			status: "mock_delivered",
			processedAt: new Date(),
		});
		return { ...accepted, outcome: "mock_delivered" as const, echo: echo.event };
	} catch (error) {
		if (error instanceof XiaofeiSupportConversationConflictError) {
			await updateXiaofeiInboundEventStatus(workspace.id, event.id, {
				status: "conversation_conflict",
				processedAt: new Date(),
				lastError: "Conversation changed during processing.",
			});
			return { ...accepted, outcome: "conversation_conflict" as const };
		}
		await updateXiaofeiInboundEventStatus(workspace.id, event.id, {
			status: "failed",
			processedAt: new Date(),
			lastError: "Mock worker failed.",
		});
		throw error;
	}
}

/** Browser-safe mirror simulation: it constructs the shared DTO and calls the
 * persistence service directly. It never holds an ingest token or invokes AI. */
export async function runMockEmailMirror(context: XiaofeiAuthContext, input: unknown) {
	const organizationId = await getXiaofeiOrganizationId(context);
	// The Email mirror can be the first Xiaofei surface used by an Organization.
	// Ensure the server-derived workspace exists before binding resolution.
	await getOrCreateXiaofeiWorkspace(context);
	const payload = z
		.object({
			companyId: z.string().trim().min(1).max(100),
			channelAccountId: z.string().trim().min(1),
			address: z.string().trim().email(),
			externalConversationId: z.string().trim().min(1),
			eventId: z.string().trim().min(1),
			occurredAt: z.iso.datetime(),
			scenario: z.enum(["inbound_customer", "outbound_loopdesk", "outbound_xiaofei"]),
			customerEmail: z.string().trim().email().default("customer@example.test"),
			subject: z.string().trim().max(300).nullable().default("Mock email"),
			text: z.string().trim().min(1).max(10_000),
		})
		.parse(input);
	const binding = (await listXiaofeiOrganizationEmailChannelBindings(organizationId)).find(
		(item) =>
			item.companyId === payload.companyId &&
			item.channelAccountId === payload.channelAccountId &&
			item.address === payload.address.trim().toLowerCase(),
	);
	// Do not pass a foreign or fabricated tuple into the global persistence
	// boundary: that would allow an authenticated member to select another tenant.
	if (!binding) throw new XiaofeiChannelBindingNotFoundError(payload.companyId);
	const outbound = payload.scenario !== "inbound_customer";
	const message = EmailMessageIngestV1Schema.parse({
		schemaVersion: "email.message.v1",
		eventId: payload.eventId,
		occurredAt: payload.occurredAt,
		tenant: { companyId: payload.companyId },
		channel: "email",
		channelAccount: { id: payload.channelAccountId, address: payload.address },
		conversation: { externalId: payload.externalConversationId, loopdeskSessionId: null },
		message: {
			sourceMessageId: `mock:${payload.eventId}`,
			providerMessageId: null,
			replyToSourceMessageId: null,
			direction: outbound ? "outbound" : "inbound",
			senderType: outbound
				? payload.scenario === "outbound_xiaofei"
					? "xiaofei"
					: "loopdesk"
				: "customer",
			from: { address: outbound ? payload.address : payload.customerEmail, name: null },
			to: [{ address: outbound ? payload.customerEmail : payload.address, name: null }],
			subject: payload.subject,
			content: { type: "text/plain", value: payload.text },
			attachments: [],
			labels: [],
			sourceSendType: null,
			sentAt: payload.occurredAt,
		},
		source: {
			system: "xiaofei-mock",
			topic: "mock.email",
			partition: 0,
			offset: 0,
			workerVersion: `organization:${organizationId}`,
		},
	});
	return acceptMirroredEmailMessage(message);
}

function toJson(value: unknown): Prisma.InputJsonValue {
	return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function normalizeInboundText(title: string | undefined, text: string) {
	return [title?.trim(), text.trim()].filter(Boolean).join("\n\n");
}

async function acceptEnvelope(workspaceId: string, envelope: ChannelEnvelope) {
	return await acceptInboundEvent(workspaceId, {
		source: envelope.source,
		eventId: envelope.eventId,
		schemaVersion: envelope.schemaVersion,
		transportKind: envelope.transport.kind,
		topic: envelope.transport.topic,
		partition: envelope.transport.partition,
		offset: envelope.transport.offset === undefined ? undefined : String(envelope.transport.offset),
		messageKey: envelope.transport.messageKey,
		eventType: envelope.eventType,
		occurredAt: envelope.occurredAt ? new Date(envelope.occurredAt) : new Date(),
		payload: envelope.payload as never,
		safeHeaders: safeInboundHeaders(envelope.metadata?.headers),
	});
}

export async function listIntegrationEvents(
	context: XiaofeiAuthContext,
	input: {
		cursor?: string;
		limit?: number;
		source?: string;
		status?: string;
		topic?: string;
	},
) {
	const { workspace } = await getOrCreateXiaofeiWorkspace(context);
	return await listInboundEvents(workspace.id, input);
}

export async function getIntegrationEvent(context: XiaofeiAuthContext, id: string) {
	const { workspace } = await getOrCreateXiaofeiWorkspace(context);
	return await getInboundEvent(workspace.id, id);
}
export async function listEmailMirrorMetadata(context: XiaofeiAuthContext) {
	const organizationId = await getXiaofeiOrganizationId(context);
	await getOrCreateXiaofeiWorkspace(context);
	return listXiaofeiOrganizationEmailMirrorMetadata(organizationId);
}
export async function getEmailMirrorDetail(context: XiaofeiAuthContext, id: string) {
	const organizationId = await getXiaofeiOrganizationId(context);
	await getOrCreateXiaofeiWorkspace(context);
	return getXiaofeiOrganizationEmailMirrorDetail(organizationId, id);
}

export function isValidIngestApiKey(authorization: string | undefined): boolean {
	const configured = process.env.XIAOFEI_INGEST_API_KEY;
	if (!configured || !authorization?.startsWith("Bearer ")) return false;
	const supplied = authorization.slice("Bearer ".length);
	const left = Buffer.from(supplied);
	const right = Buffer.from(configured);
	return left.length === right.length && timingSafeEqual(left, right);
}

export function publicIngestResponse(result: {
	kind: "created" | "duplicate";
	event: { id: string; source: string; eventId: string; status: string };
}) {
	return {
		accepted: result.kind === "created",
		replay: result.kind === "duplicate",
		event: result.event,
	};
}

export { XiaofeiInboundEventConflictError };
