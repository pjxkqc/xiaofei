import {
	DEFAULT_XIAOFEI_KNOWLEDGE_DOCUMENT_PAGE_SIZE,
	MAX_XIAOFEI_KNOWLEDGE_DOCUMENT_PAGE_SIZE,
} from "@repo/database";
import { z } from "zod";

export const knowledgeDocumentIdSchema = z.string().cuid();

export const knowledgeDocumentListInputSchema = z.object({
	cursor: knowledgeDocumentIdSchema.optional(),
	limit: z
		.number()
		.int()
		.min(1)
		.max(MAX_XIAOFEI_KNOWLEDGE_DOCUMENT_PAGE_SIZE)
		.default(DEFAULT_XIAOFEI_KNOWLEDGE_DOCUMENT_PAGE_SIZE),
});
