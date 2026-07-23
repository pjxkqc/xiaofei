import {
	type ConversationState,
	type RuntimeTurnResult,
	type XiaofeiWorkspaceSnapshot,
} from "@repo/xiaofei";

import { runLangGraphTurn } from "./langgraph";
import { runMastraTurn } from "./mastra";

export async function runXiaofeiTurn(input: {
	message: string;
	state: ConversationState;
	snapshot: XiaofeiWorkspaceSnapshot;
}): Promise<RuntimeTurnResult> {
	return input.snapshot.agent.runtime === "mastra"
		? await runMastraTurn(input)
		: await runLangGraphTurn(input);
}
