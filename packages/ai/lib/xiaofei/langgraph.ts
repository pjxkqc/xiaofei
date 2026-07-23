import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import {
	finalizeTurn,
	prepareTurn,
	type ConversationState,
	type PreparedTurn,
	type ReplyGenerator,
	type RuntimeTurnResult,
	type XiaofeiWorkspaceSnapshot,
} from "@repo/xiaofei";
import { generateText } from "ai";

import { createTextModel } from "../../model";

const GraphState = Annotation.Root({
	message: Annotation<string>(),
	conversation: Annotation<ConversationState>(),
	snapshot: Annotation<XiaofeiWorkspaceSnapshot>(),
	prepared: Annotation<PreparedTurn | null>({
		reducer: (_previous, next) => next ?? null,
		default: () => null,
	}),
	result: Annotation<RuntimeTurnResult | null>({
		reducer: (_previous, next) => next ?? null,
		default: () => null,
	}),
});

type GraphStateValue = typeof GraphState.State;

class LangGraphReplyGenerator implements ReplyGenerator {
	async generate(input: Parameters<ReplyGenerator["generate"]>[0]): Promise<string> {
		const result = await generateText({
			model: createTextModel(),
			system: [
				input.agentInstructions,
				"你正在 LangGraph 的受控回复节点中。",
				"只能依据给定 KnowledgeUnit 回答，不能执行或声称执行任何业务动作。",
				"回复简练并跟随客户语言。",
			].join("\n"),
			prompt: [
				`客户消息：${input.message}`,
				`KnowledgeUnit：${input.knowledge.title}`,
				`标准口径：${input.knowledge.standardReplyPolicy}`,
				`禁止输出：${input.knowledge.forbiddenOutputs.join("、")}`,
			].join("\n"),
		});

		return result.text.trim();
	}
}

const graph = new StateGraph(GraphState)
	.addNode("admission_knowledge_slots", (state: GraphStateValue) => ({
		prepared: prepareTurn({
			message: state.message,
			state: state.conversation,
			snapshot: state.snapshot,
			runtime: "langgraph",
		}),
	}))
	.addNode("guarded_generation", async (state: GraphStateValue) => {
		if (!state.prepared) throw new Error("LangGraph turn was not prepared.");
		return {
			result: await finalizeTurn({
				prepared: state.prepared,
				snapshot: state.snapshot,
				runtime: "langgraph",
				message: state.message,
				replyGenerator: new LangGraphReplyGenerator(),
			}),
		};
	})
	.addEdge(START, "admission_knowledge_slots")
	.addEdge("admission_knowledge_slots", "guarded_generation")
	.addEdge("guarded_generation", END)
	.compile();

export async function runLangGraphTurn(input: {
	message: string;
	state: ConversationState;
	snapshot: XiaofeiWorkspaceSnapshot;
}): Promise<RuntimeTurnResult> {
	const output = await graph.invoke({
		message: input.message,
		conversation: input.state,
		snapshot: input.snapshot,
	});
	if (!output.result) throw new Error("LangGraph did not produce a runtime result.");
	return output.result;
}
