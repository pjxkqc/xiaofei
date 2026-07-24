import { ORPCError } from "@orpc/server";
import { strToU8, zipSync } from "fflate";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@repo/database", () => ({
	createXiaofeiKnowledgeDocument: vi.fn(),
	deleteXiaofeiKnowledgeDocument: vi.fn(),
	getXiaofeiKnowledgeDocument: vi.fn(),
	listXiaofeiKnowledgeDocuments: vi.fn(),
	updateXiaofeiKnowledgeDocument: vi.fn(),
	XiaofeiKnowledgeDocumentCategory: {
		PRESALES: "PRESALES",
		POSTSALES: "POSTSALES",
	},
	XiaofeiKnowledgeDocumentFileType: {
		MARKDOWN: "MARKDOWN",
		TEXT: "TEXT",
		DOCX: "DOCX",
	},
}));

vi.mock("./service", () => ({
	getOrCreateXiaofeiWorkspaceByTenantKey: vi.fn(),
}));

vi.mock("../organizations/lib/membership", () => ({
	verifyOrganizationMembership: vi.fn(),
}));

import {
	createXiaofeiKnowledgeDocument,
	deleteXiaofeiKnowledgeDocument,
	getXiaofeiKnowledgeDocument,
	listXiaofeiKnowledgeDocuments,
	updateXiaofeiKnowledgeDocument,
} from "@repo/database";

import { verifyOrganizationMembership } from "../organizations/lib/membership";
import {
	createKnowledgeDocument,
	deleteKnowledgeDocumentForTenant,
	getKnowledgeDocument,
	getKnowledgeTenantKey,
	listKnowledgeDocuments,
	updateKnowledgeDocumentForTenant,
} from "./knowledge-documents";
import { getOrCreateXiaofeiWorkspaceByTenantKey } from "./service";

const USER_CONTEXT = {
	session: { activeOrganizationId: null },
	user: { id: "user-1" },
};

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
		vi.mocked(listXiaofeiKnowledgeDocuments).mockResolvedValueOnce([] as never);
		vi.mocked(getXiaofeiKnowledgeDocument).mockResolvedValueOnce({
			id: "document-1",
		} as never);
		vi.mocked(updateXiaofeiKnowledgeDocument).mockReturnValue({
			id: "document-1",
		} as never);
		vi.mocked(deleteXiaofeiKnowledgeDocument).mockResolvedValueOnce({ count: 1 });

		await listKnowledgeDocuments(context);
		await updateKnowledgeDocumentForTenant(context, "document-1", { status: "active" });
		await deleteKnowledgeDocumentForTenant(context, "document-1");

		expect(listXiaofeiKnowledgeDocuments).toHaveBeenCalledWith("workspace-a");
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
});
