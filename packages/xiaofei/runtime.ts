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
	const knowledge = selectKnowledge(
		input.message,
		state,
		input.snapshot.knowledgeUnits.filter(
			(unit) => callableKnowledgeIds.has(unit.id) && isKnowledgeUnitEligible(unit),
		),
	);
	traces.push(
		trace(
			state.id,
			"knowledge",
			at,
			knowledge ? "命中 KnowledgeUnit" : "知识缺失",
			knowledge?.title ?? "没有可安全调用的已发布知识。",
			{ knowledgeId: knowledge?.id },
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
			reply: "这个问题需要人工客服处理。我已经记录您的诉求，并会转交人工继续核实。",
			handoffReason: risk.reason,
			traces,
		};
	}

	if (!knowledge) {
		return {
			state: withDecision(state, {
				knowledge: null,
				riskLevel: "medium",
				action: "handoff",
				handoffReason: "knowledge_missing",
				at,
			}),
			knowledge: null,
			action: "handoff",
			riskLevel: "medium",
			reply: "现有知识不足以安全回答，我会把问题转交人工客服核实。",
			handoffReason: "knowledge_missing",
			traces,
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
			reply: "需要的资料已经记录完整。我会转交人工客服核实，后续由人工确认处理结果。",
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
		reply =
			input.prepared.knowledge?.fallbackReply ?? "这个问题需要人工客服核实，我会转交人工继续处理。";
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
	},
): ConversationState {
	const stage =
		input.action === "handoff"
			? "ready_for_human"
			: input.action === "ask_followup"
				? "info_gathering"
				: "admission";

	return ConversationStateSchema.parse({
		...state,
		scenario: input.knowledge?.title ?? null,
		matchedKnowledgeId: input.knowledge?.id ?? null,
		slots: input.slots ?? state.slots,
		missingSlots: input.missingSlots ?? [],
		riskLevel: input.riskLevel,
		nextAction: input.action,
		stage,
		handoffReason: input.handoffReason,
		remainingFollowUps: input.remainingFollowUps ?? state.remainingFollowUps,
		updatedAt: input.at,
	});
}

function selectKnowledge(
	message: string,
	state: ConversationState,
	units: KnowledgeUnit[],
): KnowledgeUnit | null {
	const released = units.filter(isKnowledgeUnitEligible);
	const normalizedMessage = message.toLocaleLowerCase();
	const explicit = released.find((unit) =>
		unit.scenarioKeywords.some((keyword) =>
			normalizedMessage.includes(keyword.toLocaleLowerCase()),
		),
	);
	if (explicit) return explicit;
	return released.find((unit) => unit.id === state.matchedKnowledgeId) ?? null;
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
	const match = snapshot.guardrails.handoffKeywords.find((keyword) =>
		message.toLocaleLowerCase().includes(keyword.toLocaleLowerCase()),
	);
	if (match) return { level: "high", reason: `handoff_keyword:${match}` };
	if (/(监管|起诉|律师|chargeback|投诉|complain|human agent|人工客服)/iu.test(message)) {
		return { level: "high", reason: "high_risk_or_human_request" };
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
