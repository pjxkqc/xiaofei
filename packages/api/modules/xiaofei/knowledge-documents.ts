import { ORPCError } from "@orpc/server";
import {
	createXiaofeiKnowledgeDocument,
	deleteXiaofeiKnowledgeDocument,
	getXiaofeiKnowledgeDocument,
	listXiaofeiKnowledgeDocuments,
	type ListXiaofeiKnowledgeDocumentsOptions,
	updateXiaofeiKnowledgeDocument,
	XiaofeiKnowledgeDocumentCategory,
	XiaofeiKnowledgeDocumentFileType,
	XiaofeiKnowledgeDocumentQuotaError,
} from "@repo/database";
import { strFromU8, unzipSync } from "fflate";

import { verifyOrganizationMembership } from "../organizations/lib/membership";
import type { XiaofeiAuthContext } from "./service";
import { getOrCreateXiaofeiWorkspaceByTenantKey } from "./service";

export const MAX_KNOWLEDGE_FILE_BYTES = 2 * 1024 * 1024;
export const MAX_KNOWLEDGE_BODY_CHARACTERS = 500_000;
const MAX_DOCX_XML_BYTES = 4 * 1024 * 1024;

const FILE_RULES = {
	".docx": {
		fileType: XiaofeiKnowledgeDocumentFileType.DOCX,
		mimeTypes: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
	},
	".md": {
		fileType: XiaofeiKnowledgeDocumentFileType.MARKDOWN,
		mimeTypes: ["text/markdown", "text/plain"],
	},
	".txt": {
		fileType: XiaofeiKnowledgeDocumentFileType.TEXT,
		mimeTypes: ["text/plain"],
	},
} as const;

interface CreateKnowledgeDocumentInput {
	originalFileName: string;
	mimeType: string;
	category: "PRESALES" | "POSTSALES";
	contentBase64: string;
}

interface UpdateKnowledgeDocumentInput {
	originalFileName?: string;
	category?: "PRESALES" | "POSTSALES";
	bodyText?: string;
	status?: "draft" | "active" | "archived";
}

export async function getKnowledgeTenantKey(context: XiaofeiAuthContext): Promise<string> {
	const organizationId = context.session.activeOrganizationId;
	if (!organizationId) return `user:${context.user.id}`;

	const membership = await verifyOrganizationMembership(organizationId, context.user.id);
	if (!membership) {
		throw new ORPCError("FORBIDDEN", {
			message: "You do not have access to the active organization.",
		});
	}
	return `organization:${organizationId}`;
}

export async function createKnowledgeDocument(
	context: XiaofeiAuthContext,
	input: CreateKnowledgeDocumentInput,
) {
	const file = validateAndExtractFile(input);
	const { workspace } = await getKnowledgeWorkspace(context);

	try {
		return await createXiaofeiKnowledgeDocument({
			workspaceId: workspace.id,
			originalFileName: input.originalFileName,
			mimeType: input.mimeType,
			fileType: file.fileType,
			category: XiaofeiKnowledgeDocumentCategory[input.category],
			bodyText: file.bodyText,
		});
	} catch (error) {
		throwKnowledgeDocumentWriteError(error);
	}
}

export async function listKnowledgeDocuments(
	context: XiaofeiAuthContext,
	options: ListXiaofeiKnowledgeDocumentsOptions,
) {
	const { workspace } = await getKnowledgeWorkspace(context);
	return await listXiaofeiKnowledgeDocuments(workspace.id, options);
}

export async function getKnowledgeDocument(context: XiaofeiAuthContext, id: string) {
	const { workspace } = await getKnowledgeWorkspace(context);
	const document = await getXiaofeiKnowledgeDocument(workspace.id, id);
	if (!document) {
		throw new ORPCError("NOT_FOUND", { message: "Knowledge document not found." });
	}
	return document;
}

export async function updateKnowledgeDocumentForTenant(
	context: XiaofeiAuthContext,
	id: string,
	input: UpdateKnowledgeDocumentInput,
) {
	const { workspace } = await getKnowledgeWorkspace(context);
	const existing = await getXiaofeiKnowledgeDocument(workspace.id, id);
	if (!existing) {
		throw new ORPCError("NOT_FOUND", { message: "Knowledge document not found." });
	}

	try {
		return await updateXiaofeiKnowledgeDocument(workspace.id, id, {
			...input,
			category: input.category ? XiaofeiKnowledgeDocumentCategory[input.category] : undefined,
		});
	} catch (error) {
		throwKnowledgeDocumentWriteError(error);
	}
}

export async function deleteKnowledgeDocumentForTenant(context: XiaofeiAuthContext, id: string) {
	const { workspace } = await getKnowledgeWorkspace(context);
	const result = await deleteXiaofeiKnowledgeDocument(workspace.id, id);
	if (result.count === 0) {
		throw new ORPCError("NOT_FOUND", { message: "Knowledge document not found." });
	}
	return { deleted: true };
}

async function getKnowledgeWorkspace(context: XiaofeiAuthContext) {
	return await getOrCreateXiaofeiWorkspaceByTenantKey(await getKnowledgeTenantKey(context));
}

function validateAndExtractFile(input: CreateKnowledgeDocumentInput): {
	fileType: XiaofeiKnowledgeDocumentFileType;
	bodyText: string;
} {
	const extension = getFileExtension(input.originalFileName);
	const rule = FILE_RULES[extension as keyof typeof FILE_RULES];
	if (!rule || !rule.mimeTypes.includes(input.mimeType as never)) {
		throw new ORPCError("BAD_REQUEST", {
			message: "Upload a .md, .txt, or .docx file with a matching content type.",
		});
	}

	const bytes = decodeBase64(input.contentBase64);
	if (bytes.byteLength === 0 || bytes.byteLength > MAX_KNOWLEDGE_FILE_BYTES) {
		throw new ORPCError("BAD_REQUEST", {
			message: `Files must be between 1 byte and ${MAX_KNOWLEDGE_FILE_BYTES / 1024 / 1024} MB.`,
		});
	}

	const bodyText =
		rule.fileType === XiaofeiKnowledgeDocumentFileType.DOCX
			? extractDocxParagraphText(bytes)
			: decodeUtf8(bytes);
	const normalizedBody = bodyText.replaceAll("\u0000", "").trim();
	if (!normalizedBody) {
		throw new ORPCError("BAD_REQUEST", { message: "The uploaded document contains no text." });
	}
	if (normalizedBody.length > MAX_KNOWLEDGE_BODY_CHARACTERS) {
		throw new ORPCError("BAD_REQUEST", {
			message: "The extracted document text is too large.",
		});
	}

	return { fileType: rule.fileType, bodyText: normalizedBody };
}

function decodeBase64(value: string): Uint8Array {
	if (value.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) {
		throw new ORPCError("BAD_REQUEST", { message: "The uploaded file encoding is invalid." });
	}
	return Buffer.from(value, "base64");
}

function decodeUtf8(bytes: Uint8Array): string {
	try {
		return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
	} catch {
		throw new ORPCError("BAD_REQUEST", {
			message: "Markdown and TXT files must contain valid UTF-8 text.",
		});
	}
}

function extractDocxParagraphText(bytes: Uint8Array): string {
	let oversizedDocumentXml = false;
	let files: Record<string, Uint8Array>;
	try {
		files = unzipSync(bytes, {
			filter: (file) => {
				if (file.name !== "word/document.xml") return false;
				oversizedDocumentXml = file.originalSize > MAX_DOCX_XML_BYTES;
				return !oversizedDocumentXml;
			},
		});
	} catch {
		throw invalidDocxError();
	}

	const documentXml = files["word/document.xml"];
	if (oversizedDocumentXml || !documentXml) {
		throw invalidDocxError();
	}

	const xml = strFromU8(documentXml);
	const withoutTables = xml.replace(/<w:tbl(?:\s[^>]*)?>[\s\S]*?<\/w:tbl>/g, "");
	const paragraphs = withoutTables.match(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g) ?? [];
	const text = paragraphs.map(extractParagraphText).filter(Boolean).join("\n");

	if (!text) throw invalidDocxError();
	return text;
}

function extractParagraphText(paragraph: string): string {
	const tokens =
		paragraph.match(
			/<w:t(?:\s[^>]*)?>[\s\S]*?<\/w:t>|<w:tab(?:\s[^>]*)?\/>|<w:(?:br|cr)(?:\s[^>]*)?\/>/g,
		) ?? [];
	return tokens
		.map((token) => {
			if (token.startsWith("<w:tab")) return "\t";
			if (token.startsWith("<w:br") || token.startsWith("<w:cr")) return "\n";
			return decodeXmlEntities(token.replace(/<[^>]+>/g, ""));
		})
		.join("")
		.trimEnd();
}

function decodeXmlEntities(value: string): string {
	return value.replace(/&(amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);/gi, (entity, code: string) => {
		const named = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" } as const;
		if (code in named) return named[code as keyof typeof named];
		const radix = code.toLowerCase().startsWith("#x") ? 16 : 10;
		const digits = code.slice(radix === 16 ? 2 : 1);
		const point = Number.parseInt(digits, radix);
		if (!isValidXmlCodePoint(point)) throw invalidDocxError();
		return String.fromCodePoint(point);
	});
}

function isValidXmlCodePoint(point: number): boolean {
	return (
		Number.isSafeInteger(point) &&
		(point === 0x9 ||
			point === 0xa ||
			point === 0xd ||
			(point >= 0x20 && point <= 0xd7ff) ||
			(point >= 0xe000 && point <= 0xfffd) ||
			(point >= 0x10000 && point <= 0x10ffff))
	);
}

function getFileExtension(fileName: string): string {
	const dot = fileName.lastIndexOf(".");
	return dot >= 0 ? fileName.slice(dot).toLowerCase() : "";
}

function invalidDocxError(): ORPCError<"BAD_REQUEST", unknown> {
	return new ORPCError("BAD_REQUEST", {
		message: "The DOCX file is malformed or does not contain ordinary paragraph text.",
	});
}

function throwKnowledgeDocumentWriteError(error: unknown): never {
	if (error instanceof XiaofeiKnowledgeDocumentQuotaError) {
		const message =
			error.quota === "document_count"
				? `This workspace can store up to ${error.limit} knowledge documents. Delete one before uploading another.`
				: `This workspace has reached its ${formatMegabytes(error.limit)} MB knowledge document storage limit. Delete or shorten a document before trying again.`;
		throw new ORPCError("BAD_REQUEST", { message });
	}
	if (isPrismaNotFoundError(error)) {
		throw new ORPCError("NOT_FOUND", { message: "Knowledge document not found." });
	}
	throw new ORPCError("INTERNAL_SERVER_ERROR", {
		message: "The knowledge document could not be saved.",
	});
}

function isPrismaNotFoundError(error: unknown): boolean {
	return (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		(error as { code?: unknown }).code === "P2025"
	);
}

function formatMegabytes(bytes: number): number {
	return bytes / 1024 / 1024;
}
