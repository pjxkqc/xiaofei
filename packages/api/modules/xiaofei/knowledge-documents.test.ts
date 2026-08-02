import { ORPCError } from "@orpc/server";
import { strToU8, zipSync } from "fflate";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@repo/database", () => ({
	createXiaofeiKnowledgeDocument: vi.fn(),
	createXiaofeiKnowledgeDocumentWithEntries: vi.fn(),
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
	XiaofeiKnowledgeEntryEligibilityError: class XiaofeiKnowledgeEntryEligibilityError extends Error {},
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
	clearKnowledgeWorkspaceAdmission: vi.fn(),
	getOrCreateXiaofeiWorkspaceByTenantKey: vi.fn(),
	getXiaofeiTenantKey: vi.fn(),
	requireXiaofeiOrganizationAdmin: vi.fn(),
	PUBLIC_SUPPORT_TENANT_KEY: "channel:public-support",
	synchronizeKnowledgeWorkspaceSnapshot: vi.fn(),
}));

vi.mock("./knowledge-content-parser", () => ({
	createKnowledgeContentParser: vi.fn(),
	validatePublicHttpUrl: vi.fn(),
	KnowledgeContentParserConfigurationError: class KnowledgeContentParserConfigurationError extends Error {},
	KnowledgeContentParserError: class KnowledgeContentParserError extends Error {},
}));

import {
	createXiaofeiKnowledgeDocument,
	createXiaofeiKnowledgeDocumentWithEntries,
	deleteXiaofeiKnowledgeDocument,
	getXiaofeiKnowledgeDocument,
	getXiaofeiKnowledgeEntry,
	getXiaofeiKnowledgeUnit,
	listXiaofeiKnowledgeUnits,
	listXiaofeiKnowledgeDocuments,
	updateXiaofeiKnowledgeDocument,
	updateXiaofeiKnowledgeEntry,
	updateXiaofeiKnowledgeUnit,
	XiaofeiKnowledgeDocumentQuotaError,
	XiaofeiKnowledgeEntryEligibilityError,
} from "@repo/database";

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
	splitKnowledgeSource,
	updateKnowledgeDocumentForTenant,
	updateKnowledgeEntryForTenant,
	transitionKnowledgeUnitForTenant,
	updateKnowledgeUnitForTenant,
} from "./knowledge-documents";
import {
	getOrCreateXiaofeiWorkspaceByTenantKey,
	getXiaofeiTenantKey,
	requireXiaofeiOrganizationAdmin,
	synchronizeKnowledgeWorkspaceSnapshot,
} from "./service";

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
				workspaceId: "workspace-public",
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
			async () =>
				({
					workspace: {
						id: "workspace-public",
					},
					snapshot: {},
				}) as never,
		);
		vi.mocked(getXiaofeiTenantKey).mockResolvedValue("organization:org-a");
		vi.mocked(requireXiaofeiOrganizationAdmin).mockResolvedValue("organization:org-a");
		vi.mocked(createXiaofeiKnowledgeDocument).mockReturnValue({
			id: "document-1",
		} as never);
		vi.mocked(createXiaofeiKnowledgeDocumentWithEntries).mockImplementation(
			async (input) =>
				({
					document: { id: "document-1" },
					entries: input.entries.map((_, index) => ({ id: `entry-${index + 1}` })),
				}) as never,
		);
	});

	it("uses the server-verified active organization workspace for knowledge governance", async () => {
		await expect(
			getKnowledgeTenantKey({
				session: { activeOrganizationId: "org-a" },
				user: { id: "user-1" },
			}),
		).resolves.toBe("organization:org-a");
		await expect(
			getKnowledgeTenantKey({
				session: { activeOrganizationId: null },
				user: { id: "another-user" },
			}),
		).resolves.toBe("organization:org-a");
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
				workspaceId: "workspace-public",
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

	it("uses the provider only for remote files and persists bounded normalized entries", async () => {
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
		expect(createXiaofeiKnowledgeDocumentWithEntries).toHaveBeenCalledWith(
			expect.objectContaining({
				document: expect.objectContaining({
					sourceType: "FILE",
					fileType: "PDF",
					provider: "firecrawl",
					bodyText: "# Parsed PDF",
				}),
				entries: [
					expect.objectContaining({
						question: "guide.pdf — Parsed PDF",
						answer: "# Parsed PDF",
						tags: ["source", "Parsed PDF"],
					}),
				],
			}),
		);
	});

	it("persists all derived entries through one atomic database call", async () => {
		await createKnowledgeFile(USER_CONTEXT, {
			originalFileName: "faq.md",
			mimeType: "text/markdown",
			category: "PRESALES",
			contentBase64: Buffer.from(
				[
					"Q: First question?",
					`A: ${"First answer. ".repeat(10)}`,
					"Q: Second question?",
					`A: ${"Second answer. ".repeat(10)}`,
					"Q: Third question?",
					`A: ${"Third answer. ".repeat(10)}`,
				].join("\n"),
			).toString("base64"),
		});

		expect(createXiaofeiKnowledgeDocumentWithEntries).toHaveBeenCalledOnce();
		expect(
			vi.mocked(createXiaofeiKnowledgeDocumentWithEntries).mock.calls[0][0].entries,
		).toHaveLength(3);
	});

	it("splits headings and practical Markdown table rows while merging tiny fragments", () => {
		const entries = splitKnowledgeSource(
			"matrix.xlsx",
			[
				"# Models",
				"",
				"| Model | Room |",
				"| --- | --- |",
				"| Mini | 8-20㎡ |",
				"| Pro | 35-70㎡ |",
				"",
				"## Warranty",
				"",
				"The motor has a 36 month warranty. It applies from delivery and excludes consumable filters and accidental damage.",
			].join("\n"),
		);

		expect(entries).toEqual([
			expect.objectContaining({
				provenance: "Models row 1",
				question: "matrix.xlsx — Models row 1",
			}),
			expect.objectContaining({
				provenance: "Models row 2",
				question: "matrix.xlsx — Models row 2",
			}),
			expect.objectContaining({
				provenance: "Warranty",
				answer:
					"The motor has a 36 month warranty. It applies from delivery and excludes consumable filters and accidental damage.",
			}),
		]);
	});

	it("caps generated entries at twenty", () => {
		const source = Array.from(
			{ length: 25 },
			(_, index) => `## FAQ ${index + 1}\n\nAnchor ${index + 1}. ${"Answer ".repeat(20)}`,
		).join("\n\n");
		const entries = splitKnowledgeSource("faq.md", source);
		expect(entries).toHaveLength(20);
		expect(entries[entries.length - 1]?.answer).toContain("Anchor 25.");
	});

	it("recognizes explicit FAQ pairs without requiring Markdown headings", () => {
		const entries = splitKnowledgeSource(
			"faq.txt",
			"Q: Can I return it?\nA: Returns are accepted within 30 days.\n\nQ: Is shipping included?\nA: Standard shipping is included.",
		);
		expect(entries).toEqual([
			expect.objectContaining({
				provenance: "Can I return it?",
				answer: "Q: Can I return it?\nA: Returns are accepted within 30 days.",
			}),
			expect.objectContaining({ provenance: "Is shipping included?" }),
		]);
	});

	it("preserves ordinary content around explicit FAQ pairs", () => {
		const entries = splitKnowledgeSource(
			"mixed.md",
			[
				"# Support",
				"",
				"Intro anchor explains the support scope before the frequently asked questions.",
				"",
				"Q: Can I return it?",
				"A: Return anchor says returns are accepted within 30 days.",
				"",
				"Trailing anchor explains that damaged items need a support review.",
			].join("\n"),
		);
		const answers = entries.map((entry) => entry.answer).join("\n");

		expect(answers).toContain("Intro anchor");
		expect(answers).toContain("Return anchor");
		expect(answers).toContain("Trailing anchor");
		expect(answers.match(/Q: Can I return it\?/g)).toHaveLength(1);
	});

	it("preserves prose around every Markdown table and keeps table rows in source order", () => {
		const entries = splitKnowledgeSource(
			"tables.md",
			[
				"# Product",
				"",
				"Intro anchor before the first table contains enough product context for review.",
				"",
				"| Model | Room |",
				"| --- | --- |",
				"| Mini | 8-20㎡ |",
				"",
				"Middle anchor between the two tables explains how customers choose a model.",
				"",
				"| Plan | Response |",
				"| --- | --- |",
				"| Standard | 24 hours |",
				"",
				"Final anchor after the second table explains escalation and warranty coverage.",
			].join("\n"),
		);
		const answers = entries.map((entry) => entry.answer);
		const joined = answers.join("\n");

		for (const anchor of ["Intro anchor", "Mini", "Middle anchor", "Standard", "Final anchor"]) {
			expect(joined).toContain(anchor);
		}
		expect(answers.findIndex((answer) => answer.includes("Intro anchor"))).toBeLessThan(
			answers.findIndex((answer) => answer.includes("Mini")),
		);
		expect(answers.findIndex((answer) => answer.includes("Mini"))).toBeLessThan(
			answers.findIndex((answer) => answer.includes("Middle anchor")),
		);
		expect(answers.findIndex((answer) => answer.includes("Middle anchor"))).toBeLessThan(
			answers.findIndex((answer) => answer.includes("Standard")),
		);
		expect(answers.findIndex((answer) => answer.includes("Standard"))).toBeLessThan(
			answers.findIndex((answer) => answer.includes("Final anchor")),
		);
	});

	it("creates manual entries without invoking Firecrawl and records web lineage through the provider", async () => {
		await createManualKnowledgeEntries(USER_CONTEXT, {
			category: "POSTSALES",
			pairs: [{ question: "How do I reset?", answer: "Use the reset link.", tags: ["account"] }],
		});
		expect(createKnowledgeContentParser).not.toHaveBeenCalled();
		expect(createXiaofeiKnowledgeDocumentWithEntries).toHaveBeenCalledWith(
			expect.objectContaining({
				document: expect.objectContaining({ sourceType: "MANUAL" }),
				entries: [
					expect.objectContaining({ question: "How do I reset?", answer: "Use the reset link." }),
				],
			}),
		);

		vi.mocked(createXiaofeiKnowledgeDocumentWithEntries).mockClear();
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
		expect(createXiaofeiKnowledgeDocumentWithEntries).toHaveBeenCalledWith(
			expect.objectContaining({
				document: expect.objectContaining({
					sourceType: "WEB",
					sourceUrl: "https://example.com/help",
					provider: "firecrawl",
				}),
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

	it("scopes document reads to the server-selected public workspace", async () => {
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
			"workspace-public",
			"other-tenant-document",
		);
	});

	it("scopes list, update, and delete operations to the public workspace", async () => {
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

		expect(listXiaofeiKnowledgeDocuments).toHaveBeenCalledWith("workspace-public", {
			cursor: "document-cursor",
			limit: 10,
		});
		expect(updateXiaofeiKnowledgeDocument).toHaveBeenCalledWith("workspace-public", "document-1", {
			status: "active",
		});
		expect(deleteXiaofeiKnowledgeDocument).toHaveBeenCalledWith("workspace-public", "document-1");
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

	it("returns the refreshed entry with computed eligibility after an update", async () => {
		const refreshed = { id: "entry-1", status: "active", eligible: true };
		vi.mocked(getXiaofeiKnowledgeEntry)
			.mockResolvedValueOnce({ id: "entry-1", eligible: true } as never)
			.mockResolvedValueOnce(refreshed as never);
		vi.mocked(updateXiaofeiKnowledgeEntry).mockResolvedValueOnce({ id: "entry-1" } as never);

		await expect(
			updateKnowledgeEntryForTenant(USER_CONTEXT, "entry-1", { status: "active" }),
		).resolves.toEqual(refreshed);
		expect(updateXiaofeiKnowledgeEntry).toHaveBeenCalledWith("workspace-public", "entry-1", {
			status: "active",
		});
		expect(getXiaofeiKnowledgeEntry).toHaveBeenLastCalledWith("workspace-public", "entry-1");
	});

	it("refuses to activate an entry whose source is no longer current", async () => {
		vi.mocked(getXiaofeiKnowledgeEntry).mockResolvedValueOnce({
			id: "entry-1",
			eligible: false,
		} as never);

		await expect(
			updateKnowledgeEntryForTenant(USER_CONTEXT, "entry-1", { status: "active" }),
		).rejects.toMatchObject({
			code: "BAD_REQUEST",
			message: expect.stringContaining("current knowledge entries"),
		});
		expect(updateXiaofeiKnowledgeEntry).not.toHaveBeenCalled();
	});

	it("refuses activation when the persistence boundary detects a source-update race", async () => {
		vi.mocked(getXiaofeiKnowledgeEntry).mockResolvedValueOnce({
			id: "entry-1",
			eligible: true,
		} as never);
		vi.mocked(updateXiaofeiKnowledgeEntry).mockRejectedValueOnce(
			new XiaofeiKnowledgeEntryEligibilityError(),
		);

		await expect(
			updateKnowledgeEntryForTenant(USER_CONTEXT, "entry-1", { status: "active" }),
		).rejects.toMatchObject({
			code: "BAD_REQUEST",
			message: expect.stringContaining("current draft knowledge entries"),
		});
	});

	it("rebuilds the runtime snapshot after a publish so only current eligible KUs are admitted", async () => {
		vi.mocked(getXiaofeiKnowledgeUnit).mockResolvedValueOnce(
			knowledgeUnit("review_ready") as never,
		);
		vi.mocked(updateXiaofeiKnowledgeUnit).mockResolvedValueOnce(
			knowledgeUnit("released", "eligible") as never,
		);
		vi.mocked(listXiaofeiKnowledgeUnits).mockResolvedValueOnce([
			knowledgeUnit("released", "eligible"),
		] as never);

		await transitionKnowledgeUnitForTenant(USER_CONTEXT, "unit-1", "publish");

		expect(synchronizeKnowledgeWorkspaceSnapshot).toHaveBeenCalledWith(
			expect.objectContaining({
				tenantKey: "organization:org-a",
				units: [expect.objectContaining({ eligibility: "eligible" })],
			}),
		);
	});

	it("hides cross-tenant knowledge-unit IDs before a transition", async () => {
		vi.mocked(getXiaofeiKnowledgeUnit).mockResolvedValueOnce(null);
		await expect(
			transitionKnowledgeUnitForTenant(USER_CONTEXT, "other-tenant-unit", "review"),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
		expect(getXiaofeiKnowledgeUnit).toHaveBeenCalledWith("workspace-public", "other-tenant-unit");
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
		expect(updateXiaofeiKnowledgeUnit).toHaveBeenCalledWith("workspace-public", "unit-1", {
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
			"workspace-public",
			"unit-1",
			expect.objectContaining({
				status: "draft",
				eligibility: "ineligible",
				staleReason: null,
			}),
		);
	});

	it("refuses stale KU edits and keeps review and publish blocked until regeneration", async () => {
		const staleUnit = { ...knowledgeUnit("draft", "stale"), staleReason: "source_deleted" };
		vi.mocked(getXiaofeiKnowledgeUnit)
			.mockResolvedValueOnce(staleUnit as never)
			.mockResolvedValueOnce(staleUnit as never)
			.mockResolvedValueOnce(staleUnit as never);

		await expect(
			updateKnowledgeUnitForTenant(USER_CONTEXT, "unit-1", {
				standardReplyPolicy: "Attempted stale edit.",
			}),
		).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringContaining("stale") });
		expect(updateXiaofeiKnowledgeUnit).not.toHaveBeenCalled();

		await expect(
			transitionKnowledgeUnitForTenant(USER_CONTEXT, "unit-1", "review"),
		).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringContaining("stale") });
		await expect(
			transitionKnowledgeUnitForTenant(USER_CONTEXT, "unit-1", "publish"),
		).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringContaining("stale") });
		expect(updateXiaofeiKnowledgeUnit).not.toHaveBeenCalled();
	});
});
