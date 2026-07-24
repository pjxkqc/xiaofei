import { db } from "../client";
import type { KnowledgeDocumentCategory, KnowledgeDocumentType } from "../generated/client";

export interface CreateKnowledgeDocumentInput {
	workspaceId: string;
	originalFileName: string;
	type: KnowledgeDocumentType;
	category: KnowledgeDocumentCategory;
	extractedBody: string;
	status?: string;
}

export interface UpdateKnowledgeDocumentInput {
	originalFileName?: string;
	type?: KnowledgeDocumentType;
	category?: KnowledgeDocumentCategory;
	extractedBody?: string;
	status?: string;
}

function requireWorkspaceId(workspaceId: string) {
	if (!workspaceId.trim()) {
		throw new Error("workspaceId is required");
	}
}

export function createKnowledgeDocument(input: CreateKnowledgeDocumentInput) {
	requireWorkspaceId(input.workspaceId);

	return db.knowledgeDocument.create({
		data: input,
	});
}

export function listKnowledgeDocuments(workspaceId: string) {
	requireWorkspaceId(workspaceId);

	return db.knowledgeDocument.findMany({
		where: { workspaceId },
		orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
	});
}

export function getKnowledgeDocument(workspaceId: string, id: string) {
	requireWorkspaceId(workspaceId);

	return db.knowledgeDocument.findUnique({
		where: {
			workspaceId_id: {
				workspaceId,
				id,
			},
		},
	});
}

export function updateKnowledgeDocument(
	workspaceId: string,
	id: string,
	data: UpdateKnowledgeDocumentInput,
) {
	requireWorkspaceId(workspaceId);

	return db.knowledgeDocument.update({
		where: {
			workspaceId_id: {
				workspaceId,
				id,
			},
		},
		data,
	});
}

export function deleteKnowledgeDocument(workspaceId: string, id: string) {
	requireWorkspaceId(workspaceId);

	return db.knowledgeDocument.delete({
		where: {
			workspaceId_id: {
				workspaceId,
				id,
			},
		},
	});
}
