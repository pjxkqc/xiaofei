import { describe, expect, it } from "vitest";

import { symmetricDifferenceSize, toInterventionEvidence } from "./KnowledgeVersioningPanel";

describe("symmetricDifferenceSize", () => {
	it("reports revision replacements even when Active and Test have equal member counts", () => {
		expect(
			symmetricDifferenceSize(
				new Set(["platform-v1", "merchant-price-v1"]),
				new Set(["platform-v1", "merchant-price-v2"]),
			),
		).toBe(2);
	});

	it("keeps an incomplete persisted pair readable without inventing an After turn", () => {
		const evidence = toInterventionEvidence([
			{
				interventionId: "intervention-1",
				isComplete: false,
				correction: "correct answer",
				before: persistedTurn("before", "source-session"),
				after: null,
			},
		]);

		expect(evidence).toMatchObject([
			{
				interventionId: "intervention-1",
				isComplete: false,
				source: { answer: "before" },
				rerun: null,
			},
		]);
	});
});

function persistedTurn(id: string, testSessionId: string) {
	return {
		id,
		testSessionId,
		capabilityVersionId: `${testSessionId}-ca`,
		answer: id,
		runtimeMetadata: metadata(),
	};
}

function metadata() {
	return {
		knowledgeEvidence: null,
		knowledgeTitle: null,
		missingSlots: [],
		nextAction: "reply",
		ownerType: "ai",
		riskLevel: "low",
		stage: "admission",
		traces: [],
	};
}
