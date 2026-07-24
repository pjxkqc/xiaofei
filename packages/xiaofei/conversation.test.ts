import { describe, expect, it } from "vitest";

import {
	acquireAiRunLease,
	authorizeAiReply,
	ConversationOwnershipError,
	createConversationState,
	requestHumanHandoff,
	transferConversationOwner,
} from "./conversation";

const NOW = "2026-07-23T16:00:00.000Z";

function createState() {
	return createConversationState({
		id: "conversation-1",
		tenantId: "tenant-1",
		agentId: "agent-1",
		maxFollowUps: 2,
		now: () => NOW,
	});
}

describe("conversation ownership", () => {
	it("creates an AI-owned admission state", () => {
		expect(createState()).toMatchObject({
			ownerType: "ai",
			ownerEpoch: 0,
			stage: "admission",
			remainingFollowUps: 2,
			nextAction: "clarify",
			updatedAt: NOW,
		});
	});

	it("allows a reply only for the current ownership epoch", () => {
		const state = createState();
		const lease = acquireAiRunLease(state);

		expect(authorizeAiReply(state, lease)).toEqual({ allowed: true });
		expect(authorizeAiReply({ ...state, ownerEpoch: state.ownerEpoch + 1 }, lease)).toEqual({
			allowed: false,
			reason: "owner_changed",
		});
	});

	it("increments ownerEpoch and invalidates an in-flight AI run after human takeover", () => {
		const state = createState();
		const lease = acquireAiRunLease(state);
		const humanOwnedState = transferConversationOwner(state, state.ownerEpoch, "human", () => NOW);

		expect(humanOwnedState).toMatchObject({
			ownerType: "human",
			ownerEpoch: 1,
			stage: "handoff",
			nextAction: "stop",
		});
		expect(authorizeAiReply(humanOwnedState, lease)).toEqual({
			allowed: false,
			reason: "owner_is_not_ai",
		});
	});

	it("creates a structured handoff package and stops AI replies", () => {
		const state = createState();
		const handoffState = requestHumanHandoff(state, acquireAiRunLease(state), {
			summary: "Customer requests a refund after reporting damaged goods.",
			reason: "refund_requires_human_approval",
			riskLevel: "high",
			missingSlots: ["photo_evidence"],
			suggestedNextStep: "Verify the order and review the evidence.",
			now: () => NOW,
		});

		expect(handoffState).toMatchObject({
			ownerType: "human",
			ownerEpoch: 1,
			stage: "handoff",
			riskLevel: "high",
			nextAction: "stop",
			handoffPackage: {
				reason: "refund_requires_human_approval",
				missingSlots: ["photo_evidence"],
			},
			sendBlockedReasons: ["refund_requires_human_approval"],
		});
	});

	it("rejects stale owner changes and closed-conversation reassignment", () => {
		const state = createState();

		expect(() => transferConversationOwner(state, 9, "human")).toThrow(ConversationOwnershipError);

		const closedState = transferConversationOwner(state, 0, "closed", () => NOW);
		expect(() => transferConversationOwner(closedState, 1, "ai")).toThrow(
			"A closed conversation cannot change ownership.",
		);
	});
});
