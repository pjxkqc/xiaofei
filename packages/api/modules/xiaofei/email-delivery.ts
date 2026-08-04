import { lookup } from "node:dns/promises";

import { ORPCError } from "@orpc/server";
import { runXiaofeiTurn } from "@repo/ai";
import {
	claimXiaofeiOrganizationEmailProcessingJob,
	completeXiaofeiEmailReplyProcessing,
	createXiaofeiOutboundDelivery,
	failXiaofeiOrganizationEmailProcessingJob,
	getLatestXiaofeiOrganizationEmailMirrorContext,
	getXiaofeiOrganizationConfig,
	getXiaofeiOrganizationEmailDeliveryConfig,
	getXiaofeiOrganizationEmailProcessingContext,
	getXiaofeiOrganizationOutboundDelivery,
	listXiaofeiOrganizationOutboundDeliveries,
	recordXiaofeiOutboundDeliveryAttempt,
	retargetXiaofeiOrganizationOutboundDelivery,
	saveXiaofeiOrganizationEmailDeliveryConfig,
	type Prisma,
} from "@repo/database";
import {
	ConversationStateSchema,
	EmailDeliveryAcceptanceV1Schema,
	EmailDeliveryV1Schema,
	EmailMessageIngestV1Schema,
	SupportMessageSchema,
	TraceEventSchema,
	type EmailDeliveryV1,
} from "@repo/xiaofei";
import * as ipaddr from "ipaddr.js";
import { z } from "zod";

import {
	createKnowledgeWorkspaceBinding,
	getOrCreateXiaofeiWorkspace,
	getXiaofeiOrganizationId,
	requireXiaofeiOrganizationAdmin,
	type XiaofeiAuthContext,
} from "./service";

const CALLBACK_TIMEOUT_MS = 10_000;
const MAX_CALLBACK_RESPONSE_BYTES = 64 * 1024;
const BUILT_IN_RECEIVER_MOCK_PATH = "/api/xiaofei/integrations/v1/email/delivery-mock";

export async function getEmailDeliverySettings(context: XiaofeiAuthContext) {
	const organizationId = await getXiaofeiOrganizationId(context);
	await getOrCreateXiaofeiWorkspace(context);
	let canManage = false;
	try {
		await requireXiaofeiOrganizationAdmin(context);
		canManage = true;
	} catch (error) {
		if (!(error instanceof ORPCError) || error.code !== "FORBIDDEN") throw error;
	}
	return {
		...(await getXiaofeiOrganizationEmailDeliveryConfig(organizationId)),
		canManage,
		builtInMockPath: BUILT_IN_RECEIVER_MOCK_PATH,
	};
}

export async function saveEmailDeliverySettings(
	context: XiaofeiAuthContext,
	input: { mode: "mock" | "webhook"; callbackUrl: string | null },
) {
	await requireXiaofeiOrganizationAdmin(context);
	const organizationId = await getXiaofeiOrganizationId(context);
	await getOrCreateXiaofeiWorkspace(context);
	const callbackUrl =
		input.mode === "webhook" ? await assertPublicCallbackUrl(input.callbackUrl) : null;
	return saveXiaofeiOrganizationEmailDeliveryConfig(organizationId, {
		mode: input.mode,
		callbackUrl,
	});
}

export async function listEmailOutboundDeliveries(context: XiaofeiAuthContext) {
	const organizationId = await getXiaofeiOrganizationId(context);
	await getOrCreateXiaofeiWorkspace(context);
	return (await listXiaofeiOrganizationOutboundDeliveries(organizationId)).map((item) => ({
		...item,
		destination: displayDestination(item.destinationMode, item.destinationUrl),
		destinationUrl: undefined,
	}));
}

export async function getEmailOutboundDelivery(context: XiaofeiAuthContext, id: string) {
	const organizationId = await getXiaofeiOrganizationId(context);
	await getOrCreateXiaofeiWorkspace(context);
	return getXiaofeiOrganizationOutboundDelivery(organizationId, id);
}

export async function processMirroredEmailJob(context: XiaofeiAuthContext, jobId: string) {
	const organizationId = await getXiaofeiOrganizationId(context);
	const [{ workspace, snapshot }, organizationConfig, deliveryConfig, initial] = await Promise.all([
		getOrCreateXiaofeiWorkspace(context),
		getXiaofeiOrganizationConfig(organizationId),
		getXiaofeiOrganizationEmailDeliveryConfig(organizationId),
		getXiaofeiOrganizationEmailProcessingContext(organizationId, jobId),
	]);
	if (!initial) throw new ORPCError("NOT_FOUND", { message: "Email processing job not found." });
	if (!organizationConfig?.xiaofeiEnabled)
		throw new ORPCError("BAD_REQUEST", {
			message: "Enable Xiaofei for this Organization before processing Email messages.",
		});
	if (deliveryConfig.mode === "webhook") await assertPublicCallbackUrl(deliveryConfig.callbackUrl);
	if (!(await claimXiaofeiOrganizationEmailProcessingJob(organizationId, jobId)))
		return {
			status: "already_processed" as const,
			jobStatus: initial.status,
			conversationId: initial.conversation.externalId,
		};

	try {
		const claimed = await getXiaofeiOrganizationEmailProcessingContext(organizationId, jobId);
		if (!claimed) throw new Error("Claimed Email processing job was not found.");
		const inbound = EmailMessageIngestV1Schema.parse(claimed.inboundEvent.payload);
		const currentState = ConversationStateSchema.parse(claimed.conversation.state);
		if (currentState.ownerType !== "ai")
			throw new ORPCError("BAD_REQUEST", {
				message: "Return this conversation to Xiaofei before running the mirrored job.",
			});
		const state = ConversationStateSchema.parse({
			...currentState,
			agentId: snapshot.agent.id,
			maxFollowUps: snapshot.agent.maxFollowUps,
		});
		const inputText = readableEmailText(
			claimed.conversationMessage.contentType,
			claimed.conversationMessage.contentValue,
		);
		const result = await runXiaofeiTurn({
			message: inputText,
			state,
			snapshot,
			knowledgeWorkspaceBinding: createKnowledgeWorkspaceBinding({
				workspace,
				snapshot,
				conversationId: state.id,
				channelId: `email:${inbound.channelAccount.id}`,
			}),
		});
		const occurredAt = new Date();
		const messages = z.array(SupportMessageSchema).parse(claimed.conversation.messages);
		const reply = SupportMessageSchema.parse({
			id: `email-source:xiaofei:delivery:${jobId}`,
			role: "ai",
			authorName: snapshot.agent.name,
			text: result.reply,
			createdAt: occurredAt.toISOString(),
		});
		const traces = z.array(TraceEventSchema).parse(claimed.conversation.traceEvents);
		const delivery = makeReplyDelivery({
			deliveryId: `delivery:${jobId}`,
			occurredAt,
			inbound,
			reply: result.reply,
			senderName: snapshot.agent.name,
		});
		const record = await completeXiaofeiEmailReplyProcessing({
			workspaceId: workspace.id,
			jobId,
			conversationId: claimed.conversation.id,
			expectedOwnerEpoch: state.ownerEpoch,
			state: toJson(result.state),
			messages: toJson([...messages, reply].slice(-160)),
			traceEvents: toJson([...traces, ...result.metadata.traces].slice(-80)),
			lastMessageAt: occurredAt,
			delivery: {
				id: delivery.deliveryId,
				workspaceId: workspace.id,
				conversationId: claimed.conversation.id,
				processingJobId: jobId,
				eventType: delivery.event.type,
				senderType: "xiaofei",
				destinationMode: deliveryConfig.mode,
				destinationUrl: deliveryConfig.callbackUrl,
				payload: delivery,
			},
		});
		const attempt = await deliverOutbound(record);
		return {
			status: "processed" as const,
			conversationId: claimed.conversation.externalId,
			reply: result.reply,
			deliveryId: record.id,
			deliveryStatus: attempt.status,
		};
	} catch (error) {
		await failXiaofeiOrganizationEmailProcessingJob(
			organizationId,
			jobId,
			safeProcessingError(error),
		);
		throw error;
	}
}

export async function sendEmailCallbackTest(context: XiaofeiAuthContext) {
	await requireXiaofeiOrganizationAdmin(context);
	const organizationId = await getXiaofeiOrganizationId(context);
	const [{ workspace }, config, latest] = await Promise.all([
		getOrCreateXiaofeiWorkspace(context),
		getXiaofeiOrganizationEmailDeliveryConfig(organizationId),
		getLatestXiaofeiOrganizationEmailMirrorContext(organizationId),
	]);
	if (!latest?.conversationMessage)
		throw new ORPCError("BAD_REQUEST", {
			message: "Run one Email inbound mock before testing the callback receiver.",
		});
	if (config.mode === "webhook") await assertPublicCallbackUrl(config.callbackUrl);
	const inbound = EmailMessageIngestV1Schema.parse(latest.payload);
	const occurredAt = new Date();
	const payload = EmailDeliveryV1Schema.parse({
		schemaVersion: "xiaofei.email.delivery.v1",
		deliveryId: `delivery:test:${crypto.randomUUID()}`,
		occurredAt: occurredAt.toISOString(),
		tenant: inbound.tenant,
		channel: "email",
		channelAccount: inbound.channelAccount,
		conversation: inbound.conversation,
		event: {
			type: "conversation.status.changed",
			status: "xiaofei_received",
			reason: "Callback connectivity test from Xiaofei.",
		},
		source: { system: "xiaofei", environment: deploymentEnvironment() },
	});
	const record = await createXiaofeiOutboundDelivery({
		id: payload.deliveryId,
		workspaceId: workspace.id,
		conversationId: latest.conversationMessage.conversation.id,
		eventType: payload.event.type,
		senderType: "system",
		destinationMode: config.mode,
		destinationUrl: config.callbackUrl,
		payload,
	});
	const attempt = await deliverOutbound(record);
	return { deliveryId: record.id, status: attempt.status };
}

export async function retryEmailOutboundDelivery(context: XiaofeiAuthContext, id: string) {
	const organizationId = await getXiaofeiOrganizationId(context);
	await getOrCreateXiaofeiWorkspace(context);
	const [record, config] = await Promise.all([
		getXiaofeiOrganizationOutboundDelivery(organizationId, id),
		getXiaofeiOrganizationEmailDeliveryConfig(organizationId),
	]);
	if (!record) throw new ORPCError("NOT_FOUND", { message: "Outbound delivery not found." });
	if (record.status === "delivered")
		throw new ORPCError("BAD_REQUEST", { message: "A delivered callback cannot be retried." });
	if (config.mode === "webhook") await assertPublicCallbackUrl(config.callbackUrl);
	const retargeted = await retargetXiaofeiOrganizationOutboundDelivery(organizationId, id, {
		destinationMode: config.mode,
		destinationUrl: config.callbackUrl,
	});
	const attempt = await deliverOutbound(retargeted);
	return { deliveryId: id, status: attempt.status };
}

async function deliverOutbound(record: {
	id: string;
	workspaceId: string;
	destinationMode: string;
	destinationUrl: string | null;
	payload: unknown;
}) {
	const payload = EmailDeliveryV1Schema.parse(record.payload);
	if (record.destinationMode === "mock") {
		EmailDeliveryAcceptanceV1Schema.parse({
			status: "accepted",
			deliveryId: payload.deliveryId,
			receivedAt: new Date().toISOString(),
		});
		return recordXiaofeiOutboundDeliveryAttempt({
			workspaceId: record.workspaceId,
			id: record.id,
			status: "delivered",
			responseStatus: 200,
			lastError: null,
		});
	}

	try {
		const callbackUrl = await assertPublicCallbackUrl(record.destinationUrl);
		const response = await fetch(callbackUrl, {
			method: "POST",
			headers: { "Content-Type": "application/json", "Idempotency-Key": payload.deliveryId },
			body: JSON.stringify(payload),
			redirect: "manual",
			signal: AbortSignal.timeout(CALLBACK_TIMEOUT_MS),
		});
		if (response.body) await readBoundedResponse(response);
		const delivered = response.status >= 200 && response.status < 300;
		return recordXiaofeiOutboundDeliveryAttempt({
			workspaceId: record.workspaceId,
			id: record.id,
			status: delivered ? "delivered" : "failed",
			responseStatus: response.status,
			lastError: delivered ? null : `Receiver returned HTTP ${response.status}.`,
		});
	} catch {
		return recordXiaofeiOutboundDeliveryAttempt({
			workspaceId: record.workspaceId,
			id: record.id,
			status: "failed",
			responseStatus: null,
			lastError: "Receiver request failed or timed out.",
		});
	}
}

function makeReplyDelivery(input: {
	deliveryId: string;
	occurredAt: Date;
	inbound: z.infer<typeof EmailMessageIngestV1Schema>;
	reply: string;
	senderName: string;
}): EmailDeliveryV1 {
	return EmailDeliveryV1Schema.parse({
		schemaVersion: "xiaofei.email.delivery.v1",
		deliveryId: input.deliveryId,
		occurredAt: input.occurredAt.toISOString(),
		tenant: input.inbound.tenant,
		channel: "email",
		channelAccount: input.inbound.channelAccount,
		conversation: input.inbound.conversation,
		event: {
			type: "message.reply.requested",
			message: {
				sourceMessageId: `xiaofei:${input.deliveryId}`,
				replyToSourceMessageId: input.inbound.message.sourceMessageId,
				senderType: "xiaofei",
				from: { address: input.inbound.channelAccount.address, name: input.senderName },
				to: [input.inbound.message.from],
				subject: replySubject(input.inbound.message.subject),
				content: { type: "text/plain", value: input.reply },
			},
		},
		source: { system: "xiaofei", environment: deploymentEnvironment() },
	});
}

async function assertPublicCallbackUrl(value: string | null): Promise<string> {
	if (!value) throw new ORPCError("BAD_REQUEST", { message: "Enter an HTTPS callback URL first." });
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		throw invalidCallbackUrl();
	}
	if (
		url.protocol !== "https:" ||
		url.username ||
		url.password ||
		url.search ||
		url.hash ||
		url.hostname === "localhost" ||
		url.hostname.endsWith(".local")
	)
		throw invalidCallbackUrl();
	let addresses: Array<{ address: string }>;
	try {
		addresses = await lookup(url.hostname, { all: true, verbatim: true });
	} catch {
		throw new ORPCError("BAD_REQUEST", { message: "The callback host could not be resolved." });
	}
	if (!addresses.length || addresses.some(({ address }) => isBlockedIpAddress(address)))
		throw invalidCallbackUrl();
	return url.toString();
}

function invalidCallbackUrl() {
	return new ORPCError("BAD_REQUEST", {
		message:
			"Use a public HTTPS callback URL without credentials, query parameters, fragments, or private-network addresses.",
	});
}

function isBlockedIpAddress(value: string) {
	if (!ipaddr.isValid(value)) return true;
	return BLOCKED_IP_RANGES.has(ipaddr.process(value).range());
}

async function readBoundedResponse(response: Response) {
	const reader = response.body?.getReader();
	if (!reader) return;
	let total = 0;
	while (true) {
		const result = await reader.read();
		if (result.done) return;
		total += result.value.byteLength;
		if (total > MAX_CALLBACK_RESPONSE_BYTES) {
			await reader.cancel();
			return;
		}
	}
}

function readableEmailText(contentType: string, value: string) {
	if (contentType === "text/plain") return value.trim() || "（空白邮件）";
	return (
		value
			.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/giu, " ")
			.replace(/<br\s*\/?>/giu, "\n")
			.replace(/<\/p\s*>/giu, "\n")
			.replace(/<[^>]+>/gu, " ")
			.replace(/&nbsp;/giu, " ")
			.replace(/&amp;/giu, "&")
			.replace(/\s+/gu, " ")
			.trim() || "（空白 HTML 邮件）"
	);
}

function replySubject(subject: string | null) {
	if (!subject?.trim()) return null;
	return /^re:/iu.test(subject.trim()) ? subject.trim() : `Re: ${subject.trim()}`;
}

function deploymentEnvironment() {
	return process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development";
}

function displayDestination(mode: string, value: string | null) {
	if (mode === "mock") return "Built-in receiver mock";
	try {
		return new URL(value ?? "").host;
	} catch {
		return "Invalid receiver";
	}
}

function safeProcessingError(error: unknown) {
	return error instanceof ORPCError && error.code === "BAD_REQUEST"
		? error.message
		: "Email processing failed before delivery was queued.";
}

function toJson(value: unknown): Prisma.InputJsonValue {
	return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

const BLOCKED_IP_RANGES = new Set([
	"unspecified",
	"broadcast",
	"multicast",
	"linkLocal",
	"loopback",
	"carrierGradeNat",
	"private",
	"uniqueLocal",
	"reserved",
]);
