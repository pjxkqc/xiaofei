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

/**
 * External IDs are supplied by a channel source and are used as durable
 * idempotency and projection keys. Keep them opaque, bounded, and safe to use
 * in logs and storage keys; do not accept whitespace or control characters.
 */
export const StableExternalIdSchema = z
	.string()
	.min(1)
	.max(200)
	.regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/, "Expected a stable external identifier.");

export const CompanyIdSchema = z
	.string()
	.min(1)
	.max(100)
	.regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/, "Expected a stable company identifier.");
export const EmailMessageDirectionSchema = z.enum(["inbound", "outbound"]);
export const EmailMessageSenderTypeSchema = z.enum(["customer", "loopdesk", "xiaofei", "system"]);

export const EmailParticipantSchema = z
	.object({
		address: z.string().email(),
		name: z.string().nullable(),
	})
	.strict();

export const EmailMessageContentSchema = z
	.object({
		type: z.enum(["text/plain", "text/html"]),
		/** The kernel preserves this value; it never truncates or downloads it. */
		value: z.string(),
	})
	.strict();

export const EmailMessageAttachmentSchema = z
	.object({
		url: z.string().url(),
		contentType: z.string().min(1),
		name: z.string().min(1),
		size: z.number().int().nonnegative(),
	})
	.strict();

export const EmailMessageFactsSchema = z
	.object({
		sourceMessageId: StableExternalIdSchema,
		providerMessageId: z.string().nullable(),
		replyToSourceMessageId: StableExternalIdSchema.nullable(),
		direction: EmailMessageDirectionSchema,
		senderType: EmailMessageSenderTypeSchema,
		from: EmailParticipantSchema,
		to: z.array(EmailParticipantSchema).min(1),
		subject: z.string().nullable(),
		content: EmailMessageContentSchema,
		attachments: z.array(EmailMessageAttachmentSchema).nullable(),
		sentAt: z.string().datetime({ offset: true }),
		labels: z.array(z.string()).nullable(),
		sourceSendType: z.number().int().nullable(),
	})
	.strict();

export const EmailConversationReferenceSchema = z
	.object({
		externalId: z.string().min(1),
		loopdeskSessionId: StableExternalIdSchema.nullable(),
	})
	.strict();

export const EmailMessageSourceSchema = z
	.object({
		system: z.string().min(1),
		topic: z.string().min(1),
		partition: z.number().int().nonnegative(),
		offset: z.number().int().nonnegative(),
		workerVersion: z.string().min(1),
	})
	.strict();

/**
 * Vendor-neutral email ingress record. `eventId` is the business idempotency
 * key; source topic/partition/offset are observability fields only. Workspace
 * routing, ownership leases, and job scheduling remain outer-layer decisions.
 */
export const EmailMessageIngestV1Schema = z
	.object({
		schemaVersion: z.literal("email.message.v1"),
		eventId: StableExternalIdSchema,
		occurredAt: z.string().datetime({ offset: true }),
		tenant: z.object({ companyId: CompanyIdSchema }).strict(),
		channel: z.literal("email"),
		channelAccount: z.object({ id: StableExternalIdSchema, address: z.string().email() }).strict(),
		conversation: EmailConversationReferenceSchema,
		message: EmailMessageFactsSchema,
		source: EmailMessageSourceSchema,
	})
	.strict()
	.superRefine((event, context) => {
		const expectedPrefix = `email:${event.tenant.companyId}:`;
		if (!event.conversation.externalId.startsWith(expectedPrefix))
			context.addIssue({
				code: "custom",
				path: ["conversation", "externalId"],
				message: `Expected an external conversation ID prefixed with ${expectedPrefix}.`,
			});
		const isCustomerInbound =
			event.message.direction === "inbound" && event.message.senderType === "customer";
		const isKnownOutbound =
			event.message.direction === "outbound" && event.message.senderType !== "customer";
		if (!isCustomerInbound && !isKnownOutbound)
			context.addIssue({
				code: "custom",
				path: ["message", "senderType"],
				message:
					"Inbound email must be sent by customer; outbound email must be sent by loopdesk, xiaofei, or system.",
			});
	});

export const EmailDeliveryEventTypeSchema = z.enum([
	"message.reply.requested",
	"conversation.status.changed",
]);
export const EmailDeliverySenderTypeSchema = z.enum(["xiaofei", "loopdesk", "system"]);
export const EmailConversationDeliveryStatusSchema = z.enum([
	"xiaofei_received",
	"xiaofei_processing",
	"xiaofei_replied",
	"human_attention_required",
	"closed",
]);

const EmailReplyDeliveryEventSchema = z
	.object({
		type: z.literal("message.reply.requested"),
		message: z
			.object({
				sourceMessageId: StableExternalIdSchema,
				replyToSourceMessageId: StableExternalIdSchema.nullable(),
				senderType: EmailDeliverySenderTypeSchema,
				from: EmailParticipantSchema,
				to: z.array(EmailParticipantSchema).min(1),
				subject: z.string().nullable(),
				content: EmailMessageContentSchema,
			})
			.strict(),
	})
	.strict();

const EmailStatusDeliveryEventSchema = z
	.object({
		type: z.literal("conversation.status.changed"),
		status: EmailConversationDeliveryStatusSchema,
		reason: z.string().max(500).nullable(),
	})
	.strict();

/**
 * Stable callback envelope emitted by Xiaofei after a reply or observable
 * conversation status is durably queued. The receiver can replay by
 * `deliveryId`; transport attempts never change the business envelope.
 */
export const EmailDeliveryV1Schema = z
	.object({
		schemaVersion: z.literal("xiaofei.email.delivery.v1"),
		deliveryId: StableExternalIdSchema,
		occurredAt: z.string().datetime({ offset: true }),
		tenant: z.object({ companyId: CompanyIdSchema }).strict(),
		channel: z.literal("email"),
		channelAccount: z.object({ id: StableExternalIdSchema, address: z.string().email() }).strict(),
		conversation: EmailConversationReferenceSchema,
		event: z.discriminatedUnion("type", [
			EmailReplyDeliveryEventSchema,
			EmailStatusDeliveryEventSchema,
		]),
		source: z
			.object({
				system: z.literal("xiaofei"),
				environment: z.string().min(1).max(80),
			})
			.strict(),
	})
	.strict()
	.superRefine((delivery, context) => {
		const expectedPrefix = `email:${delivery.tenant.companyId}:`;
		if (!delivery.conversation.externalId.startsWith(expectedPrefix))
			context.addIssue({
				code: "custom",
				path: ["conversation", "externalId"],
				message: `Expected an external conversation ID prefixed with ${expectedPrefix}.`,
			});
	});

export const EmailDeliveryAcceptanceV1Schema = z
	.object({
		status: z.enum(["accepted", "duplicate"]),
		deliveryId: StableExternalIdSchema,
		receivedAt: z.string().datetime({ offset: true }),
	})
	.strict();

/**
 * A pure admission predicate for an outer worker. It does not enqueue work,
 * resolve a workspace, or grant any reply/send authority.
 */
export function isCustomerInboundEmailJobEligible(message: EmailMessageIngestV1): boolean {
	return message.message.direction === "inbound" && message.message.senderType === "customer";
}

export const DEFAULT_FALLBACK_POLICY = {
	maxClarifications: 5,
	clarificationReply:
		"我还没有准确匹配到对应资料，先不急着转人工。请补充商品或服务名称、订单状态，以及你最想确认的问题；也可以直接说“查物流”“退换规则”“商品故障”或“发票支付”。",
	attentionReply:
		"这个问题目前没有已审核资料可以准确回答，我已经为客服标记为待关注，但小飞会继续接待。你可以继续补充信息，或直接提出其他问题。",
	handoffReply:
		"我暂时仍没在已审核资料中找到确定答案。为了避免误导，我会把你的问题和已经提供的信息一起转给人工同事继续确认，你不需要重新描述。",
} as const;

export const FallbackPolicySchema = z
	.object({
		maxClarifications: z.number().int().min(0).max(10).default(5),
		clarificationReply: z
			.string()
			.min(1)
			.max(1_000)
			.default(DEFAULT_FALLBACK_POLICY.clarificationReply),
		attentionReply: z.string().min(1).max(1_000).default(DEFAULT_FALLBACK_POLICY.attentionReply),
		handoffReply: z.string().min(1).max(1_000).default(DEFAULT_FALLBACK_POLICY.handoffReply),
	})
	.default({ ...DEFAULT_FALLBACK_POLICY });

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
	fallbackPolicy: FallbackPolicySchema,
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

/** Stable P0 capability partitions; these are product concepts, not provider modes. */
export const CapabilityKeySchema = z.enum([
	"platform-fallback",
	"merchant-knowledge",
	"xiaofei-hosting",
]);

/** KU provenance is independent from the Capability/CA that contains it. */
export const KnowledgeUnitOriginSchema = z.enum(["platform", "merchant"]);

export const KnowledgeUnitRevisionSchema = z
	.object({
		id: z.string().min(1),
		logicalKnowledgeUnitId: z.string().min(1),
		organizationId: z.string().min(1).nullable(),
		revision: z.number().int().positive(),
		origin: KnowledgeUnitOriginSchema,
		knowledgeUnit: KnowledgeUnitSchema,
		contentHash: z.string().min(1),
		createdAt: z.string().datetime({ offset: true }),
	})
	.strict()
	.superRefine((revision, context) => {
		if (revision.origin === "platform" && revision.organizationId !== null) {
			context.addIssue({
				code: "custom",
				path: ["organizationId"],
				message: "Platform fallback revisions are not merchant-owned.",
			});
		}
		if (revision.origin === "merchant" && revision.organizationId === null) {
			context.addIssue({
				code: "custom",
				path: ["organizationId"],
				message: "Merchant and hosting revisions require an organization.",
			});
		}
	});

export const CapabilityVersionStatusSchema = z.enum(["test", "active", "retired"]);
export const CapabilityVersionManifestSchema = z
	.object({
		id: z.string().min(1),
		organizationId: z.string().min(1),
		capabilityKey: CapabilityKeySchema,
		status: CapabilityVersionStatusSchema,
		knowledgeUnitRevisionIds: z.array(z.string().min(1)).min(1),
		manifestHash: z.string().min(1),
		createdAt: z.string().datetime({ offset: true }),
	})
	.strict()
	.superRefine((manifest, context) => {
		if (
			new Set(manifest.knowledgeUnitRevisionIds).size !== manifest.knowledgeUnitRevisionIds.length
		) {
			context.addIssue({
				code: "custom",
				path: ["knowledgeUnitRevisionIds"],
				message: "A capability manifest may include each KU revision only once.",
			});
		}
	});

export const KnowledgeVersioningSnapshotSchema = z
	.object({
		knowledgeUnitRevisions: z.array(KnowledgeUnitRevisionSchema).default([]),
		capabilityVersionManifests: z.array(CapabilityVersionManifestSchema).default([]),
		activeCapabilityVersionId: z.string().min(1).nullable().default(null),
	})
	.superRefine((snapshot, context) => {
		const revisionsById = new Map<string, (typeof snapshot.knowledgeUnitRevisions)[number]>();
		for (const revision of snapshot.knowledgeUnitRevisions) {
			if (revisionsById.has(revision.id)) {
				context.addIssue({
					code: "custom",
					path: ["knowledgeUnitRevisions"],
					message: "KU revision IDs must be unique.",
				});
			}
			revisionsById.set(revision.id, revision);
		}
		const manifestIds = new Set<string>();
		for (const [manifestIndex, manifest] of snapshot.capabilityVersionManifests.entries()) {
			if (manifestIds.has(manifest.id)) {
				context.addIssue({
					code: "custom",
					path: ["capabilityVersionManifests", manifestIndex, "id"],
					message: "Capability version IDs must be unique.",
				});
			}
			manifestIds.add(manifest.id);
			const logicalKnowledgeUnitIds = new Set<string>();
			for (const revisionId of manifest.knowledgeUnitRevisionIds) {
				const revision = revisionsById.get(revisionId);
				if (!revision) {
					context.addIssue({
						code: "custom",
						path: ["capabilityVersionManifests", manifestIndex, "knowledgeUnitRevisionIds"],
						message: `Manifest references unknown KU revision ${revisionId}.`,
					});
					continue;
				}
				if (logicalKnowledgeUnitIds.has(revision.logicalKnowledgeUnitId)) {
					context.addIssue({
						code: "custom",
						path: ["capabilityVersionManifests", manifestIndex, "knowledgeUnitRevisionIds"],
						message: "A manifest cannot include two revisions of one logical KU.",
					});
				}
				logicalKnowledgeUnitIds.add(revision.logicalKnowledgeUnitId);
				if (revision.origin === "merchant" && revision.organizationId !== manifest.organizationId) {
					context.addIssue({
						code: "custom",
						path: ["capabilityVersionManifests", manifestIndex, "knowledgeUnitRevisionIds"],
						message: "Merchant KU revisions must belong to the manifest organization.",
					});
				}
				if (manifest.capabilityKey === "platform-fallback" && revision.origin !== "platform") {
					context.addIssue({
						code: "custom",
						path: ["capabilityVersionManifests", manifestIndex, "knowledgeUnitRevisionIds"],
						message: "Platform fallback manifests may reference only platform-origin KU revisions.",
					});
				}
				if (manifest.capabilityKey === "merchant-knowledge" && revision.origin !== "merchant") {
					context.addIssue({
						code: "custom",
						path: ["capabilityVersionManifests", manifestIndex, "knowledgeUnitRevisionIds"],
						message:
							"Merchant knowledge manifests may reference only merchant-origin KU revisions.",
					});
				}
			}
		}
		if (snapshot.activeCapabilityVersionId) {
			const activeMatches = snapshot.capabilityVersionManifests.filter(
				(manifest) =>
					manifest.id === snapshot.activeCapabilityVersionId && manifest.status === "active",
			);
			if (activeMatches.length !== 1) {
				context.addIssue({
					code: "custom",
					path: ["activeCapabilityVersionId"],
					message: "The active capability version must resolve to exactly one active manifest.",
				});
			} else if (activeMatches[0]!.capabilityKey !== "xiaofei-hosting") {
				context.addIssue({
					code: "custom",
					path: ["activeCapabilityVersionId"],
					message:
						"The active capability version must reference an active xiaofei-hosting manifest.",
				});
			}
		}
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
	knowledgeVersioning: KnowledgeVersioningSnapshotSchema.default({
		knowledgeUnitRevisions: [],
		capabilityVersionManifests: [],
		activeCapabilityVersionId: null,
	}),
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

export const ConversationAttentionSchema = z.object({
	reason: z.literal("knowledge_missing"),
	since: z.string().min(1),
	latestAt: z.string().min(1),
	missCount: z.number().int().positive(),
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
	consecutiveKnowledgeMisses: z.number().int().nonnegative().default(0),
	operatorAttention: ConversationAttentionSchema.nullable().default(null),
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
	knowledgeEvidence: z
		.object({
			logicalKnowledgeUnitId: z.string().min(1),
			knowledgeUnitRevisionId: z.string().min(1),
			capabilityVersionId: z.string().min(1),
			capabilityKey: CapabilityKeySchema,
			knowledgeUnitOrigin: KnowledgeUnitOriginSchema,
		})
		.nullable()
		.default(null),
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
	customerId: z.string().min(1).nullable().default(null),
	customerName: z.string().min(1),
	channel: z.string().min(1),
	status: SupportConversationStatusSchema,
	ownerType: OwnerTypeSchema,
	stage: ConversationStageSchema,
	attentionRequired: z.boolean().default(false),
	attentionReason: z.string().nullable().default(null),
	attentionSince: z.string().nullable().default(null),
	online: z.boolean(),
	assignedUserName: z.string().nullable(),
	processingJobId: z.string().nullable().default(null),
	processingStatus: z.string().nullable().default(null),
	deliveryStatus: z.string().nullable().default(null),
	lastMessage: z.string(),
	lastMessageAt: z.string().nullable(),
	updatedAt: z.string().min(1),
});

export const SupportConversationSchema = SupportConversationSummarySchema.extend({
	messages: z.array(SupportMessageSchema),
	handoffReason: z.string().nullable(),
});

export const CustomerStatusSchema = z.enum(["active", "archived"]);

export const CustomerSchema = z.object({
	id: z.string().min(1),
	externalCustomerId: z.string().min(1),
	name: z.string().nullable(),
	email: z.string().nullable(),
	whatsappNumber: z.string().nullable(),
	status: CustomerStatusSchema,
	lastSeenAt: z.string().nullable(),
	createdAt: z.string().min(1),
	updatedAt: z.string().min(1),
	conversationCount: z.number().int().nonnegative(),
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
export type CapabilityKey = z.infer<typeof CapabilityKeySchema>;
export type KnowledgeUnitOrigin = z.infer<typeof KnowledgeUnitOriginSchema>;
export type KnowledgeUnitRevision = z.infer<typeof KnowledgeUnitRevisionSchema>;
export type CapabilityVersionStatus = z.infer<typeof CapabilityVersionStatusSchema>;
export type CapabilityVersionManifest = z.infer<typeof CapabilityVersionManifestSchema>;
export type KnowledgeVersioningSnapshot = z.infer<typeof KnowledgeVersioningSnapshotSchema>;
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
export type StableExternalId = z.infer<typeof StableExternalIdSchema>;
export type CompanyId = z.infer<typeof CompanyIdSchema>;
export type EmailMessageDirection = z.infer<typeof EmailMessageDirectionSchema>;
export type EmailMessageSenderType = z.infer<typeof EmailMessageSenderTypeSchema>;
export type EmailParticipant = z.infer<typeof EmailParticipantSchema>;
export type EmailMessageContent = z.infer<typeof EmailMessageContentSchema>;
export type EmailMessageAttachment = z.infer<typeof EmailMessageAttachmentSchema>;
export type EmailMessageSource = z.infer<typeof EmailMessageSourceSchema>;
export type EmailConversationReference = z.infer<typeof EmailConversationReferenceSchema>;
export type EmailMessageFacts = z.infer<typeof EmailMessageFactsSchema>;
export type EmailMessageIngestV1 = z.infer<typeof EmailMessageIngestV1Schema>;
export type EmailDeliveryEventType = z.infer<typeof EmailDeliveryEventTypeSchema>;
export type EmailDeliverySenderType = z.infer<typeof EmailDeliverySenderTypeSchema>;
export type EmailConversationDeliveryStatus = z.infer<typeof EmailConversationDeliveryStatusSchema>;
export type EmailDeliveryV1 = z.infer<typeof EmailDeliveryV1Schema>;
export type EmailDeliveryAcceptanceV1 = z.infer<typeof EmailDeliveryAcceptanceV1Schema>;
export type FallbackPolicy = z.infer<typeof FallbackPolicySchema>;
export type HandoffPackage = z.infer<typeof HandoffPackageSchema>;
export type ConversationAttention = z.infer<typeof ConversationAttentionSchema>;
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
export type Customer = z.infer<typeof CustomerSchema>;
