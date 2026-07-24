import {
	type ConversationState,
	type RuntimeTurnResult,
	type XiaofeiWorkspaceSnapshot,
} from "@repo/xiaofei";

import { runLangGraphTurn } from "./langgraph";

export async function runXiaofeiTurn(input: {
	message: string;
	state: ConversationState;
	snapshot: XiaofeiWorkspaceSnapshot;
}): Promise<RuntimeTurnResult> {
	return await runLangGraphTurn(input);
}
