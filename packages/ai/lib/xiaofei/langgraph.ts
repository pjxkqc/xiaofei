import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import {
	finalizeTurn,
	prepareTurn,
	type ConversationState,
	type KnowledgeWorkspaceBinding,
	type PreparedTurn,
	type RuntimeTurnResult,
	type TraceEvent,
	type XiaofeiWorkspaceSnapshot,
} from "@repo/xiaofei";

import { createMastraReplyGenerator } from "./mastra";

const GraphState = Annotation.Root({
	message: Annotation<string>(),
	conversation: Annotation<ConversationState>(),
	snapshot: Annotation<XiaofeiWorkspaceSnapshot>(),
	knowledgeWorkspaceBinding: Annotation<KnowledgeWorkspaceBinding>(),
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

const graph = new StateGraph(GraphState)
	.addNode("admission_knowledge_slots", (state: GraphStateValue) => {
		const prepared = prepareTurn({
			message: state.message,
			state: state.conversation,
			snapshot: state.snapshot,
			knowledgeWorkspaceBinding: state.knowledgeWorkspaceBinding,
		});
		return {
			prepared: {
				...prepared,
				traces: [
					frameworkTrace(
						state.conversation.id,
						"langgraph",
						"LangGraph 状态机开始处理",
						"执行会话准入、知识选择、槽位与路由节点。",
					),
					...prepared.traces,
				],
			},
		};
	})
	.addNode("guarded_generation", async (state: GraphStateValue) => {
		if (!state.prepared) throw new Error("LangGraph turn was not prepared.");
		const prepared =
			state.prepared.action === "reply"
				? {
						...state.prepared,
						traces: [
							...state.prepared.traces,
							frameworkTrace(
								state.conversation.id,
								"mastra",
								"Mastra Agent 生成候选回复",
								"仅依据已发布 KnowledgeUnit 生成，随后仍需通过 Guardrail。",
							),
						],
					}
				: state.prepared;
		return {
			result: await finalizeTurn({
				prepared,
				snapshot: state.snapshot,
				message: state.message,
				replyGenerator: createMastraReplyGenerator(),
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
	knowledgeWorkspaceBinding: KnowledgeWorkspaceBinding;
}): Promise<RuntimeTurnResult> {
	const output = await graph.invoke({
		message: input.message,
		conversation: input.state,
		snapshot: input.snapshot,
		knowledgeWorkspaceBinding: input.knowledgeWorkspaceBinding,
	});
	if (!output.result) throw new Error("LangGraph did not produce a runtime result.");
	return output.result;
}

function frameworkTrace(
	conversationId: string,
	type: "langgraph" | "mastra",
	title: string,
	detail: string,
): TraceEvent {
	return {
		id: globalThis.crypto.randomUUID(),
		conversationId,
		at: new Date().toISOString(),
		type,
		title,
		detail,
	};
}
