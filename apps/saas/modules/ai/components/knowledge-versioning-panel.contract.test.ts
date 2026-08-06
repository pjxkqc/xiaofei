import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const panel = readFileSync(
	path.resolve(import.meta.dirname, "KnowledgeVersioningPanel.tsx"),
	"utf8",
);

describe("knowledge versioning panel Stage-3 contract", () => {
	it("renders exact CA membership evidence rather than only counts", () => {
		for (const value of [
			"Active",
			"Test",
			"平台兜底",
			"商户资料",
			"多个 KU revision 共同组成一个 CA",
			"knowledgeUnitRevision.origin",
		])
			expect(panel).toContain(value);
	});

	it("binds correction to the saved assistant turn and displays persisted before/after evidence", () => {
		const correctionCall = panel.slice(
			panel.indexOf("applyTestTurnCorrection({"),
			panel.indexOf("});", panel.indexOf("applyTestTurnCorrection({")),
		);
		expect(panel).toContain("sourceTestTurnId: turn.turn.id");
		expect(correctionCall).not.toContain("knowledgeUnitRevisionId");
		expect(correctionCall).not.toContain("capabilityVersionId");
		expect(panel).toContain('label="Before"');
		expect(panel).toContain('label="After"');
		expect(panel).toContain("人工验收 Test CA");
	});

	it("offers a merchant supplement action for no-hit and platform answers", () => {
		expect(panel).toContain("turn.feedbackAllowed ?");
		expect(panel).toContain("补充为商户知识并修正");
		expect(panel).toContain("生成商户 KU 并同题复测");
	});

	it("uses durable Test sessions for consecutive turns and resets after correction", () => {
		expect(panel).not.toContain("sessionStorage");
		expect(panel).toContain("listTestSessions");
		expect(panel).toContain("getTestSession");
		expect(panel).toContain("旧 CA（只读）");
		expect(panel).toContain("testSessionId,");
		expect(panel).toContain("setTurns((history) => [...history, result])");
		expect(panel).toContain("orpcClient.xiaofei.newTestSession()");
		expect(panel).toContain("后续测试已切换为新会话");
	});

	it("offers both Test CA and Organization-scoped Support acceptance", () => {
		expect(panel).toContain("继续 Test CA 沙盒");
		expect(panel).toContain("sendSyntheticSupportMessage");
		expect(panel).toContain("Support 验收会话");
		expect(panel).toContain("/inbox?conversationId=");
	});

	it("lets every saved turn select one correction editor", () => {
		expect(panel).toContain("选择并修正这条回答");
		expect(panel).toContain("setSelectedTurnId(turn.turn.id)");
		expect(panel).toContain('selected.feedbackMode === "revise" ? "正在修正" : "正在补充"');
	});

	it("calculates Test-versus-Active membership by revision-set difference and locks actions", () => {
		expect(panel).toContain("symmetricDifferenceSize");
		expect(panel).toContain("active?.id === testVersion?.id");
		expect(panel).toContain("Test CA 已验收");
		expect(panel).toContain("knowledgeUnitRevisionId");
		expect(panel).toContain("TestTurn：");
		expect(panel).toContain("capabilityVersionId={rerun.source.capabilityVersionId}");
		expect(panel).toContain("setBusy(true)");
	});

	it("requires a Test CA before exposing the test form", () => {
		expect(panel).toContain("hasTestVersion");
		expect(panel).toContain("还没有 Test CA");
		expect(panel).toContain("先去准备知识");
		expect(panel).toContain("!testVersion");
	});
});
