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
	},
}));

import {
	createXiaofeiKnowledgeDocument,
	deleteXiaofeiKnowledgeDocument,
	getXiaofeiKnowledgeDocument,
	listXiaofeiKnowledgeDocuments,
	MAX_XIAOFEI_KNOWLEDGE_DOCUMENT_BODY_BYTES_PER_WORKSPACE,
	MAX_XIAOFEI_KNOWLEDGE_DOCUMENTS_PER_WORKSPACE,
	updateXiaofeiKnowledgeDocument,
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
			data: input,
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

	it("updates metadata without loading or aggregating document bodies", async () => {
		await updateXiaofeiKnowledgeDocument("workspace-a", "document-1", {
			status: "active",
		});

		expect(queryMocks.transaction).not.toHaveBeenCalled();
		expect(queryMocks.updateDocument).toHaveBeenCalledWith({
			where: {
				workspaceId_id: {
					workspaceId: "workspace-a",
					id: "document-1",
				},
			},
			data: { status: "active" },
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
});
