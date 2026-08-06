import { describe, expect, it, vi } from "vitest";

vi.mock("@repo/ai", () => ({ generateKnowledgeUnitDrafts: vi.fn() }));
vi.mock("@repo/database", () => ({
	XiaofeiKnowledgeDocumentFileType: {
		DOCX: "DOCX",
		MARKDOWN: "MARKDOWN",
		TEXT: "TEXT",
		PDF: "PDF",
		XLSX: "XLSX",
	},
	XiaofeiKnowledgeDocumentCategory: { PRESALES: "PRESALES", POSTSALES: "POSTSALES" },
	XiaofeiKnowledgeDocumentSourceType: { FILE: "FILE", MANUAL: "MANUAL", WEB: "WEB" },
}));
vi.mock("@repo/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));

import { hasUniqueKnowledgeEntryIds } from "../knowledge-documents";

describe("knowledge preparation input", () => {
	it("rejects duplicate entry IDs before a retry can materialize duplicate KUs", () => {
		expect(hasUniqueKnowledgeEntryIds(["entry-a", "entry-b"])).toBe(true);
		expect(hasUniqueKnowledgeEntryIds(["entry-a", "entry-a"])).toBe(false);
	});
});
