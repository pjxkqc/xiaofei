import { ORPCError } from "@orpc/server";
import { strToU8, zipSync } from "fflate";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@repo/database", () => ({
	createXiaofeiKnowledgeDocument: vi.fn(),
	createXiaofeiKnowledgeEntry: vi.fn(),
	createXiaofeiKnowledgeUnit: vi.fn(),
	deleteXiaofeiKnowledgeDocument: vi.fn(),
	deleteXiaofeiKnowledgeEntry: vi.fn(),
	deleteXiaofeiKnowledgeUnit: vi.fn(),
	getXiaofeiKnowledgeDocument: vi.fn(),
	getXiaofeiKnowledgeEntry: vi.fn(),
	getXiaofeiKnowledgeUnit: vi.fn(),
	listXiaofeiKnowledgeDocuments: vi.fn(),
	listXiaofeiKnowledgeEntries: vi.fn(),
	listXiaofeiKnowledgeUnits: vi.fn(),
	updateXiaofeiKnowledgeDocument: vi.fn(),
	updateXiaofeiKnowledgeEntry: vi.fn(),
	updateXiaofeiKnowledgeUnit: vi.fn(),
	DEFAULT_XIAOFEI_KNOWLEDGE_DOCUMENT_PAGE_SIZE: 25,
	MAX_XIAOFEI_KNOWLEDGE_DOCUMENT_PAGE_SIZE: 50,
	XiaofeiKnowledgeDocumentCategory: {
		PRESALES: "PRESALES",
		POSTSALES: "POSTSALES",
	},
	XiaofeiKnowledgeDocumentFileType: {
		MARKDOWN: "MARKDOWN",
		TEXT: "TEXT",
		DOCX: "DOCX",
		PDF: "PDF",
		XLSX: "XLSX",
	},
	XiaofeiKnowledgeDocumentSourceType: { FILE: "FILE", WEB: "WEB", MANUAL: "MANUAL" },
	XiaofeiKnowledgeEntryQuotaError: class XiaofeiKnowledgeEntryQuotaError extends Error {},
	XiaofeiKnowledgeDocumentQuotaError: class XiaofeiKnowledgeDocumentQuotaError extends Error {
		constructor(
			readonly quota: "document_count" | "stored_body_bytes",
			readonly limit: number,
		) {
			super("Knowledge document quota reached.");
		}
	},
}));

vi.mock("./service", () => ({
	getOrCreateXiaofeiWorkspaceByTenantKey: vi.fn(),
}));

vi.mock("../organizations/lib/membership", () => ({
	verifyOrganizationMembership: vi.fn(),
}));

vi.mock("./knowledge-content-parser", () => ({
	createKnowledgeContentParser: vi.fn(),
	validatePublicHttpUrl: vi.fn(),
	KnowledgeContentParserConfigurationError: class KnowledgeContentParserConfigurationError extends Error {},
	KnowledgeContentParserError: class KnowledgeContentParserError extends Error {},
}));

import {
	createXiaofeiKnowledgeDocument,
	createXiaofeiKnowledgeEntry,
	deleteXiaofeiKnowledgeDocument,
	getXiaofeiKnowledgeDocument,
	getXiaofeiKnowledgeUnit,
	listXiaofeiKnowledgeDocuments,
	updateXiaofeiKnowledgeDocument,
	updateXiaofeiKnowledgeUnit,
	XiaofeiKnowledgeDocumentQuotaError,
} from "@repo/database";

import { verifyOrganizationMembership } from "../organizations/lib/membership";
import { createKnowledgeContentParser, validatePublicHttpUrl } from "./knowledge-content-parser";
import { knowledgeDocumentListInputSchema } from "./knowledge-document-input";
import {
	createKnowledgeDocument,
	createKnowledgeFile,
	createKnowledgeWeb,
	createManualKnowledgeEntries,
	deleteKnowledgeDocumentForTenant,
	getKnowledgeDocument,
	getKnowledgeTenantKey,
	listKnowledgeDocuments,
	updateKnowledgeDocumentForTenant,
	transitionKnowledgeUnitForTenant,
	updateKnowledgeUnitForTenant,
} from "./knowledge-documents";
import { getOrCreateXiaofeiWorkspaceByTenantKey } from "./service";

const USER_CONTEXT = {
	session: { activeOrganizationId: null },
	user: { id: "user-1" },
};

function knowledgeUnit(status: string, eligibility = "ineligible") {
	return {
		id: "unit-1",
		status,
		eligibility,
		content: {
			id: "unit-1",
			title: "Returns",
			status,
			scenarioKeywords: ["return"],
			applicableScenarios: ["Returns"],
			inapplicableScenarios: [],
			requiredSlots: [],
			forbiddenOutputs: ["Promise a refund"],
			handoffRules: ["Escalate disputes"],
			standardReplyPolicy: "Explain the policy.",
			fallbackReply: "A support specialist can help.",
			sourceSection: "Returns entry",
			quality: { status: "warning", blockers: [], warnings: [] },
			lineage: {
				workspaceId: "workspace-user",
				sourceId: "source-1",
				sourceContentHash: "hash",
				sourceVersion: 1,
				entryId: "entry-1",
				entryVersion: 1,
			},
			eligibility,
		},
	};
}

describe("knowledge document application boundary", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(getOrCreateXiaofeiWorkspaceByTenantKey).mockImplementation(
			async (tenantKey) =>
				({
					workspace: {
						id: tenantKey === "organization:org-a" ? "workspace-a" : "workspace-user",
					},
					snapshot: {},
				}) as never,
		);
		vi.mocked(verifyOrganizationMembership).mockResolvedValue({
			organization: { id: "org-a" },
			role: "member",
		} as never);
		vi.mocked(createXiaofeiKnowledgeDocument).mockReturnValue({
			id: "document-1",
		} as never);
		vi.mocked(createXiaofeiKnowledgeEntry).mockResolvedValue({ id: "entry-1" } as never);
	});

	it("uses a verified active organization, then the authenticated user, as the tenant", async () => {
		await expect(
			getKnowledgeTenantKey({
				session: { activeOrganizationId: "org-a" },
				user: { id: "user-1" },
			}),
		).resolves.toBe("organization:org-a");
		await expect(getKnowledgeTenantKey(USER_CONTEXT)).resolves.toBe("user:user-1");
		expect(verifyOrganizationMembership).toHaveBeenCalledWith("org-a", "user-1");
	});

	it("rejects a stale active organization without current membership", async () => {
		vi.mocked(verifyOrganizationMembership).mockResolvedValueOnce(null);
		await expect(
			getKnowledgeTenantKey({
				session: { activeOrganizationId: "org-a" },
				user: { id: "user-1" },
			}),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});

	it.each([
		{
			fileName: "guide.md",
			mimeType: "text/markdown",
			body: "# Presales guide",
			fileType: "MARKDOWN",
		},
		{
			fileName: "guide.txt",
			mimeType: "text/plain",
			body: "Plain support text",
			fileType: "TEXT",
		},
	])("validates and persists $fileName UTF-8 text", async (example) => {
		await createKnowledgeDocument(USER_CONTEXT, {
			originalFileName: example.fileName,
			mimeType: example.mimeType,
			category: "PRESALES",
			contentBase64: Buffer.from(example.body).toString("base64"),
		});

		expect(createXiaofeiKnowledgeDocument).toHaveBeenCalledWith(
			expect.objectContaining({
				workspaceId: "workspace-user",
				fileType: example.fileType,
				bodyText: example.body,
			}),
		);
	});

	it("extracts ordinary DOCX paragraphs and excludes table text", async () => {
		const documentXml = `<?xml version="1.0" encoding="UTF-8"?>
			<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
				<w:body>
					<w:p><w:r><w:instrText>Hidden field instruction</w:instrText><w:t>First &amp; second</w:t></w:r></w:p>
					<w:tbl><w:tr><w:tc><w:p><w:r><w:t>Hidden table</w:t></w:r></w:p></w:tc></w:tr></w:tbl>
					<w:p><w:r><w:t>Final paragraph</w:t></w:r></w:p>
				</w:body>
			</w:document>`;
		const docx = zipSync({ "word/document.xml": strToU8(documentXml) });

		await createKnowledgeDocument(USER_CONTEXT, {
			originalFileName: "guide.docx",
			mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
			category: "POSTSALES",
			contentBase64: Buffer.from(docx).toString("base64"),
		});

		expect(createXiaofeiKnowledgeDocument).toHaveBeenCalledWith(
			expect.objectContaining({
				fileType: "DOCX",
				category: "POSTSALES",
				bodyText: "First & second\nFinal paragraph",
			}),
		);
	});

	it("uses the provider only for remote files and persists a normalized entry", async () => {
		vi.mocked(createKnowledgeContentParser).mockReturnValue({
			parseFile: vi.fn().mockResolvedValue({
				markdown: "# Parsed PDF",
				provider: "firecrawl",
				parserVersion: "firecrawl-v2",
			}),
		} as never);

		await createKnowledgeFile(USER_CONTEXT, {
			originalFileName: "guide.pdf",
			mimeType: "application/pdf",
			category: "PRESALES",
			contentBase64: Buffer.from("pdf content").toString("base64"),
		});

		expect(createKnowledgeContentParser).toHaveBeenCalled();
		expect(createXiaofeiKnowledgeDocument).toHaveBeenCalledWith(
			expect.objectContaining({
				sourceType: "FILE",
				fileType: "PDF",
				provider: "firecrawl",
				bodyText: "# Parsed PDF",
			}),
		);
		expect(createXiaofeiKnowledgeEntry).toHaveBeenCalledWith(
			expect.objectContaining({ sourceId: "document-1", answer: "# Parsed PDF" }),
		);
	});

	it("creates manual entries without invoking Firecrawl and records web lineage through the provider", async () => {
		await createManualKnowledgeEntries(USER_CONTEXT, {
			category: "POSTSALES",
			pairs: [{ question: "How do I reset?", answer: "Use the reset link.", tags: ["account"] }],
		});
		expect(createKnowledgeContentParser).not.toHaveBeenCalled();
		expect(createXiaofeiKnowledgeEntry).toHaveBeenCalledWith(
			expect.objectContaining({ question: "How do I reset?", sourceId: "document-1" }),
		);

		vi.mocked(createKnowledgeContentParser).mockReturnValue({
			scrapeUrl: vi.fn().mockResolvedValue({
				markdown: "# Web help",
				provider: "firecrawl",
				parserVersion: "firecrawl-v2",
			}),
		} as never);
		await createKnowledgeWeb(USER_CONTEXT, {
			url: "https://example.com/help",
			category: "PRESALES",
		});
		expect(validatePublicHttpUrl).toHaveBeenCalledWith("https://example.com/help");
		expect(createXiaofeiKnowledgeDocument).toHaveBeenCalledWith(
			expect.objectContaining({
				sourceType: "WEB",
				sourceUrl: "https://example.com/help",
				provider: "firecrawl",
			}),
		);
	});

	it("rejects MIME/extension mismatches and malformed DOCX without raw errors", async () => {
		await expect(
			createKnowledgeDocument(USER_CONTEXT, {
				originalFileName: "guide.md",
				mimeType: "application/json",
				category: "PRESALES",
				contentBase64: Buffer.from("content").toString("base64"),
			}),
		).rejects.toMatchObject({
			code: "BAD_REQUEST",
			message: expect.stringContaining(".md, .txt, or .docx"),
		});

		await expect(
			createKnowledgeDocument(USER_CONTEXT, {
				originalFileName: "guide.docx",
				mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
				category: "PRESALES",
				contentBase64: Buffer.from("not a zip").toString("base64"),
			}),
		).rejects.toBeInstanceOf(ORPCError);
	});

	it("rejects out-of-range DOCX numeric entities with a safe bad-request error", async () => {
		const docx = zipSync({
			"word/document.xml": strToU8(
				`<w:document><w:body><w:p><w:r><w:t>&#999999999;</w:t></w:r></w:p></w:body></w:document>`,
			),
		});

		await expect(
			createKnowledgeDocument(USER_CONTEXT, {
				originalFileName: "invalid-entity.docx",
				mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
				category: "PRESALES",
				contentBase64: Buffer.from(docx).toString("base64"),
			}),
		).rejects.toMatchObject({
			code: "BAD_REQUEST",
			message: expect.stringContaining("DOCX file is malformed"),
		});
	});

	it.each([
		{ quota: "document_count" as const, limit: 100, message: "100 knowledge documents" },
		{ quota: "stored_body_bytes" as const, limit: 20 * 1024 * 1024, message: "20 MB" },
	])("maps $quota quota errors to safe bad-request messages", async (example) => {
		vi.mocked(createXiaofeiKnowledgeDocument).mockReturnValueOnce(
			Promise.reject(new XiaofeiKnowledgeDocumentQuotaError(example.quota, example.limit)) as never,
		);

		await expect(
			createKnowledgeDocument(USER_CONTEXT, {
				originalFileName: "guide.txt",
				mimeType: "text/plain",
				category: "PRESALES",
				contentBase64: Buffer.from("content").toString("base64"),
			}),
		).rejects.toMatchObject({
			code: "BAD_REQUEST",
			message: expect.stringContaining(example.message),
		});
	});

	it("maps a body-update storage quota error without misreporting not found", async () => {
		vi.mocked(getXiaofeiKnowledgeDocument).mockResolvedValueOnce({
			id: "document-1",
		} as never);
		vi.mocked(updateXiaofeiKnowledgeDocument).mockReturnValueOnce(
			Promise.reject(
				new XiaofeiKnowledgeDocumentQuotaError("stored_body_bytes", 20 * 1024 * 1024),
			) as never,
		);

		await expect(
			updateKnowledgeDocumentForTenant(USER_CONTEXT, "document-1", {
				bodyText: "replacement",
			}),
		).rejects.toMatchObject({
			code: "BAD_REQUEST",
			message: expect.stringContaining("20 MB"),
		});
	});

	it("validates list cursors and limits at the procedure boundary", () => {
		expect(knowledgeDocumentListInputSchema.parse({})).toEqual({ limit: 25 });
		expect(knowledgeDocumentListInputSchema.safeParse({ limit: 0 }).success).toBe(false);
		expect(knowledgeDocumentListInputSchema.safeParse({ limit: 51 }).success).toBe(false);
		expect(knowledgeDocumentListInputSchema.safeParse({ limit: 1.5 }).success).toBe(false);
		expect(knowledgeDocumentListInputSchema.safeParse({ cursor: "not-a-cuid" }).success).toBe(
			false,
		);
	});

	it("scopes document reads to the resolved workspace and hides cross-tenant rows", async () => {
		vi.mocked(getXiaofeiKnowledgeDocument).mockResolvedValueOnce(null);
		const context = {
			session: { activeOrganizationId: "org-a" },
			user: { id: "user-1" },
		};

		await expect(getKnowledgeDocument(context, "other-tenant-document")).rejects.toMatchObject({
			code: "NOT_FOUND",
		});
		expect(getOrCreateXiaofeiWorkspaceByTenantKey).toHaveBeenCalledWith("organization:org-a");
		expect(getXiaofeiKnowledgeDocument).toHaveBeenCalledWith(
			"workspace-a",
			"other-tenant-document",
		);
	});

	it("scopes list, update, and delete operations to the resolved workspace", async () => {
		const context = {
			session: { activeOrganizationId: "org-a" },
			user: { id: "user-1" },
		};
		vi.mocked(listXiaofeiKnowledgeDocuments).mockResolvedValueOnce({
			items: [],
			nextCursor: null,
		});
		vi.mocked(getXiaofeiKnowledgeDocument).mockResolvedValueOnce({
			id: "document-1",
		} as never);
		vi.mocked(updateXiaofeiKnowledgeDocument).mockReturnValue({
			id: "document-1",
		} as never);
		vi.mocked(deleteXiaofeiKnowledgeDocument).mockResolvedValueOnce({ count: 1 });

		await listKnowledgeDocuments(context, { cursor: "document-cursor", limit: 10 });
		await updateKnowledgeDocumentForTenant(context, "document-1", { status: "active" });
		await deleteKnowledgeDocumentForTenant(context, "document-1");

		expect(listXiaofeiKnowledgeDocuments).toHaveBeenCalledWith("workspace-a", {
			cursor: "document-cursor",
			limit: 10,
		});
		expect(updateXiaofeiKnowledgeDocument).toHaveBeenCalledWith("workspace-a", "document-1", {
			status: "active",
		});
		expect(deleteXiaofeiKnowledgeDocument).toHaveBeenCalledWith("workspace-a", "document-1");
	});

	it("does not run a cross-tenant update when the scoped preflight cannot find the row", async () => {
		vi.mocked(getXiaofeiKnowledgeDocument).mockResolvedValueOnce(null);
		await expect(
			updateKnowledgeDocumentForTenant(
				{
					session: { activeOrganizationId: "org-a" },
					user: { id: "user-1" },
				},
				"other-tenant-document",
				{ status: "active" },
			),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
		expect(updateXiaofeiKnowledgeDocument).not.toHaveBeenCalled();
	});

	it("hides cross-tenant knowledge-unit IDs before a transition", async () => {
		vi.mocked(getXiaofeiKnowledgeUnit).mockResolvedValueOnce(null);
		await expect(
			transitionKnowledgeUnitForTenant(USER_CONTEXT, "other-tenant-unit", "review"),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
		expect(getXiaofeiKnowledgeUnit).toHaveBeenCalledWith("workspace-user", "other-tenant-unit");
		expect(updateXiaofeiKnowledgeUnit).not.toHaveBeenCalled();
	});

	it.each([
		["draft", "publish"],
		["draft", "revokeReview"],
		["review_ready", "review"],
		["review_ready", "revokePublish"],
		["released", "review"],
		["released", "revokeReview"],
	])("enforces the predecessor for %s → %s", async (status, action) => {
		vi.mocked(getXiaofeiKnowledgeUnit).mockResolvedValueOnce(knowledgeUnit(status) as never);
		await expect(
			transitionKnowledgeUnitForTenant(
				USER_CONTEXT,
				"unit-1",
				action as "review" | "revokeReview" | "publish" | "revokePublish",
			),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	it("refuses stale KU transitions and permits review-ready publication", async () => {
		vi.mocked(getXiaofeiKnowledgeUnit).mockResolvedValueOnce(
			knowledgeUnit("review_ready", "stale") as never,
		);
		await expect(
			transitionKnowledgeUnitForTenant(USER_CONTEXT, "unit-1", "publish"),
		).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringContaining("stale") });

		vi.mocked(getXiaofeiKnowledgeUnit).mockResolvedValueOnce(
			knowledgeUnit("review_ready") as never,
		);
		vi.mocked(updateXiaofeiKnowledgeUnit).mockResolvedValueOnce(
			knowledgeUnit("released", "eligible") as never,
		);
		await transitionKnowledgeUnitForTenant(USER_CONTEXT, "unit-1", "publish");
		expect(updateXiaofeiKnowledgeUnit).toHaveBeenCalledWith("workspace-user", "unit-1", {
			status: "released",
			eligibility: "eligible",
		});
	});

	it("atomically invalidates a released KU when its content is edited", async () => {
		vi.mocked(getXiaofeiKnowledgeUnit).mockResolvedValueOnce(
			knowledgeUnit("released", "eligible") as never,
		);
		vi.mocked(updateXiaofeiKnowledgeUnit).mockResolvedValueOnce(knowledgeUnit("draft") as never);
		await updateKnowledgeUnitForTenant(USER_CONTEXT, "unit-1", {
			standardReplyPolicy: "Updated policy.",
		});
		expect(updateXiaofeiKnowledgeUnit).toHaveBeenCalledWith(
			"workspace-user",
			"unit-1",
			expect.objectContaining({
				status: "draft",
				eligibility: "ineligible",
				staleReason: null,
			}),
		);
	});
});
