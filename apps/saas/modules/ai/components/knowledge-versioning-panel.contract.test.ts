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
			"Active CA",
			"Test CA",
			"逻辑 KU",
			"Revision",
			"来源",
			"Role",
			"Priority",
			"knowledgeUnitRevision.logicalKnowledgeUnitId",
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
		expect(panel).toContain("Before · {rerun.source.id}");
		expect(panel).toContain("After · {rerun.rerun.id}");
		expect(panel).toContain("人工验收 Test CA");
	});

	it("makes no-hit and platform answers visibly non-correctable", () => {
		expect(panel).toContain("lastTurn.feedbackAllowed ?");
		expect(panel).toContain("未命中或平台基线");
	});

	it("reuses an opaque Test session for consecutive turns and resets after correction", () => {
		expect(panel).toContain("testSessionId,");
		expect(panel).toContain("setTurns((history) => [...history, result])");
		expect(panel).toContain("orpcClient.xiaofei.resetTestSession()");
		expect(panel).toContain("后续测试已切换为新会话");
	});
});
