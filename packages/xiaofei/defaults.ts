import {
	XiaofeiWorkspaceSnapshotSchema,
	type CapabilityPlan,
	type KnowledgeUnit,
	type ReleaseGate,
	type XiaofeiWorkspaceSnapshot,
} from "./contracts";
import { parseKnowledgeMarkdown } from "./knowledge";

export const DEFAULT_KNOWLEDGE_MARKDOWN = `# 小飞 P0 客服知识

## 商品破损资料收集
适用场景: 客户收到商品后发现破损、碎裂或无法正常使用
不适用场景: 客户尚未收到商品、仅咨询价格
场景关键词: 破损，碎了，坏了，damaged，broken
必问字段:
- order_id | 订单号 | 请提供订单号，方便人工客服后续核实。
- damage_photo | 破损照片 | 请提供能看清商品破损情况的照片。
禁止输出: 已退款，一定退款，已补发，一定补发，责任在我们，guaranteed refund
转人工条件: 投诉，赔偿，立即退款，无法提供资料，资料冲突
标准口径: 只收集订单号与破损照片，不承诺退款、赔偿、补发或处理时效；资料齐全后转交人工核实。
兜底话术: 我先记录您提供的信息，并转交人工客服核实处理。

## 服务范围说明
适用场景: 客户询问小飞能处理哪些问题、支持哪些售后咨询
不适用场景: 要求执行退款、赔偿、补发等业务动作
场景关键词: 能做什么，能处理，服务范围，支持什么，help，support
禁止输出: 已退款，已赔偿，已补发，保证处理，guarantee
转人工条件: 退款，赔偿，补发，投诉，法律威胁
标准口径: 可以说明小飞支持低风险首响、售后资料收集、常见问题解答和人工转接，但不能声称已经执行任何业务动作。
兜底话术: 我可以先了解您的问题并收集必要资料；涉及处理结果时会转交人工客服确认。`;

export function createDefaultWorkspaceSnapshot(
	tenantId: string,
	now: () => string = () => new Date().toISOString(),
): XiaofeiWorkspaceSnapshot {
	const knowledgeUnits = parseKnowledgeMarkdown(DEFAULT_KNOWLEDGE_MARKDOWN);
	const updatedAt = now();
	const evalSuite = {
		status: "warning" as const,
		passed: 0,
		failed: 0,
		cases: [],
		updatedAt,
	};
	const tools = [
		{
			id: "send_customer_message",
			name: "发送客户消息",
			category: "adapter" as const,
			riskLevel: "medium" as const,
			status: "available" as const,
			description: "仅在最终发送资格通过后由 Channel Adapter 执行。",
		},
		{
			id: "add_private_note",
			name: "写入人工交接摘要",
			category: "observer" as const,
			riskLevel: "low" as const,
			status: "available" as const,
			description: "向客服工作台写入业务可读 HandoffPackage。",
		},
		{
			id: "issue_refund",
			name: "执行退款",
			category: "action" as const,
			riskLevel: "high" as const,
			status: "blocked" as const,
			description: "P0 禁止 Agent 直接执行，仅保留未来审批式 Tool 接口。",
		},
	];
	const agent = {
		id: "xiaofei-customer-service",
		tenantId,
		name: "小飞客服 Agent",
		status: "review_ready" as const,
		version: "p0-v1",
		instructions:
			"你是小飞客服 Agent。只做低风险首响、知识问答、资料收集和人工转接；不得承诺退款、赔偿、补发、责任或时效。",
		serviceScopes: ["售后首响", "资料收集", "常见问题", "人工转接"],
		supportedLanguages: ["zh-CN", "en-US"],
		fallbackLanguage: "en-US",
		maxFollowUps: 2,
		forbiddenOutputs: ["已退款", "一定退款", "已赔偿", "已补发", "guaranteed refund"],
		handoffRules: ["投诉", "赔偿", "立即退款", "知识缺失", "资料冲突"],
	};
	const capabilityPlan = deriveCapabilityPlan(knowledgeUnits, updatedAt);

	return XiaofeiWorkspaceSnapshotSchema.parse({
		agent,
		knowledgeMarkdown: DEFAULT_KNOWLEDGE_MARKDOWN,
		knowledgeUnits,
		guardrails: {
			forbiddenPhrases: agent.forbiddenOutputs,
			handoffKeywords: agent.handoffRules,
			requireReleasedKnowledge: true,
		},
		tools,
		capabilityPlan,
		evalSuite,
		gates: deriveReleaseGates(knowledgeUnits, capabilityPlan, evalSuite.status, tools),
		updatedAt,
	});
}

export function rebuildWorkspaceSnapshot(input: {
	previous: XiaofeiWorkspaceSnapshot;
	instructions: string;
	maxFollowUps: number;
	knowledgeMarkdown: string;
	now?: () => string;
}): XiaofeiWorkspaceSnapshot {
	const knowledgeUnits = parseKnowledgeMarkdown(input.knowledgeMarkdown);
	const now = input.now ?? (() => new Date().toISOString());
	const updatedAt = now();
	const capabilityPlan = deriveCapabilityPlan(knowledgeUnits, updatedAt);

	return XiaofeiWorkspaceSnapshotSchema.parse({
		...input.previous,
		agent: {
			...input.previous.agent,
			instructions: input.instructions,
			maxFollowUps: input.maxFollowUps,
			status: knowledgeUnits.some((unit) => unit.status === "released")
				? "review_ready"
				: "blocked",
		},
		knowledgeMarkdown: input.knowledgeMarkdown,
		knowledgeUnits,
		evalSuite: {
			status: "warning",
			passed: 0,
			failed: 0,
			cases: [],
			updatedAt,
		},
		capabilityPlan,
		gates: deriveReleaseGates(knowledgeUnits, capabilityPlan, "warning", input.previous.tools),
		updatedAt,
	});
}

export function deriveCapabilityPlan(
	knowledgeUnits: KnowledgeUnit[],
	generatedAt: string = new Date().toISOString(),
): CapabilityPlan {
	const releasedUnits = knowledgeUnits.filter((unit) => unit.status === "released");

	return {
		status: releasedUnits.length > 0 ? "review_ready" : "blocked",
		version: `cap-${generatedAt.replace(/\D/gu, "").slice(0, 14) || "v1"}`,
		reviewed: false,
		generatedAt,
		knowledgeUnitIds: releasedUnits.map((unit) => unit.id),
		takeoverScenarios: unique(
			releasedUnits.flatMap((unit) =>
				unit.applicableScenarios.length > 0 ? unit.applicableScenarios : [unit.title],
			),
		),
		rejectScenarios: unique([
			...releasedUnits.flatMap((unit) => unit.inapplicableScenarios),
			"知识缺失",
			"高风险业务动作",
		]),
		fieldMatrix: releasedUnits.map((unit) => ({
			knowledgeId: unit.id,
			scenario: unit.title,
			fields: unit.requiredSlots.map((slot) => slot.label),
			exitWhen:
				unit.requiredSlots.length > 0
					? "必问字段齐全后转人工核实"
					: "低风险回复完成或触发转人工条件",
		})),
		actionBoundaries: ["允许回复", "允许收集资料", "允许生成转人工摘要", "禁止写业务系统"],
		handoffBoundaries: unique(releasedUnits.flatMap((unit) => unit.handoffRules)),
		evalSuggestions: [
			...releasedUnits.map((unit) => `${unit.title}：验证 KU 命中、next_action 与禁止输出`),
			"知识缺失：不得硬答并转交人工",
		],
	};
}

export function setCapabilityPlanReview(
	snapshot: XiaofeiWorkspaceSnapshot,
	reviewed: boolean,
	now: () => string = () => new Date().toISOString(),
): XiaofeiWorkspaceSnapshot {
	const updatedAt = now();
	const capabilityPlan = {
		...snapshot.capabilityPlan,
		reviewed,
	};
	const evalSuite = {
		status: "warning" as const,
		passed: 0,
		failed: 0,
		cases: [],
		updatedAt,
	};

	return XiaofeiWorkspaceSnapshotSchema.parse({
		...snapshot,
		capabilityPlan,
		evalSuite,
		gates: deriveReleaseGates(
			snapshot.knowledgeUnits,
			capabilityPlan,
			evalSuite.status,
			snapshot.tools,
		),
		updatedAt,
	});
}

export function deriveReleaseGates(
	knowledgeUnits: XiaofeiWorkspaceSnapshot["knowledgeUnits"],
	capabilityPlan: XiaofeiWorkspaceSnapshot["capabilityPlan"],
	evalStatus: XiaofeiWorkspaceSnapshot["evalSuite"]["status"],
	tools: XiaofeiWorkspaceSnapshot["tools"],
): ReleaseGate[] {
	const releasedCount = knowledgeUnits.filter((unit) => unit.status === "released").length;
	const knowledgeReady =
		releasedCount > 0 && knowledgeUnits.every((unit) => unit.quality.status !== "blocked");
	const guardrailReady = knowledgeUnits.every(
		(unit) => unit.forbiddenOutputs.length > 0 && unit.handoffRules.length > 0,
	);
	const toolBoundaryReady =
		tools.some((tool) => tool.id === "send_customer_message" && tool.status === "available") &&
		tools.filter((tool) => tool.riskLevel === "high").every((tool) => tool.status !== "available");

	return [
		{
			id: "knowledge",
			label: "KU 结构与发布门禁",
			status: knowledgeReady ? "passed" : "blocked",
			detail: `${releasedCount}/${knowledgeUnits.length} 个 KnowledgeUnit 可调用`,
		},
		{
			id: "guardrail",
			label: "Guardrail 边界",
			status: guardrailReady ? "passed" : "blocked",
			detail: guardrailReady ? "禁止输出与转人工条件完整" : "存在缺失的安全边界",
		},
		{
			id: "capability",
			label: "KU → 能力方案审核",
			status:
				capabilityPlan.status === "review_ready" && capabilityPlan.reviewed ? "passed" : "blocked",
			detail: capabilityPlan.reviewed
				? `${capabilityPlan.knowledgeUnitIds.length} 个 KU 已纳入能力边界`
				: "保存 KU 后需要审核能力方案",
		},
		{
			id: "eval",
			label: "P0 Eval 门禁",
			status: evalStatus,
			detail:
				evalStatus === "passed" ? "固定业务断言全部通过" : "配置变更后需要重新运行固定业务断言",
		},
		{
			id: "tools",
			label: "Tool / Action 边界",
			status: toolBoundaryReady ? "passed" : "blocked",
			detail: toolBoundaryReady ? "发送 Adapter 可用，高风险写动作已阻塞" : "工具权限边界不完整",
		},
		{
			id: "runtime",
			label: "统一 Agent Runtime",
			status: "passed",
			detail: "LangGraph 编排状态，Mastra Agent 按需生成",
		},
	];
}

function unique(values: string[]): string[] {
	return [...new Set(values.filter(Boolean))];
}
