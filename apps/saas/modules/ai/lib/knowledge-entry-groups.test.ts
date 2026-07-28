import { describe, expect, it } from "vitest";

import {
	groupKnowledgeEntries,
	isKnowledgeEntrySelectable,
	reconcileSelectableEntryIds,
} from "./knowledge-entry-groups";

const entries = [
	{ id: "draft", question: "Draft", status: "draft", eligible: true, sourceId: "file-source" },
	{ id: "active", question: "Active", status: "active", eligible: true, sourceId: "web-source" },
	{ id: "stale", question: "Stale", status: "draft", eligible: false, sourceId: "deleted-source" },
];

describe("knowledge entry grouping", () => {
	it("selects only current draft entries and reconciles stale selections", () => {
		expect(isKnowledgeEntrySelectable(entries[0])).toBe(true);
		expect(isKnowledgeEntrySelectable(entries[1])).toBe(false);
		expect(isKnowledgeEntrySelectable(entries[2])).toBe(false);
		expect(reconcileSelectableEntryIds(["draft", "active", "missing"], entries)).toEqual(["draft"]);
	});

	it("uses human-readable source labels and never exposes an internal source ID", () => {
		const groups = groupKnowledgeEntries(entries, [
			{
				id: "file-source",
				sourceType: "FILE",
				originalFileName: "售后手册.docx",
				sourceUrl: null,
			},
			{
				id: "web-source",
				sourceType: "WEB",
				originalFileName: null,
				sourceUrl: "https://example.com/help",
			},
		]);

		expect(groups.map((group) => group.label)).toEqual([
			"售后手册.docx",
			"https://example.com/help",
			"已删除来源",
		]);
		expect(groups.map((group) => group.label)).not.toContain("deleted-source");
	});

	it("labels a source-backed manual entry without an opaque identifier", () => {
		const groups = groupKnowledgeEntries(
			[{ id: "manual-entry", question: "Manual", status: "draft", sourceId: "manual-source" }],
			[
				{
					id: "manual-source",
					sourceType: "MANUAL",
					originalFileName: null,
					sourceUrl: null,
				},
			],
		);
		expect(groups[0].label).toBe("手动录入");
	});
});
