import {
	type ConversationState,
	type KnowledgeWorkspaceBinding,
	type RuntimeTurnResult,
	type XiaofeiWorkspaceSnapshot,
	materializeTestCapabilitySnapshot,
	type CapabilityVersionManifest,
	type KnowledgeUnitRevision,
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

export async function runXiaofeiTestTurn(input: {
	message: string;
	state: ConversationState;
	baseSnapshot: XiaofeiWorkspaceSnapshot;
	knowledgeWorkspaceBinding: KnowledgeWorkspaceBinding;
	manifest: CapabilityVersionManifest;
	revisions: KnowledgeUnitRevision[];
}): Promise<RuntimeTurnResult> {
	const snapshot = materializeTestCapabilitySnapshot({
		base: input.baseSnapshot,
		manifest: input.manifest,
		revisions: input.revisions,
	});
	return await runLangGraphTurn({
		message: input.message,
		state: input.state,
		snapshot,
		knowledgeWorkspaceBinding: input.knowledgeWorkspaceBinding,
		testMode: true,
	});
}
