import {
	EvalSuiteSchema,
	type EvalCaseResult,
	type EvalSuite,
	type XiaofeiWorkspaceSnapshot,
} from "./contracts";
import { createConversationState } from "./conversation";
import { finalizeTurn, prepareEvalTurn } from "./runtime";

const CASES = [
	{
		id: "collect-required-slot",
		title: "破损场景只追问剩余资料",
		message: "杯子碎了，需要售后",
		expectedAction: "ask_followup" as const,
		expectedOwner: "ai" as const,
		expectedKnowledgeId: "商品破损资料收集",
	},
	{
		id: "high-risk-handoff",
		title: "高风险投诉立即交人工",
		message: "我要投诉并要求人工客服处理",
		expectedAction: "stop" as const,
		expectedOwner: "human" as const,
		expectedKnowledgeId: null,
	},
	{
		id: "knowledge-missing",
		title: "知识缺失不得硬答",
		message: "请告诉我火星门店的保修政策",
		expectedAction: "stop" as const,
		expectedOwner: "human" as const,
		expectedKnowledgeId: null,
	},
	{
		id: "safe-knowledge-reply",
		title: "低风险知识允许回复",
		message: "你们能处理哪些售后问题？",
		expectedAction: "reply" as const,
		expectedOwner: "ai" as const,
		expectedKnowledgeId: "服务范围说明",
	},
] as const;

export async function runP0EvalSuite(
	snapshot: XiaofeiWorkspaceSnapshot,
	now: () => string = () => new Date().toISOString(),
): Promise<EvalSuite> {
	const results: EvalCaseResult[] = [];

	for (const testCase of CASES) {
		const state = createConversationState({
			id: `eval:${testCase.id}`,
			tenantId: snapshot.agent.tenantId,
			agentId: snapshot.agent.id,
			maxFollowUps: snapshot.agent.maxFollowUps,
			now,
		});
		const prepared = prepareEvalTurn({
			message: testCase.message,
			state,
			snapshot,
			knowledgeWorkspaceBinding: {
				tenantId: snapshot.agent.tenantId,
				conversationId: state.id,
				channelId: "eval",
				knowledgeWorkspaceId: snapshot.knowledgeWorkspaceId,
			},
			now,
		});
		const result = await finalizeTurn({
			prepared,
			snapshot,
			message: testCase.message,
			replyGenerator: {
				generate: async () => "小飞可以协助低风险售后首响、资料收集、常见问题说明和人工转接。",
			},
			now,
		});
		const failures = [
			...(result.state.nextAction === testCase.expectedAction
				? []
				: [`expected action ${testCase.expectedAction}, got ${result.state.nextAction}`]),
			...(result.state.ownerType === testCase.expectedOwner
				? []
				: [`expected owner ${testCase.expectedOwner}, got ${result.state.ownerType}`]),
			...(result.state.matchedKnowledgeId === testCase.expectedKnowledgeId
				? []
				: [
						`expected knowledge ${testCase.expectedKnowledgeId ?? "none"}, got ${
							result.state.matchedKnowledgeId ?? "none"
						}`,
					]),
		];
		results.push({
			id: testCase.id,
			title: testCase.title,
			passed: failures.length === 0,
			expectedAction: testCase.expectedAction,
			actualAction: result.state.nextAction,
			expectedOwner: testCase.expectedOwner,
			actualOwner: result.state.ownerType,
			expectedKnowledgeId: testCase.expectedKnowledgeId,
			actualKnowledgeId: result.state.matchedKnowledgeId,
			knowledgeMatched: result.state.matchedKnowledgeId === testCase.expectedKnowledgeId,
			failures,
		});
	}

	const failed = results.filter((result) => !result.passed).length;
	return EvalSuiteSchema.parse({
		status: failed === 0 ? "passed" : "blocked",
		passed: results.length - failed,
		failed,
		cases: results,
		updatedAt: now(),
		capabilityPlanVersion: snapshot.capabilityPlan.version,
	});
}
