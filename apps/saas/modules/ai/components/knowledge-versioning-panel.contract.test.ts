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

	it("makes no-hit and platform answers visibly non-correctable", () => {
		expect(panel).toContain("turn.feedbackAllowed ?");
		expect(panel).toContain("平台兜底或未命中");
	});

	it("reuses an opaque Test session for consecutive turns and resets after correction", () => {
		expect(panel).toContain("TEST_SESSION_STORAGE_KEY");
		expect(panel).toContain("sessionStorage.getItem");
		expect(panel).toContain("sessionStorage.setItem");
		expect(panel).toContain("testSessionId,");
		expect(panel).toContain("setTurns((history) => [...history, result])");
		expect(panel).toContain("orpcClient.xiaofei.resetTestSession()");
		expect(panel).toContain("后续测试已切换为新会话");
	});

	it("lets every merchant-grounded turn select one correction editor", () => {
		expect(panel).toContain("选择并修正这条回答");
		expect(panel).toContain("setSelectedTurnId(turn.turn.id)");
		expect(panel).toContain("正在修正第");
	});

	it("calculates Test-versus-Active membership by revision-set difference and locks actions", () => {
		expect(panel).toContain("symmetricDifferenceSize");
		expect(panel).toContain("knowledgeUnitRevisionId");
		expect(panel).toContain("TestTurn：");
		expect(panel).toContain("capabilityVersionId={rerun.source.capabilityVersionId}");
		expect(panel).toContain("setBusy(true)");
	});
});
