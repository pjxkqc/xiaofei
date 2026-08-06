import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const workspace = readFileSync(path.resolve(import.meta.dirname, "KnowledgeWorkspace.tsx"), "utf8");
const nav = readFileSync(
	path.resolve(import.meta.dirname, "../../shared/components/NavBar.tsx"),
	"utf8",
);
const quickPreparation = readFileSync(
	path.resolve(import.meta.dirname, "QuickKnowledgePreparation.tsx"),
	"utf8",
);

describe("knowledge workspace information architecture", () => {
	it("uses one Chinese navigation entry and three guided stages", () => {
		expect(nav).toContain('label: "知识与托管"');
		expect(nav).toContain('href: "/knowledge"');
		for (const label of ["知识准备", "测试与修正", "验收与托管"])
			expect(workspace).toContain(label);
	});

	it("keeps lifecycle forms and agent policy in collapsed advanced governance", () => {
		expect(workspace).toContain("高级治理与诊断");
		expect(workspace).toContain('<details className="rounded-xl border bg-card">');
		expect(workspace).not.toContain("<details open");
		expect(workspace).toContain("<KnowledgeCapabilities />");
		expect(workspace).toContain("<XiaofeiFallbackSettings />");
	});

	it("prepares the uploaded source through the authorized atomic preparation endpoint", () => {
		expect(quickPreparation).not.toContain("updateKnowledgeEntry");
		expect(quickPreparation).toContain("prepareKnowledge");
		expect(quickPreparation).not.toContain("generateKnowledgeUnits");
		expect(quickPreparation).not.toContain("transitionKnowledgeUnit");
		expect(quickPreparation).toContain("elapsedMs");
		expect(quickPreparation).toContain("资料已提交，服务端正在校验、解析并保存");
		expect(quickPreparation).toContain("准备请求已提交，服务端正在处理并保存结果");
		expect(quickPreparation).toContain("当前资料和输入已保留，可直接重试");
		expect(quickPreparation).toContain("KNOWLEDGE_PREPARATION_INCOMPLETE");
		expect(quickPreparation).toContain("安全重试标识");
		expect(quickPreparation).toContain("已持久化");
		expect(quickPreparation).toContain("完成后会显示各阶段耗时");
	});

	it("keeps the two knowledge inputs visible and moves a prepared source to one test action", () => {
		expect(workspace).toContain("lg:grid-cols-2");
		expect(workspace).toContain(
			'<KnowledgeVersioningPanel key={versioningKey} section="prepare" />',
		);
		expect(quickPreparation).toContain("这份资料没有可用于 Test CA 的当前条目");
		expect(quickPreparation).toContain("服务端测试会话");
		expect(quickPreparation).toContain("Test CA 已准备");
		expect(quickPreparation).toContain('href="/knowledge?stage=test"');
		expect(quickPreparation).not.toContain("sessionStorage");
		expect(quickPreparation).toContain("onPrepared?.()");
		expect(workspace).toContain("onPrepared={() => setVersioningKey");
	});
});
