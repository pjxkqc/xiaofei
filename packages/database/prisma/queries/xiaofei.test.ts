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
		xiaofeiConversation: { upsert: vi.fn() },
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
	};

	return {
		createDocument: transactionClient.xiaofeiKnowledgeDocument.create,
		deleteDocuments: transactionClient.xiaofeiKnowledgeDocument.deleteMany,
		executeRaw: transactionClient.$executeRaw,
		findDocument: vi.fn(),
		findDocumentInTransaction: transactionClient.xiaofeiKnowledgeDocument.findUnique,
		listDocuments: vi.fn(),
		queryRaw: transactionClient.$queryRaw,
		transaction: vi.fn(async (callback: (client: typeof transactionClient) => unknown) => {
			return await callback(transactionClient);
		}),
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
		invalidateUnits: transactionClient.xiaofeiKnowledgeUnit.updateMany,
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
	};
});

vi.mock("../client", () => ({
	db: {
		$transaction: queryMocks.transaction,
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
	createXiaofeiKnowledgeEntry,
	createXiaofeiKnowledgeUnit,
	deleteXiaofeiKnowledgeEntry,
	deleteXiaofeiKnowledgeDocument,
	getXiaofeiKnowledgeDocument,
	getXiaofeiKnowledgeEntry,
	listXiaofeiKnowledgeEntries,
	listXiaofeiKnowledgeDocuments,
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
} from "./xiaofei";

describe("Xiaofei Organization queries", () => {
	beforeEach(() => vi.clearAllMocks());

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
			include: { customer: true },
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
