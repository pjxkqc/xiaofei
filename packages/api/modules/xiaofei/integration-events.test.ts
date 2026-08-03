import { acceptInboundEvent } from "@repo/database";
import { createConversationState, createDefaultWorkspaceSnapshot } from "@repo/xiaofei";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@repo/database", () => ({
	acceptInboundEvent: vi.fn(),
	getInboundEvent: vi.fn(),
	listInboundEvents: vi.fn(),
	getXiaofeiOrganizationConfigByExternalMerchantId: vi.fn(),
	getXiaofeiCustomer: vi.fn(),
	createXiaofeiCustomer: vi.fn(),
	updateXiaofeiCustomer: vi.fn(),
	getXiaofeiConversation: vi.fn(),
	updateXiaofeiInboundEventStatus: vi.fn(),
	updateXiaofeiSupportConversation: vi.fn(),
	upsertXiaofeiSupportConversation: vi.fn(),
	XiaofeiInboundEventConflictError: class XiaofeiInboundEventConflictError extends Error {},
	XiaofeiChannelBindingNotFoundError: class XiaofeiChannelBindingNotFoundError extends Error {},
	listXiaofeiOrganizationEmailChannelBindings: vi.fn(),
	listXiaofeiOrganizationEmailMirrorMetadata: vi.fn(),
	getXiaofeiOrganizationEmailMirrorDetail: vi.fn(),
	acceptMirroredEmailMessage: vi.fn(),
}));
vi.mock("@repo/ai", () => ({ runXiaofeiTurn: vi.fn() }));
vi.mock("./service", () => ({
	getOrCreatePublicXiaofeiWorkspace: vi.fn(),
	getOrCreateXiaofeiWorkspace: vi.fn(),
	getOrCreateXiaofeiWorkspaceByTenantKey: vi.fn(),
	getXiaofeiOrganizationId: vi.fn(),
	createKnowledgeWorkspaceBinding: vi.fn(),
}));

import { runXiaofeiTurn } from "@repo/ai";
import {
	getXiaofeiOrganizationConfigByExternalMerchantId,
	createXiaofeiCustomer,
	getXiaofeiCustomer,
	getXiaofeiConversation,
	updateXiaofeiCustomer,
	updateXiaofeiInboundEventStatus,
	listXiaofeiOrganizationEmailChannelBindings,
	listXiaofeiOrganizationEmailMirrorMetadata,
	getXiaofeiOrganizationEmailMirrorDetail,
	acceptMirroredEmailMessage,
} from "@repo/database";

import {
	channelEnvelopeSchema,
	ingestChannelEnvelope,
	runMockWorker,
	runMockEmailMirror,
	listEmailMirrorMetadata,
	getEmailMirrorDetail,
	isValidIngestApiKey,
	MAX_INBOUND_EVENT_BYTES,
	safeInboundHeaders,
} from "./integration-events";
import {
	getOrCreatePublicXiaofeiWorkspace,
	getOrCreateXiaofeiWorkspace,
	getOrCreateXiaofeiWorkspaceByTenantKey,
	getXiaofeiOrganizationId,
} from "./service";

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

describe("organization mock worker", () => {
	const context = { session: { activeOrganizationId: "org-a" }, user: { id: "user-a" } };
	const payload = {
		externalMerchantId: "merchant-a",
		externalCustomerId: "customer-a",
		channel: "email" as const,
		externalConversationId: "conversation-a",
		externalMessageId: "message-a",
		title: "Subject",
		text: "Body",
		direction: "inbound" as const,
		origin: "customer" as const,
	};
	beforeEach(() => {
		vi.clearAllMocks();
		const snapshot = createDefaultWorkspaceSnapshot("organization:org-a");
		vi.mocked(getOrCreateXiaofeiWorkspace).mockResolvedValue({
			workspace: { id: "workspace-a", tenantKey: "organization:org-a" },
		} as never);
		vi.mocked(getOrCreateXiaofeiWorkspaceByTenantKey).mockResolvedValue({
			workspace: { id: "workspace-a", tenantKey: "organization:org-a" },
			snapshot,
		} as never);
		vi.mocked(acceptInboundEvent).mockResolvedValue({
			kind: "created",
			event: { id: "event-a" },
		} as never);
		vi.mocked(getXiaofeiOrganizationConfigByExternalMerchantId).mockResolvedValue({
			organizationId: "org-a",
			xiaofeiEnabled: false,
		} as never);
		vi.mocked(getXiaofeiCustomer).mockResolvedValue({ id: "customer-row", name: "A" } as never);
		vi.mocked(updateXiaofeiCustomer).mockResolvedValue({ id: "customer-row", name: "A" } as never);
		vi.mocked(getXiaofeiConversation).mockResolvedValue(null);
	});
	it("fails closed for a merchant outside the active organization and records it", async () => {
		vi.mocked(getXiaofeiOrganizationConfigByExternalMerchantId).mockResolvedValue({
			organizationId: "org-b",
			xiaofeiEnabled: true,
		} as never);
		await expect(runMockWorker(context, payload)).resolves.toMatchObject({
			outcome: "merchant_unknown",
		});
		expect(updateXiaofeiInboundEventStatus).toHaveBeenCalledWith(
			"workspace-a",
			"event-a",
			expect.objectContaining({ status: "merchant_unknown" }),
		);
	});
	it("records disabled inbound without an AI turn", async () => {
		await expect(runMockWorker(context, payload)).resolves.toMatchObject({
			outcome: "ai_disabled",
		});
		expect(runXiaofeiTurn).not.toHaveBeenCalled();
		expect(updateXiaofeiInboundEventStatus).toHaveBeenCalledWith(
			"workspace-a",
			"event-a",
			expect.objectContaining({ status: "ai_disabled" }),
		);
		expect(updateXiaofeiCustomer).toHaveBeenCalledWith(
			"org-a",
			"customer-a",
			expect.objectContaining({ lastSeenAt: expect.any(Date) }),
		);
	});
	it("creates a missing customer for the resolved organization", async () => {
		vi.mocked(getXiaofeiCustomer).mockResolvedValue(null);
		vi.mocked(createXiaofeiCustomer).mockResolvedValue({ id: "customer-row", name: "A" } as never);
		await expect(runMockWorker(context, payload)).resolves.toMatchObject({
			outcome: "ai_disabled",
		});
		expect(createXiaofeiCustomer).toHaveBeenCalledWith(
			expect.objectContaining({
				organizationId: "org-a",
				externalCustomerId: "customer-a",
				lastSeenAt: expect.any(Date),
			}),
		);
	});
	it("does not run twice for a duplicate external message", async () => {
		vi.mocked(acceptInboundEvent).mockResolvedValue({
			kind: "duplicate",
			event: { id: "event-a" },
		} as never);
		await expect(runMockWorker(context, payload)).resolves.toMatchObject({ outcome: "duplicate" });
		expect(runXiaofeiTurn).not.toHaveBeenCalled();
	});
	it("runs the enabled worker once with the normalized email title and text", async () => {
		vi.mocked(getXiaofeiOrganizationConfigByExternalMerchantId).mockResolvedValue({
			organizationId: "org-a",
			xiaofeiEnabled: true,
		} as never);
		const state = createConversationState({
			id: "conversation-a",
			tenantId: "organization:org-a",
			agentId: "agent-a",
			maxFollowUps: 2,
		});
		vi.mocked(runXiaofeiTurn).mockResolvedValue({
			state,
			reply: "reply",
			metadata: { traces: [] },
		} as never);
		vi.mocked(acceptInboundEvent)
			.mockResolvedValueOnce({ kind: "created", event: { id: "event-a" } } as never)
			.mockResolvedValueOnce({ kind: "created", event: { id: "echo-event" } } as never);
		await expect(runMockWorker(context, payload)).resolves.toMatchObject({
			outcome: "mock_delivered",
		});
		expect(runXiaofeiTurn).toHaveBeenCalledTimes(1);
		expect(runXiaofeiTurn).toHaveBeenCalledWith(
			expect.objectContaining({ message: "Subject\n\nBody" }),
		);
		expect(runXiaofeiTurn).toHaveBeenCalledTimes(1);
		expect(updateXiaofeiInboundEventStatus).toHaveBeenCalledWith(
			"workspace-a",
			"echo-event",
			expect.objectContaining({ status: "echo_ignored" }),
		);
	});
	it("ignores an echoed Xiaofei source message without AI", async () => {
		await expect(
			runMockWorker(context, { ...payload, origin: "xiaofei", externalMessageId: "echo-a" }),
		).resolves.toMatchObject({ outcome: "echo_ignored" });
		expect(runXiaofeiTurn).not.toHaveBeenCalled();
	});
	it("marks unexpected worker failures as failed", async () => {
		vi.mocked(getXiaofeiCustomer).mockRejectedValue(new Error("database unavailable"));
		await expect(runMockWorker(context, payload)).rejects.toThrow("database unavailable");
		expect(updateXiaofeiInboundEventStatus).toHaveBeenCalledWith(
			"workspace-a",
			"event-a",
			expect.objectContaining({ status: "failed" }),
		);
	});
	it("rejects a reused conversation bound to another customer or channel", async () => {
		vi.mocked(getXiaofeiConversation).mockResolvedValue({
			customerId: "customer-b",
			channel: "whatsapp",
		} as never);
		await expect(runMockWorker(context, payload)).resolves.toMatchObject({
			outcome: "conversation_conflict",
		});
		expect(updateXiaofeiInboundEventStatus).toHaveBeenCalledWith(
			"workspace-a",
			"event-a",
			expect.objectContaining({ status: "conversation_conflict" }),
		);
	});
});

describe("email mirror mock tenant boundary", () => {
	const context = { session: { activeOrganizationId: "org-a" }, user: { id: "user-a" } };
	const input = {
		companyId: "company-a",
		channelAccountId: "account-a",
		address: "support@example.com",
		externalConversationId: "email:company-a:pair",
		eventId: "email:company-a:1",
		scenario: "inbound_customer" as const,
		text: "hello",
	};
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(getXiaofeiOrganizationId).mockResolvedValue("org-a");
		vi.mocked(getOrCreateXiaofeiWorkspace).mockResolvedValue({
			workspace: { id: "workspace-a" },
		} as never);
		vi.mocked(acceptMirroredEmailMessage).mockResolvedValue({
			status: "accepted",
			conversationId: "c",
			messageId: "m",
			jobId: "j",
		} as never);
	});
	it("rejects a foreign or fabricated binding before persistence", async () => {
		vi.mocked(listXiaofeiOrganizationEmailChannelBindings).mockResolvedValue([
			{
				companyId: "company-b",
				channelAccountId: "account-b",
				address: "other@example.com",
				status: "active",
			},
		] as never);
		await expect(runMockEmailMirror(context, input)).rejects.toThrow();
		expect(acceptMirroredEmailMessage).not.toHaveBeenCalled();
	});
	it("uses only the active Organization exact binding and never invokes AI", async () => {
		vi.mocked(listXiaofeiOrganizationEmailChannelBindings).mockResolvedValue([
			{
				companyId: input.companyId,
				channelAccountId: input.channelAccountId,
				address: input.address,
				status: "active",
			},
		] as never);
		await runMockEmailMirror(context, input);
		expect(getOrCreateXiaofeiWorkspace).toHaveBeenCalledWith(context);
		expect(acceptMirroredEmailMessage).toHaveBeenCalledOnce();
		expect(runXiaofeiTurn).not.toHaveBeenCalled();
	});
	it("initializes a new Organization workspace before metadata list and detail reads", async () => {
		vi.mocked(listXiaofeiOrganizationEmailMirrorMetadata).mockResolvedValue([] as never);
		vi.mocked(getXiaofeiOrganizationEmailMirrorDetail).mockResolvedValue(null as never);

		await expect(listEmailMirrorMetadata(context)).resolves.toEqual([]);
		await expect(getEmailMirrorDetail(context, "event-a")).resolves.toBeNull();

		expect(getOrCreateXiaofeiWorkspace).toHaveBeenCalledTimes(2);
		expect(listXiaofeiOrganizationEmailMirrorMetadata).toHaveBeenCalledWith("org-a");
		expect(getXiaofeiOrganizationEmailMirrorDetail).toHaveBeenCalledWith("org-a", "event-a");
	});
});
