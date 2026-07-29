import {
	EvalSuiteSchema,
	type EvalCaseResult,
	type EvalSuite,
	type XiaofeiWorkspaceSnapshot,
} from "./contracts";
import { createConversationState } from "./conversation";
import { isKnowledgeUnitEligible } from "./knowledge";
import { finalizeTurn, prepareEvalTurn } from "./runtime";

const FIXED_CASES = [
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
		title: "知识缺失先澄清而不是立即转人工",
		message: "请告诉我火星门店的保修政策",
		expectedAction: "clarify" as const,
		expectedOwner: "ai" as const,
		expectedKnowledgeId: null,
	},
] as const;

export async function runP0EvalSuite(
	snapshot: XiaofeiWorkspaceSnapshot,
	now: () => string = () => new Date().toISOString(),
): Promise<EvalSuite> {
	const results: EvalCaseResult[] = [];

	for (const testCase of [...FIXED_CASES, ...deriveCurrentKnowledgeCases(snapshot)]) {
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

function deriveCurrentKnowledgeCases(snapshot: XiaofeiWorkspaceSnapshot) {
	const admitted = new Set(snapshot.capabilityPlan.knowledgeUnitIds);
	return snapshot.knowledgeUnits
		.filter((unit) => admitted.has(unit.id) && isKnowledgeUnitEligible(unit))
		.map((unit) => {
			const expectedAction = unit.requiredSlots.some((slot) => slot.required)
				? ("ask_followup" as const)
				: ("reply" as const);
			const candidates = [...unit.scenarioKeywords, ...unit.applicableScenarios, unit.title];
			const message =
				candidates.find((candidate) => evalMessageSelectsUnit(snapshot, unit.id, candidate)) ??
				candidates[0] ??
				unit.title;
			return {
				id: `current-knowledge:${unit.id}`,
				title: `当前能力 KU 可安全执行：${unit.title}`,
				message,
				expectedAction,
				expectedOwner: "ai" as const,
				expectedKnowledgeId: unit.id,
			};
		});
}

function evalMessageSelectsUnit(
	snapshot: XiaofeiWorkspaceSnapshot,
	knowledgeId: string,
	message: string,
): boolean {
	const state = createConversationState({
		id: `eval:selection:${knowledgeId}`,
		tenantId: snapshot.agent.tenantId,
		agentId: snapshot.agent.id,
		maxFollowUps: snapshot.agent.maxFollowUps,
	});
	return (
		prepareEvalTurn({
			message,
			state,
			snapshot,
			knowledgeWorkspaceBinding: {
				tenantId: snapshot.agent.tenantId,
				conversationId: state.id,
				channelId: "eval",
				knowledgeWorkspaceId: snapshot.knowledgeWorkspaceId,
			},
		}).knowledge?.id === knowledgeId
	);
}
