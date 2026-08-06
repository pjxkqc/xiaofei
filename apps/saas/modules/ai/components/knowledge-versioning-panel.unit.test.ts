import { describe, expect, it } from "vitest";

import {
	findInterventionEvidence,
	symmetricDifferenceSize,
	type TestTurnView,
} from "./KnowledgeVersioningPanel";

describe("symmetricDifferenceSize", () => {
	it("reports revision replacements even when Active and Test have equal member counts", () => {
		expect(
			symmetricDifferenceSize(
				new Set(["platform-v1", "merchant-price-v1"]),
				new Set(["platform-v1", "merchant-price-v2"]),
			),
		).toBe(2);
	});

	it("reconnects persisted Before and After turns across Test CA sessions", () => {
		const source = turn("before", "source-session", "intervention-1", null);
		const rerun = turn("after", "rerun-session", "intervention-1", "before");

		expect(
			findInterventionEvidence(
				{ "source-session": [source], "rerun-session": [rerun] },
				"source-session",
			),
		).toEqual([{ interventionId: "intervention-1", source, rerun }]);
	});
});

function turn(
	id: string,
	testSessionId: string,
	interventionId: string | null,
	sourceTestTurnId: string | null,
): TestTurnView {
	return {
		turn: { id, question: id, capabilityVersionId: `${testSessionId}-ca` },
		answer: id,
		metadata: {
			knowledgeEvidence: null,
			knowledgeTitle: null,
			missingSlots: [],
			nextAction: "reply",
			ownerType: "ai",
			riskLevel: "low",
			stage: "admission",
			traces: [],
		},
		feedbackAllowed: false,
		feedbackMode: "supplement",
		interventionId,
		sourceTestTurnId,
	};
}
