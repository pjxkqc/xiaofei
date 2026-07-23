import { createConversationState, createDefaultWorkspaceSnapshot } from "@repo/xiaofei";
import { describe, expect, it } from "vitest";

import { runMastraGovernance } from "./governance";
import { runLangGraphTurn } from "./langgraph";
import { runMastraTurn } from "./mastra";

function setup(runtime: "mastra" | "langgraph") {
	const snapshot = createDefaultWorkspaceSnapshot("tenant-1");
	snapshot.agent.runtime = runtime;
	return {
		snapshot,
		state: createConversationState({
			id: `conversation-${runtime}`,
			tenantId: "tenant-1",
			agentId: snapshot.agent.id,
			maxFollowUps: snapshot.agent.maxFollowUps,
		}),
	};
}

describe("Xiaofei runtime adapters", () => {
	it("runs the Mastra governance workflow without an LLM call", async () => {
		const { snapshot } = setup("langgraph");
		const governed = await runMastraGovernance(snapshot);
		expect(governed.agent.status).toBe("review_ready");
		expect(governed.knowledgeUnits.every((unit) => unit.status === "released")).toBe(true);
	});

	it("runs deterministic P0 collection through a real LangGraph StateGraph", async () => {
		const input = setup("langgraph");
		const result = await runLangGraphTurn({
			...input,
			message: "杯子碎了，需要售后",
		});
		expect(result.metadata.runtime).toBe("langgraph");
		expect(result.state.nextAction).toBe("ask_followup");
		expect(result.reply).toContain("订单号");
	});

	it("runs high-risk exit through the Mastra runtime boundary without calling the model", async () => {
		const input = setup("mastra");
		const result = await runMastraTurn({
			...input,
			message: "我要投诉并找人工客服",
		});
		expect(result.metadata.runtime).toBe("mastra");
		expect(result.state.ownerType).toBe("human");
		expect(result.state.ownerEpoch).toBe(1);
	});
});
