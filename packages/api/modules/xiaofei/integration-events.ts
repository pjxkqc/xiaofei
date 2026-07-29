import { timingSafeEqual } from "node:crypto";

import {
	acceptInboundEvent,
	getInboundEvent,
	listInboundEvents,
	XiaofeiInboundEventConflictError,
} from "@repo/database";
import { z } from "zod";

import { getOrCreatePublicXiaofeiWorkspace } from "./service";

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
	return await acceptInboundEvent(workspace.id, {
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

export async function listIntegrationEvents(input: {
	cursor?: string;
	limit?: number;
	source?: string;
	status?: string;
	topic?: string;
}) {
	const { workspace } = await getOrCreatePublicXiaofeiWorkspace();
	return await listInboundEvents(workspace.id, input);
}

export async function getIntegrationEvent(id: string) {
	const { workspace } = await getOrCreatePublicXiaofeiWorkspace();
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
