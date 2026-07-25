import { beforeEach, describe, expect, it, vi } from "vitest";

const queryMocks = vi.hoisted(() => {
	const transactionClient = {
		$executeRaw: vi.fn(),
		$queryRaw: vi.fn(),
		xiaofeiKnowledgeDocument: {
			create: vi.fn(),
			deleteMany: vi.fn(),
			findUnique: vi.fn(),
			update: vi.fn(),
		},
		xiaofeiKnowledgeEntry: {
			create: vi.fn(),
			deleteMany: vi.fn(),
			findUnique: vi.fn(),
			update: vi.fn(),
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
		deleteEntries: transactionClient.xiaofeiKnowledgeEntry.deleteMany,
		findEntry: vi.fn(),
		findEntryInTransaction: transactionClient.xiaofeiKnowledgeEntry.findUnique,
		listEntries: vi.fn(),
		updateEntry: transactionClient.xiaofeiKnowledgeEntry.update,
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
	},
}));

import {
	createXiaofeiKnowledgeDocument,
	createXiaofeiKnowledgeEntry,
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
} from "./xiaofei";

describe("Xiaofei knowledge document queries", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		queryMocks.queryRaw.mockResolvedValue([
			{
				documentCount: BigInt(0),
				storedBodyBytes: BigInt(0),
			},
		]);
		queryMocks.findDocumentInTransaction.mockResolvedValue({
			bodyText: "Existing body",
		});
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
		const records = [{ id: "document-3" }, { id: "document-2" }, { id: "document-1" }];
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
			items: records.slice(0, 2),
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
});
