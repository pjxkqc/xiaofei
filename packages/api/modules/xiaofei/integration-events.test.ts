import { acceptInboundEvent } from "@repo/database";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@repo/database", () => ({
	acceptInboundEvent: vi.fn(),
	getInboundEvent: vi.fn(),
	listInboundEvents: vi.fn(),
	XiaofeiInboundEventConflictError: class XiaofeiInboundEventConflictError extends Error {},
}));
vi.mock("./service", () => ({ getOrCreatePublicXiaofeiWorkspace: vi.fn() }));

import {
	channelEnvelopeSchema,
	ingestChannelEnvelope,
	isValidIngestApiKey,
	MAX_INBOUND_EVENT_BYTES,
	safeInboundHeaders,
} from "./integration-events";
import { getOrCreatePublicXiaofeiWorkspace } from "./service";

describe("ChannelEnvelope v1", () => {
	it("accepts bounded transport metadata without a caller workspace", () => {
		const envelope = channelEnvelopeSchema.parse({
			schemaVersion: "v1",
			source: "kafka",
			eventId: "evt-1",
			transport: { kind: "kafka", offset: "9007199254740993" },
			payload: { order: 1 },
		});
		expect(envelope.transport.offset).toBe("9007199254740993");
		expect("workspaceId" in envelope).toBe(false);
	});
	it("rejects an injected workspace and unknown schema", () => {
		expect(() =>
			channelEnvelopeSchema.parse({
				schemaVersion: "v2",
				source: "kafka",
				eventId: "evt-1",
				transport: { kind: "kafka" },
				payload: {},
			}),
		).toThrow();
		expect(() =>
			channelEnvelopeSchema.parse({
				schemaVersion: "v1",
				source: "kafka",
				eventId: "evt-1",
				workspaceId: "other",
				transport: { kind: "kafka" },
				payload: {},
			}),
		).toThrow();
	});
});

describe("ingest authentication", () => {
	afterEach(() => {
		delete process.env.XIAOFEI_INGEST_API_KEY;
	});
	it("requires a configured matching Bearer key", () => {
		process.env.XIAOFEI_INGEST_API_KEY = "test-key";
		expect(isValidIngestApiKey("Bearer test-key")).toBe(true);
		expect(isValidIngestApiKey("Bearer wrong-key")).toBe(false);
		expect(isValidIngestApiKey(undefined)).toBe(false);
	});
	it("keeps the body limit at one MiB", () => expect(MAX_INBOUND_EVENT_BYTES).toBe(1024 * 1024));
});

describe("inbound metadata privacy", () => {
	it("persists only allowlisted observability headers", async () => {
		vi.mocked(getOrCreatePublicXiaofeiWorkspace).mockResolvedValue({
			workspace: { id: "public-workspace" },
		} as never);
		vi.mocked(acceptInboundEvent).mockResolvedValue({
			kind: "created",
			event: { id: "event-1", source: "kafka", eventId: "evt-1", status: "accepted" },
		} as never);

		await ingestChannelEnvelope({
			schemaVersion: "v1",
			source: "kafka",
			eventId: "evt-1",
			transport: { kind: "kafka" },
			payload: {},
			metadata: {
				headers: {
					Authorization: "Bearer must-not-persist",
					Cookie: "session=must-not-persist",
					"X-Request-Id": "request-123",
				},
			},
		});

		expect(acceptInboundEvent).toHaveBeenCalledWith(
			"public-workspace",
			expect.objectContaining({ safeHeaders: { "x-request-id": "request-123" } }),
		);
	});

	it("normalizes allowlisted names and excludes sensitive names", () => {
		expect(
			safeInboundHeaders({
				TraceParent: "00-abc-def-01",
				"x-api-key": "must-not-persist",
			}),
		).toEqual({ traceparent: "00-abc-def-01" });
	});
});
