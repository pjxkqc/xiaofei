import { createConversationState } from "@repo/xiaofei";
import { beforeEach, describe, expect, it, vi } from "vitest";

const queryMocks = vi.hoisted(() => {
	const transactionClient = {
		$executeRaw: vi.fn(),
		$queryRaw: vi.fn(),
		xiaofeiInboundEvent: {
			create: vi.fn(),
			findUnique: vi.fn(),
			update: vi.fn(),
		},
		xiaofeiWorkspace: { findUnique: vi.fn() },
		xiaofeiCustomer: { findUnique: vi.fn() },
		xiaofeiConversation: { create: vi.fn(), findUnique: vi.fn(), upsert: vi.fn() },
		xiaofeiKnowledgeDocument: {
			create: vi.fn(),
			deleteMany: vi.fn(),
			findUnique: vi.fn(),
			update: vi.fn(),
		},
		xiaofeiKnowledgeEntry: {
			create: vi.fn(),
			createManyAndReturn: vi.fn(),
			deleteMany: vi.fn(),
			findUnique: vi.fn(),
			update: vi.fn(),
		},
		xiaofeiKnowledgeUnit: {
			create: vi.fn(),
			findMany: vi.fn(),
			findUnique: vi.fn(),
			updateMany: vi.fn(),
		},
		xiaofeiKnowledgeUnitRevision: {
			create: vi.fn(),
			findFirst: vi.fn(),
			findMany: vi.fn(),
			findUnique: vi.fn(),
		},
		xiaofeiCapabilityVersion: {
			create: vi.fn(),
			findUnique: vi.fn(),
		},
		xiaofeiCapabilityVersionKnowledgeUnit: { createMany: vi.fn() },
		xiaofeiCapabilityBinding: { findUnique: vi.fn(), upsert: vi.fn() },
		xiaofeiResponseIntervention: {
			create: vi.fn(),
			findUnique: vi.fn(),
			update: vi.fn(),
			updateMany: vi.fn(),
		},
		xiaofeiTestTurn: { create: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
	};

	return {
		createDocument: transactionClient.xiaofeiKnowledgeDocument.create,
		deleteDocuments: transactionClient.xiaofeiKnowledgeDocument.deleteMany,
		executeRaw: transactionClient.$executeRaw,
		findDocument: vi.fn(),
		findDocumentInTransaction: transactionClient.xiaofeiKnowledgeDocument.findUnique,
		listDocuments: vi.fn(),
		queryRaw: transactionClient.$queryRaw,
		transaction: vi.fn(
			async (input: ((client: typeof transactionClient) => unknown) | unknown[]) => {
				return Array.isArray(input) ? await Promise.all(input) : await input(transactionClient);
			},
		),
		updateDocument: vi.fn(),
		updateDocumentInTransaction: transactionClient.xiaofeiKnowledgeDocument.update,
		createEntry: transactionClient.xiaofeiKnowledgeEntry.create,
		createEntries: transactionClient.xiaofeiKnowledgeEntry.createManyAndReturn,
		deleteEntries: transactionClient.xiaofeiKnowledgeEntry.deleteMany,
		findEntry: vi.fn(),
		findEntryInTransaction: transactionClient.xiaofeiKnowledgeEntry.findUnique,
		listEntries: vi.fn(),
		updateEntry: transactionClient.xiaofeiKnowledgeEntry.update,
		createUnit: transactionClient.xiaofeiKnowledgeUnit.create,
		findUnit: vi.fn(),
		listUnits: vi.fn(),
		listAdminOrganizations: vi.fn(),
		countAdminOrganizations: vi.fn(),
		invalidateUnits: transactionClient.xiaofeiKnowledgeUnit.updateMany,
		createRevision: transactionClient.xiaofeiKnowledgeUnitRevision.create,
		findRevision: transactionClient.xiaofeiKnowledgeUnitRevision.findFirst,
		findRevisions: transactionClient.xiaofeiKnowledgeUnitRevision.findMany,
		findRevisionById: transactionClient.xiaofeiKnowledgeUnitRevision.findUnique,
		createCapabilityVersion: transactionClient.xiaofeiCapabilityVersion.create,
		findCapabilityVersion: transactionClient.xiaofeiCapabilityVersion.findUnique,
		createCapabilityKnowledgeUnits:
			transactionClient.xiaofeiCapabilityVersionKnowledgeUnit.createMany,
		upsertCapabilityBinding: transactionClient.xiaofeiCapabilityBinding.upsert,
		findHostingBindingInTransaction: transactionClient.xiaofeiCapabilityBinding.findUnique,
		getHostingBinding: vi.fn(),
		createTestTurn: transactionClient.xiaofeiTestTurn.create,
		findLatestTestTurn: transactionClient.xiaofeiTestTurn.findFirst,
		findTestTurn: transactionClient.xiaofeiTestTurn.findUnique,
		listTestTurns: vi.fn(),
		countTestTurns: vi.fn(),
		groupTestTurns: vi.fn(),
		updateTestTurn: transactionClient.xiaofeiTestTurn.update,
		createResponseIntervention: transactionClient.xiaofeiResponseIntervention.create,
		findResponseIntervention: transactionClient.xiaofeiResponseIntervention.findUnique,
		updateResponseIntervention: transactionClient.xiaofeiResponseIntervention.update,
		updateResponseInterventionMany: transactionClient.xiaofeiResponseIntervention.updateMany,
		createInboundEvent: transactionClient.xiaofeiInboundEvent.create,
		findInboundEventInTransaction: transactionClient.xiaofeiInboundEvent.findUnique,
		updateInboundEvent: transactionClient.xiaofeiInboundEvent.update,
		listInboundEvents: vi.fn(),
		getInboundEvent: vi.fn(),
		getOrganizationConfig: vi.fn(),
		upsertOrganizationConfig: vi.fn(),
		getCustomer: vi.fn(),
		listCustomers: vi.fn(),
		createCustomer: vi.fn(),
		updateCustomer: vi.fn(),
		getWorkspace: vi.fn(),
		getConversation: vi.fn(),
		listConversations: vi.fn(),
		updateInboundEventDirect: vi.fn(),
		findWorkspaceInTransaction: transactionClient.xiaofeiWorkspace.findUnique,
		findCustomerInTransaction: transactionClient.xiaofeiCustomer.findUnique,
		upsertConversation: transactionClient.xiaofeiConversation.upsert,
		createConversation: transactionClient.xiaofeiConversation.create,
		findConversationInTransaction: transactionClient.xiaofeiConversation.findUnique,
	};
});

describe("Xiaofei immutable knowledge version persistence", () => {
	beforeEach(() => vi.clearAllMocks());

	it("creates Organization-scoped CA membership only from local or platform revisions", async () => {
		queryMocks.findRevisions.mockResolvedValueOnce([
			{
				id: "merchant-revision",
				scopeKey: "organization:organization-a",
				origin: "merchant",
				logicalKnowledgeUnitId: "merchant-ku",
				revision: 1,
			},
			{
				id: "platform-revision",
				scopeKey: "platform",
				origin: "platform",
				logicalKnowledgeUnitId: "platform-ku",
				revision: 1,
			},
		]);
		queryMocks.findCapabilityVersion.mockResolvedValueOnce(null);
		queryMocks.createCapabilityVersion.mockResolvedValueOnce({ id: "capability-version-1" });

		await createXiaofeiCapabilityVersion({
			organizationId: "organization-a",
			capabilityKey: "xiaofei-hosting",
			knowledgeUnits: [
				{
					knowledgeUnitRevisionId: "platform-revision",
					role: "fallback",
					priority: 1,
				},
				{ knowledgeUnitRevisionId: "merchant-revision", priority: 10 },
			],
		});

		expect(queryMocks.findRevisions).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({
					id: { in: ["platform-revision", "merchant-revision"] },
					OR: [{ scopeKey: "platform" }, { scopeKey: "organization:organization-a" }],
				}),
			}),
		);
		expect(queryMocks.createCapabilityKnowledgeUnits).toHaveBeenCalledWith({
			data: expect.arrayContaining([
				expect.objectContaining({
					organizationId: "organization-a",
					capabilityVersionId: "capability-version-1",
					knowledgeUnitRevisionId: "merchant-revision",
					knowledgeUnitRevisionScopeKey: "organization:organization-a",
				}),
				expect.objectContaining({
					knowledgeUnitRevisionId: "platform-revision",
					knowledgeUnitRevisionScopeKey: "platform",
				}),
			]),
		});
	});

	it("rejects duplicate logical KUs and disallowed capability partitions after loading exact rows", async () => {
		queryMocks.findRevisions.mockResolvedValueOnce([
			{
				id: "same-revision-a",
				scopeKey: "organization:organization-a",
				origin: "merchant",
				logicalKnowledgeUnitId: "same-ku",
			},
			{
				id: "same-revision-b",
				scopeKey: "platform",
				origin: "platform",
				logicalKnowledgeUnitId: "same-ku",
			},
		]);
		await expect(
			createXiaofeiCapabilityVersion({
				organizationId: "organization-a",
				capabilityKey: "xiaofei-hosting",
				knowledgeUnits: [
					{ knowledgeUnitRevisionId: "same-revision-a" },
					{ knowledgeUnitRevisionId: "same-revision-b" },
				],
			}),
		).rejects.toBeInstanceOf(XiaofeiDuplicateLogicalKnowledgeUnitError);

		queryMocks.findRevisions.mockResolvedValueOnce([
			{
				id: "same-revision-a",
				scopeKey: "organization:organization-a",
				origin: "merchant",
				logicalKnowledgeUnitId: "same-ku",
			},
		]);
		await expect(
			createXiaofeiCapabilityVersion({
				organizationId: "organization-a",
				capabilityKey: "platform-fallback",
				knowledgeUnits: [{ knowledgeUnitRevisionId: "same-revision-a" }],
			}),
		).rejects.toBeInstanceOf(XiaofeiCapabilityPartitionError);
	});

	it("returns the existing CA version for an identical manifest", async () => {
		queryMocks.findRevisions.mockResolvedValueOnce([
			{
				id: "merchant-revision",
				scopeKey: "organization:organization-a",
				origin: "merchant",
				logicalKnowledgeUnitId: "merchant-ku",
				revision: 1,
			},
		]);
		queryMocks.findCapabilityVersion.mockResolvedValueOnce({ id: "existing-version" });

		await expect(
			createXiaofeiCapabilityVersion({
				organizationId: "organization-a",
				capabilityKey: "merchant-knowledge",
				knowledgeUnits: [{ knowledgeUnitRevisionId: "merchant-revision" }],
			}),
		).resolves.toEqual({ id: "existing-version" });
		expect(queryMocks.createCapabilityVersion).not.toHaveBeenCalled();
	});

	it("uses a required platform scope for global revision idempotency", async () => {
		queryMocks.findRevision.mockResolvedValueOnce({ id: "platform-revision" });

		await expect(
			createXiaofeiKnowledgeUnitRevision({
				organizationId: null,
				origin: "platform",
				logicalKnowledgeUnitId: "platform-ku",
				content: { answer: "stable" },
			}),
		).resolves.toEqual({ id: "platform-revision" });
		expect(queryMocks.findRevision).toHaveBeenCalledWith({
			where: expect.objectContaining({
				scopeKey: "platform",
				logicalKnowledgeUnitId: "platform-ku",
			}),
		});
		expect(queryMocks.createRevision).not.toHaveBeenCalled();
	});

	it("refuses a platform baseline intervention before creating any successor", async () => {
		queryMocks.findRevisionById.mockResolvedValueOnce(null);
		queryMocks.findRevision.mockResolvedValueOnce({ id: "platform-revision", origin: "platform" });

		await expect(
			applyXiaofeiResponseIntervention({
				organizationId: "organization-a",
				capabilityKey: "xiaofei-hosting",
				beforeCapabilityVersionId: "capability-version-1",
				beforeKnowledgeRevisionId: "platform-revision",
				correction: "Please change this.",
				correctedContent: { answer: "new" },
			}),
		).rejects.toBeInstanceOf(XiaofeiPlatformKnowledgeInterventionError);
		expect(queryMocks.createRevision).not.toHaveBeenCalled();
		expect(queryMocks.createResponseIntervention).not.toHaveBeenCalled();
	});

	it("preserves unrelated exact revision IDs during an intervention", async () => {
		queryMocks.findRevisionById.mockResolvedValueOnce({
			id: "revision-b-1",
			scopeKey: "organization:organization-a",
			origin: "merchant",
			logicalKnowledgeUnitId: "ku-b",
			knowledgeUnitId: "knowledge-unit-b",
		});
		queryMocks.findCapabilityVersion
			.mockResolvedValueOnce({
				id: "before-version",
				capabilityKey: "xiaofei-hosting",
				knowledgeUnits: [
					{
						knowledgeUnitRevisionId: "revision-a-1",
						knowledgeUnitRevisionScopeKey: "organization:organization-a",
						role: "primary",
						priority: 10,
						knowledgeUnitRevision: { logicalKnowledgeUnitId: "ku-a" },
					},
					{
						knowledgeUnitRevisionId: "revision-b-1",
						knowledgeUnitRevisionScopeKey: "organization:organization-a",
						role: "primary",
						priority: 5,
						knowledgeUnitRevision: { logicalKnowledgeUnitId: "ku-b" },
					},
				],
			})
			.mockResolvedValueOnce(null);
		queryMocks.findRevision.mockResolvedValueOnce(null).mockResolvedValueOnce({ revision: 1 });
		queryMocks.createRevision.mockResolvedValueOnce({
			id: "revision-b-2",
			scopeKey: "organization:organization-a",
			origin: "merchant",
			logicalKnowledgeUnitId: "ku-b",
		});
		queryMocks.findRevisions.mockResolvedValueOnce([
			{
				id: "revision-a-1",
				scopeKey: "organization:organization-a",
				origin: "merchant",
				logicalKnowledgeUnitId: "ku-a",
			},
			{
				id: "revision-b-2",
				scopeKey: "organization:organization-a",
				origin: "merchant",
				logicalKnowledgeUnitId: "ku-b",
			},
		]);
		queryMocks.createCapabilityVersion.mockResolvedValueOnce({ id: "result-version" });
		queryMocks.createResponseIntervention.mockResolvedValueOnce({ id: "intervention" });

		await applyXiaofeiResponseIntervention({
			organizationId: "organization-a",
			capabilityKey: "xiaofei-hosting",
			beforeCapabilityVersionId: "before-version",
			beforeKnowledgeRevisionId: "revision-b-1",
			correction: "Correct KU-B only.",
			correctedContent: { answer: "revised B" },
		});

		expect(queryMocks.findRevisions).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({
					id: { in: ["revision-a-1", "revision-b-2"] },
				}),
			}),
		);
		expect(queryMocks.createCapabilityKnowledgeUnits).toHaveBeenCalledWith({
			data: expect.arrayContaining([
				expect.objectContaining({ knowledgeUnitRevisionId: "revision-a-1" }),
				expect.objectContaining({ knowledgeUnitRevisionId: "revision-b-2" }),
			]),
		});
		expect(queryMocks.createCapabilityKnowledgeUnits).not.toHaveBeenCalledWith(
			expect.objectContaining({ knowledgeUnitRevisionId: "revision-a-2" }),
		);
	});

	it("atomically switches only the local active capability pointer", async () => {
		queryMocks.findCapabilityVersion.mockResolvedValueOnce({
			id: "capability-version-test",
			capabilityKey: "xiaofei-hosting",
		});
		await activateXiaofeiCapabilityVersion(
			"organization-a",
			"xiaofei-hosting",
			"capability-version-test",
		);

		expect(queryMocks.findCapabilityVersion).toHaveBeenCalledWith({
			where: {
				organizationId_id: {
					organizationId: "organization-a",
					id: "capability-version-test",
				},
			},
			select: { id: true, capabilityKey: true },
		});
		expect(queryMocks.upsertCapabilityBinding).toHaveBeenCalledWith({
			where: {
				organizationId_capabilityKey: {
					organizationId: "organization-a",
					capabilityKey: "xiaofei-hosting",
				},
			},
			create: {
				organizationId: "organization-a",
				capabilityKey: "xiaofei-hosting",
				activeCapabilityVersionId: "capability-version-test",
			},
			update: { activeCapabilityVersionId: "capability-version-test" },
		});
	});

	it("refuses to activate a non-hosting capability version", async () => {
		queryMocks.findCapabilityVersion.mockResolvedValueOnce({
			id: "merchant-version",
			capabilityKey: "merchant-knowledge",
		});

		await expect(
			activateXiaofeiCapabilityVersion("organization-a", "merchant-knowledge", "merchant-version"),
		).rejects.toBeInstanceOf(XiaofeiVersioningNotFoundError);
		expect(queryMocks.upsertCapabilityBinding).not.toHaveBeenCalled();
	});
});

vi.mock("../client", () => ({
	db: {
		$transaction: queryMocks.transaction,
		$queryRaw: queryMocks.queryRaw,
		organization: {
			findMany: queryMocks.listAdminOrganizations,
			count: queryMocks.countAdminOrganizations,
		},
		xiaofeiKnowledgeDocument: {
			findMany: queryMocks.listDocuments,
			findUnique: queryMocks.findDocument,
			update: queryMocks.updateDocument,
		},
		xiaofeiKnowledgeEntry: {
			findMany: queryMocks.listEntries,
			findUnique: queryMocks.findEntry,
		},
		xiaofeiKnowledgeUnit: {
			findMany: queryMocks.listUnits,
			findUnique: queryMocks.findUnit,
		},
		xiaofeiKnowledgeUnitRevision: {
			findMany: queryMocks.findRevisions,
			findUnique: queryMocks.findRevisionById,
		},
		xiaofeiCapabilityVersion: { findUnique: queryMocks.findCapabilityVersion },
		xiaofeiCapabilityBinding: { findUnique: queryMocks.getHostingBinding },
		xiaofeiTestTurn: {
			findFirst: queryMocks.findLatestTestTurn,
			findMany: queryMocks.listTestTurns,
			count: queryMocks.countTestTurns,
			groupBy: queryMocks.groupTestTurns,
		},
		xiaofeiInboundEvent: {
			findMany: queryMocks.listInboundEvents,
			findUnique: queryMocks.getInboundEvent,
			update: queryMocks.updateInboundEventDirect,
		},
		xiaofeiOrganizationConfig: {
			findUnique: queryMocks.getOrganizationConfig,
			upsert: queryMocks.upsertOrganizationConfig,
		},
		xiaofeiCustomer: {
			findUnique: queryMocks.getCustomer,
			findMany: queryMocks.listCustomers,
			create: queryMocks.createCustomer,
			update: queryMocks.updateCustomer,
		},
		xiaofeiWorkspace: { findUnique: queryMocks.getWorkspace },
		xiaofeiConversation: {
			findUnique: queryMocks.getConversation,
			findMany: queryMocks.listConversations,
		},
	},
}));

import {
	createXiaofeiKnowledgeDocument,
	createXiaofeiKnowledgeDocumentWithEntries,
	DEFAULT_XIAOFEI_TEST_SESSION_PAGE_SIZE,
	createXiaofeiKnowledgeEntry,
	createXiaofeiKnowledgeUnit,
	deleteXiaofeiKnowledgeEntry,
	deleteXiaofeiKnowledgeDocument,
	getXiaofeiKnowledgeDocument,
	getXiaofeiKnowledgeEntry,
	listXiaofeiKnowledgeEntries,
	listXiaofeiKnowledgeDocuments,
	listAdminXiaofeiOrganizations,
	MAX_XIAOFEI_KNOWLEDGE_DOCUMENT_BODY_BYTES_PER_WORKSPACE,
	MAX_XIAOFEI_KNOWLEDGE_DOCUMENTS_PER_WORKSPACE,
	MAX_XIAOFEI_KNOWLEDGE_ENTRIES_PER_WORKSPACE,
	updateXiaofeiKnowledgeDocument,
	updateXiaofeiKnowledgeEntry,
	XiaofeiKnowledgeEntryEligibilityError,
	acceptInboundEvent,
	getInboundEvent,
	listInboundEvents,
	XiaofeiInboundEventConflictError,
	getXiaofeiCustomer,
	getXiaofeiOrganizationConversation,
	listXiaofeiCustomers,
	upsertXiaofeiOrganizationConfig,
	upsertXiaofeiOrganizationConversation,
	updateXiaofeiInboundEventStatus,
	XiaofeiOrganizationCustomerNotFoundError,
	activateXiaofeiCapabilityVersion,
	applyXiaofeiResponseIntervention,
	applyXiaofeiTestTurnFeedback,
	createXiaofeiCapabilityVersion,
	createXiaofeiKnowledgeUnitRevision,
	createXiaofeiTestTurn,
	createXiaofeiTestTurnRerun,
	getXiaofeiTestSession,
	getXiaofeiTestSessionDetail,
	listXiaofeiTestSessions,
	loadXiaofeiRuntimeHostingCapability,
	upsertXiaofeiSyntheticSupportConversation,
	XiaofeiCapabilityPartitionError,
	XiaofeiDuplicateLogicalKnowledgeUnitError,
	XiaofeiVersioningNotFoundError,
	XiaofeiPlatformKnowledgeInterventionError,
	XiaofeiTestTurnFeedbackConflictError,
	XiaofeiTestSessionCapabilityConflictError,
	XiaofeiTestSessionConflictError,
	XiaofeiSyntheticSupportConversationConflictError,
} from "./xiaofei";

const conversationState = createConversationState({
	id: "session-a",
	tenantId: "organization:organization-a",
	agentId: "agent-a",
	maxFollowUps: 3,
});

describe("Xiaofei Organization queries", () => {
	beforeEach(() => vi.clearAllMocks());

	it("normalizes persisted hashes and maps the selected hosting pointer to domain status", async () => {
		queryMocks.getHostingBinding.mockResolvedValueOnce({
			activeCapabilityVersion: {
				id: "active-version",
				capabilityKey: "xiaofei-hosting",
				manifestHash: "persistence-hash",
				createdAt: new Date("2026-08-04T00:00:00.000Z"),
				knowledgeUnits: [
					{
						knowledgeUnitRevisionId: "merchant-revision",
						knowledgeUnitRevision: {
							id: "merchant-revision",
							organizationId: "organization-a",
							logicalKnowledgeUnitId: "ku-a",
							revision: 1,
							origin: "merchant",
							contentHash: "persistence-content-hash",
							createdAt: new Date("2026-08-04T00:00:00.000Z"),
							content: {
								id: "knowledge-a",
								title: "Knowledge A",
								status: "released",
								standardReplyPolicy: "Use policy.",
								fallbackReply: "Fallback.",
								sourceSection: "FAQ",
								quality: { status: "passed" },
							},
						},
					},
				],
			},
			testCapabilityVersion: null,
		});

		const runtime = await loadXiaofeiRuntimeHostingCapability("organization-a", "active");
		expect(runtime.manifest.status).toBe("active");
		expect(runtime.manifest.manifestHash).not.toBe("persistence-hash");
		expect(runtime.revisions[0]?.contentHash).not.toBe("persistence-content-hash");
		expect(runtime.manifest.knowledgeUnitRevisionIds).toEqual(["merchant-revision"]);
	});

	it("persists a no-hit test turn without accepting a caller-selected revision", async () => {
		queryMocks.findHostingBindingInTransaction.mockResolvedValueOnce({
			activeCapabilityVersion: {
				id: "active-version",
				capabilityKey: "xiaofei-hosting",
				knowledgeUnits: [],
			},
			testCapabilityVersion: null,
		});
		queryMocks.createTestTurn.mockResolvedValueOnce({ id: "test-turn" });

		await createXiaofeiTestTurn("organization-a", {
			testSessionId: "session-a",
			expectedPreviousTestTurnId: null,
			question: "What is the policy?",
			answer: "The actual answer.",
			capabilityVersionId: "active-version",
			conversationState,
			runtimeMetadata: {
				knowledgeTitle: null,
				knowledgeEvidence: null,
				nextAction: "reply",
				riskLevel: "low",
				ownerType: "ai",
				stage: "admission",
				missingSlots: [],
				traces: [],
			},
			requestedAt: new Date("2026-08-04T00:00:00.000Z"),
			completedAt: new Date("2026-08-04T00:00:01.000Z"),
		});

		expect(queryMocks.createTestTurn).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					evidenceRevisionScopeKey: null,
					evidenceRevisionId: null,
					capabilityVersionId: "active-version",
				}),
			}),
		);
	});

	it("loads only the newest Organization-scoped non-legacy session snapshot", async () => {
		queryMocks.findLatestTestTurn.mockResolvedValueOnce({
			id: "turn-a",
			capabilityVersionId: "version-a",
			conversationState,
		});

		await expect(getXiaofeiTestSession("organization-a", "session-a")).resolves.toEqual({
			id: "turn-a",
			capabilityVersionId: "version-a",
			conversationState,
		});
		expect(queryMocks.findLatestTestTurn).toHaveBeenCalledWith({
			where: {
				organizationId: "organization-a",
				testSessionId: "session-a",
				conversationState: { not: expect.anything() },
			},
			orderBy: [{ createdAt: "desc" }, { id: "desc" }],
			select: { id: true, capabilityVersionId: true, conversationState: true },
		});
	});

	it("leaves a legacy null snapshot as audit history instead of resuming it", async () => {
		queryMocks.findLatestTestTurn.mockResolvedValueOnce(null);

		await expect(getXiaofeiTestSession("organization-a", "legacy-session")).resolves.toBeNull();
		expect(queryMocks.findLatestTestTurn).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({ conversationState: { not: expect.anything() } }),
			}),
		);
	});

	it("lists Organization-local sessions with a bounded cursor and current writability", async () => {
		queryMocks.getHostingBinding.mockResolvedValueOnce({
			activeCapabilityVersionId: "active-version",
			testCapabilityVersionId: "test-version",
		});
		queryMocks.listTestTurns
			.mockResolvedValueOnce([
				{
					id: "latest-turn",
					testSessionId: "session-a",
					capabilityVersionId: "test-version",
					completedAt: new Date("2026-08-04T00:00:01.000Z"),
				},
			])
			.mockResolvedValueOnce([{ testSessionId: "session-a", question: "First question" }]);
		queryMocks.groupTestTurns.mockResolvedValueOnce([
			{ testSessionId: "session-a", _count: { _all: 2 } },
		]);
		queryMocks.queryRaw.mockResolvedValueOnce([
			{ testSessionId: "session-a", beforeCount: BigInt(1), afterCount: BigInt(0) },
		]);

		await expect(listXiaofeiTestSessions("organization-a")).resolves.toEqual({
			items: [
				{
					id: "session-a",
					capabilityVersionId: "test-version",
					firstQuestion: "First question",
					latestAt: new Date("2026-08-04T00:00:01.000Z"),
					turnCount: 2,
					beforeInterventionCount: 1,
					afterInterventionCount: 0,
					isCurrent: true,
					writable: true,
				},
			],
			nextCursor: null,
		});
		expect(queryMocks.listTestTurns).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { organizationId: "organization-a" },
				distinct: ["testSessionId"],
				take: DEFAULT_XIAOFEI_TEST_SESSION_PAGE_SIZE + 1,
			}),
		);
		await expect(listXiaofeiTestSessions("organization-a", { limit: 51 })).rejects.toThrow(
			"Test session page limit must be between 1 and 50.",
		);
	});

	it("keeps historical TestTurns readable but marks a stale CA session non-writable", async () => {
		queryMocks.getHostingBinding.mockResolvedValueOnce({
			activeCapabilityVersionId: "active-version",
			testCapabilityVersionId: "current-test-version",
		});
		queryMocks.listTestTurns.mockResolvedValueOnce([
			{
				id: "turn-a",
				question: "First question",
				answer: "Saved answer",
				capabilityVersionId: "historic-version",
				conversationState,
				runtimeMetadata: {
					knowledgeTitle: null,
					knowledgeEvidence: null,
					nextAction: "reply",
					riskLevel: "low",
					ownerType: "ai",
					stage: "admission",
					missingSlots: [],
					traces: [],
				},
				evidenceRevisionId: null,
				sourceTestTurnId: null,
				interventionId: null,
				requestedAt: new Date("2026-08-04T00:00:00.000Z"),
				completedAt: new Date("2026-08-04T00:00:01.000Z"),
				createdAt: new Date("2026-08-04T00:00:01.000Z"),
			},
		]);
		queryMocks.findLatestTestTurn
			.mockResolvedValueOnce({ question: "First question" })
			.mockResolvedValueOnce({
				capabilityVersionId: "historic-version",
				completedAt: new Date("2026-08-04T00:00:01.000Z"),
			});
		queryMocks.countTestTurns.mockResolvedValueOnce(1);
		queryMocks.queryRaw.mockResolvedValueOnce([{ beforeCount: BigInt(0), afterCount: BigInt(0) }]);

		await expect(getXiaofeiTestSessionDetail("organization-a", "session-a")).resolves.toMatchObject(
			{
				id: "session-a",
				capabilityVersionId: "historic-version",
				turnCount: 1,
				isCurrent: false,
				writable: false,
				turns: [{ id: "turn-a", answer: "Saved answer" }],
			},
		);
		expect(queryMocks.listTestTurns).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { organizationId: "organization-a", testSessionId: "session-a" },
				take: 100,
			}),
		);
	});

	it("projects synthetic support only into its Organization conversation aggregate", async () => {
		queryMocks.findWorkspaceInTransaction.mockResolvedValueOnce({ id: "workspace-a" });
		queryMocks.findConversationInTransaction.mockResolvedValueOnce(null);
		queryMocks.createConversation.mockResolvedValueOnce({ id: "conversation-a" });

		await upsertXiaofeiSyntheticSupportConversation({
			organizationId: "organization-a",
			externalId: "synthetic-acceptance-a",
			state: { owner: "support" },
			messages: [{ direction: "inbound", content: "Synthetic question" }],
			traceEvents: [{ type: "synthetic.acceptance" }],
		});

		expect(queryMocks.createConversation).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					workspaceId: "workspace-a",
					channel: "synthetic_support",
					messages: [{ direction: "inbound", content: "Synthetic question" }],
					traceEvents: [{ type: "synthetic.acceptance" }],
				}),
			}),
		);
		expect(queryMocks.createInboundEvent).not.toHaveBeenCalled();
		expect(queryMocks.createResponseIntervention).not.toHaveBeenCalled();
	});

	it("returns an existing synthetic retry without overwriting later state", async () => {
		const existing = {
			id: "conversation-a",
			channel: "synthetic_support",
			state: { owner: "human", ownerEpoch: 2 },
			messages: [{ content: "Later message" }],
			traceEvents: [{ type: "later.trace" }],
		};
		queryMocks.findWorkspaceInTransaction.mockResolvedValueOnce({ id: "workspace-a" });
		queryMocks.findConversationInTransaction.mockResolvedValueOnce(existing);

		await expect(
			upsertXiaofeiSyntheticSupportConversation({
				organizationId: "organization-a",
				externalId: "synthetic-acceptance-a",
				state: { owner: "ai", ownerEpoch: 1 },
				messages: [],
				traceEvents: [],
			}),
		).resolves.toBe(existing);
		expect(queryMocks.createConversation).not.toHaveBeenCalled();
	});

	it("rejects a non-synthetic same-key conversation instead of relabeling it", async () => {
		queryMocks.findWorkspaceInTransaction.mockResolvedValueOnce({ id: "workspace-a" });
		queryMocks.findConversationInTransaction.mockResolvedValueOnce({ channel: "email" });

		await expect(
			upsertXiaofeiSyntheticSupportConversation({
				organizationId: "organization-a",
				externalId: "existing-email",
				state: {},
				messages: [],
				traceEvents: [],
			}),
		).rejects.toBeInstanceOf(XiaofeiSyntheticSupportConversationConflictError);
		expect(queryMocks.createConversation).not.toHaveBeenCalled();
	});

	it("keeps configuration and customers within their Organization selectors", async () => {
		await upsertXiaofeiOrganizationConfig("organization-a", { xiaofeiEnabled: true });
		await getXiaofeiCustomer("organization-a", "customer-a");
		await listXiaofeiCustomers("organization-a");

		expect(queryMocks.upsertOrganizationConfig).toHaveBeenCalledWith({
			where: { organizationId: "organization-a" },
			create: { organizationId: "organization-a", xiaofeiEnabled: true },
			update: { xiaofeiEnabled: true },
		});
		expect(queryMocks.getCustomer).toHaveBeenCalledWith({
			where: {
				organizationId_externalCustomerId: {
					organizationId: "organization-a",
					externalCustomerId: "customer-a",
				},
			},
		});
		expect(queryMocks.listCustomers).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { organizationId: "organization-a" },
			}),
		);
	});

	it("treats a missing config as disabled without widening an enabled query", async () => {
		queryMocks.listAdminOrganizations.mockResolvedValue([]);
		queryMocks.countAdminOrganizations.mockResolvedValue(0);
		await listAdminXiaofeiOrganizations({ enabled: false, limit: 20, offset: 0 });
		expect(queryMocks.listAdminOrganizations).toHaveBeenCalledWith(
			expect.objectContaining({
				where: {
					OR: [
						{ xiaofeiConfig: { is: null } },
						{ xiaofeiConfig: { is: { xiaofeiEnabled: false } } },
					],
				},
			}),
		);
		await listAdminXiaofeiOrganizations({ enabled: true, limit: 20, offset: 0 });
		expect(queryMocks.listAdminOrganizations).toHaveBeenLastCalledWith(
			expect.objectContaining({
				where: { xiaofeiConfig: { is: { xiaofeiEnabled: true } } },
			}),
		);
	});

	it("resolves an Organization conversation through its fixed workspace tenant key", async () => {
		queryMocks.getWorkspace.mockResolvedValueOnce({ id: "workspace-a" });
		await getXiaofeiOrganizationConversation("organization-a", "conversation-a");

		expect(queryMocks.getWorkspace).toHaveBeenCalledWith({
			where: { tenantKey: "organization:organization-a" },
		});
		expect(queryMocks.getConversation).toHaveBeenCalledWith({
			where: {
				workspaceId_externalId: { workspaceId: "workspace-a", externalId: "conversation-a" },
			},
			include: {
				customer: true,
				processingJobs: {
					select: { id: true, status: true },
					orderBy: { createdAt: "desc" },
					take: 1,
				},
				outboundDeliveries: {
					select: { status: true },
					orderBy: { createdAt: "desc" },
					take: 1,
				},
			},
		});
	});

	it("refuses to bind a conversation to a customer from another Organization", async () => {
		queryMocks.findWorkspaceInTransaction.mockResolvedValueOnce({ id: "workspace-a" });
		queryMocks.findCustomerInTransaction.mockResolvedValueOnce(null);

		await expect(
			upsertXiaofeiOrganizationConversation({
				organizationId: "organization-a",
				externalId: "conversation-a",
				customerId: "customer-b",
				state: {},
				traceEvents: [],
			}),
		).rejects.toBeInstanceOf(XiaofeiOrganizationCustomerNotFoundError);
		expect(queryMocks.findCustomerInTransaction).toHaveBeenCalledWith({
			where: { organizationId_id: { organizationId: "organization-a", id: "customer-b" } },
		});
	});

	it("limits processor event writes to its status fields", async () => {
		await updateXiaofeiInboundEventStatus("workspace-a", "event-a", {
			status: "processed",
			processedAt: new Date("2026-08-02T00:00:00.000Z"),
		});
		expect(queryMocks.updateInboundEventDirect).toHaveBeenCalledWith({
			where: { workspaceId_id: { workspaceId: "workspace-a", id: "event-a" } },
			data: { status: "processed", processedAt: new Date("2026-08-02T00:00:00.000Z") },
		});
	});
});

describe("Xiaofei governed TestTurn feedback boundary", () => {
	beforeEach(() => vi.clearAllMocks());

	const runtimeMetadata = {
		knowledgeTitle: null,
		knowledgeEvidence: null,
		nextAction: "reply" as const,
		riskLevel: "low" as const,
		ownerType: "ai" as const,
		stage: "admission" as const,
		missingSlots: [],
		traces: [],
	};

	it("fails closed when an existing session is submitted against another Test CA", async () => {
		queryMocks.findLatestTestTurn.mockResolvedValueOnce({
			id: "turn-a",
			capabilityVersionId: "version-a",
		});

		await expect(
			createXiaofeiTestTurn("organization-a", {
				testSessionId: "session-a",
				expectedPreviousTestTurnId: "turn-a",
				question: "What is the policy?",
				answer: "Actual answer.",
				capabilityVersionId: "version-b",
				conversationState,
				runtimeMetadata,
				requestedAt: new Date("2026-08-04T00:00:00.000Z"),
				completedAt: new Date("2026-08-04T00:00:01.000Z"),
			}),
		).rejects.toBeInstanceOf(XiaofeiTestSessionCapabilityConflictError);
		expect(queryMocks.createTestTurn).not.toHaveBeenCalled();
	});

	it("fails closed when a concurrent turn replaced the loaded session snapshot", async () => {
		queryMocks.findLatestTestTurn.mockResolvedValueOnce({
			id: "newer-turn",
			capabilityVersionId: "version-a",
		});

		await expect(
			createXiaofeiTestTurn("organization-a", {
				testSessionId: "session-a",
				expectedPreviousTestTurnId: "loaded-turn",
				question: "What is the policy?",
				answer: "Actual answer.",
				capabilityVersionId: "version-a",
				conversationState,
				runtimeMetadata,
				requestedAt: new Date("2026-08-04T00:00:00.000Z"),
				completedAt: new Date("2026-08-04T00:00:01.000Z"),
			}),
		).rejects.toBeInstanceOf(XiaofeiTestSessionConflictError);
		expect(queryMocks.createTestTurn).not.toHaveBeenCalled();
	});

	it("rejects evidence whose exact member metadata does not match", async () => {
		queryMocks.findHostingBindingInTransaction.mockResolvedValueOnce({
			activeCapabilityVersion: {
				id: "active-version",
				capabilityKey: "xiaofei-hosting",
				knowledgeUnits: [
					{
						knowledgeUnitRevisionId: "revision-a",
						knowledgeUnitRevision: {
							scopeKey: "organization:organization-a",
							logicalKnowledgeUnitId: "logical-a",
							origin: "merchant",
						},
					},
				],
			},
			testCapabilityVersion: null,
		});

		await expect(
			createXiaofeiTestTurn("organization-a", {
				testSessionId: "session-a",
				expectedPreviousTestTurnId: null,
				question: "What is the policy?",
				answer: "Actual answer.",
				capabilityVersionId: "active-version",
				conversationState,
				runtimeMetadata: {
					...runtimeMetadata,
					knowledgeEvidence: {
						logicalKnowledgeUnitId: "forged-logical-id",
						knowledgeUnitRevisionId: "revision-a",
						capabilityVersionId: "active-version",
						capabilityKey: "xiaofei-hosting",
						knowledgeUnitOrigin: "merchant",
					},
				},
				requestedAt: new Date("2026-08-04T00:00:00.000Z"),
				completedAt: new Date("2026-08-04T00:00:01.000Z"),
			}),
		).rejects.toBeInstanceOf(XiaofeiVersioningNotFoundError);
		expect(queryMocks.createTestTurn).not.toHaveBeenCalled();
	});

	it("derives rerun lineage in one transaction and stores only its saved actual answer", async () => {
		queryMocks.findResponseIntervention.mockResolvedValueOnce({
			id: "intervention-a",
			resultCapabilityVersionId: "result-version",
			afterResponse: null,
			sourceTestTurn: {
				id: "source-turn",
				testSessionId: "saved-session",
				question: "Saved source question",
			},
		});
		queryMocks.findTestTurn.mockResolvedValueOnce(null);
		queryMocks.findHostingBindingInTransaction.mockResolvedValueOnce({
			activeCapabilityVersion: null,
			testCapabilityVersion: {
				id: "result-version",
				capabilityKey: "xiaofei-hosting",
				knowledgeUnits: [],
			},
		});
		queryMocks.createTestTurn.mockResolvedValueOnce({
			id: "rerun-turn",
			answer: "Actual rerun answer.",
			runtimeMetadata,
		});
		queryMocks.updateResponseInterventionMany.mockResolvedValueOnce({ count: 1 });

		await createXiaofeiTestTurnRerun("organization-a", {
			interventionId: "intervention-a",
			testSessionId: "rerun-session",
			expectedPreviousTestTurnId: null,
			answer: "Actual rerun answer.",
			capabilityVersionId: "result-version",
			conversationState,
			runtimeMetadata,
			requestedAt: new Date("2026-08-04T00:00:02.000Z"),
			completedAt: new Date("2026-08-04T00:00:03.000Z"),
		});

		expect(queryMocks.createTestTurn).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					testSessionId: "rerun-session",
					question: "Saved source question",
					sourceTestTurnId: "source-turn",
					rerunOfTestTurnId: "source-turn",
					interventionId: "intervention-a",
				}),
			}),
		);
		expect(queryMocks.updateResponseInterventionMany).toHaveBeenCalledWith(
			expect.objectContaining({
				data: { afterResponse: { answer: "Actual rerun answer.", runtimeMetadata } },
			}),
		);
	});

	it.each([
		["no-hit", null],
		[
			"platform",
			{
				id: "platform-revision",
				origin: "platform",
			},
		],
	])(
		"supplements %s feedback as a new merchant KU without changing the baseline",
		async (_, evidence) => {
			queryMocks.findTestTurn.mockResolvedValueOnce({
				id: "source-turn",
				evidenceRevisionId: evidence?.id ?? null,
				evidenceRevision: evidence,
				capabilityVersionId: "before-version",
				question: "星云灯适合多大房间？",
				answer: "请提供型号后人工确认。",
				runtimeMetadata,
				capabilityVersion: {
					capabilityKey: "xiaofei-hosting",
					knowledgeUnits: [
						{
							knowledgeUnitRevisionId: "platform-revision",
							role: "fallback",
							priority: 0,
						},
					],
				},
			});
			queryMocks.findResponseIntervention.mockResolvedValueOnce(null);
			queryMocks.findRevision.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
			queryMocks.createRevision.mockResolvedValueOnce({
				id: "result-supplement-revision",
				scopeKey: "organization:organization-a",
			});
			queryMocks.findRevisions.mockResolvedValueOnce([
				{
					id: "platform-revision",
					scopeKey: "platform",
					origin: "platform",
					logicalKnowledgeUnitId: "platform:baseline",
				},
				{
					id: "result-supplement-revision",
					scopeKey: "organization:organization-a",
					origin: "merchant",
					logicalKnowledgeUnitId: "merchant:test-turn:source-turn",
				},
			]);
			queryMocks.findCapabilityVersion.mockResolvedValueOnce(null);
			queryMocks.createCapabilityVersion.mockResolvedValueOnce({ id: "result-version" });
			queryMocks.createResponseIntervention.mockResolvedValueOnce({ id: "intervention-a" });

			await expect(
				applyXiaofeiTestTurnFeedback({
					organizationId: "organization-a",
					sourceTestTurnId: "source-turn",
					correction: "星云灯适合不超过 20 平方米的房间。",
				}),
			).resolves.toEqual(
				expect.objectContaining({
					resultRevision: expect.objectContaining({ id: "result-supplement-revision" }),
					resultVersion: expect.objectContaining({ id: "result-version" }),
				}),
			);

			expect(queryMocks.createRevision).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						origin: "merchant",
						content: expect.objectContaining({
							status: "released",
							standardReplyPolicy: "星云灯适合不超过 20 平方米的房间。",
						}),
					}),
				}),
			);
			expect(queryMocks.createResponseIntervention).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						beforeKnowledgeRevisionScopeKey: null,
						beforeKnowledgeRevisionId: null,
					}),
				}),
			);
			expect(queryMocks.createCapabilityKnowledgeUnits).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.arrayContaining([
						expect.objectContaining({ knowledgeUnitRevisionId: "platform-revision" }),
						expect.objectContaining({ knowledgeUnitRevisionId: "result-supplement-revision" }),
					]),
				}),
			);
			expect(queryMocks.upsertCapabilityBinding).toHaveBeenCalledWith(
				expect.objectContaining({ update: { testCapabilityVersionId: "result-version" } }),
			);
		},
	);

	it("returns only an exact normalized retry and rejects a different correction", async () => {
		const source = {
			id: "source-turn",
			evidenceRevisionId: "merchant-revision",
			evidenceRevision: {
				origin: "merchant",
				content: {
					id: "knowledge-unit",
					title: "Saved knowledge",
					status: "released",
					standardReplyPolicy: "Old policy.",
					fallbackReply: "Fallback.",
					sourceSection: "FAQ",
					quality: { status: "passed" },
				},
			},
			capabilityVersion: {
				capabilityKey: "xiaofei-hosting",
				knowledgeUnits: [{ knowledgeUnitRevisionId: "merchant-revision" }],
			},
		};
		queryMocks.findTestTurn.mockResolvedValue(source);
		queryMocks.findResponseIntervention.mockResolvedValue({
			correction: "Same correction.",
			resultKnowledgeRevision: { id: "result-revision" },
			resultCapabilityVersion: { id: "result-version" },
		});

		await expect(
			applyXiaofeiTestTurnFeedback({
				organizationId: "organization-a",
				sourceTestTurnId: "source-turn",
				correction: "  Same correction.\r\n",
			}),
		).resolves.toEqual(expect.objectContaining({ sourceTestTurn: source }));
		await expect(
			applyXiaofeiTestTurnFeedback({
				organizationId: "organization-a",
				sourceTestTurnId: "source-turn",
				correction: "Different correction.",
			}),
		).rejects.toBeInstanceOf(XiaofeiTestTurnFeedbackConflictError);
	});

	it("rejects reruns that do not use the intervention result CA", async () => {
		queryMocks.findResponseIntervention.mockResolvedValueOnce({
			id: "intervention-a",
			resultCapabilityVersionId: "result-version",
			sourceTestTurn: { id: "source-turn", testSessionId: "saved-session", question: "Saved" },
		});
		await expect(
			createXiaofeiTestTurnRerun("organization-a", {
				interventionId: "intervention-a",
				testSessionId: "rerun-session",
				expectedPreviousTestTurnId: null,
				answer: "Actual rerun answer.",
				capabilityVersionId: "wrong-version",
				conversationState,
				runtimeMetadata,
				requestedAt: new Date("2026-08-04T00:00:02.000Z"),
				completedAt: new Date("2026-08-04T00:00:03.000Z"),
			}),
		).rejects.toBeInstanceOf(XiaofeiVersioningNotFoundError);
	});

	it("derives the corrected revision from saved evidence instead of caller content", async () => {
		const evidenceRevision = {
			id: "merchant-revision",
			scopeKey: "organization:organization-a",
			origin: "merchant",
			logicalKnowledgeUnitId: "logical-ku",
			knowledgeUnitId: "knowledge-unit",
			content: {
				id: "knowledge-unit",
				title: "Saved knowledge",
				status: "released",
				standardReplyPolicy: "Old policy.",
				fallbackReply: "Fallback.",
				sourceSection: "FAQ",
				quality: { status: "passed" },
			},
		};
		queryMocks.findTestTurn.mockResolvedValueOnce({
			id: "source-turn",
			evidenceRevisionId: "merchant-revision",
			evidenceRevision,
			capabilityVersionId: "before-version",
			question: "Question from saved turn",
			answer: "Answer from saved turn",
			runtimeMetadata,
			capabilityVersion: {
				capabilityKey: "xiaofei-hosting",
				knowledgeUnits: [{ knowledgeUnitRevisionId: "merchant-revision" }],
			},
		});
		queryMocks.findResponseIntervention.mockResolvedValueOnce(null);
		queryMocks.findRevisionById.mockResolvedValueOnce(evidenceRevision);
		queryMocks.findCapabilityVersion
			.mockResolvedValueOnce({
				id: "before-version",
				capabilityKey: "xiaofei-hosting",
				knowledgeUnits: [
					{
						knowledgeUnitRevisionId: "merchant-revision",
						role: "primary",
						priority: 0,
					},
				],
			})
			.mockResolvedValueOnce(null);
		queryMocks.findRevision.mockResolvedValueOnce(null).mockResolvedValueOnce({ revision: 1 });
		queryMocks.createRevision.mockResolvedValueOnce({
			id: "result-revision",
			scopeKey: "organization:organization-a",
			origin: "merchant",
			logicalKnowledgeUnitId: "logical-ku",
		});
		queryMocks.findRevisions.mockResolvedValueOnce([
			{
				id: "result-revision",
				scopeKey: "organization:organization-a",
				origin: "merchant",
				logicalKnowledgeUnitId: "logical-ku",
			},
		]);
		queryMocks.createCapabilityVersion.mockResolvedValueOnce({ id: "result-version" });
		queryMocks.createResponseIntervention.mockResolvedValueOnce({ id: "intervention-a" });

		await applyXiaofeiTestTurnFeedback({
			organizationId: "organization-a",
			sourceTestTurnId: "source-turn",
			correction: "New approved policy.",
		});

		expect(queryMocks.createRevision).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					content: expect.objectContaining({
						id: "knowledge-unit",
						fallbackReply: "Fallback.",
						standardReplyPolicy: "New approved policy.",
					}),
				}),
			}),
		);
		expect(queryMocks.updateTestTurn).toHaveBeenCalledWith(
			expect.objectContaining({ data: { interventionId: "intervention-a" } }),
		);
		expect(queryMocks.transaction).toHaveBeenLastCalledWith(expect.any(Function), {
			maxWait: 5_000,
			timeout: 15_000,
		});
	});

	it("rejects whitespace-only feedback before creating a revision, intervention, or Test pointer", async () => {
		queryMocks.findTestTurn.mockResolvedValueOnce({
			id: "source-turn",
			evidenceRevisionId: "merchant-revision",
			evidenceRevision: {
				origin: "merchant",
				content: {
					id: "knowledge-unit",
					title: "Saved knowledge",
					status: "released",
					standardReplyPolicy: "Old policy.",
					fallbackReply: "Fallback.",
					sourceSection: "FAQ",
					quality: { status: "passed" },
				},
			},
			capabilityVersion: {
				capabilityKey: "xiaofei-hosting",
				knowledgeUnits: [{ knowledgeUnitRevisionId: "merchant-revision" }],
			},
		});

		await expect(
			applyXiaofeiTestTurnFeedback({
				organizationId: "organization-a",
				sourceTestTurnId: "source-turn",
				correction: " \r\n ",
			}),
		).rejects.toThrow();

		expect(queryMocks.findResponseIntervention).not.toHaveBeenCalled();
		expect(queryMocks.createRevision).not.toHaveBeenCalled();
		expect(queryMocks.createResponseIntervention).not.toHaveBeenCalled();
		expect(queryMocks.upsertCapabilityBinding).not.toHaveBeenCalled();
	});
});

describe("Xiaofei knowledge document queries", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		queryMocks.createDocument.mockResolvedValue({
			id: "document-1",
			sourceType: "FILE",
			originalFileName: "guide.md",
			mimeType: "text/markdown",
			fileType: "MARKDOWN",
			sourceUrl: null,
			contentHash: "document-hash",
			sourceVersion: 1,
		});
		queryMocks.createEntries.mockResolvedValue([]);
		queryMocks.queryRaw.mockResolvedValue([
			{
				documentCount: BigInt(0),
				storedBodyBytes: BigInt(0),
			},
		]);
		queryMocks.findDocumentInTransaction.mockResolvedValue({
			bodyText: "Existing body",
		});
		queryMocks.updateDocumentInTransaction.mockResolvedValue({
			id: "document-1",
			sourceType: "FILE",
			originalFileName: "guide.md",
			mimeType: "text/markdown",
			fileType: "MARKDOWN",
			sourceUrl: null,
		});
		queryMocks.invalidateUnits.mockResolvedValue({ count: 0 });
	});

	it("serializes workspace writes and persists normalized document content", async () => {
		const input = {
			workspaceId: "workspace-a",
			originalFileName: "guide.md",
			mimeType: "text/markdown",
			fileType: "MARKDOWN" as const,
			category: "PRESALES" as const,
			bodyText: "# Guide",
		};

		await createXiaofeiKnowledgeDocument(input);

		expect(queryMocks.transaction).toHaveBeenCalledOnce();
		expect(queryMocks.executeRaw).toHaveBeenCalledOnce();
		expect(queryMocks.queryRaw).toHaveBeenCalledOnce();
		expect(queryMocks.createDocument).toHaveBeenCalledWith({
			data: expect.objectContaining(input),
		});
	});

	it("atomically creates one source and all derived entries under one workspace lock", async () => {
		queryMocks.createEntries.mockResolvedValueOnce([{ id: "entry-1" }, { id: "entry-2" }]);
		queryMocks.queryRaw
			.mockResolvedValueOnce([{ count: BigInt(2), bodyBytes: BigInt(100) }])
			.mockResolvedValueOnce([{ count: BigInt(3), bodyBytes: BigInt(200) }]);

		const result = await createXiaofeiKnowledgeDocumentWithEntries({
			document: {
				workspaceId: "workspace-a",
				originalFileName: "guide.md",
				mimeType: "text/markdown",
				fileType: "MARKDOWN",
				category: "PRESALES",
				bodyText: "# Guide",
			},
			entries: [
				{ question: "Question 1", answer: "Answer 1", tags: ["source"] },
				{ question: "Question 2", answer: "Answer 2", tags: ["source"] },
			],
		});

		expect(queryMocks.transaction).toHaveBeenCalledOnce();
		expect(queryMocks.executeRaw).toHaveBeenCalledOnce();
		expect(queryMocks.queryRaw).toHaveBeenCalledTimes(2);
		expect(queryMocks.createDocument).toHaveBeenCalledOnce();
		expect(queryMocks.createEntries).toHaveBeenCalledWith({
			data: [
				expect.objectContaining({
					workspaceId: "workspace-a",
					sourceId: "document-1",
					sourceContentHash: "document-hash",
					sourceVersion: 1,
					question: "Question 1",
				}),
				expect.objectContaining({
					workspaceId: "workspace-a",
					sourceId: "document-1",
					sourceContentHash: "document-hash",
					sourceVersion: 1,
					question: "Question 2",
				}),
			],
		});
		expect(result.entries).toEqual([{ id: "entry-1" }, { id: "entry-2" }]);
	});

	it("rejects creates above the fixed workspace document count", async () => {
		queryMocks.queryRaw.mockResolvedValueOnce([
			{
				documentCount: BigInt(MAX_XIAOFEI_KNOWLEDGE_DOCUMENTS_PER_WORKSPACE),
				storedBodyBytes: BigInt(0),
			},
		]);

		await expect(
			createXiaofeiKnowledgeDocument({
				workspaceId: "workspace-a",
				originalFileName: "guide.md",
				mimeType: "text/markdown",
				fileType: "MARKDOWN",
				category: "PRESALES",
				bodyText: "# Guide",
			}),
		).rejects.toEqual(
			expect.objectContaining({
				name: "XiaofeiKnowledgeDocumentQuotaError",
				quota: "document_count",
				limit: MAX_XIAOFEI_KNOWLEDGE_DOCUMENTS_PER_WORKSPACE,
			}),
		);
		expect(queryMocks.createDocument).not.toHaveBeenCalled();
	});

	it("rejects creates above the fixed workspace stored-body ceiling", async () => {
		queryMocks.queryRaw.mockResolvedValueOnce([
			{
				documentCount: BigInt(1),
				storedBodyBytes: BigInt(MAX_XIAOFEI_KNOWLEDGE_DOCUMENT_BODY_BYTES_PER_WORKSPACE - 1),
			},
		]);

		await expect(
			createXiaofeiKnowledgeDocument({
				workspaceId: "workspace-a",
				originalFileName: "guide.md",
				mimeType: "text/markdown",
				fileType: "MARKDOWN",
				category: "PRESALES",
				bodyText: "too large",
			}),
		).rejects.toEqual(
			expect.objectContaining({
				name: "XiaofeiKnowledgeDocumentQuotaError",
				quota: "stored_body_bytes",
				limit: MAX_XIAOFEI_KNOWLEDGE_DOCUMENT_BODY_BYTES_PER_WORKSPACE,
			}),
		);
		expect(queryMocks.createDocument).not.toHaveBeenCalled();
	});

	it("returns a bounded metadata-only page with a workspace-scoped cursor", async () => {
		const records = [
			{
				id: "document-3",
				sourceType: "FILE",
				originalFileName: "guide.md",
				mimeType: "text/markdown",
				fileType: "MARKDOWN",
				sourceUrl: null,
			},
			{
				id: "document-2",
				sourceType: "MANUAL",
				originalFileName: null,
				mimeType: null,
				fileType: null,
				sourceUrl: null,
			},
			{
				id: "document-1",
				sourceType: "WEB",
				originalFileName: null,
				mimeType: null,
				fileType: null,
				sourceUrl: "https://example.com/guide",
			},
		];
		queryMocks.listDocuments.mockResolvedValueOnce(records);

		const page = await listXiaofeiKnowledgeDocuments("workspace-a", {
			cursor: "document-4",
			limit: 2,
		});

		expect(queryMocks.listDocuments).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { workspaceId: "workspace-a" },
				cursor: {
					workspaceId_id: {
						workspaceId: "workspace-a",
						id: "document-4",
					},
				},
				skip: 1,
				take: 3,
				orderBy: [{ createdAt: "desc" }, { id: "desc" }],
				select: expect.not.objectContaining({ bodyText: true }),
			}),
		);
		expect(page).toEqual({
			items: [
				{ ...records[0], sourceFileType: "MARKDOWN" },
				{
					...records[1],
					sourceFileType: null,
					originalFileName: "manual-source-document-2",
					mimeType: "text/plain",
					fileType: "TEXT",
				},
			],
			nextCursor: "document-2",
		});
	});

	it("rejects list limits outside the database maximum", async () => {
		await expect(
			listXiaofeiKnowledgeDocuments("workspace-a", { limit: 51 }),
		).rejects.toBeInstanceOf(RangeError);
		expect(queryMocks.listDocuments).not.toHaveBeenCalled();
	});

	it("keeps full body retrieval in the workspace-scoped get query", async () => {
		await getXiaofeiKnowledgeDocument("workspace-a", "document-1");

		expect(queryMocks.findDocument).toHaveBeenCalledWith({
			where: {
				workspaceId_id: {
					workspaceId: "workspace-a",
					id: "document-1",
				},
			},
		});
	});

	it("projects nullable web and manual metadata into deterministic legacy fields", async () => {
		queryMocks.findDocument.mockResolvedValueOnce({
			id: "document-web",
			sourceType: "WEB",
			originalFileName: null,
			mimeType: null,
			fileType: "PDF",
			sourceUrl: "https://example.com/help",
		});

		await expect(getXiaofeiKnowledgeDocument("workspace-a", "document-web")).resolves.toEqual({
			id: "document-web",
			sourceType: "WEB",
			sourceFileType: "PDF",
			originalFileName: "https://example.com/help",
			mimeType: "text/html",
			fileType: "TEXT",
			sourceUrl: "https://example.com/help",
		});
	});

	it("enforces stored-body quota atomically for body updates", async () => {
		queryMocks.queryRaw.mockResolvedValueOnce([
			{
				documentCount: BigInt(2),
				storedBodyBytes: BigInt(MAX_XIAOFEI_KNOWLEDGE_DOCUMENT_BODY_BYTES_PER_WORKSPACE),
			},
		]);
		queryMocks.findDocumentInTransaction.mockResolvedValueOnce({
			bodyText: "x",
		});

		await expect(
			updateXiaofeiKnowledgeDocument("workspace-a", "document-1", {
				bodyText: "too large",
			}),
		).rejects.toMatchObject({
			name: "XiaofeiKnowledgeDocumentQuotaError",
			quota: "stored_body_bytes",
		});
		expect(queryMocks.updateDocumentInTransaction).not.toHaveBeenCalled();
	});

	it("invalidates entries when source metadata changes", async () => {
		await updateXiaofeiKnowledgeDocument("workspace-a", "document-1", {
			status: "active",
		});

		expect(queryMocks.transaction).toHaveBeenCalledOnce();
		expect(queryMocks.updateDocumentInTransaction).toHaveBeenCalledWith({
			where: {
				workspaceId_id: {
					workspaceId: "workspace-a",
					id: "document-1",
				},
			},
			data: { status: "active", sourceVersion: { increment: 1 } },
		});
		expect(queryMocks.invalidateUnits).toHaveBeenCalledWith({
			where: { workspaceId: "workspace-a", sourceId: "document-1" },
			data: { status: "draft", eligibility: "stale", staleReason: "source_updated" },
		});
	});

	it("serializes workspace-scoped deletes with quota-changing writes", async () => {
		await deleteXiaofeiKnowledgeDocument("workspace-a", "document-1");

		expect(queryMocks.executeRaw).toHaveBeenCalledOnce();
		expect(queryMocks.deleteDocuments).toHaveBeenCalledWith({
			where: {
				workspaceId: "workspace-a",
				id: "document-1",
			},
		});
		expect(queryMocks.invalidateUnits).toHaveBeenCalledWith({
			where: { workspaceId: "workspace-a", sourceId: "document-1" },
			data: { status: "draft", eligibility: "stale", staleReason: "source_deleted" },
		});
	});

	it("snapshots a workspace-scoped source when creating an entry", async () => {
		queryMocks.findDocumentInTransaction.mockResolvedValueOnce({
			contentHash: "source-hash",
			sourceVersion: 3,
		});
		queryMocks.queryRaw.mockResolvedValueOnce([{ count: BigInt(0), bodyBytes: BigInt(0) }]);

		await createXiaofeiKnowledgeEntry({
			workspaceId: "workspace-a",
			sourceId: "source-1",
			question: "How does this work?",
			answer: "Like this.",
		});

		expect(queryMocks.findDocumentInTransaction).toHaveBeenCalledWith({
			where: { workspaceId_id: { workspaceId: "workspace-a", id: "source-1" } },
			select: { contentHash: true, sourceVersion: true },
		});
		expect(queryMocks.createEntry).toHaveBeenCalledWith({
			data: expect.objectContaining({
				sourceContentHash: "source-hash",
				sourceVersion: 3,
			}),
		});
	});

	it("makes an entry ineligible when its source version or hash changes", async () => {
		queryMocks.findEntry.mockResolvedValueOnce({
			id: "entry-1",
			sourceContentHash: "old-hash",
			sourceVersion: 2,
			source: { id: "source-1", contentHash: "new-hash", sourceVersion: 3 },
		});

		await expect(getXiaofeiKnowledgeEntry("workspace-a", "entry-1")).resolves.toEqual(
			expect.objectContaining({ id: "entry-1", eligible: false }),
		);
		expect(queryMocks.findEntry).toHaveBeenCalledWith({
			where: { workspaceId_id: { workspaceId: "workspace-a", id: "entry-1" } },
			include: expect.any(Object),
		});
	});

	it("makes an entry ineligible when its source was deleted with SetNull", async () => {
		queryMocks.findEntry.mockResolvedValueOnce({
			id: "entry-deleted-source",
			sourceContentHash: "old-hash",
			sourceVersion: 1,
			source: null,
		});
		await expect(getXiaofeiKnowledgeEntry("workspace-a", "entry-deleted-source")).resolves.toEqual(
			expect.objectContaining({ id: "entry-deleted-source", eligible: false }),
		);
	});

	it("keeps legacy null-hash entries eligible until a source update increments the version", async () => {
		queryMocks.findEntry.mockResolvedValueOnce({
			id: "entry-legacy",
			sourceContentHash: null,
			sourceVersion: 1,
			source: { id: "source-legacy", contentHash: null, sourceVersion: 1 },
		});
		await expect(getXiaofeiKnowledgeEntry("workspace-a", "entry-legacy")).resolves.toEqual(
			expect.objectContaining({ id: "entry-legacy", eligible: true }),
		);

		await updateXiaofeiKnowledgeDocument("workspace-a", "source-legacy", { status: "active" });
		expect(queryMocks.updateDocumentInTransaction).toHaveBeenCalledWith({
			where: { workspaceId_id: { workspaceId: "workspace-a", id: "source-legacy" } },
			data: { status: "active", sourceVersion: { increment: 1 } },
		});

		queryMocks.findEntry.mockResolvedValueOnce({
			id: "entry-legacy",
			sourceContentHash: null,
			sourceVersion: 1,
			source: { id: "source-legacy", contentHash: null, sourceVersion: 2 },
		});
		await expect(getXiaofeiKnowledgeEntry("workspace-a", "entry-legacy")).resolves.toEqual(
			expect.objectContaining({ id: "entry-legacy", eligible: false }),
		);
	});

	it("returns entry list eligibility and rejects cross-workspace entry deletes", async () => {
		queryMocks.listEntries.mockResolvedValueOnce([
			{
				id: "entry-2",
				sourceContentHash: "hash",
				sourceVersion: 1,
				source: { id: "source-2", contentHash: "hash", sourceVersion: 1 },
			},
		]);
		const page = await listXiaofeiKnowledgeEntries("workspace-a");
		expect(page.items).toEqual([expect.objectContaining({ id: "entry-2", eligible: true })]);

		await deleteXiaofeiKnowledgeEntry("workspace-a", "entry-2");
		expect(queryMocks.deleteEntries).toHaveBeenCalledWith({
			where: { workspaceId: "workspace-a", id: "entry-2" },
		});
	});

	it("rejects entry creates above the workspace count quota", async () => {
		queryMocks.findDocumentInTransaction.mockResolvedValueOnce({
			contentHash: "hash",
			sourceVersion: 1,
		});
		queryMocks.queryRaw.mockResolvedValueOnce([
			{ count: BigInt(MAX_XIAOFEI_KNOWLEDGE_ENTRIES_PER_WORKSPACE), bodyBytes: BigInt(0) },
		]);
		await expect(
			createXiaofeiKnowledgeEntry({
				workspaceId: "workspace-a",
				sourceId: "source-1",
				question: "q",
				answer: "a",
			}),
		).rejects.toMatchObject({
			name: "XiaofeiKnowledgeEntryQuotaError",
			quota: "entry_count",
		});
		expect(queryMocks.createEntry).not.toHaveBeenCalled();
	});

	it("scopes entry updates to their workspace", async () => {
		queryMocks.findEntryInTransaction.mockResolvedValueOnce(null);
		await updateXiaofeiKnowledgeEntry("workspace-a", "entry-1", { status: "active" });
		expect(queryMocks.updateEntry).toHaveBeenCalledWith({
			where: { workspaceId_id: { workspaceId: "workspace-a", id: "entry-1" } },
			data: { status: "active" },
		});
	});

	it("increments entry lineage and invalidates dependent KUs in the same transaction", async () => {
		queryMocks.findEntryInTransaction.mockResolvedValueOnce({
			question: "q",
			answer: "a",
			similarQueries: [],
			sourceId: "source-1",
			sourceContentHash: "hash-1",
			sourceVersion: 2,
			status: "draft",
		});
		queryMocks.findDocumentInTransaction.mockResolvedValueOnce({
			contentHash: "hash-1",
			sourceVersion: 2,
		});
		queryMocks.queryRaw.mockResolvedValueOnce([{ count: BigInt(1), bodyBytes: BigInt(2) }]);
		await updateXiaofeiKnowledgeEntry("workspace-a", "entry-1", { status: "active" });
		expect(queryMocks.updateEntry).toHaveBeenCalledWith({
			where: { workspaceId_id: { workspaceId: "workspace-a", id: "entry-1" } },
			data: { status: "active", entryVersion: { increment: 1 } },
		});
		expect(queryMocks.invalidateUnits).toHaveBeenCalledWith({
			where: { workspaceId: "workspace-a", entryId: "entry-1" },
			data: { status: "draft", eligibility: "stale", staleReason: "entry_updated" },
		});
	});

	it("rejects activation when the source changed before the locked mutation", async () => {
		queryMocks.findEntryInTransaction.mockResolvedValueOnce({
			question: "q",
			answer: "a",
			similarQueries: [],
			sourceId: "source-1",
			sourceContentHash: "old-hash",
			sourceVersion: 1,
			status: "draft",
		});
		queryMocks.findDocumentInTransaction.mockResolvedValueOnce({
			contentHash: "new-hash",
			sourceVersion: 2,
		});

		await expect(
			updateXiaofeiKnowledgeEntry("workspace-a", "entry-1", { status: "active" }),
		).rejects.toBeInstanceOf(XiaofeiKnowledgeEntryEligibilityError);

		expect(queryMocks.executeRaw).toHaveBeenCalledOnce();
		expect(queryMocks.updateEntry).not.toHaveBeenCalled();
		expect(queryMocks.invalidateUnits).not.toHaveBeenCalled();
	});

	it("invalidates dependent KUs before deleting an entry", async () => {
		await deleteXiaofeiKnowledgeEntry("workspace-a", "entry-1");
		expect(queryMocks.invalidateUnits).toHaveBeenCalledWith({
			where: { workspaceId: "workspace-a", entryId: "entry-1" },
			data: { status: "draft", eligibility: "stale", staleReason: "entry_deleted" },
		});
	});

	it("persists KU lineage from an eligible entry and defaults its review state", async () => {
		queryMocks.findEntryInTransaction.mockResolvedValueOnce({
			sourceId: "source-1",
			sourceContentHash: "hash-1",
			sourceVersion: 2,
			entryVersion: 3,
		});
		queryMocks.findDocumentInTransaction.mockResolvedValueOnce({
			contentHash: "hash-1",
			sourceVersion: 2,
		});
		await createXiaofeiKnowledgeUnit({
			workspaceId: "workspace-a",
			entryId: "entry-1",
			title: "Draft unit",
			content: { title: "Draft unit" },
		});
		expect(queryMocks.createUnit).toHaveBeenCalledWith({
			data: expect.objectContaining({
				workspaceId: "workspace-a",
				entryId: "entry-1",
				sourceId: "source-1",
				sourceContentHash: "hash-1",
				sourceVersion: 2,
				entryVersion: 3,
			}),
		});
	});
});

describe("Xiaofei inbound event queries", () => {
	const input = {
		source: "kafka",
		eventId: "event-1",
		schemaVersion: "1",
		transportKind: "kafka",
		topic: "support.events",
		partition: 2,
		offset: "9007199254740993",
		eventType: "ticket.created",
		occurredAt: new Date("2026-07-29T00:00:00.000Z"),
		payload: { ticket: { id: "ticket-1" }, tags: ["new"] },
	};

	beforeEach(() => {
		vi.clearAllMocks();
		queryMocks.createInboundEvent.mockResolvedValue({ id: "inbound-1", ...input });
	});

	it("creates a workspace-bound event and hashes canonical JSON without logging its payload", async () => {
		const result = await acceptInboundEvent("workspace-a", input);

		expect(result.kind).toBe("created");
		expect(queryMocks.createInboundEvent).toHaveBeenCalledWith({
			data: expect.objectContaining({
				workspaceId: "workspace-a",
				offset: "9007199254740993",
				payload: input.payload,
				payloadHash: expect.stringMatching(/^[a-f0-9]{64}$/),
			}),
		});
	});

	it("treats a concurrent unique replay with the same payload as a duplicate", async () => {
		queryMocks.createInboundEvent.mockRejectedValueOnce({ code: "P2002" });
		queryMocks.findInboundEventInTransaction.mockResolvedValueOnce({
			id: "inbound-1",
			payloadHash: "45fd78b4f47df8dba9db2824c0aca23921a1288451c9a3a2745b971150b4652c",
		});
		queryMocks.updateInboundEvent.mockResolvedValueOnce({ id: "inbound-1", deliveryCount: 2 });

		const result = await acceptInboundEvent("workspace-a", input);

		expect(result.kind).toBe("duplicate");
		expect(queryMocks.updateInboundEvent).toHaveBeenCalledWith({
			where: {
				workspaceId_source_eventId: {
					workspaceId: "workspace-a",
					source: "kafka",
					eventId: "event-1",
				},
			},
			data: { deliveryCount: { increment: 1 }, lastReceivedAt: expect.any(Date) },
		});
	});

	it("rejects same-ID payload conflicts while preserving the existing row", async () => {
		queryMocks.createInboundEvent.mockRejectedValueOnce({ code: "P2002" });
		queryMocks.findInboundEventInTransaction.mockResolvedValueOnce({
			id: "inbound-1",
			payloadHash: "different-hash",
		});

		await expect(acceptInboundEvent("workspace-a", input)).rejects.toBeInstanceOf(
			XiaofeiInboundEventConflictError,
		);
		expect(queryMocks.updateInboundEvent).not.toHaveBeenCalled();
	});

	it("isolates same event IDs across workspaces", async () => {
		await acceptInboundEvent("workspace-b", input);
		expect(queryMocks.createInboundEvent).toHaveBeenCalledWith({
			data: expect.objectContaining({ workspaceId: "workspace-b", eventId: "event-1" }),
		});
	});

	it("returns stable filtered metadata pages and reserves payload for the scoped detail query", async () => {
		queryMocks.listInboundEvents.mockResolvedValueOnce([
			{ id: "inbound-3" },
			{ id: "inbound-2" },
			{ id: "inbound-1" },
		]);
		const page = await listInboundEvents("workspace-a", {
			cursor: "inbound-4",
			limit: 2,
			source: "kafka",
			status: "accepted",
			topic: "support.events",
		});
		expect(page).toEqual({
			items: [{ id: "inbound-3" }, { id: "inbound-2" }],
			nextCursor: "inbound-2",
		});
		expect(queryMocks.listInboundEvents).toHaveBeenCalledWith(
			expect.objectContaining({
				where: {
					workspaceId: "workspace-a",
					source: "kafka",
					status: "accepted",
					topic: "support.events",
				},
				orderBy: [{ createdAt: "desc" }, { id: "desc" }],
				take: 3,
				cursor: { workspaceId_id: { workspaceId: "workspace-a", id: "inbound-4" } },
				skip: 1,
				select: expect.not.objectContaining({ payload: true }),
			}),
		);

		await getInboundEvent("workspace-a", "inbound-1");
		expect(queryMocks.getInboundEvent).toHaveBeenCalledWith({
			where: { workspaceId_id: { workspaceId: "workspace-a", id: "inbound-1" } },
		});
	});
});
