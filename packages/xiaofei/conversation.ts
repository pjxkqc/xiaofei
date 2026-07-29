import {
	AiRunLeaseSchema,
	ConversationStateSchema,
	HandoffPackageSchema,
	type AiRunLease,
	type ConversationState,
	type HandoffPackage,
	type OwnerType,
} from "./contracts";

export class ConversationOwnershipError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ConversationOwnershipError";
	}
}

export interface CreateConversationStateInput {
	id: string;
	tenantId: string;
	agentId: string;
	maxFollowUps: number;
	now?: () => string;
}

export interface HandoffRequest {
	summary: string;
	reason: string;
	riskLevel: "low" | "medium" | "high";
	collectedSlots?: HandoffPackage["collectedSlots"];
	missingSlots?: string[];
	suggestedNextStep: string;
	now?: () => string;
}

export interface AiReplyAuthorization {
	allowed: boolean;
	reason?: "conversation_mismatch" | "owner_changed" | "owner_is_not_ai" | "conversation_closed";
}

export function createConversationState(input: CreateConversationStateInput): ConversationState {
	const now = input.now ?? (() => new Date().toISOString());

	return ConversationStateSchema.parse({
		id: input.id,
		tenantId: input.tenantId,
		agentId: input.agentId,
		ownerType: "ai",
		ownerEpoch: 0,
		aiMode: "auto_handle",
		stage: "admission",
		scenario: null,
		matchedKnowledgeId: null,
		slots: {},
		missingSlots: [],
		riskLevel: "low",
		nextAction: "clarify",
		remainingFollowUps: input.maxFollowUps,
		sendBlockedReasons: [],
		updatedAt: now(),
	});
}

export function acquireAiRunLease(state: ConversationState): AiRunLease {
	const parsedState = ConversationStateSchema.parse(state);

	if (parsedState.ownerType !== "ai") {
		throw new ConversationOwnershipError("AI cannot start a run without conversation ownership.");
	}

	if (parsedState.stage === "closed") {
		throw new ConversationOwnershipError("AI cannot start a run for a closed conversation.");
	}

	return AiRunLeaseSchema.parse({
		conversationId: parsedState.id,
		ownerEpoch: parsedState.ownerEpoch,
	});
}

export function authorizeAiReply(
	state: ConversationState,
	lease: AiRunLease,
): AiReplyAuthorization {
	const parsedState = ConversationStateSchema.parse(state);
	const parsedLease = AiRunLeaseSchema.parse(lease);

	if (parsedState.id !== parsedLease.conversationId) {
		return { allowed: false, reason: "conversation_mismatch" };
	}

	if (parsedState.stage === "closed" || parsedState.ownerType === "closed") {
		return { allowed: false, reason: "conversation_closed" };
	}

	if (parsedState.ownerType !== "ai") {
		return { allowed: false, reason: "owner_is_not_ai" };
	}

	if (parsedState.ownerEpoch !== parsedLease.ownerEpoch) {
		return { allowed: false, reason: "owner_changed" };
	}

	return { allowed: true };
}

export function transferConversationOwner(
	state: ConversationState,
	expectedOwnerEpoch: number,
	nextOwner: OwnerType,
	now: () => string = () => new Date().toISOString(),
): ConversationState {
	const parsedState = ConversationStateSchema.parse(state);

	if (parsedState.stage === "closed" || parsedState.ownerType === "closed") {
		throw new ConversationOwnershipError("A closed conversation cannot change ownership.");
	}

	if (parsedState.ownerEpoch !== expectedOwnerEpoch) {
		throw new ConversationOwnershipError("Conversation ownership changed before this operation.");
	}

	if (parsedState.ownerType === nextOwner) {
		return parsedState;
	}

	return ConversationStateSchema.parse({
		...parsedState,
		ownerType: nextOwner,
		ownerEpoch: parsedState.ownerEpoch + 1,
		aiMode: nextOwner === "ai" ? "auto_handle" : "monitor",
		stage: nextOwner === "closed" ? "closed" : nextOwner === "human" ? "handoff" : "admission",
		nextAction: nextOwner === "ai" || nextOwner === "workflow" ? "clarify" : "stop",
		updatedAt: now(),
	});
}

export function requestHumanHandoff(
	state: ConversationState,
	lease: AiRunLease,
	request: HandoffRequest,
): ConversationState {
	const authorization = authorizeAiReply(state, lease);
	if (!authorization.allowed) {
		throw new ConversationOwnershipError(
			`AI cannot request handoff because ${authorization.reason ?? "ownership is invalid"}.`,
		);
	}

	const now = request.now ?? (() => new Date().toISOString());
	const handoffPackage = HandoffPackageSchema.parse({
		summary: request.summary,
		reason: request.reason,
		riskLevel: request.riskLevel,
		collectedSlots: request.collectedSlots ?? [],
		missingSlots: request.missingSlots ?? [],
		suggestedNextStep: request.suggestedNextStep,
		createdAt: now(),
	});

	return ConversationStateSchema.parse({
		...state,
		ownerType: "human",
		ownerEpoch: state.ownerEpoch + 1,
		aiMode: "monitor",
		stage: "handoff",
		riskLevel: request.riskLevel,
		nextAction: "stop",
		handoffPackage,
		operatorAttention: null,
		sendBlockedReasons: [...state.sendBlockedReasons, request.reason],
		updatedAt: now(),
	});
}
