import { beforeEach, describe, expect, it, vi } from "vitest";

const queryMocks = vi.hoisted(() => ({
	createDocument: vi.fn(),
	deleteDocuments: vi.fn(),
	findDocument: vi.fn(),
	listDocuments: vi.fn(),
	updateDocument: vi.fn(),
}));

vi.mock("../client", () => ({
	db: {
		xiaofeiKnowledgeDocument: {
			create: queryMocks.createDocument,
			deleteMany: queryMocks.deleteDocuments,
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
	updateXiaofeiKnowledgeDocument,
} from "./xiaofei";

describe("Xiaofei knowledge document queries", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("persists normalized document content in its workspace", async () => {
		const input = {
			workspaceId: "workspace-a",
			originalFileName: "guide.md",
			mimeType: "text/markdown",
			fileType: "MARKDOWN" as const,
			category: "PRESALES" as const,
			bodyText: "# Guide",
		};

		await createXiaofeiKnowledgeDocument(input);

		expect(queryMocks.createDocument).toHaveBeenCalledWith({
			data: input,
		});
	});

	it("scopes list and get queries to the requested workspace", async () => {
		await listXiaofeiKnowledgeDocuments("workspace-a");
		await getXiaofeiKnowledgeDocument("workspace-a", "document-1");

		expect(queryMocks.listDocuments).toHaveBeenCalledWith({
			where: { workspaceId: "workspace-a" },
			orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
		});
		expect(queryMocks.findDocument).toHaveBeenCalledWith({
			where: {
				workspaceId_id: {
					workspaceId: "workspace-a",
					id: "document-1",
				},
			},
		});
	});

	it("scopes update and delete mutations to the requested workspace", async () => {
		await updateXiaofeiKnowledgeDocument("workspace-a", "document-1", {
			status: "ready",
			bodyText: "Reviewed text",
		});
		await deleteXiaofeiKnowledgeDocument("workspace-a", "document-1");

		expect(queryMocks.updateDocument).toHaveBeenCalledWith({
			where: {
				workspaceId_id: {
					workspaceId: "workspace-a",
					id: "document-1",
				},
			},
			data: {
				status: "ready",
				bodyText: "Reviewed text",
			},
		});
		expect(queryMocks.deleteDocuments).toHaveBeenCalledWith({
			where: {
				workspaceId: "workspace-a",
				id: "document-1",
			},
		});
	});
});
