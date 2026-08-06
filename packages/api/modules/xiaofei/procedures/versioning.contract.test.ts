import { call } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	applyFeedback: vi.fn(),
	createCapability: vi.fn(),
	createRevision: vi.fn(),
	createSession: vi.fn(),
	createTurn: vi.fn(),
	createRerun: vi.fn(),
	getDetail: vi.fn(),
	getBinding: vi.fn(),
	getConfig: vi.fn(),
	getSession: vi.fn(),
	getRuntimeState: vi.fn(),
	getWorkspace: vi.fn(),
	listKnowledge: vi.fn(),
	listSessions: vi.fn(),
	loadCapability: vi.fn(),
	runTurn: vi.fn(),
	setTestVersion: vi.fn(),
	verifyMembership: vi.fn(),
}));

vi.mock("@repo/ai", () => ({ runXiaofeiTestTurn: mocks.runTurn }));
vi.mock("@repo/auth", () => ({ auth: { api: { getSession: mocks.getSession } } }));
vi.mock("@repo/database", () => ({
	XiaofeiTestSessionCapabilityConflictError: class extends Error {},
	XiaofeiTestSessionConflictError: class extends Error {},
	XiaofeiTestCapabilityConflictError: class extends Error {
		readonly code = "TEST_CA_VERSION_CONFLICT";
		constructor(
			readonly organizationId: string,
			readonly expectedCapabilityVersionId: string,
			readonly currentCapabilityVersionId: string | null = null,
		) {
			super("Test capability changed.");
		}
	},
	XiaofeiTestTurnFeedbackConflictError: class extends Error {},
	XiaofeiVersioningNotFoundError: class extends Error {},
	applyXiaofeiTestTurnFeedback: mocks.applyFeedback,
	createXiaofeiCapabilityVersion: mocks.createCapability,
	createXiaofeiKnowledgeUnitRevision: mocks.createRevision,
	createXiaofeiTestSession: mocks.createSession,
	createXiaofeiTestTurn: mocks.createTurn,
	createXiaofeiTestTurnRerun: mocks.createRerun,
	getXiaofeiOrganizationConfig: mocks.getConfig,
	getXiaofeiOrganizationHostingBinding: mocks.getBinding,
	getXiaofeiVersioningOverviewData: vi.fn(),
	getXiaofeiTestSessionDetail: mocks.getDetail,
	getXiaofeiTestSessionRuntimeState: mocks.getRuntimeState,
	getXiaofeiWorkspace: mocks.getWorkspace,
	listXiaofeiKnowledgeUnits: mocks.listKnowledge,
	listXiaofeiKnowledgeUnitRevisions: vi.fn(),
	listXiaofeiTestSessions: mocks.listSessions,
	loadXiaofeiRuntimeHostingCapability: mocks.loadCapability,
	setXiaofeiOrganizationTestHostingVersion: mocks.setTestVersion,
	upsertXiaofeiOrganizationConfig: vi.fn(),
}));
vi.mock("../../organizations/lib/membership", () => ({
	verifyOrganizationMembership: mocks.verifyMembership,
}));

import {
	XiaofeiTestCapabilityConflictError,
	XiaofeiTestSessionCapabilityConflictError,
} from "@repo/database";
import { createConversationState, createDefaultWorkspaceSnapshot } from "@repo/xiaofei";

import {
	applyXiaofeiTestTurnCorrection,
	getXiaofeiTestSessionProcedure,
	initializeXiaofeiVersioning,
	listXiaofeiTestSessionsProcedure,
	newXiaofeiTestSession,
	resumeXiaofeiTestSession,
	runXiaofeiVersionedTest,
} from "./versioning";

const ORGANIZATION_A = "organization-a";
const ORGANIZATION_B = "organization-b";
const TEST_VERSION = "test-version";

describe("Xiaofei Test CA persistent-session procedures", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		mocks.getSession.mockImplementation(async ({ headers }: { headers: Headers }) => ({
			session: { activeOrganizationId: headers.get("x-organization") },
			user: { id: "support-user", role: "user" },
		}));
		mocks.verifyMembership.mockResolvedValue({ role: "owner" });
		mocks.getWorkspace.mockImplementation(async (tenantKey: string) => ({
			id: `workspace:${tenantKey}`,
			tenantKey,
			snapshot: createDefaultWorkspaceSnapshot(tenantKey),
		}));
		mocks.loadCapability.mockImplementation(async () => ({
			manifest: { id: TEST_VERSION },
			revisions: [],
		}));
		mocks.getBinding.mockResolvedValue({ testCapabilityVersionId: TEST_VERSION });
		mocks.getConfig.mockResolvedValue(null);
		mocks.getRuntimeState.mockResolvedValue({
			capabilityVersionId: TEST_VERSION,
			latestTestTurnId: null,
			conversationState: null,
		});
	});

	it("creates a zero-turn session through the exported procedure and reads it back without duplicates", async () => {
		const sessions = new Map<string, { id: string; capabilityVersionId: string }>();
		mocks.loadCapability.mockResolvedValue({ manifest: { id: TEST_VERSION }, revisions: [] });
		mocks.createSession.mockImplementation(
			async (_organizationId: string, input: { id: string; capabilityVersionId: string }) => {
				const existing = sessions.get(input.id);
				if (existing) return existing;
				const session = { id: input.id, capabilityVersionId: input.capabilityVersionId };
				sessions.set(input.id, session);
				return session;
			},
		);
		mocks.listSessions.mockImplementation(async (organizationId: string) => ({
			items: [...sessions.values()].map((session) => ({
				...session,
				firstQuestion: "",
				latestAt: new Date("2026-08-06T00:00:00.000Z"),
				turnCount: 0,
				beforeInterventionCount: 0,
				afterInterventionCount: 0,
				isCurrent: organizationId === ORGANIZATION_A,
				writable: organizationId === ORGANIZATION_A,
			})),
			nextCursor: null,
		}));

		const created = await call(newXiaofeiTestSession, undefined, request(ORGANIZATION_A));
		const firstList = await call(
			listXiaofeiTestSessionsProcedure,
			undefined,
			request(ORGANIZATION_A),
		);
		const refreshedList = await call(
			listXiaofeiTestSessionsProcedure,
			undefined,
			request(ORGANIZATION_A),
		);

		expect(created).toMatchObject({ capabilityVersionId: TEST_VERSION });
		expect(firstList).toEqual(refreshedList);
		expect(firstList.items).toEqual([
			expect.objectContaining({
				id: created.testSessionId,
				firstQuestion: "",
				turnCount: 0,
				writable: true,
			}),
		]);
		expect(mocks.createSession).toHaveBeenCalledTimes(1);
	});

	it("continues from the persisted prior state and keeps stale or foreign sessions fail-closed", async () => {
		const sessionId = "session-a";
		const savedTurns: Array<{ id: string; conversationState: object }> = [];
		mocks.getBinding.mockResolvedValue({ testCapabilityVersionId: TEST_VERSION });
		mocks.createTurn.mockImplementation(
			async (
				_organizationId: string,
				input: { expectedPreviousTestTurnId: string | null; conversationState: object },
			) => {
				expect(input.expectedPreviousTestTurnId).toBe(
					savedTurns[savedTurns.length - 1]?.id ?? null,
				);
				const turn = {
					id: `turn-${savedTurns.length + 1}`,
					conversationState: input.conversationState,
				};
				savedTurns.push(turn);
				return turn;
			},
		);
		mocks.runTurn.mockImplementation(
			async ({ state }: { state: { remainingFollowUps: number } }) => ({
				state: { ...state, remainingFollowUps: state.remainingFollowUps - 1 },
				reply: "saved answer",
				metadata: { knowledgeEvidence: null, traces: [] },
			}),
		);
		mocks.getBinding.mockResolvedValue({ testCapabilityVersionId: TEST_VERSION });
		const runtimeState = () => ({
			capabilityVersionId: TEST_VERSION,
			latestTestTurnId: savedTurns[savedTurns.length - 1]?.id ?? null,
			conversationState: savedTurns[savedTurns.length - 1]?.conversationState ?? null,
		});
		mocks.getRuntimeState.mockImplementation(async (organizationId: string, id: string) =>
			organizationId === ORGANIZATION_A && id === sessionId ? runtimeState() : null,
		);

		for (const question of ["one", "two", "three"])
			await call(
				runXiaofeiVersionedTest,
				{ testSessionId: sessionId, capabilityVersionId: TEST_VERSION, question },
				request(ORGANIZATION_A),
			);

		expect(mocks.runTurn.mock.calls.map(([input]) => input.state.remainingFollowUps)).toEqual([
			5, 4, 3,
		]);
		expect(savedTurns).toHaveLength(3);
		await expect(
			call(getXiaofeiTestSessionProcedure, { testSessionId: sessionId }, request(ORGANIZATION_B)),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
	});

	it("returns a stable typed conflict before running a stale Test CA session", async () => {
		mocks.getRuntimeState.mockResolvedValueOnce({
			capabilityVersionId: "old-test-ca",
			latestTestTurnId: null,
			conversationState: null,
		});
		mocks.loadCapability.mockResolvedValueOnce({
			manifest: { id: "current-test-ca" },
			revisions: [],
		});

		await expect(
			call(
				runXiaofeiVersionedTest,
				{
					testSessionId: "historic-session",
					capabilityVersionId: "old-test-ca",
					question: "Can this old session continue?",
				},
				request(ORGANIZATION_A),
			),
		).rejects.toMatchObject({
			code: "CONFLICT",
			data: {
				code: "TEST_CA_VERSION_CONFLICT",
				expectedCapabilityVersionId: "old-test-ca",
				currentCapabilityVersionId: "current-test-ca",
			},
		});
		expect(mocks.runTurn).not.toHaveBeenCalled();
		expect(mocks.createTurn).not.toHaveBeenCalled();
	});

	it("reports the current Test CA when the pointer moves during the model run", async () => {
		mocks.runTurn.mockResolvedValueOnce({
			state: createConversationState({
				id: "session-a",
				tenantId: "organization:organization-a",
				agentId: "agent-a",
				maxFollowUps: 5,
			}),
			reply: "stale answer",
			metadata: { knowledgeEvidence: null, traces: [] },
		});
		mocks.createTurn.mockRejectedValueOnce(
			new XiaofeiTestSessionCapabilityConflictError(ORGANIZATION_A, "session-a"),
		);
		mocks.getBinding.mockResolvedValueOnce({ testCapabilityVersionId: "current-test-ca" });

		await expect(
			call(
				runXiaofeiVersionedTest,
				{
					testSessionId: "session-a",
					capabilityVersionId: TEST_VERSION,
					question: "Did the pointer move while the model was running?",
				},
				request(ORGANIZATION_A),
			),
		).rejects.toMatchObject({
			code: "CONFLICT",
			data: {
				code: "TEST_CA_VERSION_CONFLICT",
				expectedCapabilityVersionId: TEST_VERSION,
				currentCapabilityVersionId: "current-test-ca",
			},
		});
		expect(mocks.runTurn).toHaveBeenCalledTimes(1);
		expect(mocks.getBinding).toHaveBeenCalledWith(ORGANIZATION_A);
	});

	it("keeps Active unchanged while a new Test CA makes old sessions read-only", async () => {
		const releasedKnowledge = {
			id: "knowledge-a",
			status: "released",
			eligibility: "eligible",
			content: {
				id: "knowledge-a",
				status: "released",
				title: "Shipping",
				standardReplyPolicy: "Ship in two days.",
				fallbackReply: "Contact support.",
				sourceSection: "FAQ",
				quality: { status: "passed" },
			},
		};
		mocks.listKnowledge.mockResolvedValue([releasedKnowledge]);
		mocks.createRevision.mockResolvedValue({ id: "merchant-revision" });
		mocks.createCapability
			.mockResolvedValueOnce({ id: "platform-ca" })
			.mockResolvedValueOnce({ id: "merchant-ca" })
			.mockResolvedValueOnce({ id: "new-test-ca" });
		mocks.getDetail.mockResolvedValue({
			id: "historic-session",
			capabilityVersionId: "old-test-ca",
			writable: false,
			turns: [{ id: "turn-1" }],
		});

		await call(initializeXiaofeiVersioning, undefined, request(ORGANIZATION_A));
		await expect(
			call(
				resumeXiaofeiTestSession,
				{ testSessionId: "historic-session" },
				request(ORGANIZATION_A),
			),
		).rejects.toMatchObject({
			code: "CONFLICT",
			data: {
				code: "TEST_CA_VERSION_CONFLICT",
				expectedCapabilityVersionId: "old-test-ca",
				currentCapabilityVersionId: TEST_VERSION,
			},
		});

		expect(mocks.setTestVersion).toHaveBeenCalledWith(ORGANIZATION_A, "new-test-ca", TEST_VERSION);
		expect(mocks.setTestVersion).not.toHaveBeenCalledWith(ORGANIZATION_A, "active-ca");
	});

	it("enforces owner-only correction before invoking the durable feedback service", async () => {
		mocks.verifyMembership.mockResolvedValue({ role: "member" });

		await expect(
			call(
				applyXiaofeiTestTurnCorrection,
				{
					sourceTestTurnId: "clx9xow740000qwerty123456",
					testSessionId: "session-a",
					capabilityVersionId: "clx9xow740001qwerty123456",
					correction: "Use the corrected policy.",
				},
				request(ORGANIZATION_A),
			),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		expect(mocks.applyFeedback).not.toHaveBeenCalled();
	});

	it("returns a safe conflict before any rerun work when the Test pointer moved", async () => {
		mocks.applyFeedback.mockRejectedValueOnce(
			new XiaofeiTestCapabilityConflictError(ORGANIZATION_A, TEST_VERSION, "current-test-ca"),
		);

		await expect(
			call(
				applyXiaofeiTestTurnCorrection,
				{
					sourceTestTurnId: "clx9xow740000qwerty123456",
					testSessionId: "session-a",
					capabilityVersionId: "clx9xow740001qwerty123456",
					correction: "Use the corrected policy.",
				},
				request(ORGANIZATION_A),
			),
		).rejects.toMatchObject({
			code: "CONFLICT",
			data: {
				code: "TEST_CA_VERSION_CONFLICT",
				expectedCapabilityVersionId: TEST_VERSION,
				currentCapabilityVersionId: "current-test-ca",
			},
		});

		expect(mocks.loadCapability).not.toHaveBeenCalled();
		expect(mocks.createSession).not.toHaveBeenCalled();
		expect(mocks.runTurn).not.toHaveBeenCalled();
		expect(mocks.createRerun).not.toHaveBeenCalled();
	});

	it("returns a completed identical correction without another session or model run", async () => {
		const runtimeMetadata = {
			knowledgeTitle: null,
			knowledgeEvidence: null,
			knowledgeEvidenceSet: [],
			knowledgeRecall: { candidateCount: 0, aggregationMs: 0 },
			nextAction: "reply" as const,
			riskLevel: "low" as const,
			ownerType: "ai" as const,
			stage: "admission" as const,
			missingSlots: [],
			traces: [],
		};
		mocks.applyFeedback.mockResolvedValueOnce({
			sourceTestTurn: { id: "clx9xow740000qwerty123456" },
			existingRerun: {
				id: "rerun-a",
				testSessionId: "rerun-session-a",
				answer: "Persisted corrected answer.",
				capabilityVersionId: TEST_VERSION,
				runtimeMetadata,
			},
		});

		await expect(
			call(
				applyXiaofeiTestTurnCorrection,
				{
					sourceTestTurnId: "clx9xow740000qwerty123456",
					testSessionId: "session-a",
					capabilityVersionId: "clx9xow740001qwerty123456",
					correction: "Use the corrected policy.",
				},
				request(ORGANIZATION_A),
			),
		).resolves.toMatchObject({
			rerun: { id: "rerun-a", testSessionId: "rerun-session-a" },
			answer: "Persisted corrected answer.",
		});

		expect(mocks.loadCapability).not.toHaveBeenCalled();
		expect(mocks.createSession).not.toHaveBeenCalled();
		expect(mocks.runTurn).not.toHaveBeenCalled();
		expect(mocks.createRerun).not.toHaveBeenCalled();
	});

	it("projects intervention pairs once into a browser-safe bounded DTO", async () => {
		const detail = {
			id: "session-a",
			capabilityVersionId: TEST_VERSION,
			firstQuestion: "Original question",
			latestAt: new Date("2026-08-06T00:00:00.000Z"),
			turnCount: 1,
			beforeInterventionCount: 1,
			afterInterventionCount: 1,
			isCurrent: true,
			writable: true,
			turns: [],
			interventionPairs: [
				{
					interventionId: "intervention-complete",
					isComplete: true,
					correction: "Use the corrected policy.",
					beforeResponse: { privateSentinel: "raw-before" },
					afterResponse: { privateSentinel: "raw-after" },
					before: {
						id: "before-turn",
						testSessionId: "old-session",
						capabilityVersionId: "old-ca",
						answer: "Before answer",
						runtimeMetadata: { traces: [{ type: "before-trace" }] },
					},
					after: {
						id: "after-turn",
						testSessionId: "new-session",
						capabilityVersionId: "new-ca",
						answer: "After answer",
						runtimeMetadata: { traces: [{ type: "after-trace" }] },
					},
				},
				{
					interventionId: "intervention-incomplete",
					isComplete: false,
					correction: "Pending rerun",
					beforeResponse: { privateSentinel: "raw-before-2" },
					afterResponse: null,
					before: {
						id: "before-turn-2",
						testSessionId: "old-session",
						capabilityVersionId: "old-ca",
						answer: "Before answer 2",
						runtimeMetadata: { traces: [] },
					},
					after: null,
				},
			],
		};
		mocks.getDetail.mockResolvedValue(detail);

		const result = await call(
			getXiaofeiTestSessionProcedure,
			{ testSessionId: "session-a" },
			request(ORGANIZATION_A),
		);

		expect(mocks.getDetail).toHaveBeenCalledTimes(1);
		expect(mocks.getDetail).toHaveBeenCalledWith(ORGANIZATION_A, "session-a");
		expect(result.interventionPairs).toEqual([
			{
				interventionId: "intervention-complete",
				isComplete: true,
				correction: "Use the corrected policy.",
				before: expect.objectContaining({
					id: "before-turn",
					testSessionId: "old-session",
					capabilityVersionId: "old-ca",
					answer: "Before answer",
				}),
				after: expect.objectContaining({
					id: "after-turn",
					testSessionId: "new-session",
					capabilityVersionId: "new-ca",
					answer: "After answer",
				}),
			},
			{
				interventionId: "intervention-incomplete",
				isComplete: false,
				correction: "Pending rerun",
				before: expect.objectContaining({ id: "before-turn-2" }),
				after: null,
			},
		]);
		expect(JSON.stringify(result)).not.toContain("privateSentinel");
		expect(result.interventionPairs[0]).not.toHaveProperty("beforeResponse");
		expect(result.interventionPairs[0]).not.toHaveProperty("afterResponse");
	});

	it("treats a session ID from another Organization as not found", async () => {
		mocks.getDetail.mockResolvedValue(null);
		await expect(
			call(getXiaofeiTestSessionProcedure, { testSessionId: "session-a" }, request(ORGANIZATION_B)),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
		expect(mocks.getDetail).toHaveBeenCalledTimes(1);
		expect(mocks.getDetail).toHaveBeenCalledWith(ORGANIZATION_B, "session-a");
	});
});

function request(organizationId: string) {
	return {
		context: {
			headers: new Headers({ "x-organization": organizationId }),
		},
	};
}
