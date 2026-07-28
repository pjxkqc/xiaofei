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
			remainingFollowUps: 1,
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
				maxClarifications: 2,
			},
		);
		expect(ConversationStateSchema.parse(legacyState).consecutiveKnowledgeMisses).toBe(0);
	});

	it("clarifies consecutive knowledge misses before a soft handoff", async () => {
		const { snapshot, state, knowledgeWorkspaceBinding } = await setup();
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
		const thirdPrepared = prepareTurn({
			message: "没有其他信息了",
			state: second.state,
			snapshot,
			knowledgeWorkspaceBinding,
			now,
		});
		const third = await finalizeTurn({
			prepared: thirdPrepared,
			snapshot,
			message: "没有其他信息了",
			replyGenerator: { generate: vi.fn() },
			now,
		});

		expect(first.state).toMatchObject({
			ownerType: "ai",
			nextAction: "clarify",
			consecutiveKnowledgeMisses: 1,
		});
		expect(second.state).toMatchObject({
			ownerType: "ai",
			nextAction: "clarify",
			consecutiveKnowledgeMisses: 2,
		});
		expect(third.state).toMatchObject({
			ownerType: "human",
			handoffReason: "knowledge_missing",
			consecutiveKnowledgeMisses: 3,
		});
		expect(third.reply).toContain("不需要重新描述");
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
