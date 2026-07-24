import { z } from "zod";

import { supportProcedure } from "../../../orpc/procedures";
import {
	MAX_KNOWLEDGE_BODY_CHARACTERS,
	createKnowledgeDocument,
	deleteKnowledgeDocumentForTenant,
	getKnowledgeDocument,
	listKnowledgeDocuments,
	updateKnowledgeDocumentForTenant,
} from "../knowledge-documents";

const documentIdSchema = z.string().cuid();
const fileNameSchema = z.string().trim().min(1).max(255);
const categorySchema = z.enum(["PRESALES", "POSTSALES"]);
const statusSchema = z.enum(["draft", "active", "archived"]);

export const createKnowledgeDocumentProcedure = supportProcedure
	.route({
		method: "POST",
		path: "/xiaofei/knowledge/documents",
		tags: ["Xiaofei Knowledge"],
		summary: "Upload and extract a tenant knowledge document",
	})
	.input(
		z.object({
			originalFileName: fileNameSchema,
			mimeType: z.string().trim().min(1).max(150),
			category: categorySchema,
			contentBase64: z.string().max(3_000_000),
		}),
	)
	.handler(async ({ context, input }) => await createKnowledgeDocument(context, input));

export const listKnowledgeDocumentsProcedure = supportProcedure
	.route({
		method: "GET",
		path: "/xiaofei/knowledge/documents",
		tags: ["Xiaofei Knowledge"],
		summary: "List tenant knowledge documents",
	})
	.handler(async ({ context }) => await listKnowledgeDocuments(context));

export const getKnowledgeDocumentProcedure = supportProcedure
	.route({
		method: "GET",
		path: "/xiaofei/knowledge/documents/{id}",
		tags: ["Xiaofei Knowledge"],
		summary: "Get a tenant knowledge document",
	})
	.input(z.object({ id: documentIdSchema }))
	.handler(async ({ context, input }) => await getKnowledgeDocument(context, input.id));

export const updateKnowledgeDocumentProcedure = supportProcedure
	.route({
		method: "PUT",
		path: "/xiaofei/knowledge/documents/{id}",
		tags: ["Xiaofei Knowledge"],
		summary: "Update a tenant knowledge document",
	})
	.input(
		z
			.object({
				id: documentIdSchema,
				originalFileName: fileNameSchema.optional(),
				category: categorySchema.optional(),
				bodyText: z.string().trim().min(1).max(MAX_KNOWLEDGE_BODY_CHARACTERS).optional(),
				status: statusSchema.optional(),
			})
			.refine(
				({ id: _id, ...changes }) => Object.values(changes).some((value) => value !== undefined),
				{ message: "Provide at least one document change." },
			),
	)
	.handler(
		async ({ context, input: { id, ...changes } }) =>
			await updateKnowledgeDocumentForTenant(context, id, changes),
	);

export const deleteKnowledgeDocumentProcedure = supportProcedure
	.route({
		method: "DELETE",
		path: "/xiaofei/knowledge/documents/{id}",
		tags: ["Xiaofei Knowledge"],
		summary: "Delete a tenant knowledge document",
	})
	.input(z.object({ id: documentIdSchema }))
	.handler(async ({ context, input }) => await deleteKnowledgeDocumentForTenant(context, input.id));
