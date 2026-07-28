import {
	DEFAULT_FALLBACK_POLICY,
	XiaofeiWorkspaceSnapshotSchema,
	type CapabilityPlan,
	type KnowledgeUnit,
	type ReleaseGate,
	type XiaofeiWorkspaceSnapshot,
} from "./contracts";
import {
	invalidateKnowledgeUnitsForLineage,
	isKnowledgeUnitEligible,
	parseKnowledgeMarkdown,
} from "./knowledge";

export const DEFAULT_KNOWLEDGE_MARKDOWN = `# 小飞 P0 客服知识

## 商品、价格与库存咨询
适用场景: 客户在购买前询问商品特点、适用范围、价格、优惠或库存
不适用场景: 查询具体订单进度、要求锁定库存或承诺优惠
场景关键词: 商品介绍，产品介绍，多少钱，价格，优惠，折扣，库存，有货，缺货，适合，推荐，price，stock
禁止输出: 保证最低价，一定有货，已锁定库存，永久有效，guaranteed stock
转人工条件: 大额采购，企业报价，特殊折扣，价格争议
标准口径: 可以根据已审核资料介绍商品和适用场景；实时价格、优惠和库存以客户当前看到的商品页或正式报价为准，不虚构金额、库存或活动期限。信息不足时先询问商品名称、型号和使用需求。
兜底话术: 我可以继续帮你确认商品信息；如果涉及实时库存、企业报价或特殊优惠，我会把商品和需求一并交给同事确认。

## 订单与物流进度
适用场景: 客户查询订单状态、发货、物流、配送、签收或快递异常
不适用场景: 仅咨询通用退换规则、尚未下单的商品咨询
场景关键词: 订单状态，查订单，发货，没发货，物流，快递，配送，签收，没收到，到哪了，tracking，delivery，shipment
必问字段:
- order_id | 订单号 | 请提供订单号，我会先记录并帮助定位这笔订单。
禁止输出: 已发货，今天必到，保证送达，已催单，物流一定正常，guaranteed delivery
转人工条件: 物流长期无更新，显示签收但未收到，包裹丢失，地址争议
标准口径: 可以说明查询订单与物流需要订单号；不能在没有业务系统结果时编造状态、承诺到达时间或声称已经催单。收集订单号后交由有订单查询权限的同事继续核实。
兜底话术: 订单号已经记录，我会把你关心的物流或订单问题一起交给同事核实，你不需要再次描述。

## 收货破损、错发或缺件
适用场景: 客户收到商品后发现破损、碎裂、错发、少件、缺少配件或无法正常使用
不适用场景: 客户尚未收到商品、仅咨询价格或库存
场景关键词: 破损，裂开，碎了，坏了，错发，发错，少件，缺件，漏发，缺配件，damaged，broken，missing item，wrong item
必问字段:
- order_id | 订单号 | 请提供订单号，我会把它和问题一起记录。
- damage_photo | 问题照片 | 请提供能看清破损、错发或缺件情况的照片。
禁止输出: 已退款，一定退款，已补发，一定补发，责任在我们，guaranteed refund
转人工条件: 投诉，赔偿，立即退款，无法提供资料，资料冲突
标准口径: 先表达理解并收集订单号和问题照片，不承诺退款、赔偿、补发、责任归属或处理时效；资料齐全后将完整上下文交给人工核实。
兜底话术: 我已经记录订单和问题资料，会连同你的描述一起交给同事核实，你不需要重新说明。

## 退换货与退款规则咨询
适用场景: 客户询问退货、换货、退款条件、申请入口、所需资料或一般流程
不适用场景: 要求立即执行退款、指定退款金额、赔偿或绕过审核
场景关键词: 退货规则，怎么退货，如何退货，换货规则，怎么换货，退款规则，退款条件，退款流程，申请退款，退款多久到账，return policy，refund policy，exchange
禁止输出: 已退款，已赔偿，已补发，保证处理，guarantee
转人工条件: 立即退款，指定赔偿，特殊补偿，退款金额争议，投诉，法律威胁
标准口径: 可以解释通用准备步骤：保留订单信息、商品及包装现状和必要图片，并以当前订单页面及已审核规则判断资格；不得承诺一定可退、金额、到账时间或声称已经提交。客户只是询问规则时应先直接说明边界，不因出现“退款”二字立即转人工。
兜底话术: 我可以继续解释通用退换准备；如果你要处理具体订单，我会把订单状态和诉求一并交给同事确认资格与结果。

## 地址与订单信息修改
适用场景: 客户希望修改收货地址、联系人、电话、规格、数量或取消订单
不适用场景: 只查询物流、退换规则或商品信息
场景关键词: 修改地址，改地址，收货地址，修改电话，改手机号，修改联系人，改规格，改数量，取消订单，change address，cancel order
必问字段:
- order_id | 订单号 | 请提供订单号，我会先记录需要修改的订单。
禁止输出: 已修改，修改成功，已取消，一定可以修改，保证拦截
转人工条件: 已发货后改址，拦截配送，取消争议，资料冲突
标准口径: 可以说明是否可修改取决于订单当前状态；小飞只收集订单号和期望变更，不声称已经修改、取消或拦截。资料齐全后交给有权限的同事确认。
兜底话术: 我已记录订单号和修改诉求，会把完整信息交给同事确认是否还能处理。

## 发票与支付问题
适用场景: 客户询问付款方式、支付失败、重复扣款、发票类型、开票资料或发票进度
不适用场景: 要求在聊天中提供完整银行卡、验证码或敏感身份资料
场景关键词: 支付失败，付不了款，重复扣款，扣了两次，付款方式，发票，开票，电子发票，企业发票，invoice，payment，charged twice
禁止输出: 已退款，已冲正，已开票，保证到账，提供验证码，完整银行卡
转人工条件: 重复扣款，金额争议，企业特殊开票，疑似盗刷，支付安全风险
标准口径: 可以说明常见排查和开票所需的非敏感信息；不得索要支付验证码、完整银行卡或密码，不得声称已经冲正、退款或开票。涉及具体交易结果时转有权限的同事核实。
兜底话术: 为保护账户安全，请不要发送验证码、密码或完整银行卡信息；我会把支付或发票问题安全地交给同事继续核实。

## 使用与故障初步排查
适用场景: 客户询问安装、使用方法、无法启动、异常提示、故障码或一般故障排查
不适用场景: 冒烟、起火、触电、漏液、强烈异味、异常高温等安全风险
场景关键词: 怎么用，如何使用，安装，设置，启动不了，不能开机，没反应，故障，报错，错误码，故障码，说明书，troubleshooting，error code，not working
禁止输出: 可以继续强制使用，拆机维修，一定没有安全问题，已远程修复
转人工条件: 冒烟，起火，触电，漏液，强烈异味，异常高温，反复故障
标准口径: 只提供已审核的低风险检查，例如确认电源、连接、安装步骤和说明书提示；不得指导拆机、绕过保护或在安全风险下继续使用。出现冒烟、起火、触电、漏液、强烈异味或异常高温时，先建议停止使用并转人工。
兜底话术: 请先停止可能有风险的操作并保留故障现象；我会把产品型号、故障表现和已尝试步骤一起交给同事确认。

## 账号、订阅与隐私
适用场景: 客户询问登录、账号信息、订阅、续费、取消订阅、消息通知或隐私数据
不适用场景: 在聊天中提交密码、验证码、密钥或完整支付信息
场景关键词: 登录不了，账号，注册，订阅，续费，取消订阅，自动续费，通知，隐私，删除账号，验证码，account，subscription，privacy
禁止输出: 提供密码，提供验证码，已取消订阅，已删除账号，保证找回
转人工条件: 账号被盗，异常登录，删除账号，扣费争议，身份核验失败
标准口径: 可以说明通用入口和安全注意事项；不得索要密码、验证码或密钥，也不能声称已修改账号或订阅状态。涉及身份、扣费或数据删除时交给有权限的同事核验。
兜底话术: 请不要发送密码、验证码或密钥；我会把账号或订阅问题连同非敏感信息交给同事继续处理。

## 服务范围、寒暄与问题引导
适用场景: 客户问候、致谢，或询问小飞能做什么、支持哪些售前售后问题
不适用场景: 明确要求执行退款、赔偿、补发、改订单等业务动作
场景关键词: 你好，在吗，谢谢，再见，能做什么，能处理，服务范围，支持什么，怎么提问，hello，hi，thanks，help，support
禁止输出: 已退款，已赔偿，已补发，保证处理，什么都能做
转人工条件: 明确要求真人，投诉，法律威胁，紧急安全风险
标准口径: 友好回应并说明小飞可以做商品与规则问答、订单售后首响、资料收集、低风险排查和人工转接；不能声称已经执行任何业务动作。主动引导客户提供商品或服务名称、订单状态和最想解决的问题。
兜底话术: 你可以直接告诉我商品或服务名称、订单状态和遇到的问题；我会先查找已审核资料，确实需要人工权限时再完整转交。`;

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
		capabilityPlanVersion: null,
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
			"你是小飞客服 Agent。优先依据已审核知识直接回答低风险售前售后问题，并延续客户紧接着补充的房间、联网、预算、型号等上一轮语境；无法准确匹配时礼貌澄清、标记待人工关注，但继续接待和尝试后续消息，不猜测、不编造。只有明确高风险、客户要求真人、资料冲突或需要人工权限时才转人工。不得承诺退款、赔偿、补发、责任或时效。",
		serviceScopes: ["售前问答", "售后首响", "资料收集", "常见问题", "故障引导", "人工转接"],
		supportedLanguages: ["zh-CN", "en-US"],
		fallbackLanguage: "en-US",
		maxFollowUps: 5,
		fallbackPolicy: { ...DEFAULT_FALLBACK_POLICY },
		forbiddenOutputs: ["已退款", "一定退款", "已赔偿", "已补发", "guaranteed refund"],
		handoffRules: [
			"人工客服",
			"真人客服",
			"投诉",
			"起诉",
			"律师",
			"chargeback",
			"冒烟",
			"起火",
			"触电",
			"立即退款",
		],
	};
	const capabilityPlan = deriveCapabilityPlan(knowledgeUnits, updatedAt);

	return XiaofeiWorkspaceSnapshotSchema.parse({
		knowledgeWorkspaceId: `${tenantId}:knowledge`,
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
	fallbackPolicy?: XiaofeiWorkspaceSnapshot["agent"]["fallbackPolicy"];
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
			fallbackPolicy: input.fallbackPolicy ?? input.previous.agent.fallbackPolicy,
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
			capabilityPlanVersion: null,
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
	const releasedUnits = knowledgeUnits.filter(isKnowledgeUnitEligible);

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
			"知识缺失：不得硬答；标记待关注但保留 AI 接待",
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
		capabilityPlanVersion: null,
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

/**
 * Source/entry changes revoke the complete admission evidence deterministically.
 * A caller persists this returned snapshot atomically with its source mutation.
 */
export function invalidateWorkspaceKnowledgeForLineage(
	snapshot: XiaofeiWorkspaceSnapshot,
	input: { entryId?: string; sourceId?: string; reason: string; now?: () => string },
): XiaofeiWorkspaceSnapshot {
	const now = input.now ?? (() => new Date().toISOString());
	const updatedAt = now();
	const knowledgeUnits = invalidateKnowledgeUnitsForLineage(snapshot.knowledgeUnits, {
		workspaceId: snapshot.knowledgeWorkspaceId,
		entryId: input.entryId,
		sourceId: input.sourceId,
		reason: input.reason,
	});
	const capabilityPlan = deriveCapabilityPlan(knowledgeUnits, updatedAt);
	const evalSuite = {
		status: "warning" as const,
		passed: 0,
		failed: 0,
		cases: [],
		updatedAt,
		capabilityPlanVersion: null,
	};

	return XiaofeiWorkspaceSnapshotSchema.parse({
		...snapshot,
		knowledgeUnits,
		capabilityPlan,
		evalSuite,
		gates: deriveReleaseGates(knowledgeUnits, capabilityPlan, evalSuite.status, snapshot.tools),
		updatedAt,
	});
}

export function deriveReleaseGates(
	knowledgeUnits: XiaofeiWorkspaceSnapshot["knowledgeUnits"],
	capabilityPlan: XiaofeiWorkspaceSnapshot["capabilityPlan"],
	evalStatus: XiaofeiWorkspaceSnapshot["evalSuite"]["status"],
	tools: XiaofeiWorkspaceSnapshot["tools"],
): ReleaseGate[] {
	const releasedCount = knowledgeUnits.filter(isKnowledgeUnitEligible).length;
	const knowledgeReady =
		releasedCount > 0 &&
		knowledgeUnits.every(
			(unit) => unit.quality.status !== "blocked" && unit.eligibility !== "stale",
		);
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
