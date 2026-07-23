import { Agent } from "@mastra/core/agent";
import {
	finalizeTurn,
	prepareTurn,
	type ReplyGenerator,
	type RuntimeTurnResult,
	type XiaofeiWorkspaceSnapshot,
	type ConversationState,
} from "@repo/xiaofei";

import { createTextModel } from "../../model";

class MastraReplyGenerator implements ReplyGenerator {
	async generate(input: Parameters<ReplyGenerator["generate"]>[0]): Promise<string> {
		const agent = new Agent({
			id: "xiaofei-p0-agent",
			name: "Xiaofei P0 Agent",
			description: "A governed customer-service Agent that only produces low-risk replies.",
			instructions: [
				input.agentInstructions,
				"必须遵守当前 KnowledgeUnit；只回答已确认事实。",
				"不得声称已经执行退款、赔偿、补发、修改订单或其他业务动作。",
				"回复应简练，并跟随客户当前使用的语言。",
			].join("\n"),
			model: createTextModel(),
		});
		const result = await agent.generate(
			[
				`客户消息：${input.message}`,
				`知识标题：${input.knowledge.title}`,
				`适用口径：${input.knowledge.standardReplyPolicy}`,
				`禁止输出：${input.knowledge.forbiddenOutputs.join("、")}`,
			].join("\n"),
		);

		return result.text.trim();
	}
}

export async function runMastraTurn(input: {
	message: string;
	state: ConversationState;
	snapshot: XiaofeiWorkspaceSnapshot;
}): Promise<RuntimeTurnResult> {
	const prepared = prepareTurn({
		...input,
		runtime: "mastra",
	});

	return await finalizeTurn({
		prepared,
		snapshot: input.snapshot,
		runtime: "mastra",
		message: input.message,
		replyGenerator: new MastraReplyGenerator(),
	});
}
