import { z } from "zod";

export const AgentLifecycleStatusSchema = z.enum(["draft", "review_ready", "released", "blocked"]);
export const OwnerTypeSchema = z.enum(["ai", "human", "workflow", "closed"]);
export const ConversationStageSchema = z.enum([
	"admission",
	"info_gathering",
	"ready_for_human",
	"handoff",
	"closed",
]);
export const SlotStatusSchema = z.enum([
	"missing",
	"provided",
	"denied",
	"unavailable",
	"conflict",
	"not_applicable",
]);
export const NextActionSchema = z.enum([
	"reply",
	"ask_followup",
	"clarify",
	"fallback",
	"handoff",
	"stop",
]);
export const RiskLevelSchema = z.enum(["low", "medium", "high"]);

export const AgentProfileSchema = z.object({
	id: z.string().min(1),
	tenantId: z.string().min(1),
	name: z.string().min(1),
	status: AgentLifecycleStatusSchema,
	version: z.string().min(1),
	serviceScopes: z.array(z.string().min(1)).default([]),
	supportedLanguages: z.array(z.string().min(1)).default([]),
	fallbackLanguage: z.string().min(1),
	maxFollowUps: z.number().int().nonnegative(),
	forbiddenOutputs: z.array(z.string().min(1)).default([]),
	handoffRules: z.array(z.string().min(1)).default([]),
});

export const SlotValueSchema = z.object({
	label: z.string().min(1),
	status: SlotStatusSchema,
	value: z.string().optional(),
	evidence: z.string().optional(),
	updatedAt: z.string().min(1),
});

export const HandoffPackageSchema = z.object({
	summary: z.string().min(1),
	reason: z.string().min(1),
	riskLevel: RiskLevelSchema,
	collectedSlots: z
		.array(
			z.object({
				key: z.string().min(1),
				label: z.string().min(1),
				value: z.string().min(1),
			}),
		)
		.default([]),
	missingSlots: z.array(z.string().min(1)).default([]),
	suggestedNextStep: z.string().min(1),
	createdAt: z.string().min(1),
});

export const ConversationStateSchema = z.object({
	id: z.string().min(1),
	tenantId: z.string().min(1),
	agentId: z.string().min(1),
	ownerType: OwnerTypeSchema,
	ownerEpoch: z.number().int().nonnegative(),
	stage: ConversationStageSchema,
	scenario: z.string().nullable(),
	slots: z.record(z.string(), SlotValueSchema).default({}),
	missingSlots: z.array(z.string().min(1)).default([]),
	riskLevel: RiskLevelSchema,
	nextAction: NextActionSchema,
	remainingFollowUps: z.number().int().nonnegative(),
	handoffPackage: HandoffPackageSchema.optional(),
	sendBlockedReasons: z.array(z.string().min(1)).default([]),
	updatedAt: z.string().min(1),
});

export const AiRunLeaseSchema = z.object({
	conversationId: z.string().min(1),
	ownerEpoch: z.number().int().nonnegative(),
});

export const TraceEventSchema = z.object({
	id: z.string().min(1),
	conversationId: z.string().min(1),
	at: z.string().min(1),
	type: z.enum([
		"admission",
		"owner",
		"runtime",
		"knowledge",
		"policy",
		"guardrail",
		"handoff",
		"adapter",
	]),
	title: z.string().min(1),
	detail: z.string().optional(),
	payload: z.record(z.string(), z.unknown()).optional(),
});

export type AgentLifecycleStatus = z.infer<typeof AgentLifecycleStatusSchema>;
export type AgentProfile = z.infer<typeof AgentProfileSchema>;
export type OwnerType = z.infer<typeof OwnerTypeSchema>;
export type ConversationStage = z.infer<typeof ConversationStageSchema>;
export type SlotStatus = z.infer<typeof SlotStatusSchema>;
export type SlotValue = z.infer<typeof SlotValueSchema>;
export type NextAction = z.infer<typeof NextActionSchema>;
export type RiskLevel = z.infer<typeof RiskLevelSchema>;
export type HandoffPackage = z.infer<typeof HandoffPackageSchema>;
export type ConversationState = z.infer<typeof ConversationStateSchema>;
export type AiRunLease = z.infer<typeof AiRunLeaseSchema>;
export type TraceEvent = z.infer<typeof TraceEventSchema>;
