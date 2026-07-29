import { describe, expect, it } from "vitest";

import {
	generateKnowledgeUnitDrafts,
	KnowledgeUnitGenerationCandidatesSchema,
	KnowledgeUnitGenerationError,
} from "./knowledge-generation";

const entry = {
	id: "entry-1",
	workspaceId: "workspace-1",
	sourceId: "source-1",
	sourceContentHash: "content-hash",
	sourceVersion: 1,
	version: 1,
	question: "如何申请售后？",
	answer: "请提供订单号，人工客服会核实处理。",
	similarQueries: [],
	category: "POSTSALES",
	tags: ["售后"],
	status: "active" as const,
};

function candidate(entryId = entry.id) {
	return {
		entryId,
		title: "售后资料收集",
		scenarioKeywords: ["售后"],
		applicableScenarios: ["售后咨询"],
		inapplicableScenarios: [],
		requiredSlots: [],
		forbiddenOutputs: ["已退款"],
		handoffRules: ["投诉"],
		standardReplyPolicy: "仅收集信息，不承诺处理结果。",
		fallbackReply: "我会转交人工客服核实。",
	};
}

describe("KU structured generation", () => {
	it("accepts mocked structured output and still creates a server-owned Draft", async () => {
		const drafts = await generateKnowledgeUnitDrafts(
			{ workspaceId: entry.workspaceId, entries: [entry] },
			async () => [candidate()],
		);

		expect(drafts[0]).toMatchObject({
			status: "draft",
			eligibility: "ineligible",
			lineage: { workspaceId: entry.workspaceId, entryId: entry.id },
		});
		expect(drafts[0]?.standardReplyPolicy).toContain(entry.answer);
		expect(drafts[0]?.standardReplyPolicy).toContain("回复口径：\n仅收集信息，不承诺处理结果。");
	});

	it("redacts malformed structured output", async () => {
		await expect(
			generateKnowledgeUnitDrafts(
				{ workspaceId: entry.workspaceId, entries: [entry] },
				async () => [{ ...candidate(), forbiddenOutputs: [] }],
			),
		).rejects.toBeInstanceOf(KnowledgeUnitGenerationError);
		expect(() =>
			KnowledgeUnitGenerationCandidatesSchema.parse([{ ...candidate(), title: "" }]),
		).toThrow();
	});

	it("bounds grounded source facts to the editable KU policy limit", async () => {
		const longEntry = { ...entry, answer: "已审核事实。".repeat(4_000) };
		const drafts = await generateKnowledgeUnitDrafts(
			{ workspaceId: longEntry.workspaceId, entries: [longEntry] },
			async () => [candidate()],
		);

		expect(drafts[0]?.standardReplyPolicy.length).toBeLessThanOrEqual(20_000);
		expect(drafts[0]?.standardReplyPolicy).toContain("回复口径：");
	});

	it("redacts candidates that fail the server-owned entry lineage gate", async () => {
		await expect(
			generateKnowledgeUnitDrafts(
				{ workspaceId: entry.workspaceId, entries: [entry] },
				async () => [candidate("another-entry")],
			),
		).rejects.toBeInstanceOf(KnowledgeUnitGenerationError);
	});
});
