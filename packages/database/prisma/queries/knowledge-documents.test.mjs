import { beforeEach, describe, expect, it, vi } from "vitest";

const { knowledgeDocument } = vi.hoisted(() => ({
	knowledgeDocument: {
		create: vi.fn(),
		findMany: vi.fn(),
		findUnique: vi.fn(),
		update: vi.fn(),
		delete: vi.fn(),
	},
}));

vi.mock("../client", () => ({
	db: { knowledgeDocument },
}));

import {
	createKnowledgeDocument,
	deleteKnowledgeDocument,
	getKnowledgeDocument,
	listKnowledgeDocuments,
	updateKnowledgeDocument,
} from "./knowledge-documents";

describe("knowledge document queries", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("requires workspace scope for every operation", () => {
		expect(() =>
			createKnowledgeDocument({
				workspaceId: " ",
				originalFileName: "guide.md",
				type: "MARKDOWN",
				category: "PRESALES",
				extractedBody: "Guide",
			}),
		).toThrow("workspaceId is required");
		expect(() => listKnowledgeDocuments("")).toThrow("workspaceId is required");
		expect(() => getKnowledgeDocument("", "document-1")).toThrow("workspaceId is required");
		expect(() => updateKnowledgeDocument("", "document-1", {})).toThrow("workspaceId is required");
		expect(() => deleteKnowledgeDocument("", "document-1")).toThrow("workspaceId is required");
	});

	it("persists the workspace scope on create", async () => {
		await createKnowledgeDocument({
			workspaceId: "workspace-a",
			originalFileName: "guide.docx",
			type: "DOCX",
			category: "POSTSALES",
			extractedBody: "Guide",
			status: "ACTIVE",
		});

		expect(knowledgeDocument.create).toHaveBeenCalledWith({
			data: {
				workspaceId: "workspace-a",
				originalFileName: "guide.docx",
				type: "DOCX",
				category: "POSTSALES",
				extractedBody: "Guide",
				status: "ACTIVE",
			},
		});
	});

	it("scopes list queries to one workspace", async () => {
		await listKnowledgeDocuments("workspace-a");

		expect(knowledgeDocument.findMany).toHaveBeenCalledWith({
			where: { workspaceId: "workspace-a" },
			orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
		});
	});

	it("cannot read a document through another workspace selector", async () => {
		knowledgeDocument.findUnique.mockImplementation(async ({ where }) =>
			where.workspaceId_id.workspaceId === "workspace-b" && where.workspaceId_id.id === "document-b"
				? { id: "document-b", workspaceId: "workspace-b" }
				: null,
		);

		await expect(getKnowledgeDocument("workspace-a", "document-b")).resolves.toBeNull();
		expect(knowledgeDocument.findUnique).toHaveBeenCalledWith({
			where: {
				workspaceId_id: {
					workspaceId: "workspace-a",
					id: "document-b",
				},
			},
		});
	});

	it("uses the compound workspace selector for update and delete", async () => {
		await updateKnowledgeDocument("workspace-a", "document-1", {
			extractedBody: "Updated",
		});
		await deleteKnowledgeDocument("workspace-a", "document-1");

		const where = {
			workspaceId_id: {
				workspaceId: "workspace-a",
				id: "document-1",
			},
		};
		expect(knowledgeDocument.update).toHaveBeenCalledWith({
			where,
			data: { extractedBody: "Updated" },
		});
		expect(knowledgeDocument.delete).toHaveBeenCalledWith({ where });
	});
});
