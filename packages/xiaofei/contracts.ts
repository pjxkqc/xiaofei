import { z } from "zod";

export const GateStatusSchema = z.enum(["passed", "warning", "blocked"]);
export const AgentLifecycleStatusSchema = z.enum(["draft", "review_ready", "released", "blocked"]);
export const OwnerTypeSchema = z.enum(["ai", "human", "workflow", "closed"]);
export const AiModeSchema = z.enum(["auto_handle", "monitor", "copilot", "draft"]);
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
	instructions: z.string().min(1),
	serviceScopes: z.array(z.string().min(1)).default([]),
	supportedLanguages: z.array(z.string().min(1)).default([]),
	fallbackLanguage: z.string().min(1),
	maxFollowUps: z.number().int().nonnegative(),
	forbiddenOutputs: z.array(z.string().min(1)).default([]),
	handoffRules: z.array(z.string().min(1)).default([]),
});

export const RequiredSlotSchema = z.object({
	key: z.string().min(1),
	label: z.string().min(1),
	askText: z.string().min(1),
	required: z.boolean().default(true),
});

export const KnowledgeQualitySchema = z.object({
	status: GateStatusSchema,
	blockers: z.array(z.string().min(1)).default([]),
	warnings: z.array(z.string().min(1)).default([]),
});

export const KnowledgeUnitEligibilitySchema = z.enum(["eligible", "ineligible", "stale"]);

/** Durable, content-free provenance for a generated KU. */
export const KnowledgeUnitLineageSchema = z.object({
	workspaceId: z.string().min(1),
	sourceId: z.string().min(1),
	sourceContentHash: z.string().min(1).nullable(),
	sourceVersion: z.number().int().nonnegative().nullable(),
	entryId: z.string().min(1),
	entryVersion: z.number().int().nonnegative(),
});

export const NormalizedKnowledgeEntrySchema = z.object({
	id: z.string().min(1),
	workspaceId: z.string().min(1),
	sourceId: z.string().min(1),
	sourceContentHash: z.string().min(1).nullable(),
	sourceVersion: z.number().int().nonnegative().nullable(),
	version: z.number().int().nonnegative(),
	question: z.string().min(1),
	answer: z.string().min(1),
	similarQueries: z.array(z.string().min(1)).default([]),
	category: z.string().nullable().default(null),
	tags: z.array(z.string().min(1)).default([]),
	status: z.enum(["active", "draft", "archived", "deleted"]),
});

export const KnowledgeUnitSchema = z.object({
	id: z.string().min(1),
	title: z.string().min(1),
	status: AgentLifecycleStatusSchema,
	scenarioKeywords: z.array(z.string().min(1)).default([]),
	applicableScenarios: z.array(z.string().min(1)).default([]),
	inapplicableScenarios: z.array(z.string().min(1)).default([]),
	requiredSlots: z.array(RequiredSlotSchema).default([]),
	forbiddenOutputs: z.array(z.string().min(1)).default([]),
	handoffRules: z.array(z.string().min(1)).default([]),
	standardReplyPolicy: z.string().min(1),
	fallbackReply: z.string().min(1),
	sourceSection: z.string().min(1),
	quality: KnowledgeQualitySchema,
	lineage: KnowledgeUnitLineageSchema.optional(),
	eligibility: KnowledgeUnitEligibilitySchema.default("eligible"),
	staleReason: z.string().min(1).optional(),
});

/** Model output cannot set a KU's lifecycle, eligibility, or provenance. */
export const KnowledgeUnitDraftCandidateSchema = KnowledgeUnitSchema.omit({
	id: true,
	status: true,
	sourceSection: true,
	quality: true,
	lineage: true,
	eligibility: true,
	staleReason: true,
}).superRefine((candidate, context) => {
	for (const field of ["scenarioKeywords", "forbiddenOutputs", "handoffRules"] as const) {
		if (candidate[field].length === 0) {
			context.addIssue({
				code: "custom",
				path: [field],
				message: "Generated draft candidates must include their safety boundary.",
			});
		}
	}
});

export const KnowledgeUnitDraftSchema = KnowledgeUnitSchema.extend({
	status: z.literal("draft"),
	lineage: KnowledgeUnitLineageSchema,
	eligibility: z.literal("ineligible"),
});

export const GuardrailPolicySchema = z.object({
	forbiddenPhrases: z.array(z.string().min(1)).default([]),
	handoffKeywords: z.array(z.string().min(1)).default([]),
	requireReleasedKnowledge: z.boolean().default(true),
});

export const ToolDefinitionSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	category: z.enum(["adapter", "business_api", "action", "observer"]),
	riskLevel: RiskLevelSchema,
	status: z.enum(["available", "approval_required", "blocked"]),
	description: z.string().min(1),
});

export const CapabilityPlanSchema = z.object({
	status: AgentLifecycleStatusSchema.default("review_ready"),
	version: z.string().min(1).default("cap-v1"),
	reviewed: z.boolean().default(false),
	generatedAt: z.string().optional(),
	knowledgeUnitIds: z.array(z.string().min(1)).default([]),
	takeoverScenarios: z.array(z.string().min(1)).default([]),
	rejectScenarios: z.array(z.string().min(1)).default([]),
	fieldMatrix: z
		.array(
			z.object({
				knowledgeId: z.string().min(1),
				scenario: z.string().min(1),
				fields: z.array(z.string().min(1)).default([]),
				exitWhen: z.string().min(1),
			}),
		)
		.default([]),
	actionBoundaries: z.array(z.string().min(1)).default([]),
	handoffBoundaries: z.array(z.string().min(1)).default([]),
	evalSuggestions: z.array(z.string().min(1)).default([]),
});

/**
 * The authenticated outer layer resolves a channel/conversation to this record
 * before invoking the runtime. The kernel verifies it but never resolves
 * tenant routing from framework or persistence state itself.
 */
export const KnowledgeWorkspaceBindingSchema = z.object({
	tenantId: z.string().min(1),
	conversationId: z.string().min(1),
	channelId: z.string().min(1),
	knowledgeWorkspaceId: z.string().min(1),
});

export const EvalCaseResultSchema = z.object({
	id: z.string().min(1),
	title: z.string().min(1),
	passed: z.boolean(),
	expectedAction: NextActionSchema,
	actualAction: NextActionSchema,
	expectedOwner: OwnerTypeSchema,
	actualOwner: OwnerTypeSchema,
	expectedKnowledgeId: z.string().nullable().default(null),
	actualKnowledgeId: z.string().nullable().default(null),
	knowledgeMatched: z.boolean().default(false),
	failures: z.array(z.string()).default([]),
});

export const EvalSuiteSchema = z.object({
	status: GateStatusSchema,
	passed: z.number().int().nonnegative(),
	failed: z.number().int().nonnegative(),
	cases: z.array(EvalCaseResultSchema).default([]),
	updatedAt: z.string().min(1),
	capabilityPlanVersion: z.string().min(1).nullable().default(null),
});

export const ReleaseGateSchema = z.object({
	id: z.string().min(1),
	label: z.string().min(1),
	status: GateStatusSchema,
	detail: z.string().min(1),
});

export const XiaofeiWorkspaceSnapshotSchema = z.object({
	knowledgeWorkspaceId: z.string().min(1).default("unbound"),
	agent: AgentProfileSchema,
	knowledgeMarkdown: z.string().min(1),
	knowledgeUnits: z.array(KnowledgeUnitSchema),
	guardrails: GuardrailPolicySchema,
	tools: z.array(ToolDefinitionSchema),
	capabilityPlan: CapabilityPlanSchema,
	evalSuite: EvalSuiteSchema,
	gates: z.array(ReleaseGateSchema),
	updatedAt: z.string().min(1),
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
	scenario: z.string().nullable().default(null),
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
	aiMode: AiModeSchema.default("auto_handle"),
	stage: ConversationStageSchema,
	scenario: z.string().nullable(),
	matchedKnowledgeId: z.string().nullable().default(null),
	slots: z.record(z.string(), SlotValueSchema).default({}),
	missingSlots: z.array(z.string().min(1)).default([]),
	riskLevel: RiskLevelSchema,
	nextAction: NextActionSchema,
	remainingFollowUps: z.number().int().nonnegative(),
	handoffReason: z.string().optional(),
	handoffPackage: HandoffPackageSchema.optional(),
	sendBlockedReasons: z.array(z.string().min(1)).default([]),
	lastReply: z.string().optional(),
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
		"mastra",
		"langgraph",
		"admission",
		"owner",
		"runtime",
		"knowledge",
		"slot",
		"policy",
		"guardrail",
		"handoff",
		"delivery",
		"eval",
		"adapter",
	]),
	title: z.string().min(1),
	detail: z.string().optional(),
	payload: z.record(z.string(), z.unknown()).optional(),
});

export const RuntimeMetadataSchema = z.object({
	knowledgeTitle: z.string().nullable(),
	nextAction: NextActionSchema,
	riskLevel: RiskLevelSchema,
	ownerType: OwnerTypeSchema,
	stage: ConversationStageSchema,
	missingSlots: z.array(z.string()),
	traces: z.array(TraceEventSchema),
});

export const RuntimeTurnResultSchema = z.object({
	reply: z.string(),
	state: ConversationStateSchema,
	metadata: RuntimeMetadataSchema,
});

export const SupportMessageRoleSchema = z.enum(["customer", "ai", "human"]);

export const SupportMessageSchema = z.object({
	id: z.string().min(1),
	role: SupportMessageRoleSchema,
	authorName: z.string().min(1),
	text: z.string().min(1),
	createdAt: z.string().min(1),
});

export const SupportConversationStatusSchema = z.enum(["open", "closed"]);

export const SupportConversationSummarySchema = z.object({
	id: z.string().min(1),
	customerName: z.string().min(1),
	status: SupportConversationStatusSchema,
	ownerType: OwnerTypeSchema,
	stage: ConversationStageSchema,
	online: z.boolean(),
	assignedUserName: z.string().nullable(),
	lastMessage: z.string(),
	lastMessageAt: z.string().nullable(),
	updatedAt: z.string().min(1),
});

export const SupportConversationSchema = SupportConversationSummarySchema.extend({
	messages: z.array(SupportMessageSchema),
	handoffReason: z.string().nullable(),
});

export type GateStatus = z.infer<typeof GateStatusSchema>;
export type AgentLifecycleStatus = z.infer<typeof AgentLifecycleStatusSchema>;
export type AgentProfile = z.infer<typeof AgentProfileSchema>;
export type RequiredSlot = z.infer<typeof RequiredSlotSchema>;
export type KnowledgeUnit = z.infer<typeof KnowledgeUnitSchema>;
export type KnowledgeUnitEligibility = z.infer<typeof KnowledgeUnitEligibilitySchema>;
export type KnowledgeUnitLineage = z.infer<typeof KnowledgeUnitLineageSchema>;
export type NormalizedKnowledgeEntry = z.infer<typeof NormalizedKnowledgeEntrySchema>;
export type KnowledgeUnitDraftCandidate = z.infer<typeof KnowledgeUnitDraftCandidateSchema>;
export type KnowledgeUnitDraft = z.infer<typeof KnowledgeUnitDraftSchema>;
export type GuardrailPolicy = z.infer<typeof GuardrailPolicySchema>;
export type ToolDefinition = z.infer<typeof ToolDefinitionSchema>;
export type CapabilityPlan = z.infer<typeof CapabilityPlanSchema>;
export type KnowledgeWorkspaceBinding = z.infer<typeof KnowledgeWorkspaceBindingSchema>;
export type EvalCaseResult = z.infer<typeof EvalCaseResultSchema>;
export type EvalSuite = z.infer<typeof EvalSuiteSchema>;
export type ReleaseGate = z.infer<typeof ReleaseGateSchema>;
export type XiaofeiWorkspaceSnapshot = z.infer<typeof XiaofeiWorkspaceSnapshotSchema>;
export type OwnerType = z.infer<typeof OwnerTypeSchema>;
export type AiMode = z.infer<typeof AiModeSchema>;
export type ConversationStage = z.infer<typeof ConversationStageSchema>;
export type SlotStatus = z.infer<typeof SlotStatusSchema>;
export type SlotValue = z.infer<typeof SlotValueSchema>;
export type NextAction = z.infer<typeof NextActionSchema>;
export type RiskLevel = z.infer<typeof RiskLevelSchema>;
export type HandoffPackage = z.infer<typeof HandoffPackageSchema>;
export type ConversationState = z.infer<typeof ConversationStateSchema>;
export type AiRunLease = z.infer<typeof AiRunLeaseSchema>;
export type TraceEvent = z.infer<typeof TraceEventSchema>;
export type RuntimeMetadata = z.infer<typeof RuntimeMetadataSchema>;
export type RuntimeTurnResult = z.infer<typeof RuntimeTurnResultSchema>;
export type SupportMessageRole = z.infer<typeof SupportMessageRoleSchema>;
export type SupportMessage = z.infer<typeof SupportMessageSchema>;
export type SupportConversationStatus = z.infer<typeof SupportConversationStatusSchema>;
export type SupportConversationSummary = z.infer<typeof SupportConversationSummarySchema>;
export type SupportConversation = z.infer<typeof SupportConversationSchema>;
