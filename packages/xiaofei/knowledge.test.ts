import { describe, expect, it } from "vitest";

import {
	DEFAULT_KNOWLEDGE_MARKDOWN,
	createDefaultWorkspaceSnapshot,
	parseKnowledgeMarkdown,
	setCapabilityPlanReview,
} from "./index";

describe("KnowledgeUnit markdown parser", () => {
	it("builds released, source-traceable KnowledgeUnits from the P0 template", () => {
		const units = parseKnowledgeMarkdown(DEFAULT_KNOWLEDGE_MARKDOWN);

		expect(units).toHaveLength(2);
		expect(units[0]).toMatchObject({
			title: "商品破损资料收集",
			status: "released",
			requiredSlots: [
				{ key: "order_id", label: "订单号" },
				{ key: "damage_photo", label: "破损照片" },
			],
			quality: { status: "passed", blockers: [] },
		});
	});

	it("requires a capability review before evaluation can become release evidence", () => {
		const snapshot = createDefaultWorkspaceSnapshot("tenant-1", () => "2026-07-24T00:00:00Z");
		const reviewed = setCapabilityPlanReview(snapshot, true, () => "2026-07-24T00:01:00Z");

		expect(reviewed.capabilityPlan.reviewed).toBe(true);
		expect(reviewed.evalSuite).toMatchObject({ status: "warning", cases: [] });
		expect(reviewed.gates).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ id: "capability", status: "passed" }),
				expect.objectContaining({ id: "eval", status: "warning" }),
			]),
		);
	});

	it("blocks a KnowledgeUnit that omits safety and fallback fields", () => {
		const [unit] = parseKnowledgeMarkdown(`## 不完整知识
场景关键词: test
标准口径: 仅测试`);

		expect(unit?.status).toBe("blocked");
		expect(unit?.quality.blockers).toEqual(
			expect.arrayContaining(["缺少禁止输出", "缺少转人工条件", "缺少兜底话术"]),
		);
	});

	it("derives a reviewable capability plan and release gates from KnowledgeUnits", () => {
		const snapshot = createDefaultWorkspaceSnapshot("tenant-1", () => "2026-07-24T00:00:00Z");

		expect(snapshot.capabilityPlan).toMatchObject({
			status: "review_ready",
			reviewed: false,
			knowledgeUnitIds: ["商品破损资料收集", "服务范围说明"],
			fieldMatrix: [
				{
					knowledgeId: "商品破损资料收集",
					fields: ["订单号", "破损照片"],
					exitWhen: "必问字段齐全后转人工核实",
				},
				{
					knowledgeId: "服务范围说明",
					fields: [],
					exitWhen: "低风险回复完成或触发转人工条件",
				},
			],
		});
		expect(snapshot.gates).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ id: "knowledge", status: "passed" }),
				expect.objectContaining({ id: "capability", status: "blocked" }),
				expect.objectContaining({ id: "guardrail", status: "passed" }),
				expect.objectContaining({ id: "runtime", status: "passed" }),
			]),
		);
	});
});
