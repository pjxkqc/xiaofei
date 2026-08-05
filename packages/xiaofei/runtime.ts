import {
	ConversationStateSchema,
	KnowledgeWorkspaceBindingSchema,
	RuntimeTurnResultSchema,
	type ConversationState,
	type KnowledgeUnit,
	type KnowledgeWorkspaceBinding,
	type NextAction,
	type RiskLevel,
	type RuntimeTurnResult,
	type SlotValue,
	type TraceEvent,
	type XiaofeiWorkspaceSnapshot,
} from "./contracts";
import { acquireAiRunLease, authorizeAiReply, requestHumanHandoff } from "./conversation";
import { isKnowledgeUnitEligible } from "./knowledge";
import { resolveRuntimeKnowledgeEvidence } from "./versioning";

export interface ReplyGenerationInput {
	message: string;
	agentInstructions: string;
	knowledge: KnowledgeUnit;
	state: ConversationState;
}

export interface ReplyGenerator {
	generate(input: ReplyGenerationInput): Promise<string>;
}

export interface PreparedTurn {
	state: ConversationState;
	knowledge: KnowledgeUnit | null;
	action: NextAction;
	riskLevel: RiskLevel;
	reply: string;
	handoffReason?: string;
	traces: TraceEvent[];
}

export function prepareTurn(input: {
	message: string;
	state: ConversationState;
	snapshot: XiaofeiWorkspaceSnapshot;
	knowledgeWorkspaceBinding: KnowledgeWorkspaceBinding;
	now?: () => string;
}): PreparedTurn {
	return prepareTurnInternal(input, true);
}

/** Eval uses the reviewed capability boundary to produce the evidence required at runtime. */
export function prepareEvalTurn(input: {
	message: string;
	state: ConversationState;
	snapshot: XiaofeiWorkspaceSnapshot;
	knowledgeWorkspaceBinding: KnowledgeWorkspaceBinding;
	now?: () => string;
}): PreparedTurn {
	return prepareTurnInternal(input, false);
}

function prepareTurnInternal(
	input: {
		message: string;
		state: ConversationState;
		snapshot: XiaofeiWorkspaceSnapshot;
		knowledgeWorkspaceBinding: KnowledgeWorkspaceBinding;
		now?: () => string;
	},
	requireEvalEvidence: boolean,
): PreparedTurn {
	const now = input.now ?? (() => new Date().toISOString());
	const at = now();
	const state = ConversationStateSchema.parse(input.state);
	const traces: TraceEvent[] = [];
	const binding = KnowledgeWorkspaceBindingSchema.safeParse(input.knowledgeWorkspaceBinding);
	if (
		!binding.success ||
		binding.data.tenantId !== state.tenantId ||
		binding.data.tenantId !== input.snapshot.agent.tenantId ||
		binding.data.conversationId !== state.id ||
		binding.data.knowledgeWorkspaceId !== input.snapshot.knowledgeWorkspaceId
	) {
		return blockedAdmission(
			state,
			at,
			"knowledge_workspace_unresolved",
			"知识工作区映射未解析或不匹配。",
		);
	}

	if (state.ownerType !== "ai" || state.aiMode !== "auto_handle") {
		return {
			state: ConversationStateSchema.parse({
				...state,
				nextAction: "stop",
				stage: state.ownerType === "closed" ? "closed" : "handoff",
				updatedAt: at,
			}),
			knowledge: null,
			action: "stop",
			riskLevel: state.riskLevel,
			reply: "当前会话已由人工接管，AI 不再自动处理。",
			traces: [
				...traces,
				trace(state.id, "admission", at, "Admission 阻塞", `当前处理权为 ${state.ownerType}。`),
			],
		};
	}

	if (!hasCurrentAdmissionEvidence(input.snapshot, requireEvalEvidence)) {
		return blockedAdmission(
			state,
			at,
			"capability_evidence_stale",
			"能力审核、可调用 KU 或 Eval 证据不是当前版本。",
		);
	}

	const risk = detectRisk(input.message, input.snapshot);
	const callableKnowledgeIds = new Set(input.snapshot.capabilityPlan.knowledgeUnitIds);
	const selection =
		risk.level === "high"
			? null
			: selectKnowledge(
					input.message,
					state,
					input.snapshot.knowledgeUnits.filter(
						(unit) => callableKnowledgeIds.has(unit.id) && isKnowledgeUnitEligible(unit),
					),
				);
	const knowledge = selection?.knowledge ?? null;
	traces.push(
		trace(
			state.id,
			"knowledge",
			at,
			knowledge ? "命中 KnowledgeUnit" : "知识缺失",
			knowledge
				? `${knowledge.title}（${selection?.reason ?? "deterministic"}）`
				: "没有可安全调用的已发布知识。",
			{ knowledgeId: knowledge?.id, matchScore: selection?.score },
		),
	);

	if (risk.level === "high") {
		return {
			state: withDecision(state, {
				knowledge,
				riskLevel: "high",
				action: "handoff",
				handoffReason: risk.reason,
				at,
			}),
			knowledge,
			action: "handoff",
			riskLevel: "high",
			reply: input.snapshot.agent.fallbackPolicy.handoffReply,
			handoffReason: risk.reason,
			traces,
		};
	}

	if (!knowledge) {
		const missCount = state.consecutiveKnowledgeMisses + 1;
		const operatorAttention = {
			reason: "knowledge_missing" as const,
			since: state.operatorAttention?.since ?? at,
			latestAt: at,
			missCount,
		};
		if (state.consecutiveKnowledgeMisses < input.snapshot.agent.fallbackPolicy.maxClarifications) {
			return {
				state: withDecision(state, {
					knowledge: null,
					riskLevel: "low",
					action: "clarify",
					at,
					consecutiveKnowledgeMisses: missCount,
					operatorAttention,
				}),
				knowledge: null,
				action: "clarify",
				riskLevel: "low",
				reply: input.snapshot.agent.fallbackPolicy.clarificationReply,
				traces: [
					...traces,
					trace(
						state.id,
						"policy",
						at,
						"知识缺失，等待人工关注",
						`第 ${missCount}/${input.snapshot.agent.fallbackPolicy.maxClarifications} 次澄清；已标记待关注，继续由 AI 托管。`,
					),
				],
			};
		}
		return {
			state: withDecision(state, {
				knowledge: null,
				riskLevel: "low",
				action: "fallback",
				at,
				consecutiveKnowledgeMisses: missCount,
				operatorAttention,
			}),
			knowledge: null,
			action: "fallback",
			riskLevel: "low",
			reply: input.snapshot.agent.fallbackPolicy.attentionReply,
			traces: [
				...traces,
				trace(
					state.id,
					"policy",
					at,
					"知识缺失持续观察",
					`已连续 ${missCount} 次未命中；通知人工关注，但不移交处理权，后续消息继续尝试匹配。`,
				),
			],
		};
	}

	const slots = updateSlots(state.slots, knowledge, input.message, at);
	const missingSlots = knowledge.requiredSlots
		.filter((slot) => slot.required && slots[slot.key]?.status === "missing")
		.map((slot) => slot.key);
	const hasRequiredSlots = knowledge.requiredSlots.some((slot) => slot.required);
	const blockedSlot = Object.entries(slots).find(([, slot]) =>
		["denied", "unavailable", "conflict"].includes(slot.status),
	);
	traces.push(
		trace(state.id, "slot", at, "更新资料槽位", `${missingSlots.length} 个必问字段仍缺失。`, {
			missingSlots,
		}),
	);

	if (blockedSlot) {
		return {
			state: withDecision(state, {
				knowledge,
				slots,
				missingSlots,
				riskLevel: "medium",
				action: "handoff",
				handoffReason: `slot_${blockedSlot[1].status}:${blockedSlot[0]}`,
				at,
			}),
			knowledge,
			action: "handoff",
			riskLevel: "medium",
			reply: knowledge.fallbackReply,
			handoffReason: `slot_${blockedSlot[1].status}:${blockedSlot[0]}`,
			traces,
		};
	}

	if (missingSlots.length > 0) {
		if (state.remainingFollowUps <= 0) {
			return {
				state: withDecision(state, {
					knowledge,
					slots,
					missingSlots,
					riskLevel: "medium",
					action: "handoff",
					handoffReason: "follow_up_limit_reached",
					at,
				}),
				knowledge,
				action: "handoff",
				riskLevel: "medium",
				reply: knowledge.fallbackReply,
				handoffReason: "follow_up_limit_reached",
				traces,
			};
		}

		const nextSlot = knowledge.requiredSlots.find((slot) => missingSlots.includes(slot.key));
		return {
			state: withDecision(state, {
				knowledge,
				slots,
				missingSlots,
				riskLevel: "low",
				action: "ask_followup",
				at,
				remainingFollowUps: state.remainingFollowUps - 1,
			}),
			knowledge,
			action: "ask_followup",
			riskLevel: "low",
			reply: nextSlot?.askText ?? "请补充必要信息，方便人工客服后续核实。",
			traces,
		};
	}

	if (hasRequiredSlots) {
		return {
			state: withDecision(state, {
				knowledge,
				slots,
				missingSlots,
				riskLevel: "low",
				action: "handoff",
				handoffReason: "required_information_collected",
				at,
			}),
			knowledge,
			action: "handoff",
			riskLevel: "low",
			reply: knowledge.fallbackReply,
			handoffReason: "required_information_collected",
			traces,
		};
	}

	return {
		state: withDecision(state, {
			knowledge,
			slots,
			missingSlots,
			riskLevel: "low",
			action: "reply",
			at,
		}),
		knowledge,
		action: "reply",
		riskLevel: "low",
		reply: "",
		traces,
	};
}

export async function finalizeTurn(input: {
	prepared: PreparedTurn;
	snapshot: XiaofeiWorkspaceSnapshot;
	message: string;
	replyGenerator: ReplyGenerator;
	now?: () => string;
}): Promise<RuntimeTurnResult> {
	const now = input.now ?? (() => new Date().toISOString());
	const at = now();
	let reply = input.prepared.reply;
	const traces = [...input.prepared.traces];

	if (input.prepared.action === "reply" && input.prepared.knowledge) {
		reply = await input.replyGenerator.generate({
			message: input.message,
			agentInstructions: input.snapshot.agent.instructions,
			knowledge: input.prepared.knowledge,
			state: input.prepared.state,
		});
	}

	const blockedReasons = validateReply(
		reply,
		input.snapshot,
		input.prepared.knowledge,
		input.prepared.action === "reply",
	);
	if (blockedReasons.length > 0) {
		reply = input.snapshot.agent.fallbackPolicy.handoffReply;
	}
	traces.push(
		trace(
			input.prepared.state.id,
			"guardrail",
			at,
			blockedReasons.length > 0 ? "回复前校验拦截" : "回复前校验通过",
			blockedReasons.join("；") || "Owner、知识和禁止承诺校验通过。",
		),
	);

	let state = ConversationStateSchema.parse({
		...input.prepared.state,
		sendBlockedReasons: blockedReasons,
		lastReply: reply,
		updatedAt: at,
	});

	const shouldHandoff = input.prepared.action === "handoff" || blockedReasons.length > 0;
	if (shouldHandoff && state.ownerType === "ai") {
		const lease = acquireAiRunLease(state);
		const reason =
			blockedReasons[0] ?? input.prepared.handoffReason ?? "manual_verification_required";
		state = requestHumanHandoff(state, lease, {
			summary: `客户问题：${input.message}`,
			reason,
			riskLevel: input.prepared.riskLevel,
			collectedSlots: Object.entries(state.slots).flatMap(([key, slot]) =>
				slot.status === "provided" && slot.value
					? [{ key, label: slot.label, value: slot.value }]
					: [],
			),
			missingSlots: state.missingSlots,
			suggestedNextStep: "核实客户资料，并由人工确认后续处理结果。",
			now,
		});
		state = ConversationStateSchema.parse({
			...state,
			aiMode: "monitor",
			handoffReason: reason,
			lastReply: reply,
		});
		traces.push(
			trace(state.id, "handoff", at, "交接给人工客服", reason, {
				ownerEpoch: state.ownerEpoch,
			}),
		);
	} else if (state.ownerType === "ai") {
		const authorization = authorizeAiReply(state, acquireAiRunLease(state));
		if (!authorization.allowed) {
			throw new Error(`AI reply authorization failed: ${authorization.reason}`);
		}
		traces.push(trace(state.id, "delivery", at, "允许发送客户可见回复", "最终发送资格校验通过。"));
	}

	return RuntimeTurnResultSchema.parse({
		reply,
		state,
		metadata: {
			knowledgeTitle: input.prepared.knowledge?.title ?? null,
			knowledgeEvidence: resolveRuntimeKnowledgeEvidence(
				input.snapshot.knowledgeVersioning,
				input.prepared.knowledge?.id ?? null,
			),
			nextAction: state.nextAction,
			riskLevel: state.riskLevel,
			ownerType: state.ownerType,
			stage: state.stage,
			missingSlots: state.missingSlots,
			traces,
		},
	});
}

function withDecision(
	state: ConversationState,
	input: {
		knowledge: KnowledgeUnit | null;
		slots?: Record<string, SlotValue>;
		missingSlots?: string[];
		riskLevel: RiskLevel;
		action: NextAction;
		handoffReason?: string;
		at: string;
		remainingFollowUps?: number;
		consecutiveKnowledgeMisses?: number;
		operatorAttention?: ConversationState["operatorAttention"];
	},
): ConversationState {
	const stage =
		input.action === "handoff"
			? "ready_for_human"
			: input.action === "ask_followup" || input.action === "clarify"
				? "info_gathering"
				: "admission";

	return ConversationStateSchema.parse({
		...state,
		scenario: input.knowledge?.title ?? state.scenario,
		matchedKnowledgeId: input.knowledge?.id ?? state.matchedKnowledgeId,
		slots: input.slots ?? state.slots,
		missingSlots: input.missingSlots ?? [],
		riskLevel: input.riskLevel,
		nextAction: input.action,
		stage,
		handoffReason: input.handoffReason,
		remainingFollowUps: input.remainingFollowUps ?? state.remainingFollowUps,
		consecutiveKnowledgeMisses:
			input.consecutiveKnowledgeMisses ?? (input.knowledge ? 0 : state.consecutiveKnowledgeMisses),
		operatorAttention: input.knowledge
			? null
			: input.operatorAttention === undefined
				? state.operatorAttention
				: input.operatorAttention,
		updatedAt: input.at,
	});
}

function selectKnowledge(
	message: string,
	state: ConversationState,
	units: KnowledgeUnit[],
): { knowledge: KnowledgeUnit; score: number; reason: "exact" | "related" | "context" } | null {
	const released = units.filter(isKnowledgeUnitEligible);
	const normalizedMessage = normalizeSearchText(message);
	const ranked = released
		.flatMap((knowledge) => {
			const match = bestKnowledgeTermMatch(normalizedMessage, knowledge);
			return match ? [{ knowledge, ...match }] : [];
		})
		.sort((left, right) => right.score - left.score);
	if (ranked[0]) return ranked[0];

	const canUseConversationContext = shouldUseConversationContext(message, state);
	const contextual = canUseConversationContext
		? released.find((unit) => unit.id === state.matchedKnowledgeId)
		: undefined;
	return contextual ? { knowledge: contextual, score: 1, reason: "context" } : null;
}

function shouldUseConversationContext(message: string, state: ConversationState): boolean {
	if (!state.matchedKnowledgeId) return false;
	if (state.nextAction === "ask_followup" || state.missingSlots.length > 0) return true;

	const normalizedMessage = normalizeSearchText(message);
	if (!normalizedMessage || normalizedMessage.length > 80 || !state.lastReply) return false;

	const hasStrongContextField =
		/(?:平方米|平方|㎡|联网|wi-?fi|预算|用途|房间|面积|型号|订单号)/iu.test(message);
	if (hasStrongContextField) return true;

	const lastReplyInvitedFollowUp =
		/[?？]/u.test(state.lastReply) ||
		/(请|方便|告诉我|补充|确认|是否|需要|可以继续|想了解)/u.test(state.lastReply);
	if (!lastReplyInvitedFollowUp) return false;

	if (state.operatorAttention) return false;

	const looksLikeFollowUpAnswer =
		/(^|[，,。\s])(?:是|不是|要|不要|需要|不需要|可以|不可以|有|没有|大概|左右|这个|那个|它|前面|刚才)|(?:平方米|平方|㎡|联网|wi-?fi|预算|用途|房间|面积|型号|订单号)/iu.test(
			message,
		);
	if (looksLikeFollowUpAnswer) return true;

	const replyPairs = characterPairs(normalizeSearchText(state.lastReply));
	const messagePairs = characterPairs(normalizedMessage);
	return [...messagePairs].filter((pair) => replyPairs.has(pair)).length >= 2;
}

function bestKnowledgeTermMatch(
	normalizedMessage: string,
	knowledge: KnowledgeUnit,
): { score: number; reason: "exact" | "related" } | null {
	const terms = [
		...new Set(
			[...knowledge.scenarioKeywords, ...knowledge.applicableScenarios, knowledge.title]
				.flatMap(expandKnowledgeSearchTerm)
				.map(normalizeSearchText)
				.filter((term) => term.length >= 2),
		),
	];
	const exactTerms = terms.filter(
		(term) =>
			normalizedMessage.includes(term) ||
			(normalizedMessage.length >= 4 && term.includes(normalizedMessage)),
	);
	const hasSpecificExactTerm = exactTerms.some((term) => !WEAK_STANDALONE_TERMS.has(term));
	const exactScenarioKeywords = [
		...new Set(
			knowledge.scenarioKeywords
				.map(normalizeSearchText)
				.filter(
					(term) =>
						term.length >= 2 &&
						(normalizedMessage.includes(term) ||
							(normalizedMessage.length >= 4 && term.includes(normalizedMessage))) &&
						(!WEAK_STANDALONE_TERMS.has(term) || hasSpecificExactTerm),
				),
		),
	];
	let best: { score: number; reason: "exact" | "related" } | null = null;
	let acceptedExactMatches = 0;

	for (const term of terms) {
		const exact =
			normalizedMessage.includes(term) ||
			(normalizedMessage.length >= 4 && term.includes(normalizedMessage));
		if (exact && WEAK_STANDALONE_TERMS.has(term) && !hasSpecificExactTerm) {
			continue;
		}
		if (exact) acceptedExactMatches += 1;
		const candidate = exact
			? { score: 100 + Math.min(term.length * 4, 80), reason: "exact" as const }
			: relatedTextScore(normalizedMessage, term);
		if (candidate && (!best || candidate.score > best.score)) best = candidate;
	}
	if (best?.reason === "exact" && acceptedExactMatches > 1) {
		return {
			...best,
			score:
				best.score +
				Math.min((acceptedExactMatches - 1) * 15, 60) +
				Math.min(exactScenarioKeywords.length * 20, 60),
		};
	}
	if (best?.reason === "exact" && exactScenarioKeywords.length > 0) {
		return {
			...best,
			score: best.score + Math.min(exactScenarioKeywords.length * 20, 60),
		};
	}
	return best;
}

const WEAK_STANDALONE_TERMS = new Set(["保修", "人工客服"].map(normalizeSearchText));

function expandKnowledgeSearchTerm(value: string): string[] {
	const explicitProductTerms = value.match(/[A-Za-z][A-Za-z0-9]*(?:[- ][A-Za-z0-9]+)*/gu) ?? [];
	return [value, ...explicitProductTerms.filter((term) => normalizeSearchText(term).length >= 4)];
}

function relatedTextScore(
	message: string,
	term: string,
): { score: number; reason: "related" } | null {
	if (message.length < 4 || term.length < 4) return null;
	const messagePairs = characterPairs(message);
	const termPairs = characterPairs(term);
	const overlap = [...messagePairs].filter((pair) => termPairs.has(pair)).length;
	if (overlap < 2) return null;
	const similarity = (2 * overlap) / (messagePairs.size + termPairs.size);
	return similarity >= 0.45 ? { score: Math.round(similarity * 80), reason: "related" } : null;
}

function characterPairs(value: string): Set<string> {
	const pairs = new Set<string>();
	for (let index = 0; index < value.length - 1; index += 1) {
		pairs.add(value.slice(index, index + 2));
	}
	return pairs;
}

function normalizeSearchText(value: string): string {
	return value
		.normalize("NFKC")
		.toLocaleLowerCase()
		.replace(/[^\p{Letter}\p{Number}]+/gu, "");
}

function hasCurrentAdmissionEvidence(
	snapshot: XiaofeiWorkspaceSnapshot,
	requireEvalEvidence: boolean,
): boolean {
	if (!snapshot.capabilityPlan.reviewed || snapshot.capabilityPlan.status !== "review_ready") {
		return false;
	}
	if (
		requireEvalEvidence &&
		(snapshot.evalSuite.status !== "passed" ||
			snapshot.evalSuite.capabilityPlanVersion !== snapshot.capabilityPlan.version)
	) {
		return false;
	}
	const eligibleIds = snapshot.knowledgeUnits
		.filter(isKnowledgeUnitEligible)
		.map((unit) => unit.id);
	return (
		eligibleIds.length > 0 &&
		eligibleIds.length === snapshot.capabilityPlan.knowledgeUnitIds.length &&
		eligibleIds.every((id) => snapshot.capabilityPlan.knowledgeUnitIds.includes(id))
	);
}

function blockedAdmission(
	state: ConversationState,
	at: string,
	handoffReason: string,
	detail: string,
): PreparedTurn {
	return {
		state: withDecision(state, {
			knowledge: null,
			riskLevel: "medium",
			action: "handoff",
			handoffReason,
			at,
		}),
		knowledge: null,
		action: "handoff",
		riskLevel: "medium",
		reply: "当前知识能力尚未满足安全准入条件，我会把问题转交人工客服处理。",
		handoffReason,
		traces: [trace(state.id, "admission", at, "知识能力准入阻塞", detail)],
	};
}

function updateSlots(
	current: Record<string, SlotValue>,
	knowledge: KnowledgeUnit,
	message: string,
	at: string,
): Record<string, SlotValue> {
	const slots = { ...current };

	for (const required of knowledge.requiredSlots) {
		const value = inferSlotValue(required.key, required.label, message);
		const unavailable =
			/(没有|无法|不能|no\b|cannot|can't)/iu.test(message) &&
			(message.includes(required.label) || message.includes(required.key));

		if (value) {
			slots[required.key] = {
				label: required.label,
				status: "provided",
				value,
				evidence: message,
				updatedAt: at,
			};
		} else if (unavailable) {
			slots[required.key] = {
				label: required.label,
				status: "unavailable",
				evidence: message,
				updatedAt: at,
			};
		} else if (!slots[required.key]) {
			slots[required.key] = {
				label: required.label,
				status: "missing",
				updatedAt: at,
			};
		}
	}

	return slots;
}

function inferSlotValue(key: string, label: string, message: string): string | undefined {
	if (key.includes("order")) {
		return message.match(/\b[A-Z0-9-]{6,}\b/iu)?.[0];
	}
	if (key.includes("photo") || key.includes("image")) {
		return /(照片|图片|photo|image|attached|附件)/iu.test(message) ? "已提供照片/图片" : undefined;
	}
	if (/(device.*model|model|设备型号|机型|型号)/iu.test(`${key} ${label}`)) {
		return message.match(/\b[A-Z][A-Za-z0-9]*(?:[- ][A-Za-z0-9]+){1,3}\b/u)?.[0];
	}
	if (/(error|fault|code|故障码|错误码)/iu.test(`${key} ${label}`)) {
		return message.match(/\b[A-Z]{1,4}-?\d{1,5}\b/iu)?.[0];
	}
	return undefined;
}

function detectRisk(
	message: string,
	snapshot: XiaofeiWorkspaceSnapshot,
): { level: RiskLevel; reason?: string } {
	const normalized = message.toLocaleLowerCase();
	const alwaysEscalate =
		/(监管|投诉|起诉|律师|chargeback|complain|human agent|人工客服|真人客服|冒烟|起火|触电|漏液|强烈异味|异常高温)/iu;
	if (alwaysEscalate.test(message)) {
		return { level: "high", reason: "high_risk_or_human_request" };
	}
	const informationalQuestion =
		/(规则|条件|流程|政策|怎么|如何|多久|什么时候|能不能|是否|了解|咨询|请问|问一下|what|how|policy|process)/iu.test(
			message,
		);
	const directAction =
		/^(?:马上|立即|立刻)?(?:给我|帮我)?(?:退款|退货|赔偿|补发|取消订单|refund|return|compensation|replacement)[！!。.\s]*$/iu.test(
			message,
		);
	const forcefulAction =
		/(?:帮我|给我|必须|要求你们?|马上给我|立即给我|立刻给我).{0,12}(?:退款|退货|赔偿|补发|取消订单|refund|return|compensation|replacement)/iu.test(
			message,
		);
	const statedAction =
		!informationalQuestion &&
		/(?:我要|我需要|想要|want a|need a).{0,10}(?:退款|退货|赔偿|补发|取消订单|refund|return|compensation|replacement)/iu.test(
			message,
		);
	const actionRequest = directAction || forcefulAction || statedAction;
	if (actionRequest) {
		return { level: "high", reason: "high_risk_action_request" };
	}
	const match = snapshot.guardrails.handoffKeywords.find((keyword) =>
		normalized.includes(keyword.toLocaleLowerCase()),
	);
	if (
		match &&
		(alwaysEscalate.test(match) || /(冲突|不一致|无法核实)/u.test(match) || actionRequest)
	) {
		return { level: "high", reason: `handoff_keyword:${match}` };
	}
	return { level: "low" };
}

function validateReply(
	reply: string,
	snapshot: XiaofeiWorkspaceSnapshot,
	knowledge: KnowledgeUnit | null,
	requireKnowledge: boolean,
): string[] {
	if (!reply.trim()) return ["候选回复为空"];
	if (requireKnowledge && snapshot.guardrails.requireReleasedKnowledge && !knowledge) {
		return ["没有已发布 KnowledgeUnit"];
	}
	const forbidden = new Set([
		...snapshot.guardrails.forbiddenPhrases,
		...(knowledge?.forbiddenOutputs ?? []),
	]);
	return [...forbidden]
		.filter((phrase) => reply.toLocaleLowerCase().includes(phrase.toLocaleLowerCase()))
		.map((phrase) => `命中禁止输出：${phrase}`);
}

function trace(
	conversationId: string,
	type: TraceEvent["type"],
	at: string,
	title: string,
	detail?: string,
	payload?: Record<string, unknown>,
): TraceEvent {
	return {
		id: globalThis.crypto.randomUUID(),
		conversationId,
		at,
		type,
		title,
		detail,
		payload,
	};
}
