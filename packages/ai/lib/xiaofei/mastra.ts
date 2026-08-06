import { Agent } from "@mastra/core/agent";
import { type ReplyGenerator } from "@repo/xiaofei";

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
				...(input.knowledgeContext ?? [])
					.slice(1, 2)
					.map(
						(context) => `Additional knowledge: ${context.title}\n${context.standardReplyPolicy}`,
					),
				`Forbidden outputs (all selected KU): ${[...new Set([...(input.knowledgeContext ?? []).flatMap((unit) => unit.forbiddenOutputs), ...input.knowledge.forbiddenOutputs])].join(", ")}`,
			].join("\n"),
			model: createTextModel("reply"),
		});
		const result = await agent.generate(
			[
				`客户消息：${input.message}`,
				...(input.state.lastReply
					? [
							`上一轮小飞回复：${input.state.lastReply}`,
							"如果客户当前消息是在回答上一轮问题，请延续该语境，不要求客户重复商品名称。",
						]
					: []),
				`知识标题：${input.knowledge.title}`,
				`适用口径：${input.knowledge.standardReplyPolicy}`,
				`禁止输出：${input.knowledge.forbiddenOutputs.join("、")}`,
			].join("\n"),
		);

		return result.text.trim();
	}
}

export function createMastraReplyGenerator(): ReplyGenerator {
	return new MastraReplyGenerator();
}
