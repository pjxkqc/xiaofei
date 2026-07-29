import { describe, expect, it, vi } from "vitest";

import {
	ConversationStateSchema,
	XiaofeiWorkspaceSnapshotSchema,
	createConversationState,
	createDefaultWorkspaceSnapshot,
	finalizeTurn,
	prepareTurn,
	runP0EvalSuite,
	type ReplyGenerator,
} from "./index";

const NOW = "2026-07-24T00:00:00.000Z";
const now = () => NOW;

async function setup() {
	const snapshot = createDefaultWorkspaceSnapshot("tenant-1", now);
	snapshot.capabilityPlan.reviewed = true;
	snapshot.evalSuite = await runP0EvalSuite(snapshot, now);
	const state = createConversationState({
		id: "conversation-1",
		tenantId: "tenant-1",
		agentId: snapshot.agent.id,
		maxFollowUps: snapshot.agent.maxFollowUps,
		now,
	});
	return { snapshot, state, knowledgeWorkspaceBinding: binding(snapshot, state.id) };
}

describe("P0 runtime kernel", () => {
	it("blocks automatic handling until the KU capability plan is reviewed", async () => {
		const snapshot = createDefaultWorkspaceSnapshot("tenant-1", now);
		const state = createConversationState({
			id: "conversation-unreviewed",
			tenantId: "tenant-1",
			agentId: snapshot.agent.id,
			maxFollowUps: snapshot.agent.maxFollowUps,
			now,
		});
		const prepared = prepareTurn({
			message: "你们能处理哪些售后问题？",
			state,
			snapshot,
			knowledgeWorkspaceBinding: binding(snapshot, state.id),
			now,
		});
		const result = await finalizeTurn({
			prepared,
			snapshot,
			message: "你们能处理哪些售后问题？",
			replyGenerator: { generate: vi.fn() },
			now,
		});

		expect(result.state).toMatchObject({
			ownerType: "human",
			handoffReason: "capability_evidence_stale",
		});
		expect(result.reply).toContain("知识能力尚未满足安全准入条件");
	});

	it("collects only the next missing slot and keeps AI ownership", async () => {
		const { snapshot, state, knowledgeWorkspaceBinding } = await setup();
		const prepared = prepareTurn({
			message: "我收到的杯子裂开了",
			state,
			snapshot,
			knowledgeWorkspaceBinding,
			now,
		});
		const generate = vi.fn();
		const result = await finalizeTurn({
			prepared,
			snapshot,
			message: "我收到的杯子裂开了",
			replyGenerator: { generate } as ReplyGenerator,
			now,
		});

		expect(generate).not.toHaveBeenCalled();
		expect(result.reply).toContain("订单号");
		expect(result.state).toMatchObject({
			ownerType: "ai",
			nextAction: "ask_followup",
			missingSlots: ["order_id", "damage_photo"],
			remainingFollowUps: 4,
		});
	});

	it("keeps low-risk refund policy questions with AI instead of treating the noun as an action", async () => {
		const { snapshot, state, knowledgeWorkspaceBinding } = await setup();
		const prepared = prepareTurn({
			message: "我想先了解一下退款条件是什么？",
			state,
			snapshot,
			knowledgeWorkspaceBinding,
			now,
		});
		const result = await finalizeTurn({
			prepared,
			snapshot,
			message: "我想先了解一下退款条件是什么？",
			replyGenerator: { generate: async () => "可以先保留订单信息，并以当前订单规则确认资格。" },
			now,
		});

		expect(result.state).toMatchObject({
			ownerType: "ai",
			nextAction: "reply",
			matchedKnowledgeId: "退换货与退款规则咨询",
		});
	});

	it("does not confuse stated intent to learn with a request to execute a refund", async () => {
		const { snapshot, state, knowledgeWorkspaceBinding } = await setup();
		const prepared = prepareTurn({
			message: "我要了解退款规则和申请流程",
			state,
			snapshot,
			knowledgeWorkspaceBinding,
			now,
		});

		expect(prepared).toMatchObject({
			action: "reply",
			riskLevel: "low",
			knowledge: { id: "退换货与退款规则咨询" },
		});
	});

	it("matches a bounded related phrasing without requiring an exact keyword substring", async () => {
		const { snapshot, state, knowledgeWorkspaceBinding } = await setup();
		const deliveryUnit = {
			...snapshot.knowledgeUnits[1]!,
			title: "履约追踪",
			scenarioKeywords: ["如何查询配送进度"],
			applicableScenarios: [],
		};
		snapshot.knowledgeUnits = [deliveryUnit];
		snapshot.capabilityPlan.knowledgeUnitIds = [deliveryUnit.id];
		const prepared = prepareTurn({
			message: "怎么查询配送进度呢？",
			state,
			snapshot,
			knowledgeWorkspaceBinding,
			now,
		});

		expect(prepared).toMatchObject({
			knowledge: { id: deliveryUnit.id },
			action: "ask_followup",
		});
		expect(prepared.traces).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					title: "命中 KnowledgeUnit",
					detail: expect.stringContaining("related"),
				}),
			]),
		);
	});

	it("preserves explicit product terms inside generated composite knowledge fields", async () => {
		const { snapshot, state, knowledgeWorkspaceBinding } = await setup();
		const productUnit = {
			...snapshot.knowledgeUnits[0]!,
			title: "澄风 C-Air 常见问答",
			scenarioKeywords: ["Wi-Fi联网模块", "空气净化器选型"],
			applicableScenarios: ["用户询问 C-Air Pro 是否适合会议室"],
			requiredSlots: [],
		};
		snapshot.knowledgeUnits = [productUnit];
		snapshot.capabilityPlan.knowledgeUnitIds = [productUnit.id];
		for (const message of ["C-Air Pro 适合 40 平方米会议室吗？", "Wi-Fi 能否连接会议室网络？"]) {
			const prepared = prepareTurn({
				message,
				state,
				snapshot,
				knowledgeWorkspaceBinding,
				now,
			});

			expect(prepared).toMatchObject({
				knowledge: { id: productUnit.id },
				action: "reply",
			});
			expect(prepared.traces).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						title: "命中 KnowledgeUnit",
						detail: expect.stringContaining("exact"),
					}),
				]),
			);
		}
	});

	it("prefers a product-specific KU over the generic presales KU", async () => {
		const { snapshot, state, knowledgeWorkspaceBinding } = await setup();
		const genericProductUnit = snapshot.knowledgeUnits[0]!;
		const specificProductUnit = {
			...genericProductUnit,
			id: "c-air-mini-parameters",
			title: "澄风 C-Air 常见问答",
			scenarioKeywords: ["C-Air Mini", "Wi-Fi联网模块", "空气净化器选型"],
			applicableScenarios: ["客户询问 C-Air Mini 的面积、噪音或联网参数"],
			requiredSlots: [],
			standardReplyPolicy: "C-Air Mini 适合 8–20㎡，最低噪音 25dB(A)，不支持 Wi-Fi。",
		};
		snapshot.knowledgeUnits = [genericProductUnit, specificProductUnit];
		snapshot.capabilityPlan.knowledgeUnitIds = [genericProductUnit.id, specificProductUnit.id];

		const prepared = prepareTurn({
			message: "我看中 C-Air Mini，20平方米卧室够用吗？最低噪音和 Wi-Fi 怎么样？",
			state,
			snapshot,
			knowledgeWorkspaceBinding,
			now,
		});

		expect(prepared).toMatchObject({
			knowledge: { id: specificProductUnit.id },
			action: "reply",
		});
	});

	it("does not let broad generated keywords swallow unknown or high-risk requests", async () => {
		const { snapshot, state, knowledgeWorkspaceBinding } = await setup();
		const generatedAftersalesUnit = {
			...snapshot.knowledgeUnits[0]!,
			id: "c-air-generated-aftersales",
			title: "澄风 C-Air 滤芯、供电、保修与故障处理",
			scenarioKeywords: ["滤芯型号", "保修", "E07", "人工客服"],
			applicableScenarios: [
				"用户询问 C-Air Mini、C-Air S、C-Air Pro 分别使用什么滤芯",
				"用户询问整机和电机的保修期限与范围",
			],
			requiredSlots: [],
		};
		snapshot.knowledgeUnits = [...snapshot.knowledgeUnits, generatedAftersalesUnit];
		snapshot.capabilityPlan.knowledgeUnitIds = [
			...snapshot.capabilityPlan.knowledgeUnitIds,
			generatedAftersalesUnit.id,
		];

		const unknownPolicy = prepareTurn({
			message: "请告诉我火星门店的保修政策",
			state,
			snapshot,
			knowledgeWorkspaceBinding,
			now,
		});
		const anchoredWarranty = prepareTurn({
			message: "C-Air Mini 的保修期限是多久？",
			state,
			snapshot,
			knowledgeWorkspaceBinding,
			now,
		});
		const humanRequest = prepareTurn({
			message: "我要投诉并要求人工客服处理",
			state,
			snapshot,
			knowledgeWorkspaceBinding,
			now,
		});

		expect(unknownPolicy).toMatchObject({ knowledge: null, action: "clarify" });
		expect(anchoredWarranty).toMatchObject({
			knowledge: { id: generatedAftersalesUnit.id },
			action: "reply",
		});
		expect(humanRequest).toMatchObject({
			knowledge: null,
			action: "handoff",
			riskLevel: "high",
		});
	});

	it("prefers the KU supported by both product and scenario evidence", async () => {
		const { snapshot, state, knowledgeWorkspaceBinding } = await setup();
		const presalesUnit = {
			...snapshot.knowledgeUnits[0]!,
			id: "c-air-generated-presales",
			title: "C-Air 适用面积、联网能力与选型建议 FAQ",
			scenarioKeywords: ["适用面积", "房间大小", "联网模块", "Wi-Fi"],
			applicableScenarios: [
				"用户询问 Mini 适合多大的房间",
				"用户询问 C-Air Mini 的 CADR、噪音或联网能力",
				"用户提供会议室面积、预算和 Wi-Fi 需求，希望获得型号推荐",
			],
			requiredSlots: [],
		};
		const aftersalesUnit = {
			...snapshot.knowledgeUnits[1]!,
			id: "c-air-generated-aftersales",
			title: "C-Air 滤芯、供电、保修与 E07 故障 FAQ",
			scenarioKeywords: ["滤芯型号", "保修期限", "E07故障"],
			applicableScenarios: [
				"用户询问 C-Air Mini / S / Pro 对应滤芯型号与建议更换周期",
				"用户询问整机、电机保修时长与保修范围",
			],
			requiredSlots: [],
		};
		snapshot.knowledgeUnits = [presalesUnit, aftersalesUnit];
		snapshot.capabilityPlan.knowledgeUnitIds = [presalesUnit.id, aftersalesUnit.id];

		const warranty = prepareTurn({
			message: "C-Air Mini 的保修期限是多久？",
			state,
			snapshot,
			knowledgeWorkspaceBinding,
			now,
		});
		const roomSize = prepareTurn({
			message: "C-Air Mini 适合多大的房间？",
			state,
			snapshot,
			knowledgeWorkspaceBinding,
			now,
		});

		expect(warranty).toMatchObject({ knowledge: { id: aftersalesUnit.id }, action: "reply" });
		expect(roomSize).toMatchObject({ knowledge: { id: presalesUnit.id }, action: "reply" });
	});

	it("routes a complete greeting, product consultation, follow-up, and closing conversation", async () => {
		const { snapshot, state, knowledgeWorkspaceBinding } = await setup();
		const genericProductUnit = snapshot.knowledgeUnits[0]!;
		const serviceUnit = snapshot.knowledgeUnits.find((unit) => unit.title.includes("服务范围"))!;
		const specificProductUnit = {
			...genericProductUnit,
			id: "c-air-mini-complete-conversation",
			title: "澄风 C-Air 常见问答",
			scenarioKeywords: ["C-Air Mini", "Wi-Fi联网模块", "空气净化器选型"],
			applicableScenarios: ["客户询问 C-Air Mini 的面积、噪音或联网参数"],
			requiredSlots: [],
			standardReplyPolicy: "C-Air Mini 适合 8–20㎡，最低噪音 25dB(A)，不支持 Wi-Fi。",
		};
		snapshot.knowledgeUnits = [...snapshot.knowledgeUnits, specificProductUnit];
		snapshot.capabilityPlan.knowledgeUnitIds = [
			...snapshot.capabilityPlan.knowledgeUnitIds,
			specificProductUnit.id,
		];

		const greetingPrepared = prepareTurn({
			message: "你好，小飞",
			state,
			snapshot,
			knowledgeWorkspaceBinding,
			now,
		});
		const greeting = await finalizeTurn({
			prepared: greetingPrepared,
			snapshot,
			message: "你好，小飞",
			replyGenerator: { generate: async () => "你好，我是小飞。请告诉我你想了解的商品。" },
			now,
		});
		const productPrepared = prepareTurn({
			message: "我看中 C-Air Mini，20平方米卧室够用吗？最低噪音怎么样？",
			state: greeting.state,
			snapshot,
			knowledgeWorkspaceBinding,
			now,
		});
		const product = await finalizeTurn({
			prepared: productPrepared,
			snapshot,
			message: "我看中 C-Air Mini，20平方米卧室够用吗？最低噪音怎么样？",
			replyGenerator: {
				generate: async () => "20㎡在适用范围内，最低噪音是 25dB(A)。",
			},
			now,
		});
		const followUpPrepared = prepareTurn({
			message: "那我还需要联网",
			state: product.state,
			snapshot,
			knowledgeWorkspaceBinding,
			now,
		});
		const closingPrepared = prepareTurn({
			message: "好的，谢谢，再见",
			state: product.state,
			snapshot,
			knowledgeWorkspaceBinding,
			now,
		});

		expect(greetingPrepared).toMatchObject({ knowledge: { id: serviceUnit.id } });
		expect(productPrepared).toMatchObject({ knowledge: { id: specificProductUnit.id } });
		expect(followUpPrepared).toMatchObject({ knowledge: { id: specificProductUnit.id } });
		expect(closingPrepared).toMatchObject({ knowledge: { id: serviceUnit.id } });
	});

	it("hydrates fallback defaults when reading legacy snapshots and conversation state", async () => {
		const { snapshot, state } = await setup();
		const legacySnapshot = JSON.parse(JSON.stringify(snapshot)) as {
			agent: Record<string, unknown>;
		};
		const legacyState = JSON.parse(JSON.stringify(state)) as Record<string, unknown>;
		delete legacySnapshot.agent.fallbackPolicy;
		delete legacyState.consecutiveKnowledgeMisses;

		expect(XiaofeiWorkspaceSnapshotSchema.parse(legacySnapshot).agent.fallbackPolicy).toMatchObject(
			{
				maxClarifications: 5,
				attentionReply: expect.stringContaining("待关注"),
			},
		);
		expect(ConversationStateSchema.parse(legacyState).consecutiveKnowledgeMisses).toBe(0);
		expect(ConversationStateSchema.parse(legacyState).operatorAttention).toBeNull();
	});

	it("keeps the matched KU for a short contextual answer to the previous reply", async () => {
		const { snapshot, state, knowledgeWorkspaceBinding } = await setup();
		const productUnit = {
			...snapshot.knowledgeUnits[0]!,
			id: "c-air-mini",
			title: "C-Air Mini 选型",
			scenarioKeywords: ["C-Air Mini", "小房间空气净化器"],
			applicableScenarios: ["客户询问 C-Air Mini 的适用面积和联网能力"],
			requiredSlots: [],
			standardReplyPolicy:
				"C-Air Mini 适合 8–20㎡，最低噪音 25dB(A)，不支持 Wi-Fi；需要联网时说明该型号不符合需求。",
		};
		snapshot.knowledgeUnits = [productUnit];
		snapshot.capabilityPlan.knowledgeUnitIds = [productUnit.id];

		const firstPrepared = prepareTurn({
			message: "C-Air Mini 适合多大的房间？",
			state,
			snapshot,
			knowledgeWorkspaceBinding,
			now,
		});
		const first = await finalizeTurn({
			prepared: firstPrepared,
			snapshot,
			message: "C-Air Mini 适合多大的房间？",
			replyGenerator: {
				generate: async () => "C-Air Mini 适合 8–20㎡ 的房间，最低噪音 25dB(A)，不支持 Wi-Fi。",
			},
			now,
		});
		const secondPrepared = prepareTurn({
			message: "20平方，需要联网",
			state: first.state,
			snapshot,
			knowledgeWorkspaceBinding,
			now,
		});
		const second = await finalizeTurn({
			prepared: secondPrepared,
			snapshot,
			message: "20平方，需要联网",
			replyGenerator: {
				generate: async () => "面积符合，但 C-Air Mini 不支持 Wi-Fi，需要选择支持联网的型号。",
			},
			now,
		});
		const unrelatedPrepared = prepareTurn({
			message: "你们火星门店几点关门？",
			state: first.state,
			snapshot,
			knowledgeWorkspaceBinding,
			now,
		});
		const unrelated = await finalizeTurn({
			prepared: unrelatedPrepared,
			snapshot,
			message: "你们火星门店几点关门？",
			replyGenerator: { generate: vi.fn() },
			now,
		});
		const repeatedUnknownPrepared = prepareTurn({
			message: "没有更多信息，就是营业时间",
			state: unrelated.state,
			snapshot,
			knowledgeWorkspaceBinding,
			now,
		});

		expect(secondPrepared).toMatchObject({
			action: "reply",
			knowledge: { id: productUnit.id },
		});
		expect(unrelatedPrepared).toMatchObject({
			action: "clarify",
			knowledge: null,
		});
		expect(repeatedUnknownPrepared).toMatchObject({
			action: "clarify",
			knowledge: null,
		});
		expect(secondPrepared.traces).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					title: "命中 KnowledgeUnit",
					detail: expect.stringContaining("context"),
				}),
			]),
		);
		expect(second).toMatchObject({
			reply: expect.stringContaining("不支持 Wi-Fi"),
			state: {
				ownerType: "ai",
				matchedKnowledgeId: productUnit.id,
				consecutiveKnowledgeMisses: 0,
				operatorAttention: null,
			},
		});
	});

	it("marks knowledge misses for operator attention without relinquishing AI ownership", async () => {
		const { snapshot, state, knowledgeWorkspaceBinding } = await setup();
		snapshot.agent.fallbackPolicy.maxClarifications = 1;
		const firstPrepared = prepareTurn({
			message: "你们火星门店几点关门？",
			state,
			snapshot,
			knowledgeWorkspaceBinding,
			now,
		});
		const first = await finalizeTurn({
			prepared: firstPrepared,
			snapshot,
			message: "你们火星门店几点关门？",
			replyGenerator: { generate: vi.fn() },
			now,
		});
		const secondPrepared = prepareTurn({
			message: "就是火星线下门店的营业时间",
			state: first.state,
			snapshot,
			knowledgeWorkspaceBinding,
			now,
		});
		const second = await finalizeTurn({
			prepared: secondPrepared,
			snapshot,
			message: "就是火星线下门店的营业时间",
			replyGenerator: { generate: vi.fn() },
			now,
		});
		const recoveredPrepared = prepareTurn({
			message: "怎么查询配送进度呢？",
			state: second.state,
			snapshot,
			knowledgeWorkspaceBinding,
			now,
		});
		const recovered = await finalizeTurn({
			prepared: recoveredPrepared,
			snapshot,
			message: "怎么查询配送进度呢？",
			replyGenerator: { generate: vi.fn() },
			now,
		});

		expect(first.state).toMatchObject({
			ownerType: "ai",
			nextAction: "clarify",
			consecutiveKnowledgeMisses: 1,
			operatorAttention: {
				reason: "knowledge_missing",
				missCount: 1,
			},
		});
		expect(second.state).toMatchObject({
			ownerType: "ai",
			nextAction: "fallback",
			consecutiveKnowledgeMisses: 2,
			operatorAttention: {
				reason: "knowledge_missing",
				missCount: 2,
			},
		});
		expect(second.reply).toContain("待关注");
		expect(recovered.state).toMatchObject({
			ownerType: "ai",
			matchedKnowledgeId: "订单与物流进度",
			consecutiveKnowledgeMisses: 0,
			operatorAttention: null,
		});
		expect(recovered.state.nextAction).toBe("ask_followup");
	});

	it("still hands off an explicit refund action request immediately", async () => {
		const { snapshot, state, knowledgeWorkspaceBinding } = await setup();
		const prepared = prepareTurn({
			message: "请立即给我退款，我不要解释",
			state,
			snapshot,
			knowledgeWorkspaceBinding,
			now,
		});
		const result = await finalizeTurn({
			prepared,
			snapshot,
			message: "请立即给我退款，我不要解释",
			replyGenerator: { generate: vi.fn() },
			now,
		});

		expect(result.state).toMatchObject({
			ownerType: "human",
			handoffReason: "high_risk_action_request",
		});
		expect(result.reply).toContain("不需要重新描述");
	});

	it("hands off after all required information is collected", async () => {
		const { snapshot, state, knowledgeWorkspaceBinding } = await setup();
		const first = prepareTurn({
			message: "商品碎了，订单号是 ABC12345",
			state,
			snapshot,
			knowledgeWorkspaceBinding,
			now,
		});
		const second = prepareTurn({
			message: "照片已经作为附件发给你",
			state: first.state,
			snapshot,
			knowledgeWorkspaceBinding: binding(snapshot, first.state.id),
			now,
		});
		const result = await finalizeTurn({
			prepared: second,
			snapshot,
			message: "照片已经作为附件发给你",
			replyGenerator: { generate: vi.fn() },
			now,
		});

		expect(result.state).toMatchObject({
			ownerType: "human",
			ownerEpoch: 1,
			aiMode: "monitor",
			stage: "handoff",
			handoffReason: "required_information_collected",
		});
		expect(result.reply).not.toMatch(/已退款|已补发/u);
	});

	it("collects a generated fault-code slot from the customer's message", async () => {
		const { snapshot, state, knowledgeWorkspaceBinding } = await setup();
		snapshot.knowledgeUnits[1] = {
			...snapshot.knowledgeUnits[1]!,
			scenarioKeywords: ["E07"],
			fallbackReply: "请立即停机断电，不要拆机或再次强制启动；我会转交人工客服处理。",
			requiredSlots: [
				{
					key: "device_model",
					label: "设备型号",
					askText: "请确认设备型号。",
					required: true,
				},
				{
					key: "error_code",
					label: "故障码",
					askText: "请确认设备显示的故障码。",
					required: true,
				},
			],
		};
		const prepared = prepareTurn({
			message: "C-Air Pro 显示 E07，还能继续开机吗？",
			state,
			snapshot,
			knowledgeWorkspaceBinding,
			now,
		});
		const result = await finalizeTurn({
			prepared,
			snapshot,
			message: "C-Air Pro 显示 E07，还能继续开机吗？",
			replyGenerator: { generate: vi.fn() },
			now,
		});

		expect(result.state).toMatchObject({
			ownerType: "human",
			nextAction: "stop",
			handoffReason: "required_information_collected",
			missingSlots: [],
			slots: {
				device_model: {
					label: "设备型号",
					status: "provided",
					value: "C-Air Pro",
				},
				error_code: {
					label: "故障码",
					status: "provided",
					value: "E07",
				},
			},
		});
		expect(result.reply).toContain("立即停机断电");
	});

	it("replaces unsafe model output before handing the conversation to a human", async () => {
		const { snapshot, state, knowledgeWorkspaceBinding } = await setup();
		const prepared = prepareTurn({
			message: "你们能处理哪些售后问题？",
			state,
			snapshot,
			knowledgeWorkspaceBinding,
			now,
		});
		const result = await finalizeTurn({
			prepared,
			snapshot,
			message: "你们能处理哪些售后问题？",
			replyGenerator: {
				generate: async () => "可以，我已经退款并保证处理。",
			},
			now,
		});

		expect(result.reply).not.toContain("已经退款");
		expect(result.state.ownerType).toBe("human");
		expect(result.state.sendBlockedReasons[0]).toContain("禁止输出");
	});

	it("passes the deterministic release assertions without calling a model", async () => {
		const { snapshot } = await setup();
		const suite = await runP0EvalSuite(snapshot, now);

		expect(suite.status).toBe("passed");
		expect(suite.failed).toBe(0);
		expect(suite.passed).toBe(snapshot.capabilityPlan.knowledgeUnitIds.length + 2);
		expect(suite.cases.every((testCase) => testCase.knowledgeMatched)).toBe(true);
	});

	it("derives positive Eval evidence from a custom admitted KU and excludes stale KUs", async () => {
		const { snapshot } = await setup();
		const custom = {
			...snapshot.knowledgeUnits[1]!,
			id: "custom-policy",
			title: "自定义政策",
			scenarioKeywords: ["自定义保修"],
		};
		snapshot.knowledgeUnits = [custom, { ...snapshot.knowledgeUnits[0]!, eligibility: "stale" }];
		snapshot.capabilityPlan.knowledgeUnitIds = [custom.id];
		const suite = await runP0EvalSuite(snapshot, now);

		expect(suite.cases).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ expectedKnowledgeId: "custom-policy", passed: true }),
			]),
		);
		expect(suite.cases).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({ expectedKnowledgeId: "商品破损资料收集" }),
			]),
		);
	});

	it("chooses a discriminating Eval sample when generated KUs share a product term", async () => {
		const { snapshot } = await setup();
		const presales = {
			...snapshot.knowledgeUnits[0]!,
			id: "c-air-presales",
			title: "C-Air 选型与房间面积",
			scenarioKeywords: ["C-Air Mini", "房间面积"],
			applicableScenarios: ["客户询问 C-Air Mini 适合多大的房间"],
			requiredSlots: [],
		};
		const aftersales = {
			...snapshot.knowledgeUnits[1]!,
			id: "c-air-aftersales",
			title: "C-Air 滤芯与保修",
			scenarioKeywords: ["滤芯型号", "保修期限"],
			applicableScenarios: ["客户询问 C-Air Mini / S / Pro 分别使用哪种滤芯"],
			requiredSlots: [],
		};
		snapshot.knowledgeUnits = [presales, aftersales];
		snapshot.capabilityPlan.knowledgeUnitIds = [presales.id, aftersales.id];

		const suite = await runP0EvalSuite(snapshot, now);

		expect(suite.status).toBe("passed");
		expect(suite.cases).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ expectedKnowledgeId: presales.id, passed: true }),
				expect.objectContaining({ expectedKnowledgeId: aftersales.id, passed: true }),
			]),
		);
	});

	it("allows optional-only KU slots to reply and keeps Eval expectations aligned", async () => {
		const { snapshot, state, knowledgeWorkspaceBinding } = await setup();
		const optionalOnly = {
			...snapshot.knowledgeUnits[0]!,
			id: "optional-only-policy",
			title: "净芯年包政策",
			scenarioKeywords: ["净芯年包"],
			requiredSlots: [
				{
					key: "packageType",
					label: "年包档位",
					askText: "请确认你咨询的是 Mini、S 还是 Pro 年包。",
					required: false,
				},
			],
		};
		snapshot.knowledgeUnits = [optionalOnly];
		snapshot.capabilityPlan.knowledgeUnitIds = [optionalOnly.id];
		const prepared = prepareTurn({
			message: "净芯年包",
			state,
			snapshot,
			knowledgeWorkspaceBinding,
			now,
		});
		const generate = vi.fn(async () => "净芯年包分为 Mini、S 和 Pro 三档。");
		const result = await finalizeTurn({
			prepared,
			snapshot,
			message: "净芯年包",
			replyGenerator: { generate },
			now,
		});
		const suite = await runP0EvalSuite(snapshot, now);

		expect(generate).toHaveBeenCalledOnce();
		expect(result.state).toMatchObject({ ownerType: "ai", nextAction: "reply" });
		expect(suite.cases).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					expectedKnowledgeId: optionalOnly.id,
					expectedAction: "reply",
					passed: true,
				}),
			]),
		);
	});

	it("fails closed when the channel conversation binding does not resolve this tenant workspace", async () => {
		const { snapshot, state } = await setup();
		const prepared = prepareTurn({
			message: "你们能处理哪些售后问题？",
			state,
			snapshot,
			knowledgeWorkspaceBinding: {
				...binding(snapshot, state.id),
				knowledgeWorkspaceId: "another-workspace",
			},
			now,
		});

		expect(prepared).toMatchObject({
			action: "handoff",
			handoffReason: "knowledge_workspace_unresolved",
		});
	});

	it("does not select a previously admitted KU after a failed mutation leaves admission cleared", async () => {
		const { snapshot, state, knowledgeWorkspaceBinding } = await setup();
		const clearedSnapshot = {
			...snapshot,
			knowledgeUnits: [],
			capabilityPlan: { ...snapshot.capabilityPlan, reviewed: false, knowledgeUnitIds: [] },
			evalSuite: { ...snapshot.evalSuite, status: "warning" as const, capabilityPlanVersion: null },
		};

		const prepared = prepareTurn({
			message: "你们能处理哪些售后问题？",
			state,
			snapshot: clearedSnapshot,
			knowledgeWorkspaceBinding,
			now,
		});

		expect(prepared).toMatchObject({
			action: "handoff",
			knowledge: null,
			handoffReason: "capability_evidence_stale",
		});
	});
});

function binding(
	snapshot: ReturnType<typeof createDefaultWorkspaceSnapshot>,
	conversationId: string,
) {
	return {
		tenantId: snapshot.agent.tenantId,
		conversationId,
		channelId: "test",
		knowledgeWorkspaceId: snapshot.knowledgeWorkspaceId,
	};
}
