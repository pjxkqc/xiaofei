import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	getConversation: vi.fn(),
	listConversations: vi.fn(),
	runTurn: vi.fn(),
	touchConversation: vi.fn(),
	updateConversation: vi.fn(),
	upsertConversation: vi.fn(),
	getPublicWorkspace: vi.fn(),
	getWorkspace: vi.fn(),
}));

vi.mock("@repo/ai", () => ({ runXiaofeiTurn: mocks.runTurn }));
vi.mock("@repo/database", () => ({
	getXiaofeiConversation: mocks.getConversation,
	listXiaofeiConversations: mocks.listConversations,
	touchXiaofeiSupportConversation: mocks.touchConversation,
	updateXiaofeiSupportConversation: mocks.updateConversation,
	upsertXiaofeiSupportConversation: mocks.upsertConversation,
	XiaofeiSupportConversationConflictError: class XiaofeiSupportConversationConflictError extends Error {},
}));
vi.mock("./service", async (importOriginal) => ({
	...(await importOriginal<typeof import("./service")>()),
	createKnowledgeWorkspaceBinding: vi.fn(() => ({ tenantId: "channel:public-support" })),
	getOrCreatePublicXiaofeiWorkspace: mocks.getPublicWorkspace,
	getOrCreateXiaofeiWorkspace: mocks.getWorkspace,
}));

import { XiaofeiSupportConversationConflictError } from "@repo/database";
import {
	createConversationState,
	createDefaultWorkspaceSnapshot,
	transferConversationOwner,
} from "@repo/xiaofei";

import {
	getPublicSupportConversation,
	sendHumanSupportMessage,
	sendPublicSupportMessage,
	setSupportConversationOwner,
} from "./support-service";

const workspace = { id: "workspace-a", tenantKey: "channel:public-support" };
const snapshot = createDefaultWorkspaceSnapshot(workspace.tenantKey);

describe("Support/Inbox semantic CAS", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		mocks.getPublicWorkspace.mockResolvedValue({ workspace, snapshot });
		mocks.getWorkspace.mockResolvedValue({ workspace, snapshot });
	});

	it("does not let an AI reply commit after Inbox takeover changed the captured lease", async () => {
		const record = conversationRecord();
		mocks.getConversation.mockResolvedValue(record);
		mocks.runTurn.mockResolvedValue({
			state: record.state,
			reply: "stale AI reply",
			metadata: { traces: [] },
		});
		mocks.updateConversation.mockRejectedValue(
			new XiaofeiSupportConversationConflictError(workspace.id, record.externalId),
		);

		await expect(
			sendPublicSupportMessage(record.externalId, "need help", expectation(record)),
		).rejects.toMatchObject({ code: "CONFLICT" });
		expect(mocks.updateConversation).toHaveBeenCalledWith(
			workspace.id,
			record.externalId,
			expectation(record),
			expect.objectContaining({
				messages: expect.arrayContaining([
					expect.objectContaining({ role: "customer", text: "need help" }),
					expect.objectContaining({ role: "ai", text: "stale AI reply" }),
				]),
			}),
		);
	});

	it("does not let a human reply overwrite a concurrent return to AI", async () => {
		const aiState = conversationRecord().state;
		const state = transferConversationOwner(aiState, aiState.ownerEpoch, "human");
		const record = conversationRecord({ revision: 2, ownerType: "human", ownerEpoch: 1, state });
		mocks.getConversation.mockResolvedValue(record);
		mocks.updateConversation.mockRejectedValue(
			new XiaofeiSupportConversationConflictError(workspace.id, record.externalId),
		);

		await expect(
			sendHumanSupportMessage({
				context: authContext(),
				externalId: record.externalId,
				text: "human answer",
				user: { id: "agent-a", name: "Agent A" },
				expectation: expectation(record),
			}),
		).rejects.toMatchObject({ code: "CONFLICT" });
	});

	it("transfers ownership with the exact loaded revision and owner tuple", async () => {
		const record = conversationRecord();
		mocks.getConversation.mockResolvedValue(record);
		mocks.updateConversation.mockImplementation(
			async (_workspaceId, _externalId, _expectation, data) => ({
				...record,
				...data,
				revision: 2,
				ownerType: "human",
				ownerEpoch: 1,
			}),
		);

		await expect(
			setSupportConversationOwner({
				context: authContext(),
				externalId: record.externalId,
				owner: "human",
				user: { id: "agent-a", name: "Agent A" },
				expectation: expectation(record),
			}),
		).resolves.toMatchObject({ ownerType: "human", ownerEpoch: 1, revision: 2 });
		expect(mocks.updateConversation).toHaveBeenCalledWith(
			workspace.id,
			record.externalId,
			expectation(record),
			expect.objectContaining({ assignedUserId: "agent-a" }),
		);
	});

	it("keeps a presence heartbeat outside the semantic revision path", async () => {
		const record = conversationRecord();
		mocks.getConversation.mockResolvedValue(record);
		mocks.touchConversation.mockResolvedValue(record);

		await getPublicSupportConversation(record.externalId);

		expect(mocks.touchConversation).toHaveBeenCalledWith(
			workspace.id,
			record.externalId,
			expect.any(Date),
		);
		expect(mocks.updateConversation).not.toHaveBeenCalled();
	});

	it("repairs a legacy null owner projection through the exact raw tuple", async () => {
		const record = { ...conversationRecord(), ownerType: null, ownerEpoch: null };
		mocks.getConversation.mockResolvedValue(record);
		mocks.runTurn.mockResolvedValue({
			state: record.state,
			reply: "safe reply",
			metadata: { traces: [] },
		});
		mocks.updateConversation.mockImplementation(
			async (_workspaceId, _externalId, _expectation, data) => ({
				...record,
				...data,
				revision: 2,
				ownerType: "ai",
				ownerEpoch: 0,
			}),
		);

		await sendPublicSupportMessage(record.externalId, "hello", {
			expectedRevision: 1,
			expectedOwnerType: "ai",
			expectedOwnerEpoch: 0,
		});

		expect(mocks.updateConversation).toHaveBeenCalledWith(
			workspace.id,
			record.externalId,
			{ expectedRevision: 1, expectedOwnerType: null, expectedOwnerEpoch: null },
			expect.any(Object),
		);
	});
});

function conversationRecord(overrides: Partial<ReturnType<typeof baseConversationRecord>> = {}) {
	return { ...baseConversationRecord(), ...overrides };
}

function baseConversationRecord() {
	const now = new Date("2026-08-06T00:00:00.000Z");
	const state = createConversationState({
		id: "conversation-a",
		tenantId: workspace.tenantKey,
		agentId: snapshot.agent.id,
		maxFollowUps: snapshot.agent.maxFollowUps,
	});
	return {
		id: "row-a",
		workspaceId: workspace.id,
		externalId: state.id,
		customerId: null,
		channel: "public_support",
		customerName: "Visitor",
		status: "open",
		assignedUserId: null,
		assignedUserName: null,
		revision: 1,
		ownerType: state.ownerType,
		ownerEpoch: state.ownerEpoch,
		state,
		messages: [],
		traceEvents: [],
		syntheticAcceptance: null,
		lastCustomerSeenAt: now,
		lastMessageAt: now,
		createdAt: now,
		updatedAt: now,
		processingJobs: [],
		outboundDeliveries: [],
	};
}

function expectation(record: ReturnType<typeof baseConversationRecord>) {
	return {
		expectedRevision: record.revision,
		expectedOwnerType: record.ownerType,
		expectedOwnerEpoch: record.ownerEpoch,
	};
}

function authContext() {
	return {
		session: { activeOrganizationId: "organization-a" },
		user: { id: "agent-a" },
	};
}
