import { timingSafeEqual } from "node:crypto";

import { runXiaofeiTurn } from "@repo/ai";
import {
	acceptInboundEvent,
	createXiaofeiCustomer,
	getXiaofeiConversation,
	getXiaofeiCustomer,
	getXiaofeiOrganizationConfigByExternalMerchantId,
	getInboundEvent,
	listInboundEvents,
	updateXiaofeiInboundEventStatus,
	updateXiaofeiCustomer,
	updateXiaofeiSupportConversation,
	upsertXiaofeiSupportConversation,
	XiaofeiInboundEventConflictError,
	type Prisma,
} from "@repo/database";
import {
	ConversationStateSchema,
	SupportMessageSchema,
	TraceEventSchema,
	createConversationState,
} from "@repo/xiaofei";
import { z } from "zod";

import {
	getOrCreatePublicXiaofeiWorkspace,
	createKnowledgeWorkspaceBinding,
	getOrCreateXiaofeiWorkspaceByTenantKey,
	getOrCreateXiaofeiWorkspace,
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
	if (accepted.kind === "duplicate") return { ...accepted, outcome: "duplicate" as const };
	const event = accepted.event;
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
		const current = await getXiaofeiConversation(workspace.id, payload.externalConversationId);
		if (current && (current.customerId !== customer.id || current.channel !== payload.channel)) {
			await updateXiaofeiInboundEventStatus(workspace.id, event.id, {
				status: "conversation_conflict",
				processedAt: new Date(),
				lastError: "Conversation customer or channel binding mismatch.",
			});
			return { ...accepted, outcome: "conversation_conflict" as const };
		}
		const now = new Date();
		const inboundText = normalizeInboundText(payload.title, payload.text);
		const state = current
			? ConversationStateSchema.parse(current.state)
			: createConversationState({
					id: payload.externalConversationId,
					tenantId: workspace.tenantKey,
					agentId: loaded.snapshot.agent.id,
					maxFollowUps: loaded.snapshot.agent.maxFollowUps,
					now: () => now.toISOString(),
				});
		const messages = current ? z.array(SupportMessageSchema).parse(current.messages) : [];
		const inbound = SupportMessageSchema.parse({
			id: payload.externalMessageId,
			role: "customer",
			authorName: customer.name ?? payload.externalCustomerId,
			text: inboundText,
			createdAt: now.toISOString(),
		});
		const traces = current ? z.array(TraceEventSchema).parse(current.traceEvents) : [];
		if (!current)
			await upsertXiaofeiSupportConversation({
				workspaceId: workspace.id,
				externalId: payload.externalConversationId,
				customerId: customer.id,
				channel: payload.channel,
				customerName: customer.name ?? payload.externalCustomerId,
				state: toJson(state),
				traceEvents: toJson(traces),
				messages: toJson([...messages, inbound]),
				lastCustomerSeenAt: now,
				lastMessageAt: now,
			});
		else
			await updateXiaofeiSupportConversation(workspace.id, payload.externalConversationId, {
				customerName: customer.name ?? payload.externalCustomerId,
				state: toJson(state),
				messages: toJson([...messages, inbound].slice(-160)),
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
		const result = await runXiaofeiTurn({
			message: inboundText,
			state,
			snapshot: loaded.snapshot,
			knowledgeWorkspaceBinding: createKnowledgeWorkspaceBinding({
				workspace: loaded.workspace,
				snapshot: loaded.snapshot,
				conversationId: state.id,
				channelId: `mock:${payload.channel}`,
			}),
		});
		const reply = SupportMessageSchema.parse({
			id: `xiaofei:${payload.externalMessageId}`,
			role: "ai",
			authorName: loaded.snapshot.agent.name,
			text: result.reply,
			createdAt: new Date().toISOString(),
		});
		await updateXiaofeiSupportConversation(workspace.id, payload.externalConversationId, {
			state: toJson(result.state),
			traceEvents: toJson([...traces, ...result.metadata.traces].slice(-80)),
			messages: toJson([...messages, inbound, reply].slice(-160)),
			lastMessageAt: new Date(),
		});
		await updateXiaofeiInboundEventStatus(workspace.id, event.id, {
			status: "ai_replied",
		});
		await updateXiaofeiInboundEventStatus(workspace.id, event.id, {
			status: "mock_delivered",
			processedAt: new Date(),
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
		return { ...accepted, outcome: "mock_delivered" as const, echo: echo.event };
	} catch (error) {
		await updateXiaofeiInboundEventStatus(workspace.id, event.id, {
			status: "failed",
			processedAt: new Date(),
			lastError: "Mock worker failed.",
		});
		throw error;
	}
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
