import {
	createCapabilityVersionManifest,
	createConversationState,
	createDefaultWorkspaceSnapshot,
	createKnowledgeUnitRevision,
	materializeActiveCapabilitySnapshot,
	runP0EvalSuite,
} from "@repo/xiaofei";
import { describe, expect, it } from "vitest";

import { runMastraGovernance } from "./governance";
import { runLangGraphTurn } from "./langgraph";
import { runXiaofeiTestTurn, runXiaofeiTurn } from "./runtime";

const CREATED_AT = "2026-08-05T00:00:00.000Z";
const ORGANIZATION_ID = "org-a";
const TENANT_ID = `organization:${ORGANIZATION_ID}`;

async function setup() {
	const snapshot = createDefaultWorkspaceSnapshot(TENANT_ID);
	snapshot.capabilityPlan.reviewed = true;
	const revisions = snapshot.knowledgeUnits.map((knowledgeUnit, index) =>
		createKnowledgeUnitRevision({
			id: `setup-revision-${String(index + 1).padStart(3, "0")}`,
			logicalKnowledgeUnitId: knowledgeUnit.id,
			organizationId: null,
			revision: 1,
			origin: "platform",
			knowledgeUnit,
			createdAt: CREATED_AT,
		}),
	);
	const manifest = createCapabilityVersionManifest({
		id: "setup-active-ca",
		organizationId: ORGANIZATION_ID,
		capabilityKey: "xiaofei-hosting",
		status: "active",
		knowledgeUnitRevisionIds: revisions.map((revision) => revision.id),
		createdAt: CREATED_AT,
	});
	snapshot.knowledgeVersioning = {
		knowledgeUnitRevisions: revisions,
		capabilityVersionManifests: [manifest],
		activeCapabilityVersionId: manifest.id,
	};
	snapshot.evalSuite = await runP0EvalSuite(snapshot);
	const state = createConversationState({
		id: "conversation-unified",
		tenantId: TENANT_ID,
		agentId: snapshot.agent.id,
		maxFollowUps: snapshot.agent.maxFollowUps,
	});
	return {
		snapshot,
		state,
		knowledgeWorkspaceBinding: {
			tenantId: snapshot.agent.tenantId,
			conversationId: state.id,
			channelId: "test",
			knowledgeWorkspaceId: snapshot.knowledgeWorkspaceId,
		},
	};
}

describe("Xiaofei runtime adapters", () => {
	it("runs the Mastra governance workflow without an LLM call", async () => {
		const { snapshot } = await setup();
		const governed = await runMastraGovernance(snapshot);
		expect(governed.agent.status).toBe("review_ready");
		expect(governed.knowledgeUnits.every((unit) => unit.status === "released")).toBe(true);
	});

	it("runs deterministic P0 collection through a real LangGraph StateGraph", async () => {
		const input = await setup();
		const result = await runLangGraphTurn({
			...input,
			message: "杯子碎了，需要售后",
		});
		expect(result.metadata.traces.some((trace) => trace.type === "langgraph")).toBe(true);
		expect(result.state.nextAction).toBe("ask_followup");
		expect(result.reply).toContain("订单号");
	});

	it("runs high-risk exit through the unified runtime without calling the model", async () => {
		const input = await setup();
		const result = await runXiaofeiTurn({
			...input,
			message: "我要投诉并找人工客服",
		});
		expect(result.metadata.traces.some((trace) => trace.type === "langgraph")).toBe(true);
		expect(result.metadata.traces.some((trace) => trace.type === "mastra")).toBe(false);
		expect(result.state.ownerType).toBe("human");
		expect(result.state.ownerEpoch).toBe(1);
	});

	it("runs an exact Test CA through LangGraph and returns its selected evidence", async () => {
		const input = await setup();
		const knowledge = input.snapshot.knowledgeUnits[0]!;
		const revision = createKnowledgeUnitRevision({
			id: "test-ku-price",
			logicalKnowledgeUnitId: "logical-test-price",
			organizationId: ORGANIZATION_ID,
			revision: 1,
			origin: "merchant",
			knowledgeUnit: knowledge,
			createdAt: CREATED_AT,
		});
		const manifest = createCapabilityVersionManifest({
			id: "test-hosting-ca",
			organizationId: ORGANIZATION_ID,
			capabilityKey: "xiaofei-hosting",
			status: "test",
			knowledgeUnitRevisionIds: [revision.id],
			createdAt: CREATED_AT,
		});
		const result = await runXiaofeiTestTurn({
			...input,
			message: knowledge.scenarioKeywords[0]!,
			baseSnapshot: input.snapshot,
			manifest,
			revisions: [revision],
			replyGenerator: { generate: async () => "来自精确 Test CA 的候选回复。" },
		});

		expect(result.reply).toBe("来自精确 Test CA 的候选回复。");
		expect(result.metadata.traces.some((trace) => trace.type === "langgraph")).toBe(true);
		expect(result.metadata.traces.some((trace) => trace.type === "mastra")).toBe(true);
		expect(result.metadata.knowledgeEvidence).toMatchObject({
			logicalKnowledgeUnitId: revision.logicalKnowledgeUnitId,
			knowledgeUnitRevisionId: revision.id,
			capabilityVersionId: manifest.id,
			capabilityKey: "xiaofei-hosting",
			knowledgeUnitOrigin: "merchant",
		});
	});

	it("keeps no-hit null and preserves owner and Guardrail safety in Test mode", async () => {
		const input = await setup();
		const knowledge = input.snapshot.knowledgeUnits[0]!;
		const revision = createKnowledgeUnitRevision({
			id: "test-ku-safety",
			logicalKnowledgeUnitId: "logical-test-safety",
			organizationId: ORGANIZATION_ID,
			revision: 1,
			origin: "merchant",
			knowledgeUnit: knowledge,
			createdAt: CREATED_AT,
		});
		const manifest = createCapabilityVersionManifest({
			id: "test-hosting-safety",
			organizationId: ORGANIZATION_ID,
			capabilityKey: "xiaofei-hosting",
			status: "test",
			knowledgeUnitRevisionIds: [revision.id],
			createdAt: CREATED_AT,
		});
		const run = (message: string, state = input.state) =>
			runXiaofeiTestTurn({
				...input,
				message,
				state,
				baseSnapshot: input.snapshot,
				manifest,
				revisions: [revision],
				replyGenerator: { generate: async () => "不应绕过 Guardrail。" },
			});

		await expect(run("火星门店保修政策")).resolves.toMatchObject({
			metadata: { knowledgeEvidence: null },
		});
		await expect(run("我要投诉并找人工客服")).resolves.toMatchObject({
			state: { ownerType: "human", ownerEpoch: 1 },
		});
		await expect(
			run(knowledge.scenarioKeywords[0]!, { ...input.state, ownerType: "human", ownerEpoch: 1 }),
		).resolves.toMatchObject({
			state: { ownerType: "human", ownerEpoch: 1 },
		});
	});

	it("keeps normal turns on the Active CA when a Test CA exists outside its runtime view", async () => {
		const input = await setup();
		const knowledge = input.snapshot.knowledgeUnits[0]!;
		const revision = createKnowledgeUnitRevision({
			id: "active-ku-price",
			logicalKnowledgeUnitId: "logical-active-price",
			organizationId: ORGANIZATION_ID,
			revision: 1,
			origin: "merchant",
			knowledgeUnit: knowledge,
			createdAt: CREATED_AT,
		});
		const activeManifest = createCapabilityVersionManifest({
			id: "active-hosting-ca",
			organizationId: ORGANIZATION_ID,
			capabilityKey: "xiaofei-hosting",
			status: "active",
			knowledgeUnitRevisionIds: [revision.id],
			createdAt: CREATED_AT,
		});
		const testManifest = createCapabilityVersionManifest({
			...activeManifest,
			id: "outside-test-hosting-ca",
			status: "test",
			manifestHash: undefined,
		} as never);
		const snapshot = materializeActiveCapabilitySnapshot({
			base: input.snapshot,
			manifest: activeManifest,
			revisions: [revision],
		});
		snapshot.evalSuite = await runP0EvalSuite(snapshot);

		const result = await runXiaofeiTurn({
			message: knowledge.scenarioKeywords[0]!,
			state: input.state,
			snapshot,
			knowledgeWorkspaceBinding: input.knowledgeWorkspaceBinding,
			replyGenerator: { generate: async () => "来自 Active CA 的候选回复。" },
		});

		expect(snapshot.knowledgeVersioning.capabilityVersionManifests).not.toContainEqual(
			testManifest,
		);
		expect(result.metadata.knowledgeEvidence?.capabilityVersionId).toBe(activeManifest.id);
	});
});
