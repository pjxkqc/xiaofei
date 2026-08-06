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
	getXiaofeiTestSessionDetail: mocks.getDetail,
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

import { createDefaultWorkspaceSnapshot } from "@repo/xiaofei";

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
		const detail = () => ({
			id: sessionId,
			capabilityVersionId: TEST_VERSION,
			writable: true,
			turns: savedTurns,
		});
		mocks.getDetail.mockImplementation(async (organizationId: string, id: string) =>
			organizationId === ORGANIZATION_A && id === sessionId ? detail() : null,
		);

		for (const question of ["one", "two", "three"])
			await call(
				runXiaofeiVersionedTest,
				{ testSessionId: sessionId, question },
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
		).rejects.toMatchObject({ code: "CONFLICT" });

		expect(mocks.setTestVersion).toHaveBeenCalledWith(ORGANIZATION_A, "new-test-ca");
		expect(mocks.setTestVersion).not.toHaveBeenCalledWith(ORGANIZATION_A, "active-ca");
	});

	it("enforces owner-only correction before invoking the durable feedback service", async () => {
		mocks.verifyMembership.mockResolvedValue({ role: "member" });

		await expect(
			call(
				applyXiaofeiTestTurnCorrection,
				{
					sourceTestTurnId: "clx9xow740000qwerty123456",
					correction: "Use the corrected policy.",
				},
				request(ORGANIZATION_A),
			),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		expect(mocks.applyFeedback).not.toHaveBeenCalled();
	});
});

function request(organizationId: string) {
	return {
		context: {
			headers: new Headers({ "x-organization": organizationId }),
		},
	};
}
