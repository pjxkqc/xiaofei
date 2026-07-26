import { z } from "zod";

import { supportProcedure } from "../../../orpc/procedures";
import {
	knowledgeDocumentIdSchema,
	knowledgeDocumentListInputSchema,
	knowledgeEntryIdSchema,
	knowledgeEntryListInputSchema,
} from "../knowledge-document-input";
import {
	MAX_KNOWLEDGE_BODY_CHARACTERS,
	MAX_KNOWLEDGE_FILE_BYTES,
	createKnowledgeFile,
	createKnowledgeWeb,
	createManualKnowledgeEntries,
	deleteKnowledgeDocumentForTenant,
	deleteKnowledgeEntryForTenant,
	deleteKnowledgeUnitForTenant,
	generateKnowledgeUnitsForTenant,
	getKnowledgeDocument,
	getKnowledgeEntry,
	listKnowledgeDocuments,
	listKnowledgeEntries,
	listKnowledgeUnitsForTenant,
	transitionKnowledgeUnitForTenant,
	updateKnowledgeDocumentForTenant,
	updateKnowledgeEntryForTenant,
	updateKnowledgeUnitForTenant,
} from "../knowledge-documents";

const fileNameSchema = z.string().trim().min(1).max(255);
const categorySchema = z.enum(["PRESALES", "POSTSALES"]);
const statusSchema = z.enum(["draft", "active", "archived"]);
const manualPairSchema = z.object({
	question: z.string().trim().min(1).max(10_000),
	answer: z.string().trim().min(1).max(MAX_KNOWLEDGE_BODY_CHARACTERS),
	similarQueries: z.array(z.string().trim().min(1).max(1_000)).max(20).default([]),
	tags: z.array(z.string().trim().min(1).max(100)).max(20).default([]),
});

export const createKnowledgeDocumentProcedure = supportProcedure
	.route({
		method: "POST",
		path: "/xiaofei/knowledge/documents",
		tags: ["Xiaofei Knowledge"],
		summary: "Upload and normalize a tenant knowledge file",
	})
	.input(
		z.object({
			originalFileName: fileNameSchema,
			mimeType: z.string().trim().min(1).max(150),
			category: categorySchema,
			contentBase64: z.string().max(Math.ceil((MAX_KNOWLEDGE_FILE_BYTES * 4) / 3) + 4),
		}),
	)
	.handler(async ({ context, input }) => await createKnowledgeFile(context, input));

export const createKnowledgeWebProcedure = supportProcedure
	.route({
		method: "POST",
		path: "/xiaofei/knowledge/web",
		tags: ["Xiaofei Knowledge"],
		summary: "Scrape and normalize one public webpage",
	})
	.input(z.object({ url: z.string().trim().min(1).max(2_000), category: categorySchema }))
	.handler(async ({ context, input }) => await createKnowledgeWeb(context, input));

export const createManualKnowledgeEntriesProcedure = supportProcedure
	.route({
		method: "POST",
		path: "/xiaofei/knowledge/manual",
		tags: ["Xiaofei Knowledge"],
		summary: "Create normalized manual Q and A entries",
	})
	.input(z.object({ category: categorySchema, pairs: z.array(manualPairSchema).min(1).max(20) }))
	.handler(async ({ context, input }) => await createManualKnowledgeEntries(context, input));

export const listKnowledgeDocumentsProcedure = supportProcedure
	.route({
		method: "GET",
		path: "/xiaofei/knowledge/documents",
		tags: ["Xiaofei Knowledge"],
		summary: "List tenant knowledge documents",
	})
	.input(knowledgeDocumentListInputSchema)
	.handler(async ({ context, input }) => await listKnowledgeDocuments(context, input));
export const getKnowledgeDocumentProcedure = supportProcedure
	.route({
		method: "GET",
		path: "/xiaofei/knowledge/documents/{id}",
		tags: ["Xiaofei Knowledge"],
		summary: "Get a tenant knowledge document",
	})
	.input(z.object({ id: knowledgeDocumentIdSchema }))
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
				id: knowledgeDocumentIdSchema,
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
	.input(z.object({ id: knowledgeDocumentIdSchema }))
	.handler(async ({ context, input }) => await deleteKnowledgeDocumentForTenant(context, input.id));

export const listKnowledgeEntriesProcedure = supportProcedure
	.route({
		method: "GET",
		path: "/xiaofei/knowledge/entries",
		tags: ["Xiaofei Knowledge"],
		summary: "List normalized tenant knowledge entries",
	})
	.input(knowledgeEntryListInputSchema)
	.handler(async ({ context, input }) => await listKnowledgeEntries(context, input));
export const getKnowledgeEntryProcedure = supportProcedure
	.route({
		method: "GET",
		path: "/xiaofei/knowledge/entries/{id}",
		tags: ["Xiaofei Knowledge"],
		summary: "Get one tenant knowledge entry",
	})
	.input(z.object({ id: knowledgeEntryIdSchema }))
	.handler(async ({ context, input }) => await getKnowledgeEntry(context, input.id));
export const updateKnowledgeEntryProcedure = supportProcedure
	.route({
		method: "PUT",
		path: "/xiaofei/knowledge/entries/{id}",
		tags: ["Xiaofei Knowledge"],
		summary: "Update one normalized tenant knowledge entry",
	})
	.input(
		z
			.object({
				id: knowledgeEntryIdSchema,
				question: manualPairSchema.shape.question.optional(),
				answer: manualPairSchema.shape.answer.optional(),
				similarQueries: manualPairSchema.shape.similarQueries.optional(),
				category: z.string().trim().min(1).max(100).nullable().optional(),
				tags: manualPairSchema.shape.tags.optional(),
				status: statusSchema.optional(),
			})
			.refine(
				({ id: _id, ...changes }) => Object.values(changes).some((value) => value !== undefined),
				{ message: "Provide at least one entry change." },
			),
	)
	.handler(
		async ({ context, input: { id, ...changes } }) =>
			await updateKnowledgeEntryForTenant(context, id, changes),
	);
export const deleteKnowledgeEntryProcedure = supportProcedure
	.route({
		method: "DELETE",
		path: "/xiaofei/knowledge/entries/{id}",
		tags: ["Xiaofei Knowledge"],
		summary: "Delete one normalized tenant knowledge entry",
	})
	.input(z.object({ id: knowledgeEntryIdSchema }))
	.handler(async ({ context, input }) => await deleteKnowledgeEntryForTenant(context, input.id));

const knowledgeUnitIdSchema = z.string().cuid();
const knowledgeUnitEditSchema = z.object({
	title: z.string().trim().min(1).max(500).optional(),
	standardReplyPolicy: z.string().trim().min(1).max(20_000).optional(),
	fallbackReply: z.string().trim().min(1).max(20_000).optional(),
});

export const generateKnowledgeUnitsProcedure = supportProcedure
	.route({
		method: "POST",
		path: "/xiaofei/knowledge/units/generate",
		tags: ["Xiaofei Knowledge"],
		summary: "Generate draft knowledge units from current normalized entries",
	})
	.input(z.object({ entryIds: z.array(knowledgeEntryIdSchema).min(1).max(20) }))
	.handler(
		async ({ context, input }) => await generateKnowledgeUnitsForTenant(context, input.entryIds),
	);
export const listKnowledgeUnitsProcedure = supportProcedure
	.route({
		method: "GET",
		path: "/xiaofei/knowledge/units",
		tags: ["Xiaofei Knowledge"],
		summary: "List tenant knowledge units",
	})
	.handler(async ({ context }) => await listKnowledgeUnitsForTenant(context));
export const updateKnowledgeUnitProcedure = supportProcedure
	.route({
		method: "PUT",
		path: "/xiaofei/knowledge/units/{id}",
		tags: ["Xiaofei Knowledge"],
		summary: "Edit a draft knowledge unit",
	})
	.input(
		z
			.object({ id: knowledgeUnitIdSchema })
			.merge(knowledgeUnitEditSchema)
			.refine(
				({ id: _id, ...changes }) => Object.values(changes).some((value) => value !== undefined),
				{ message: "Provide at least one knowledge-unit change." },
			),
	)
	.handler(
		async ({ context, input: { id, ...changes } }) =>
			await updateKnowledgeUnitForTenant(context, id, changes),
	);
export const transitionKnowledgeUnitProcedure = supportProcedure
	.route({
		method: "POST",
		path: "/xiaofei/knowledge/units/{id}/transition",
		tags: ["Xiaofei Knowledge"],
		summary: "Review, publish, or revoke a knowledge unit",
	})
	.input(
		z.object({
			id: knowledgeUnitIdSchema,
			action: z.enum(["review", "revokeReview", "publish", "revokePublish"]),
		}),
	)
	.handler(
		async ({ context, input }) =>
			await transitionKnowledgeUnitForTenant(context, input.id, input.action),
	);
export const deleteKnowledgeUnitProcedure = supportProcedure
	.route({
		method: "DELETE",
		path: "/xiaofei/knowledge/units/{id}",
		tags: ["Xiaofei Knowledge"],
		summary: "Delete a tenant knowledge unit",
	})
	.input(z.object({ id: knowledgeUnitIdSchema }))
	.handler(async ({ context, input }) => await deleteKnowledgeUnitForTenant(context, input.id));
