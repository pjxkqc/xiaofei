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

function setup() {
	const snapshot = createDefaultWorkspaceSnapshot("tenant-1", now);
	snapshot.capabilityPlan.reviewed = true;
	const state = createConversationState({
		id: "conversation-1",
		tenantId: "tenant-1",
		agentId: snapshot.agent.id,
		maxFollowUps: snapshot.agent.maxFollowUps,
		now,
	});
	return { snapshot, state };
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
			handoffReason: "capability_not_reviewed",
		});
		expect(result.reply).toContain("能力方案尚未完成审核");
	});

	it("collects only the next missing slot and keeps AI ownership", async () => {
		const { snapshot, state } = setup();
		const prepared = prepareTurn({
			message: "我收到的杯子碎了",
			state,
			snapshot,
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
		const { snapshot, state } = setup();
		const first = prepareTurn({
			message: "商品碎了，订单号是 ABC12345",
			state,
			snapshot,
			now,
		});
		const second = prepareTurn({
			message: "照片已经作为附件发给你",
			state: first.state,
			snapshot,
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

	it("replaces unsafe model output before handing the conversation to a human", async () => {
		const { snapshot, state } = setup();
		const prepared = prepareTurn({
			message: "你们能处理哪些售后问题？",
			state,
			snapshot,
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
		const { snapshot } = setup();
		const suite = await runP0EvalSuite(snapshot, now);

		expect(suite.status).toBe("passed");
		expect(suite.failed).toBe(0);
		expect(suite.passed).toBe(4);
		expect(suite.cases.every((testCase) => testCase.knowledgeMatched)).toBe(true);
	});
});
