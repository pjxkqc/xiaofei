import { call } from "@orpc/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	commit: vi.fn(),
	getSession: vi.fn(),
	getWorkspace: vi.fn(),
	loadActive: vi.fn(),
	runTurn: vi.fn(),
	upsert: vi.fn(),
	verifyMembership: vi.fn(),
}));

vi.mock("@repo/ai", () => ({ runXiaofeiTurn: mocks.runTurn }));
vi.mock("@repo/auth", () => ({ auth: { api: { getSession: mocks.getSession } } }));
vi.mock("@repo/database", () => ({
	XiaofeiSyntheticSupportCommitConflictError: class extends Error {
		constructor(organizationId: string, externalId: string) {
			super(`Synthetic Support changed: ${organizationId}/${externalId}`);
		}
	},
	commitXiaofeiSyntheticSupportConversation: mocks.commit,
	getXiaofeiWorkspace: mocks.getWorkspace,
	loadXiaofeiRuntimeHostingCapability: mocks.loadActive,
	upsertXiaofeiSyntheticSupportConversation: mocks.upsert,
}));
vi.mock("../../organizations/lib/membership", () => ({
	verifyOrganizationMembership: mocks.verifyMembership,
}));

import {
	XiaofeiSyntheticSupportCommitConflictError,
	type CommitXiaofeiSyntheticSupportConversationInput,
	type UpsertXiaofeiSyntheticSupportConversationInput,
} from "@repo/database";
import {
	createCapabilityVersionManifest,
	createConversationState,
	createDefaultWorkspaceSnapshot,
	createKnowledgeUnitRevision,
	type ConversationState,
	type SupportMessage,
	type TraceEvent,
} from "@repo/xiaofei";

import { sendSyntheticSupportMessage, syntheticSupportConversationId } from "./acceptance";

interface SyntheticRow {
	externalId: string;
	channel: "synthetic_support";
	state: ConversationState;
	messages: SupportMessage[];
	traceEvents: TraceEvent[];
	revision: number;
	ownerType: ConversationState["ownerType"];
	ownerEpoch: number;
	syntheticAcceptance?: unknown;
}

const ORGANIZATION_A = "organization-a";
const ORGANIZATION_B = "organization-b";

describe("synthetic support acceptance procedure", () => {
	let rows: Map<string, SyntheticRow>;
	let committedStates: ConversationState[];
	let selectedOrganizationId: string;

	beforeEach(() => {
		vi.resetAllMocks();
		vi.stubEnv("VERCEL_ENV", "preview");
		vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "a".repeat(40));
		rows = new Map();
		committedStates = [];
		selectedOrganizationId = ORGANIZATION_A;
		mocks.getSession.mockImplementation(async ({ headers }: { headers: Headers }) => ({
			session: { activeOrganizationId: headers.get("x-organization") ?? selectedOrganizationId },
			user: { id: "support-user", role: "user" },
		}));
		mocks.verifyMembership.mockResolvedValue({ role: "owner" });
		mocks.getWorkspace.mockImplementation(async (tenantKey: string) => ({
			id: `workspace:${tenantKey}`,
			tenantKey,
			snapshot: createDefaultWorkspaceSnapshot(tenantKey),
		}));
		mocks.loadActive.mockImplementation(async (organizationId: string) => {
			const knowledgeUnit = createDefaultWorkspaceSnapshot(`organization:${organizationId}`)
				.knowledgeUnits[0]!;
			const revision = createKnowledgeUnitRevision({
				id: `revision:${organizationId}`,
				logicalKnowledgeUnitId: knowledgeUnit.id,
				organizationId: null,
				revision: 1,
				origin: "platform",
				knowledgeUnit,
				createdAt: "2026-01-01T00:00:00.000Z",
			});
			return {
				manifest: createCapabilityVersionManifest({
					id: `active:${organizationId}`,
					organizationId,
					capabilityKey: "xiaofei-hosting",
					status: "active",
					knowledgeUnitRevisionIds: [revision.id],
					createdAt: "2026-01-01T00:00:00.000Z",
				}),
				revisions: [revision],
			};
		});
		mocks.upsert.mockImplementation(
			async (input: UpsertXiaofeiSyntheticSupportConversationInput) => {
				const current = rows.get(rowKey(input.organizationId, input.externalId));
				if (current) return snapshot(current);
				const state = input.state as ConversationState;
				const row: SyntheticRow = {
					externalId: input.externalId,
					channel: "synthetic_support",
					state,
					messages: input.messages as SupportMessage[],
					traceEvents: input.traceEvents as TraceEvent[],
					revision: 0,
					ownerType: state.ownerType,
					ownerEpoch: state.ownerEpoch,
					syntheticAcceptance: input.syntheticAcceptance,
				};
				rows.set(rowKey(input.organizationId, input.externalId), row);
				return snapshot(row);
			},
		);
		mocks.commit.mockImplementation(
			async (input: CommitXiaofeiSyntheticSupportConversationInput) => {
				const key = rowKey(input.organizationId, input.externalId);
				const current = rows.get(key);
				if (
					!current ||
					current.revision !== input.expectedRevision ||
					current.ownerType !== input.expectedOwnerType ||
					current.ownerEpoch !== input.expectedOwnerEpoch
				)
					throw new XiaofeiSyntheticSupportCommitConflictError(
						input.organizationId,
						input.externalId,
					);
				const state = input.state as ConversationState;
				const updated: SyntheticRow = {
					...current,
					state,
					messages: input.messages as SupportMessage[],
					traceEvents: input.traceEvents as TraceEvent[],
					revision: current.revision + 1,
					ownerType: state.ownerType,
					ownerEpoch: state.ownerEpoch,
				};
				rows.set(key, updated);
				committedStates.push(structuredClone(state));
				return snapshot(updated);
			},
		);
		mocks.runTurn.mockImplementation(async ({ state }: { state: ConversationState }) => ({
			state: {
				...state,
				remainingFollowUps: state.remainingFollowUps - 1,
			},
			reply: `reply:${state.id}:${state.ownerEpoch}`,
			metadata: { traces: [] },
		}));
	});

	afterEach(() => vi.unstubAllEnvs());

	it("uses one stable, opaque Inbox identity for every turn", () => {
		expect(syntheticSupportConversationId("acceptance-42")).toBe("synthetic:acceptance-42");
		expect(syntheticSupportConversationId("acceptance-42")).toBe(
			syntheticSupportConversationId("acceptance-42"),
		);
	});

	it("fails closed without an exact Preview head before creating a conversation", async () => {
		vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "not-a-head");
		await expect(send("missing-head", "hello", ORGANIZATION_A)).rejects.toMatchObject({
			code: "BAD_REQUEST",
		});
		expect(mocks.upsert).not.toHaveBeenCalled();
		expect(mocks.runTurn).not.toHaveBeenCalled();
	});

	it("server-authors non-deliverable audit metadata for the selected Organization", async () => {
		await send("audited", "hello", ORGANIZATION_A);
		expect(mocks.upsert).toHaveBeenCalledWith(
			expect.objectContaining({
				organizationId: ORGANIZATION_A,
				syntheticAcceptance: expect.objectContaining({
					organizationId: ORGANIZATION_A,
					createdByUserId: "support-user",
					deploymentEnvironment: "preview",
					previewHeadSha: "a".repeat(40),
					allowExternalDelivery: false,
				}),
			}),
		);
	});

	it("materializes before AI and commits three continued turns with the captured AI lease", async () => {
		const externalId = "continued";
		for (const text of ["one", "two", "three"]) await send(externalId, text, ORGANIZATION_A);

		const id = syntheticSupportConversationId(externalId);
		const row = rows.get(rowKey(ORGANIZATION_A, id));
		expect(mocks.upsert).toHaveBeenCalledBefore(mocks.runTurn);
		expect(mocks.commit).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({
				organizationId: ORGANIZATION_A,
				externalId: id,
				expectedRevision: 0,
				expectedOwnerType: "ai",
				expectedOwnerEpoch: 0,
			}),
		);
		expect(mocks.runTurn.mock.calls[0]?.[0].state).toMatchObject({
			id,
			tenantId: `organization:${ORGANIZATION_A}`,
			ownerType: "ai",
			ownerEpoch: 0,
		});
		expect(mocks.runTurn.mock.calls.map(([input]) => input.state.remainingFollowUps)).toEqual([
			5, 4, 3,
		]);
		expect(committedStates.map((state) => state.remainingFollowUps)).toEqual([4, 3, 2]);
		expect(mocks.runTurn.mock.calls[1]?.[0].state).toEqual(committedStates[0]);
		expect(mocks.runTurn.mock.calls[2]?.[0].state).toEqual(committedStates[1]);
		expect(mocks.commit.mock.calls.map(([input]) => input.expectedRevision)).toEqual([0, 1, 2]);
		expect(row).toMatchObject({ revision: 3, ownerType: "ai", ownerEpoch: 0 });
		expect(row?.messages.map((message) => message.role)).toEqual([
			"customer",
			"ai",
			"customer",
			"ai",
			"customer",
			"ai",
		]);
		expect(mocks.loadActive).toHaveBeenCalledWith(ORGANIZATION_A, "active");
	});

	it("appends a human-owned customer message without invoking AI and preserves its lease", async () => {
		const id = syntheticSupportConversationId("human-owned");
		const state = {
			...createState(id, ORGANIZATION_A),
			ownerType: "human" as const,
			ownerEpoch: 7,
		};
		rows.set(rowKey(ORGANIZATION_A, id), {
			externalId: id,
			channel: "synthetic_support",
			state,
			messages: [],
			traceEvents: [],
			revision: 4,
			ownerType: "human",
			ownerEpoch: 7,
		});

		await send("human-owned", "please help", ORGANIZATION_A);

		expect(mocks.runTurn).not.toHaveBeenCalled();
		expect(mocks.commit).toHaveBeenCalledWith(
			expect.objectContaining({
				expectedRevision: 4,
				expectedOwnerType: "human",
				expectedOwnerEpoch: 7,
			}),
		);
		expect(rows.get(rowKey(ORGANIZATION_A, id))?.messages).toHaveLength(1);
	});

	it("maps a takeover after model work to CONFLICT and never commits the stale reply", async () => {
		mocks.runTurn.mockImplementationOnce(async ({ state }: { state: ConversationState }) => {
			const key = rowKey(ORGANIZATION_A, state.id);
			const current = rows.get(key)!;
			rows.set(key, { ...current, ownerType: "human", ownerEpoch: current.ownerEpoch + 1 });
			return { state, reply: "stale reply", metadata: { traces: [] } };
		});

		await expect(send("takeover", "need help", ORGANIZATION_A)).rejects.toMatchObject({
			code: "CONFLICT",
		});
		expect(mocks.commit).toHaveBeenCalledTimes(1);
		expect(
			rows.get(rowKey(ORGANIZATION_A, syntheticSupportConversationId("takeover")))?.messages,
		).toEqual([]);
	});

	it("allows at most one same-revision turn to commit and scopes each call to its server-selected Organization", async () => {
		let releaseFirstCommit: (() => void) | undefined;
		const firstCommitStarted = new Promise<void>((resolve) => {
			releaseFirstCommit = resolve;
		});
		const commit = mocks.commit.getMockImplementation()!;
		mocks.commit.mockImplementationOnce(
			async (input: CommitXiaofeiSyntheticSupportConversationInput) => {
				await firstCommitStarted;
				return await commit(input);
			},
		);

		const first = send("race", "first", ORGANIZATION_A);
		await vi.waitFor(() => expect(mocks.commit).toHaveBeenCalledTimes(1));
		const second = send("race", "second", ORGANIZATION_A);
		await vi.waitFor(() => expect(mocks.commit).toHaveBeenCalledTimes(2));
		releaseFirstCommit?.();
		const outcomes = await Promise.allSettled([first, second]);
		expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
		expect(outcomes.filter((outcome) => outcome.status === "rejected")).toHaveLength(1);
		expect(outcomes.find((outcome) => outcome.status === "rejected")).toMatchObject({
			reason: { code: "CONFLICT" },
		});
		expect(
			rows.get(rowKey(ORGANIZATION_A, syntheticSupportConversationId("race")))?.messages,
		).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ role: "customer", text: "second" }),
				expect.objectContaining({ role: "ai" }),
			]),
		);
		expect(
			rows.get(rowKey(ORGANIZATION_A, syntheticSupportConversationId("race")))?.messages,
		).toHaveLength(2);

		await send("tenant", "a", ORGANIZATION_A);
		await send("tenant", "b", ORGANIZATION_B);
		expect(mocks.loadActive).toHaveBeenCalledWith(ORGANIZATION_A, "active");
		expect(mocks.loadActive).toHaveBeenCalledWith(ORGANIZATION_B, "active");
		expect(mocks.upsert).toHaveBeenCalledWith(
			expect.objectContaining({ organizationId: ORGANIZATION_A }),
		);
		expect(mocks.upsert).toHaveBeenCalledWith(
			expect.objectContaining({ organizationId: ORGANIZATION_B }),
		);
		expect(mocks.commit).toHaveBeenCalledWith(
			expect.objectContaining({ organizationId: ORGANIZATION_A }),
		);
		expect(mocks.commit).toHaveBeenCalledWith(
			expect.objectContaining({ organizationId: ORGANIZATION_B }),
		);
	});

	function send(externalId: string, text: string, organizationId: string) {
		return call(
			sendSyntheticSupportMessage,
			{ externalId, text },
			{ context: { headers: new Headers({ "x-organization": organizationId }) } },
		);
	}
});

function createState(id: string, organizationId: string): ConversationState {
	return createConversationState({
		id,
		tenantId: `organization:${organizationId}`,
		agentId: "xiaofei-customer-service",
		maxFollowUps: 5,
	});
}

function rowKey(organizationId: string, externalId: string) {
	return `${organizationId}:${externalId}`;
}

function snapshot(row: SyntheticRow): SyntheticRow {
	return structuredClone(row);
}
