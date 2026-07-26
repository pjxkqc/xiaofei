import {
	type ConversationState,
	type KnowledgeWorkspaceBinding,
	type RuntimeTurnResult,
	type XiaofeiWorkspaceSnapshot,
} from "@repo/xiaofei";

import { runLangGraphTurn } from "./langgraph";

export async function runXiaofeiTurn(input: {
	message: string;
	state: ConversationState;
	snapshot: XiaofeiWorkspaceSnapshot;
	knowledgeWorkspaceBinding: KnowledgeWorkspaceBinding;
}): Promise<RuntimeTurnResult> {
	return await runLangGraphTurn(input);
}
