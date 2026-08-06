import { describe, expect, it, vi } from "vitest";

import { symmetricDifferenceSize, toInterventionEvidence } from "./KnowledgeVersioningPanel";
import { recoverTestSession } from "./test-session-recovery";

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

	it("projects a complete before/after pair", () => {
		const evidence = toInterventionEvidence([
			{
				interventionId: "i-1",
				isComplete: true,
				correction: "fix",
				before: persistedTurn("before", "s"),
				after: persistedTurn("after", "s-2"),
			},
		]);
		expect(evidence[0]?.rerun?.answer).toBe("after");
		expect(evidence[0]?.isComplete).toBe(true);
	});

	it("rejects invalid runtime metadata", () => {
		const pair = {
			interventionId: "i",
			isComplete: true,
			correction: "x",
			before: persistedTurn("b", "s"),
			after: null,
		};
		(pair.before as { runtimeMetadata: unknown }).runtimeMetadata = { invalid: true };
		expect(() => toInterventionEvidence([pair])).toThrow("会话干预证据格式无效");
	});

	it("recovers only the selected session detail", async () => {
		const list = vi.fn(async () => ({
			items: [
				{ id: "selected", writable: true },
				{ id: "old", writable: false },
			],
		}));
		const detail = vi.fn(async (id: string) => ({ id }));
		const result = await recoverTestSession({ list, detail });
		expect(list).toHaveBeenCalledOnce();
		expect(detail).toHaveBeenCalledOnce();
		expect(detail).toHaveBeenCalledWith("selected");
		expect(result.detail).toEqual({ id: "selected" });
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
