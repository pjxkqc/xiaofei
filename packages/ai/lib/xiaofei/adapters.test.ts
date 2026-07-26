import { createConversationState, createDefaultWorkspaceSnapshot } from "@repo/xiaofei";
import { describe, expect, it } from "vitest";

import { runMastraGovernance } from "./governance";
import { KnowledgeUnitGenerationError, parseGeneratedCandidates } from "./knowledge-generation";
import { runLangGraphTurn } from "./langgraph";
import { runXiaofeiTurn } from "./runtime";

function setup() {
	const snapshot = createDefaultWorkspaceSnapshot("tenant-1");
	snapshot.capabilityPlan.reviewed = true;
	return {
		snapshot,
		state: createConversationState({
			id: "conversation-unified",
			tenantId: "tenant-1",
			agentId: snapshot.agent.id,
			maxFollowUps: snapshot.agent.maxFollowUps,
		}),
	};
}

describe("Xiaofei runtime adapters", () => {
	it("accepts only JSON-array structured KU output and redacts malformed provider output", () => {
		expect(parseGeneratedCandidates('[{"entryId":"entry-1"}]')).toEqual([{ entryId: "entry-1" }]);
		expect(parseGeneratedCandidates('```json\n{"drafts":[{"entryId":"entry-1"}]}\n```')).toEqual([
			{ entryId: "entry-1" },
		]);
		expect(parseGeneratedCandidates('Generated draft:\n{"entryId":"entry-1"}')).toEqual([
			{ entryId: "entry-1" },
		]);
		expect(parseGeneratedCandidates('[{"entryId":"entry-1"}]\nDone.')).toEqual([
			{ entryId: "entry-1" },
		]);
		expect(() => parseGeneratedCandidates("provider token: secret-value")).toThrow(
			KnowledgeUnitGenerationError,
		);
	});
	it("runs the Mastra governance workflow without an LLM call", async () => {
		const { snapshot } = setup();
		const governed = await runMastraGovernance(snapshot);
		expect(governed.agent.status).toBe("review_ready");
		expect(governed.knowledgeUnits.every((unit) => unit.status === "released")).toBe(true);
	});

	it("runs deterministic P0 collection through a real LangGraph StateGraph", async () => {
		const input = setup();
		const result = await runLangGraphTurn({
			...input,
			message: "杯子碎了，需要售后",
		});
		expect(result.metadata.traces.some((trace) => trace.type === "langgraph")).toBe(true);
		expect(result.state.nextAction).toBe("ask_followup");
		expect(result.reply).toContain("订单号");
	});

	it("runs high-risk exit through the unified runtime without calling the model", async () => {
		const input = setup();
		const result = await runXiaofeiTurn({
			...input,
			message: "我要投诉并找人工客服",
		});
		expect(result.metadata.traces.some((trace) => trace.type === "langgraph")).toBe(true);
		expect(result.metadata.traces.some((trace) => trace.type === "mastra")).toBe(false);
		expect(result.state.ownerType).toBe("human");
		expect(result.state.ownerEpoch).toBe(1);
	});
});
