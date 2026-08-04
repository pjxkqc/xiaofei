import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const workspace = readFileSync(path.resolve(import.meta.dirname, "KnowledgeWorkspace.tsx"), "utf8");
const nav = readFileSync(
	path.resolve(import.meta.dirname, "../../shared/components/NavBar.tsx"),
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
		expect(workspace).toContain("<details open");
		expect(workspace).toContain("<KnowledgeCapabilities />");
		expect(workspace).toContain("<XiaofeiFallbackSettings />");
	});
});
