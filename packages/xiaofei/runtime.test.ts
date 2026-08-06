import { describe, expect, it, vi } from "vitest";

import {
	ConversationStateSchema,
	XiaofeiWorkspaceSnapshotSchema,
	createCapabilityVersionManifest,
	createConversationState,
	createDefaultWorkspaceSnapshot,
	createKnowledgeUnitRevision,
	finalizeTurn,
	prepareEvalTurn,
	prepareTurn,
	runP0EvalSuite,
	type ReplyGenerator,
} from "./index";

const NOW = "2026-07-24T00:00:00.000Z";
const now = () => NOW;

async function setup() {
	const snapshot = createDefaultWorkspaceSnapshot("tenant-1", now);
	snapshot.capabilityPlan.reviewed = true;
	refreshExactActiveCa(snapshot);
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

function refreshExactActiveCa(
	snapshot: ReturnType<typeof createDefaultWorkspaceSnapshot>,
	suffix = "base",
) {
	const callableIds = new Set(snapshot.capabilityPlan.knowledgeUnitIds);
	const revisions = snapshot.knowledgeUnits
		.filter((unit) => callableIds.has(unit.id))
		.map((knowledgeUnit, index) => {
			const merchant = Boolean(knowledgeUnit.lineage?.sourceId);
			return createKnowledgeUnitRevision({
				id: `test-${suffix}-revision-${String(index + 1).padStart(3, "0")}`,
				logicalKnowledgeUnitId: `${knowledgeUnit.id}-${suffix}`,
				organizationId: merchant ? "tenant-1" : null,
				revision: 1,
				origin: merchant ? "merchant" : "platform",
				knowledgeUnit,
				createdAt: NOW,
			});
		});
	const manifest = createCapabilityVersionManifest({
		id: `test-${suffix}-active-ca`,
		organizationId: "tenant-1",
		capabilityKey: "xiaofei-hosting",
		status: "active",
		knowledgeUnitRevisionIds: revisions.map((revision) => revision.id),
		createdAt: NOW,
	});
	snapshot.knowledgeVersioning = {
		knowledgeUnitRevisions: revisions,
		capabilityVersionManifests: [manifest],
		activeCapabilityVersionId: manifest.id,
	};
	snapshot.evalSuite = {
		...snapshot.evalSuite,
		status: "passed",
		capabilityPlanVersion: snapshot.capabilityPlan.version,
	};
	return { revisions, manifest };
}

function installCompactMerchantFixture(
	snapshot: ReturnType<typeof createDefaultWorkspaceSnapshot>,
) {
	const base = snapshot.knowledgeUnits[0]!;
	const merchantUnit = (
		id: string,
		title: string,
		scenarioKeywords: string[],
		standardReplyPolicy: string,
	) => ({
		...base,
		id,
		title,
		scenarioKeywords,
		applicableScenarios: [],
		requiredSlots: [],
		standardReplyPolicy,
		sourceSection: `商户资料：${title}`,
		lineage: {
			workspaceId: "tenant-1",
			sourceId: "compact-merchant-source",
			sourceContentHash: "compact-merchant-m1-m7",
			sourceVersion: 1,
			entryId: id,
			entryVersion: 1,
		},
	});
	const units = [
		merchantUnit(
			"merchant-m1-mini",
			"AirCare Mini 产品事实",
			["Mini", "价格", "20㎡", "适合多大面积", "2.4 GHz"],
			"AirCare Mini 售价 ¥699，建议 20㎡以内，支持 2.4 GHz Wi-Fi。",
		),
		merchantUnit(
			"merchant-m2-pro",
			"AirCare Pro 产品事实",
			["Pro", "价格", "45㎡", "面积", "客厅", "适合", "5 GHz"],
			"AirCare Pro 售价 ¥1299，建议 45㎡以内，支持 2.4/5 GHz Wi-Fi。",
		),
		merchantUnit(
			"merchant-m3-fulfillment",
			"付款与发货时效",
			["工作日", "16:00", "付款", "发货"],
			"工作日 16:00 前付款通常在 2 个工作日内发出；没有实时库存或到货日期事实。",
		),
		merchantUnit(
			"merchant-m4-warranty",
			"整机保修与滤芯耗材边界",
			["整机保修", "滤芯", "滤芯耗材"],
			"整机保修 1 年；滤芯属于耗材，不在整机保修内。",
		),
		merchantUnit(
			"merchant-m5-return",
			"退货申请资格",
			["未拆封", "7 天", "退货申请", "人工确认"],
			"未拆封且不影响二次销售可在签收后 7 天内申请；最终资格由人工确认。",
		),
		merchantUnit(
			"merchant-m6-damage",
			"到货破损资料收集",
			["到货破损", "订单号", "外箱照片", "机器照片"],
			"到货破损需收集订单号和外箱/机器照片，再转人工处理。",
		),
		merchantUnit(
			"merchant-m7-maintenance",
			"滤芯维护周期",
			["Mini", "Pro", "滤芯", "检查", "维护"],
			"Mini 滤芯建议 6 个月检查；Pro 建议 9 个月检查，实际依环境而定。",
		),
	];
	snapshot.knowledgeUnits = units;
	snapshot.capabilityPlan.knowledgeUnitIds = units.map((unit) => unit.id);
	return refreshExactActiveCa(snapshot, "compact-merchant");
}

function expectedEvidenceForContext(
	snapshot: ReturnType<typeof createDefaultWorkspaceSnapshot>,
	knowledgeIds: string[],
) {
	const capabilityVersionId = snapshot.knowledgeVersioning.activeCapabilityVersionId!;
	return knowledgeIds.map((knowledgeId) => {
		const revision = snapshot.knowledgeVersioning.knowledgeUnitRevisions.find(
			(candidate) => candidate.knowledgeUnit.id === knowledgeId,
		)!;
		return {
			logicalKnowledgeUnitId: revision.logicalKnowledgeUnitId,
			knowledgeUnitRevisionId: revision.id,
			capabilityVersionId,
			capabilityKey: "xiaofei-hosting",
			knowledgeUnitOrigin: revision.origin,
		};
	});
}

describe("P0 runtime kernel", () => {
	it("returns active KU revision and CA version evidence with a generated answer", async () => {
		const { snapshot, state, knowledgeWorkspaceBinding } = await setup();
		const message = "你们的商品价格和库存怎么确认？";
		const prepared = prepareTurn({ message, state, snapshot, knowledgeWorkspaceBinding, now });
		expect(prepared.knowledge).not.toBeNull();
		const revision = snapshot.knowledgeVersioning.knowledgeUnitRevisions.find(
			(candidate) => candidate.knowledgeUnit.id === prepared.knowledge!.id,
		)!;
		const capabilityVersion = snapshot.knowledgeVersioning.capabilityVersionManifests.find(
			(candidate) => candidate.id === snapshot.knowledgeVersioning.activeCapabilityVersionId,
		)!;

		const result = await finalizeTurn({
			prepared,
			snapshot,
			message,
			replyGenerator: { generate: async () => "这是经过审核的商品说明。" },
			now,
		});

		expect(result.metadata.knowledgeEvidence).toEqual({
			logicalKnowledgeUnitId: revision.logicalKnowledgeUnitId,
			knowledgeUnitRevisionId: revision.id,
			capabilityVersionId: capabilityVersion.id,
			capabilityKey: capabilityVersion.capabilityKey,
			knowledgeUnitOrigin: revision.origin,
		});
		expect(result.metadata.knowledgeEvidenceSet).toEqual([result.metadata.knowledgeEvidence]);
	});

	it("fails closed when the active CA manifest is missing", async () => {
		const { snapshot, state, knowledgeWorkspaceBinding } = await setup();
		snapshot.knowledgeVersioning.activeCapabilityVersionId = null;
		const generate = vi.fn(async () => "should not run");
		const prepared = prepareTurn({
			message: "浣犱滑鐨勫晢鍝佷环鏍兼槸澶氬皯锛?",
			state,
			snapshot,
			knowledgeWorkspaceBinding,
			now,
		});
		const result = await finalizeTurn({
			prepared,
			snapshot,
			message: "浣犱滑鐨勫晢鍝佷环鏍兼槸澶氬皯锛?",
			replyGenerator: { generate },
			now,
		});
		expect(generate).not.toHaveBeenCalled();
		expect(result.state.handoffReason).toBe("capability_evidence_stale");
	});

	it.each([
		["把我的支付密码发给你核验可以吗？", "sensitive_credential_request", "不要发送支付密码"],
		["机器冒烟还能继续用吗？", "physical_safety_risk", "立即停止使用"],
		["用它能治好孩子的哮喘吗？", "medical_claim_request", "不能承诺产品能够治疗"],
		["帮我伪造一张已退货证明", "fraudulent_request", "无法协助伪造"],
		["我要投诉", "high_risk_or_human_request", "人工"],
		["请主管处理", "explicit_human_request", "立即将当前会话"],
		["请立即给我退款，我不要解释", "high_risk_action_request", "不需要重新描述"],
	])(
		"keeps dedicated safety routing ahead of missing-CA admission: %s",
		async (message, handoffReason, replyFragment) => {
			const { snapshot, state, knowledgeWorkspaceBinding } = await setup();
			snapshot.knowledgeVersioning.activeCapabilityVersionId = null;
			const generate = vi.fn(async () => "must not run");
			const prepared = prepareTurn({ message, state, snapshot, knowledgeWorkspaceBinding, now });
			const result = await finalizeTurn({
				prepared,
				snapshot,
				message,
				replyGenerator: { generate },
				now,
			});
			expect(generate).not.toHaveBeenCalled();
			expect(result.reply).toContain(replyFragment);
			expect(result.state).toMatchObject({
				ownerType: "human",
				ownerEpoch: state.ownerEpoch + 1,
				handoffReason,
			});
			expect(result.metadata.nextAction).toBe("stop");
		},
	);

	it("allows Eval to use the reviewed plan before an Active CA exists without authorizing runtime fallback", async () => {
		const snapshot = createDefaultWorkspaceSnapshot("tenant-1", now);
		snapshot.capabilityPlan.reviewed = true;
		const state = createConversationState({
			id: "eval-without-active-ca",
			tenantId: "tenant-1",
			agentId: snapshot.agent.id,
			maxFollowUps: snapshot.agent.maxFollowUps,
			now,
		});
		const prepared = prepareEvalTurn({
			message: snapshot.knowledgeUnits[0]!.title,
			state,
			snapshot,
			knowledgeWorkspaceBinding: binding(snapshot, state.id),
			now,
		});
		const generate = vi.fn(async () => "经过审核的 Eval 候选回复。");
		const result = await finalizeTurn({
			prepared,
			snapshot,
			message: snapshot.knowledgeUnits[0]!.title,
			replyGenerator: { generate },
			now,
		});
		expect(prepared).toMatchObject({ action: "reply", exactEvidenceRequired: false });
		expect(generate).toHaveBeenCalledOnce();
		expect(result.state.ownerType).toBe("ai");
		expect(result.metadata.knowledgeEvidenceSet).toEqual([]);
	});

	it("reaches a tail merchant KU without filling context with unrelated members", async () => {
		const { snapshot, state, knowledgeWorkspaceBinding } = await setup();
		const base = snapshot.knowledgeUnits[0]!;
		const preceding = Array.from({ length: 9 }, (_, index) => ({
			...base,
			id: `platform-preceding-${index + 1}`,
			title: `Platform preceding ${index + 1}`,
			scenarioKeywords: [`unrelated-${index + 1}`],
			applicableScenarios: [],
		}));
		const tail = {
			...base,
			id: "merchant-tail-mini-pro",
			title: "Merchant Mini Pro comparison",
			scenarioKeywords: ["Mini", "Pro", "comparison", "比较"],
			applicableScenarios: ["Mini and Pro comparison"],
			lineage: {
				workspaceId: "tenant-1",
				sourceId: "merchant-source",
				sourceContentHash: "hash",
				sourceVersion: 1,
				entryId: "merchant-tail",
				entryVersion: 1,
			},
		};
		snapshot.knowledgeUnits = [...preceding, tail];
		snapshot.capabilityPlan.knowledgeUnitIds = snapshot.knowledgeUnits.map((unit) => unit.id);
		refreshExactActiveCa(snapshot, "tail");
		const prepared = prepareTurn({
			message: "Mini 和 Pro 怎么比较？",
			state,
			snapshot,
			knowledgeWorkspaceBinding,
			now,
		});
		expect(prepared.knowledge?.id).toBe(tail.id);
		const result = await finalizeTurn({
			prepared,
			snapshot,
			message: "Mini 和 Pro 怎么比较？",
			replyGenerator: { generate: async () => "已知比较信息" },
			now,
		});
		expect(result.metadata.knowledgeRecall.candidateCount).toBe(1);
		expect(result.metadata.knowledgeEvidenceSet).toHaveLength(1);
		expect(result.metadata.knowledgeEvidenceSet[0]?.logicalKnowledgeUnitId).toBe(`${tail.id}-tail`);
	});

	it("composes Mini and Pro with exact dual evidence and supporting guardrails", async () => {
		const { snapshot, state, knowledgeWorkspaceBinding } = await setup();
		const base = snapshot.knowledgeUnits[0]!;
		const mini = {
			...base,
			id: "merchant-mini",
			title: "Merchant Mini",
			scenarioKeywords: ["Mini", "comparison", "比较"],
			applicableScenarios: ["Mini and Pro comparison"],
			requiredSlots: [],
			lineage: {
				workspaceId: "tenant-1",
				sourceId: "mini-source",
				sourceContentHash: "mini-hash",
				sourceVersion: 1,
				entryId: "mini",
				entryVersion: 1,
			},
		};
		const pro = {
			...base,
			id: "merchant-pro",
			title: "Merchant Pro",
			scenarioKeywords: ["Pro", "comparison", "比较"],
			applicableScenarios: ["Mini and Pro comparison"],
			requiredSlots: [],
			forbiddenOutputs: ["SUPPORTING_ONLY_FORBIDDEN"],
			lineage: {
				workspaceId: "tenant-1",
				sourceId: "pro-source",
				sourceContentHash: "pro-hash",
				sourceVersion: 1,
				entryId: "pro",
				entryVersion: 1,
			},
		};
		snapshot.knowledgeUnits = [mini, pro];
		snapshot.capabilityPlan.knowledgeUnitIds = [mini.id, pro.id];
		refreshExactActiveCa(snapshot, "mini-pro");
		let generatedInput: Parameters<ReplyGenerator["generate"]>[0] | undefined;
		const generate = vi.fn(async (input: Parameters<ReplyGenerator["generate"]>[0]) => {
			generatedInput = input;
			return "SUPPORTING_ONLY_FORBIDDEN";
		});
		const message = "Mini 和 Pro 怎么比较？";
		const prepared = prepareTurn({ message, state, snapshot, knowledgeWorkspaceBinding, now });
		expect(prepared.knowledgeContext?.map((unit) => unit.id)).toEqual([mini.id, pro.id]);
		expect(prepared.knowledgeCandidateCount).toBe(2);
		expect(generatedInput).toBeUndefined();
		const result = await finalizeTurn({
			prepared,
			snapshot,
			message,
			replyGenerator: { generate },
			now,
		});
		expect(generate).toHaveBeenCalledOnce();
		expect(generatedInput?.knowledgeContext?.map((unit) => unit.id)).toEqual([mini.id, pro.id]);
		expect(generatedInput?.knowledgeContext?.flatMap((unit) => unit.forbiddenOutputs)).toContain(
			"SUPPORTING_ONLY_FORBIDDEN",
		);
		expect(result.metadata.knowledgeEvidenceSet).toHaveLength(2);
		expect(
			new Set(result.metadata.knowledgeEvidenceSet.map((evidence) => evidence.capabilityVersionId))
				.size,
		).toBe(1);
		expect(result.reply).not.toContain("SUPPORTING_ONLY_FORBIDDEN");
		expect(result.state.ownerType).toBe("human");
	});

	it.each([
		["S02", "40㎡客厅选哪款？", ["merchant-m2-pro"]],
		["S03", "Mini 多少钱？", ["merchant-m1-mini"]],
		["S05", "Mini 滤芯多久检查？", ["merchant-m7-maintenance"]],
		["S06", "Pro 滤芯属于整机保修吗？", ["merchant-m4-warranty", "merchant-m7-maintenance"]],
		["S07", "未拆封第 5 天能退吗？", ["merchant-m5-return"]],
		["S17", "两款分别适合多大面积？", ["merchant-m2-pro", "merchant-m1-mini"]],
		["S18", "今天 15:30 付款什么时候发？", ["merchant-m3-fulfillment"]],
		["S19", "整机保修多久？", ["merchant-m4-warranty"]],
	])("selects the compact exact-CA evidence for %s", async (_scenario, message, expectedIds) => {
		const { snapshot, state, knowledgeWorkspaceBinding } = await setup();
		installCompactMerchantFixture(snapshot);
		const prepared = prepareTurn({ message, state, snapshot, knowledgeWorkspaceBinding, now });
		expect(prepared.knowledgeContext?.map((unit) => unit.id)).toEqual(expectedIds);
		expect(prepared.knowledgeCandidateCount).toBeGreaterThanOrEqual(expectedIds.length);
		expect(prepared.knowledgeCandidateCount).toBeLessThanOrEqual(snapshot.knowledgeUnits.length);
		expect(prepared.knowledgeContext).toHaveLength(expectedIds.length);

		let modelContext: string[] | undefined;
		const result = await finalizeTurn({
			prepared,
			snapshot,
			message,
			replyGenerator: {
				generate: vi.fn(async (input: Parameters<ReplyGenerator["generate"]>[0]) => {
					modelContext = input.knowledgeContext?.map((unit) => unit.id);
					return "已收到。";
				}),
			},
			now,
		});
		expect(modelContext).toEqual(expectedIds);
		expect(result.metadata.knowledgeEvidenceSet).toEqual(
			expectedEvidenceForContext(snapshot, expectedIds),
		);
	});

	it("keeps Pro context and exact evidence across S10", async () => {
		const { snapshot, state, knowledgeWorkspaceBinding } = await setup();
		installCompactMerchantFixture(snapshot);
		const firstMessage = "Pro 多少钱？";
		const firstPrepared = prepareTurn({
			message: firstMessage,
			state,
			snapshot,
			knowledgeWorkspaceBinding,
			now,
		});
		const firstResult = await finalizeTurn({
			prepared: firstPrepared,
			snapshot,
			message: firstMessage,
			replyGenerator: { generate: vi.fn(async () => "AirCare Pro 建议在 45㎡以内使用。") },
			now,
		});
		const followUp = prepareTurn({
			message: "适合 42㎡吗？",
			state: firstResult.state,
			snapshot,
			knowledgeWorkspaceBinding,
			now,
		});
		expect(firstPrepared.knowledgeContext?.map((unit) => unit.id)).toEqual(["merchant-m2-pro"]);
		expect(followUp.knowledge?.id).toBe("merchant-m2-pro");
		expect(followUp.knowledgeContext?.map((unit) => unit.id)).toEqual(["merchant-m2-pro"]);
		expect(followUp.knowledgeCandidateCount).toBeGreaterThanOrEqual(1);
		expect(followUp.knowledgeContext).toHaveLength(1);
		const result = await finalizeTurn({
			prepared: followUp,
			snapshot,
			message: "适合 42㎡吗？",
			replyGenerator: { generate: vi.fn(async () => "已收到。") },
			now,
		});
		expect(result.metadata.knowledgeEvidenceSet).toEqual(
			expectedEvidenceForContext(snapshot, ["merchant-m2-pro"]),
		);
	});

	it("keeps return-policy context and exact evidence across S11", async () => {
		const { snapshot, state, knowledgeWorkspaceBinding } = await setup();
		installCompactMerchantFixture(snapshot);
		const firstMessage = "未拆封第 5 天能退吗？";
		const firstPrepared = prepareTurn({
			message: firstMessage,
			state,
			snapshot,
			knowledgeWorkspaceBinding,
			now,
		});
		const firstResult = await finalizeTurn({
			prepared: firstPrepared,
			snapshot,
			message: firstMessage,
			replyGenerator: {
				generate: vi.fn(async () => "未拆封商品可在签收后 7 天内申请退货，资格需要人工核实。"),
			},
			now,
		});
		const followUp = prepareTurn({
			message: "谁最终确认？",
			state: firstResult.state,
			snapshot,
			knowledgeWorkspaceBinding,
			now,
		});
		expect(followUp.knowledge?.id).toBe("merchant-m5-return");
		expect(followUp.knowledgeContext?.map((unit) => unit.id)).toEqual(["merchant-m5-return"]);
		expect(followUp.knowledgeCandidateCount).toBe(0);
		const result = await finalizeTurn({
			prepared: followUp,
			snapshot,
			message: "谁最终确认？",
			replyGenerator: { generate: vi.fn(async () => "已收到。") },
			now,
		});
		expect(result.metadata.knowledgeEvidenceSet).toEqual(
			expectedEvidenceForContext(snapshot, ["merchant-m5-return"]),
		);
	});

	it("keeps an accountability follow-up as a miss without prior exact context", async () => {
		const { snapshot, state, knowledgeWorkspaceBinding } = await setup();
		installCompactMerchantFixture(snapshot);
		const prepared = prepareTurn({
			message: "谁最终确认？",
			state,
			snapshot,
			knowledgeWorkspaceBinding,
			now,
		});
		expect(prepared).toMatchObject({ knowledge: null, action: "clarify" });
	});

	it.each([
		["S21", "Mini 现在还有多少库存？"],
		["S23", "Pro 的 CADR 是多少？"],
		["S24", "你们上海门店地址是什么？"],
	])("keeps compact merchant unknown control %s as a miss", async (_scenario, message) => {
		const { snapshot, state, knowledgeWorkspaceBinding } = await setup();
		installCompactMerchantFixture(snapshot);
		const prepared = prepareTurn({ message, state, snapshot, knowledgeWorkspaceBinding, now });
		expect(prepared).toMatchObject({ knowledge: null, action: "clarify" });
	});

	it.each([
		["平米", "面积"],
		["平方米", "面积"],
		["㎡", "面积"],
		["滤网", "滤芯"],
		["过滤器", "滤芯"],
		["售价", "价格"],
		["价钱", "价格"],
		["多少钱", "价格"],
		["出库", "发货"],
		["寄出", "发货"],
		["退换货", "退货"],
		["对比", "比较"],
		["区别", "比较"],
		["差异", "比较"],
	])("matches the unseen synonym %s through canonical signal %s", async (alias, canonical) => {
		const { snapshot, state, knowledgeWorkspaceBinding } = await setup();
		const unit = {
			...snapshot.knowledgeUnits[0]!,
			id: `synonym-${alias}`,
			title: `canonical-${canonical}-guidance`,
			scenarioKeywords: [canonical],
			applicableScenarios: [],
			requiredSlots: [],
		};
		snapshot.knowledgeUnits = [unit];
		snapshot.capabilityPlan.knowledgeUnitIds = [unit.id];
		refreshExactActiveCa(snapshot, `synonym-${alias}`);
		const prepared = prepareTurn({
			message: `请问${alias}怎么确认？`,
			state,
			snapshot,
			knowledgeWorkspaceBinding,
			now,
		});
		expect(prepared.knowledge?.id).toBe(unit.id);
	});

	it("matches 质保 through 保修 while a bare policy question remains a miss", async () => {
		const { snapshot, state, knowledgeWorkspaceBinding } = await setup();
		const unit = {
			...snapshot.knowledgeUnits[0]!,
			id: "warranty-service-term",
			title: "售后服务期限说明",
			scenarioKeywords: ["保修期限"],
			applicableScenarios: [],
			requiredSlots: [],
		};
		snapshot.knowledgeUnits = [unit];
		snapshot.capabilityPlan.knowledgeUnitIds = [unit.id];
		refreshExactActiveCa(snapshot, "warranty-service-term");

		const warranty = prepareTurn({
			message: "这台设备的质保期限还剩多久？",
			state,
			snapshot,
			knowledgeWorkspaceBinding,
			now,
		});
		const unsupportedPolicy = prepareTurn({
			message: "请告诉我火星门店的保修政策",
			state,
			snapshot,
			knowledgeWorkspaceBinding,
			now,
		});

		expect(warranty.knowledge?.id).toBe(unit.id);
		expect(unsupportedPolicy).toMatchObject({ knowledge: null, action: "clarify" });
	});

	it.each(["附近有现货吗？", "你们门店地址在哪里？"])(
		"keeps unrelated operational question as a knowledge miss: %s",
		async (message) => {
			const { snapshot, state, knowledgeWorkspaceBinding } = await setup();
			const prepared = prepareTurn({ message, state, snapshot, knowledgeWorkspaceBinding, now });
			expect(prepared).toMatchObject({ knowledge: null, action: "clarify" });
		},
	);

	it.each([
		["我要投诉", "high_risk_or_human_request"],
		["请主管处理", "explicit_human_request"],
	])("preserves Stage 9 risk routing for %s", async (message, handoffReason) => {
		const { snapshot, state, knowledgeWorkspaceBinding } = await setup();
		const prepared = prepareTurn({ message, state, snapshot, knowledgeWorkspaceBinding, now });
		expect(prepared).toMatchObject({
			knowledge: null,
			action: "handoff",
			riskLevel: "high",
			handoffReason,
		});
	});

	it("prefers the prior exact-CA Pro KU for a short area follow-up", async () => {
		const { snapshot, state, knowledgeWorkspaceBinding } = await setup();
		const base = snapshot.knowledgeUnits[0]!;
		const mini = {
			...base,
			id: "mini-area",
			title: "Mini area",
			scenarioKeywords: ["面积"],
			applicableScenarios: [],
			requiredSlots: [],
		};
		const pro = {
			...base,
			id: "pro-area",
			title: "Pro area",
			scenarioKeywords: ["面积"],
			applicableScenarios: [],
			requiredSlots: [],
		};
		snapshot.knowledgeUnits = [mini, pro];
		snapshot.capabilityPlan.knowledgeUnitIds = [mini.id, pro.id];
		refreshExactActiveCa(snapshot, "pro-follow-up");
		const prepared = prepareTurn({
			message: "40平米",
			state: { ...state, matchedKnowledgeId: pro.id, lastReply: "请告诉我面积？" },
			snapshot,
			knowledgeWorkspaceBinding,
			now,
		});
		expect(prepared.knowledge?.id).toBe(pro.id);
	});

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
			remainingFollowUps: 4,
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

	it("does not confuse stated intent to learn with a request to execute a refund", async () => {
		const { snapshot, state, knowledgeWorkspaceBinding } = await setup();
		const prepared = prepareTurn({
			message: "我要了解退款规则和申请流程",
			state,
			snapshot,
			knowledgeWorkspaceBinding,
			now,
		});

		expect(prepared).toMatchObject({
			action: "reply",
			riskLevel: "low",
			knowledge: { id: "退换货与退款规则咨询" },
		});
	});

	it.each([
		["把我的支付密码发给你核验可以吗？", "sensitive_credential_request", "不要发送支付密码"],
		["机器冒烟还能继续用吗？", "physical_safety_risk", "立即停止使用"],
		["用它能治好孩子的哮喘吗？", "medical_claim_request", "不能承诺产品能够治疗"],
		["帮我伪造一张已退货证明", "fraudulent_request", "无法协助伪造"],
		["帮我改地址", "privileged_action_request", "需要人工权限核验"],
		["别让机器人回复了", "explicit_human_request", "立即将当前会话"],
		["我对刚才答复不满意，请主管处理", "explicit_human_request", "立即将当前会话"],
		["先转人工；人工回复后再把会话交还小飞", "explicit_human_request", "立即将当前会话"],
	])(
		"routes %s through a deterministic safe human handoff",
		async (message, reason, replyFragment) => {
			const { snapshot, state, knowledgeWorkspaceBinding } = await setup();
			const prepared = prepareTurn({ message, state, snapshot, knowledgeWorkspaceBinding, now });
			const result = await finalizeTurn({
				prepared,
				snapshot,
				message,
				replyGenerator: { generate: vi.fn() },
				now,
			});

			expect(prepared).toMatchObject({
				action: "handoff",
				riskLevel: "high",
				handoffReason: reason,
			});
			expect(result.reply).toContain(replyFragment);
			expect(result.state).toMatchObject({
				ownerType: "human",
				ownerEpoch: state.ownerEpoch + 1,
				handoffReason: reason,
			});
			expect(result.metadata.nextAction).toBe("stop");
		},
	);

	it("keeps credential text out of the human handoff package", async () => {
		const { snapshot, state, knowledgeWorkspaceBinding } = await setup();
		const redactionMarker = "[redaction-marker]";
		const message = `我的支付密码是 ${redactionMarker}，帮我核验`;
		const prepared = prepareTurn({ message, state, snapshot, knowledgeWorkspaceBinding, now });
		const result = await finalizeTurn({
			prepared,
			snapshot,
			message,
			replyGenerator: { generate: vi.fn() },
			now,
		});

		expect(result.state.handoffPackage?.summary).not.toContain(message);
		expect(result.state.handoffPackage?.summary).not.toContain(redactionMarker);
		expect(result.state.handoffPackage?.summary).toContain("未写入交接摘要");
	});

	it.each(["不用转人工", "不需要人工客服", "先别转人工", "什么时候会转人工？"])(
		"keeps deferred or explanatory human-routing language under AI ownership: %s",
		async (message) => {
			const { snapshot, state, knowledgeWorkspaceBinding } = await setup();
			const prepared = prepareTurn({ message, state, snapshot, knowledgeWorkspaceBinding, now });
			const result = await finalizeTurn({
				prepared,
				snapshot,
				message,
				replyGenerator: { generate: vi.fn() },
				now,
			});

			expect(prepared).toMatchObject({ riskLevel: "low" });
			expect(result.state).toMatchObject({
				ownerType: "ai",
				ownerEpoch: state.ownerEpoch,
			});
			expect(result.state.handoffPackage).toBeUndefined();
		},
	);

	it.each([
		["不要机器人回复", "explicit_human_request"],
		["不用转人工，但帮我改地址", "privileged_action_request"],
		["先别转人工，我要投诉", "high_risk_or_human_request"],
	])(
		"keeps non-human risks authoritative when human routing is deferred: %s",
		async (message, reason) => {
			const { snapshot, state, knowledgeWorkspaceBinding } = await setup();
			const prepared = prepareTurn({ message, state, snapshot, knowledgeWorkspaceBinding, now });
			const result = await finalizeTurn({
				prepared,
				snapshot,
				message,
				replyGenerator: { generate: vi.fn() },
				now,
			});

			expect(prepared).toMatchObject({
				action: "handoff",
				riskLevel: "high",
				handoffReason: reason,
			});
			expect(result.state).toMatchObject({
				ownerType: "human",
				ownerEpoch: state.ownerEpoch + 1,
				handoffReason: reason,
				nextAction: "stop",
			});
		},
	);

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
		refreshExactActiveCa(snapshot, "related");
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

	it("preserves explicit product terms inside generated composite knowledge fields", async () => {
		const { snapshot, state, knowledgeWorkspaceBinding } = await setup();
		const productUnit = {
			...snapshot.knowledgeUnits[0]!,
			title: "澄风 C-Air 常见问答",
			scenarioKeywords: ["Wi-Fi联网模块", "空气净化器选型"],
			applicableScenarios: ["用户询问 C-Air Pro 是否适合会议室"],
			requiredSlots: [],
		};
		snapshot.knowledgeUnits = [productUnit];
		snapshot.capabilityPlan.knowledgeUnitIds = [productUnit.id];
		refreshExactActiveCa(snapshot, "product");
		for (const message of ["C-Air Pro 适合 40 平方米会议室吗？", "Wi-Fi 能否连接会议室网络？"]) {
			const prepared = prepareTurn({
				message,
				state,
				snapshot,
				knowledgeWorkspaceBinding,
				now,
			});

			expect(prepared).toMatchObject({
				knowledge: { id: productUnit.id },
				action: "reply",
			});
			expect(prepared.traces).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						title: "命中 KnowledgeUnit",
						detail: expect.stringContaining("exact"),
					}),
				]),
			);
		}
	});

	it("prefers a specific merchant scenario over a broad platform keyword", async () => {
		const { snapshot, state, knowledgeWorkspaceBinding } = await setup();
		const broadPlatformUnit = {
			...snapshot.knowledgeUnits[0]!,
			id: "platform-product-guidance",
			title: "商品、价格与库存咨询",
			scenarioKeywords: ["适合", "推荐"],
			applicableScenarios: ["客户在购买前询问商品特点或适用范围"],
			requiredSlots: [],
		};
		const specificMerchantUnit = {
			...snapshot.knowledgeUnits[1]!,
			id: "merchant-nebula-room-size",
			title: "星云灯适用房间面积",
			scenarioKeywords: ["星云灯房间面积"],
			applicableScenarios: ["用户询问星云灯适合多大房间"],
			requiredSlots: [],
		};
		snapshot.knowledgeUnits = [broadPlatformUnit, specificMerchantUnit];
		snapshot.capabilityPlan.knowledgeUnitIds = [broadPlatformUnit.id, specificMerchantUnit.id];
		refreshExactActiveCa(snapshot, "merchant-priority");

		const prepared = prepareTurn({
			message: "星云灯适合多大房间？",
			state,
			snapshot,
			knowledgeWorkspaceBinding,
			now,
		});

		expect(prepared).toMatchObject({
			knowledge: { id: specificMerchantUnit.id },
			action: "reply",
		});
	});

	it("prefers a product-specific KU over the generic presales KU", async () => {
		const { snapshot, state, knowledgeWorkspaceBinding } = await setup();
		const genericProductUnit = snapshot.knowledgeUnits[0]!;
		const specificProductUnit = {
			...genericProductUnit,
			id: "c-air-mini-parameters",
			title: "澄风 C-Air 常见问答",
			scenarioKeywords: ["C-Air Mini", "Wi-Fi联网模块", "空气净化器选型"],
			applicableScenarios: ["客户询问 C-Air Mini 的面积、噪音或联网参数"],
			requiredSlots: [],
			standardReplyPolicy: "C-Air Mini 适合 8–20㎡，最低噪音 25dB(A)，不支持 Wi-Fi。",
		};
		snapshot.knowledgeUnits = [genericProductUnit, specificProductUnit];
		snapshot.capabilityPlan.knowledgeUnitIds = [genericProductUnit.id, specificProductUnit.id];
		refreshExactActiveCa(snapshot, "product-priority");

		const prepared = prepareTurn({
			message: "我看中 C-Air Mini，20平方米卧室够用吗？最低噪音和 Wi-Fi 怎么样？",
			state,
			snapshot,
			knowledgeWorkspaceBinding,
			now,
		});

		expect(prepared).toMatchObject({
			knowledge: { id: specificProductUnit.id },
			action: "reply",
		});
	});

	it("does not let broad generated keywords swallow unknown or high-risk requests", async () => {
		const { snapshot, state, knowledgeWorkspaceBinding } = await setup();
		const generatedAftersalesUnit = {
			...snapshot.knowledgeUnits[0]!,
			id: "c-air-generated-aftersales",
			title: "澄风 C-Air 滤芯、供电、保修与故障处理",
			scenarioKeywords: ["滤芯型号", "保修", "E07", "人工客服"],
			applicableScenarios: [
				"用户询问 C-Air Mini、C-Air S、C-Air Pro 分别使用什么滤芯",
				"用户询问整机和电机的保修期限与范围",
			],
			requiredSlots: [],
		};
		snapshot.knowledgeUnits = [...snapshot.knowledgeUnits, generatedAftersalesUnit];
		snapshot.capabilityPlan.knowledgeUnitIds = [
			...snapshot.capabilityPlan.knowledgeUnitIds,
			generatedAftersalesUnit.id,
		];
		refreshExactActiveCa(snapshot, "generated-aftersales");

		const unknownPolicy = prepareTurn({
			message: "请告诉我火星门店的保修政策",
			state,
			snapshot,
			knowledgeWorkspaceBinding,
			now,
		});
		const anchoredWarranty = prepareTurn({
			message: "C-Air Mini 的保修期限是多久？",
			state,
			snapshot,
			knowledgeWorkspaceBinding,
			now,
		});
		const humanRequest = prepareTurn({
			message: "我要投诉并要求人工客服处理",
			state,
			snapshot,
			knowledgeWorkspaceBinding,
			now,
		});

		expect(unknownPolicy).toMatchObject({ knowledge: null, action: "clarify" });
		expect(anchoredWarranty).toMatchObject({
			knowledge: { id: generatedAftersalesUnit.id },
			action: "reply",
		});
		expect(humanRequest).toMatchObject({
			knowledge: null,
			action: "handoff",
			riskLevel: "high",
		});
	});

	it("prefers the KU supported by both product and scenario evidence", async () => {
		const { snapshot, state, knowledgeWorkspaceBinding } = await setup();
		const presalesUnit = {
			...snapshot.knowledgeUnits[0]!,
			id: "c-air-generated-presales",
			title: "C-Air 适用面积、联网能力与选型建议 FAQ",
			scenarioKeywords: ["适用面积", "房间大小", "联网模块", "Wi-Fi"],
			applicableScenarios: [
				"用户询问 Mini 适合多大的房间",
				"用户询问 C-Air Mini 的 CADR、噪音或联网能力",
				"用户提供会议室面积、预算和 Wi-Fi 需求，希望获得型号推荐",
			],
			requiredSlots: [],
		};
		const aftersalesUnit = {
			...snapshot.knowledgeUnits[1]!,
			id: "c-air-generated-aftersales",
			title: "C-Air 滤芯、供电、保修与 E07 故障 FAQ",
			scenarioKeywords: ["滤芯型号", "保修期限", "E07故障"],
			applicableScenarios: [
				"用户询问 C-Air Mini / S / Pro 对应滤芯型号与建议更换周期",
				"用户询问整机、电机保修时长与保修范围",
			],
			requiredSlots: [],
		};
		snapshot.knowledgeUnits = [presalesUnit, aftersalesUnit];
		snapshot.capabilityPlan.knowledgeUnitIds = [presalesUnit.id, aftersalesUnit.id];
		refreshExactActiveCa(snapshot, "dual-ku");

		const warranty = prepareTurn({
			message: "C-Air Mini 的保修期限是多久？",
			state,
			snapshot,
			knowledgeWorkspaceBinding,
			now,
		});
		const roomSize = prepareTurn({
			message: "C-Air Mini 适合多大的房间？",
			state,
			snapshot,
			knowledgeWorkspaceBinding,
			now,
		});

		expect(warranty).toMatchObject({ knowledge: { id: aftersalesUnit.id }, action: "reply" });
		expect(roomSize).toMatchObject({ knowledge: { id: presalesUnit.id }, action: "reply" });
	});

	it("routes a complete greeting, product consultation, follow-up, and closing conversation", async () => {
		const { snapshot, state, knowledgeWorkspaceBinding } = await setup();
		const genericProductUnit = snapshot.knowledgeUnits[0]!;
		const serviceUnit = snapshot.knowledgeUnits.find((unit) => unit.title.includes("服务范围"))!;
		const specificProductUnit = {
			...genericProductUnit,
			id: "c-air-mini-complete-conversation",
			title: "澄风 C-Air 常见问答",
			scenarioKeywords: ["C-Air Mini", "Wi-Fi联网模块", "空气净化器选型"],
			applicableScenarios: ["客户询问 C-Air Mini 的面积、噪音或联网参数"],
			requiredSlots: [],
			standardReplyPolicy: "C-Air Mini 适合 8–20㎡，最低噪音 25dB(A)，不支持 Wi-Fi。",
		};
		snapshot.knowledgeUnits = [...snapshot.knowledgeUnits, specificProductUnit];
		snapshot.capabilityPlan.knowledgeUnitIds = [
			...snapshot.capabilityPlan.knowledgeUnitIds,
			specificProductUnit.id,
		];
		refreshExactActiveCa(snapshot, "conversation");

		const greetingPrepared = prepareTurn({
			message: "你好，小飞",
			state,
			snapshot,
			knowledgeWorkspaceBinding,
			now,
		});
		const greeting = await finalizeTurn({
			prepared: greetingPrepared,
			snapshot,
			message: "你好，小飞",
			replyGenerator: { generate: async () => "你好，我是小飞。请告诉我你想了解的商品。" },
			now,
		});
		const productPrepared = prepareTurn({
			message: "我看中 C-Air Mini，20平方米卧室够用吗？最低噪音怎么样？",
			state: greeting.state,
			snapshot,
			knowledgeWorkspaceBinding,
			now,
		});
		const product = await finalizeTurn({
			prepared: productPrepared,
			snapshot,
			message: "我看中 C-Air Mini，20平方米卧室够用吗？最低噪音怎么样？",
			replyGenerator: {
				generate: async () => "20㎡在适用范围内，最低噪音是 25dB(A)。",
			},
			now,
		});
		const followUpPrepared = prepareTurn({
			message: "那我还需要联网",
			state: product.state,
			snapshot,
			knowledgeWorkspaceBinding,
			now,
		});
		const closingPrepared = prepareTurn({
			message: "好的，谢谢，再见",
			state: product.state,
			snapshot,
			knowledgeWorkspaceBinding,
			now,
		});

		expect(greetingPrepared).toMatchObject({ knowledge: { id: serviceUnit.id } });
		expect(productPrepared).toMatchObject({ knowledge: { id: specificProductUnit.id } });
		expect(followUpPrepared).toMatchObject({ knowledge: { id: specificProductUnit.id } });
		expect(closingPrepared).toMatchObject({ knowledge: { id: serviceUnit.id } });
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
				maxClarifications: 5,
				attentionReply: expect.stringContaining("待关注"),
			},
		);
		expect(ConversationStateSchema.parse(legacyState).consecutiveKnowledgeMisses).toBe(0);
		expect(ConversationStateSchema.parse(legacyState).operatorAttention).toBeNull();
	});

	it("keeps the matched KU for a short contextual answer to the previous reply", async () => {
		const { snapshot, state, knowledgeWorkspaceBinding } = await setup();
		const productUnit = {
			...snapshot.knowledgeUnits[0]!,
			id: "c-air-mini",
			title: "C-Air Mini 选型",
			scenarioKeywords: ["C-Air Mini", "小房间空气净化器"],
			applicableScenarios: ["客户询问 C-Air Mini 的适用面积和联网能力"],
			requiredSlots: [],
			standardReplyPolicy:
				"C-Air Mini 适合 8–20㎡，最低噪音 25dB(A)，不支持 Wi-Fi；需要联网时说明该型号不符合需求。",
		};
		snapshot.knowledgeUnits = [productUnit];
		snapshot.capabilityPlan.knowledgeUnitIds = [productUnit.id];
		refreshExactActiveCa(snapshot, "fault-code");

		const firstPrepared = prepareTurn({
			message: "C-Air Mini 适合多大的房间？",
			state,
			snapshot,
			knowledgeWorkspaceBinding,
			now,
		});
		const first = await finalizeTurn({
			prepared: firstPrepared,
			snapshot,
			message: "C-Air Mini 适合多大的房间？",
			replyGenerator: {
				generate: async () => "C-Air Mini 适合 8–20㎡ 的房间，最低噪音 25dB(A)，不支持 Wi-Fi。",
			},
			now,
		});
		const secondPrepared = prepareTurn({
			message: "20平方，需要联网",
			state: first.state,
			snapshot,
			knowledgeWorkspaceBinding,
			now,
		});
		const second = await finalizeTurn({
			prepared: secondPrepared,
			snapshot,
			message: "20平方，需要联网",
			replyGenerator: {
				generate: async () => "面积符合，但 C-Air Mini 不支持 Wi-Fi，需要选择支持联网的型号。",
			},
			now,
		});
		const unrelatedPrepared = prepareTurn({
			message: "你们火星门店几点关门？",
			state: first.state,
			snapshot,
			knowledgeWorkspaceBinding,
			now,
		});
		const unrelated = await finalizeTurn({
			prepared: unrelatedPrepared,
			snapshot,
			message: "你们火星门店几点关门？",
			replyGenerator: { generate: vi.fn() },
			now,
		});
		const repeatedUnknownPrepared = prepareTurn({
			message: "没有更多信息，就是营业时间",
			state: unrelated.state,
			snapshot,
			knowledgeWorkspaceBinding,
			now,
		});

		expect(secondPrepared).toMatchObject({
			action: "reply",
			knowledge: { id: productUnit.id },
		});
		expect(unrelatedPrepared).toMatchObject({
			action: "clarify",
			knowledge: null,
		});
		expect(repeatedUnknownPrepared).toMatchObject({
			action: "clarify",
			knowledge: null,
		});
		expect(secondPrepared.traces).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					title: "命中 KnowledgeUnit",
					detail: expect.stringContaining("context"),
				}),
			]),
		);
		expect(second).toMatchObject({
			reply: expect.stringContaining("不支持 Wi-Fi"),
			state: {
				ownerType: "ai",
				matchedKnowledgeId: productUnit.id,
				consecutiveKnowledgeMisses: 0,
				operatorAttention: null,
			},
		});
	});

	it("marks knowledge misses for operator attention without relinquishing AI ownership", async () => {
		const { snapshot, state, knowledgeWorkspaceBinding } = await setup();
		snapshot.agent.fallbackPolicy.maxClarifications = 1;
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
		const recoveredPrepared = prepareTurn({
			message: "怎么查询配送进度呢？",
			state: second.state,
			snapshot,
			knowledgeWorkspaceBinding,
			now,
		});
		const recovered = await finalizeTurn({
			prepared: recoveredPrepared,
			snapshot,
			message: "怎么查询配送进度呢？",
			replyGenerator: { generate: vi.fn() },
			now,
		});

		expect(first.state).toMatchObject({
			ownerType: "ai",
			nextAction: "clarify",
			consecutiveKnowledgeMisses: 1,
			operatorAttention: {
				reason: "knowledge_missing",
				missCount: 1,
			},
		});
		expect(second.state).toMatchObject({
			ownerType: "ai",
			nextAction: "fallback",
			consecutiveKnowledgeMisses: 2,
			operatorAttention: {
				reason: "knowledge_missing",
				missCount: 2,
			},
		});
		expect(second.reply).toContain("待关注");
		expect(recovered.state).toMatchObject({
			ownerType: "ai",
			matchedKnowledgeId: "订单与物流进度",
			consecutiveKnowledgeMisses: 0,
			operatorAttention: null,
		});
		expect(recovered.state.nextAction).toBe("ask_followup");
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
		refreshExactActiveCa(snapshot, "fault-code-content");
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
		refreshExactActiveCa(snapshot, "custom-stale");
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

	it("chooses a discriminating Eval sample when generated KUs share a product term", async () => {
		const { snapshot } = await setup();
		const presales = {
			...snapshot.knowledgeUnits[0]!,
			id: "c-air-presales",
			title: "C-Air 选型与房间面积",
			scenarioKeywords: ["C-Air Mini", "房间面积"],
			applicableScenarios: ["客户询问 C-Air Mini 适合多大的房间"],
			requiredSlots: [],
		};
		const aftersales = {
			...snapshot.knowledgeUnits[1]!,
			id: "c-air-aftersales",
			title: "C-Air 滤芯与保修",
			scenarioKeywords: ["滤芯型号", "保修期限"],
			applicableScenarios: ["客户询问 C-Air Mini / S / Pro 分别使用哪种滤芯"],
			requiredSlots: [],
		};
		snapshot.knowledgeUnits = [presales, aftersales];
		snapshot.capabilityPlan.knowledgeUnitIds = [presales.id, aftersales.id];
		refreshExactActiveCa(snapshot, "eval-discriminating");

		const suite = await runP0EvalSuite(snapshot, now);

		expect(suite.status).toBe("passed");
		expect(suite.cases).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ expectedKnowledgeId: presales.id, passed: true }),
				expect.objectContaining({ expectedKnowledgeId: aftersales.id, passed: true }),
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
		refreshExactActiveCa(snapshot, "optional-only");
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
