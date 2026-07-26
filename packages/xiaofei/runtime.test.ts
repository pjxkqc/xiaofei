import { describe, expect, it, vi } from "vitest";

import {
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
			message: "我收到的杯子碎了",
			state,
			snapshot,
			knowledgeWorkspaceBinding,
			now,
		});
		const generate = vi.fn();
		const result = await finalizeTurn({
			prepared,
			snapshot,
			message: "我收到的杯子碎了",
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
		expect(suite.passed).toBe(4);
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
			...snapshot.knowledgeUnits[1]!,
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
