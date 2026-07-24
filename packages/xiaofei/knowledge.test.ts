import { describe, expect, it } from "vitest";

import {
	DEFAULT_KNOWLEDGE_MARKDOWN,
	createDefaultWorkspaceSnapshot,
	parseKnowledgeMarkdown,
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

	it("blocks a KnowledgeUnit that omits safety and fallback fields", () => {
		const [unit] = parseKnowledgeMarkdown(`## 不完整知识
场景关键词: test
标准口径: 仅测试`);

		expect(unit?.status).toBe("blocked");
		expect(unit?.quality.blockers).toEqual(
			expect.arrayContaining(["缺少禁止输出", "缺少转人工条件", "缺少兜底话术"]),
		);
	});

	it("creates a snapshot with visible KU, guardrail and runtime gates", () => {
		const snapshot = createDefaultWorkspaceSnapshot("tenant-1", () => "2026-07-24T00:00:00Z");

		expect(snapshot.gates).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ id: "knowledge", status: "passed" }),
				expect.objectContaining({ id: "guardrail", status: "passed" }),
				expect.objectContaining({ id: "runtime", status: "passed" }),
			]),
		);
	});
});
