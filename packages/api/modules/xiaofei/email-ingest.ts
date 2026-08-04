import { timingSafeEqual } from "node:crypto";

import {
	acceptMirroredEmailMessage,
	XiaofeiChannelBindingConflictError,
	XiaofeiChannelBindingDisabledError,
	XiaofeiChannelBindingNotFoundError,
	XiaofeiEmailConversationConflictError,
	XiaofeiEmailMirrorConflictError,
} from "@repo/database";
import { EmailMessageIngestV1Schema } from "@repo/xiaofei";

export const MAX_EMAIL_INGEST_BYTES = 1024 * 1024;

export type EmailIngestErrorCode =
	| "unauthorized"
	| "unsupported_media_type"
	| "payload_too_large"
	| "invalid_json"
	| "invalid_request"
	| "idempotency_key_mismatch"
	| "binding_not_found"
	| "binding_disabled"
	| "binding_conflict"
	| "conversation_conflict"
	| "event_conflict"
	| "internal_error";

export function isValidEmailIngestAuthorization(authorization: string | undefined): boolean {
	const configured = process.env.XIAOFEI_EMAIL_INGEST_API_KEY;
	if (!configured || !authorization?.startsWith("Bearer ")) return false;
	const supplied = Buffer.from(authorization.slice("Bearer ".length));
	const expected = Buffer.from(configured);
	return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export async function ingestEmailMessage(input: unknown, idempotencyKey: string | undefined) {
	const parsed = EmailMessageIngestV1Schema.safeParse(input);
	if (!parsed.success) return { status: 400 as const, body: { error: "invalid_request" as const } };
	if (!idempotencyKey || idempotencyKey !== parsed.data.eventId)
		return { status: 400 as const, body: { error: "idempotency_key_mismatch" as const } };
	try {
		const result = await acceptMirroredEmailMessage(parsed.data);
		return {
			status: result.status === "accepted" ? (202 as const) : (200 as const),
			body: {
				status: result.status,
				eventId: parsed.data.eventId,
				conversationId: result.conversationId,
				externalConversationId: parsed.data.conversation.externalId,
				messageId: result.messageId,
				jobId: result.jobId,
			},
		};
	} catch (error) {
		return mapEmailIngestError(error);
	}
}

export function mapEmailIngestError(error: unknown) {
	if (error instanceof XiaofeiChannelBindingNotFoundError)
		return { status: 404 as const, body: { error: "binding_not_found" as const } };
	if (error instanceof XiaofeiChannelBindingDisabledError)
		return { status: 409 as const, body: { error: "binding_disabled" as const } };
	if (error instanceof XiaofeiChannelBindingConflictError)
		return { status: 409 as const, body: { error: "binding_conflict" as const } };
	if (error instanceof XiaofeiEmailConversationConflictError)
		return { status: 409 as const, body: { error: "conversation_conflict" as const } };
	if (error instanceof XiaofeiEmailMirrorConflictError)
		return { status: 409 as const, body: { error: "event_conflict" as const } };
	return { status: 500 as const, body: { error: "internal_error" as const } };
}
