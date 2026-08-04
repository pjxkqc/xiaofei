import { describe, expect, it } from "vitest";

import { freezeMerchantKnowledgeUnitRevisionContent } from "./versioning-knowledge";

const generatedDraftPayload = {
	id: "merchant-ku-1",
	title: "Returns policy",
	status: "draft",
	scenarioKeywords: ["return"],
	applicableScenarios: ["Returns"],
	inapplicableScenarios: [],
	requiredSlots: [],
	forbiddenOutputs: ["Do not promise a refund"],
	handoffRules: ["Escalate disputed orders"],
	standardReplyPolicy: "Explain the approved return policy.",
	fallbackReply: "A support specialist can verify the order.",
	sourceSection: "Returns",
	quality: { status: "warning", blockers: [], warnings: [] },
	lineage: {
		workspaceId: "workspace-a",
		sourceId: "source-a",
		sourceContentHash: "hash-a",
		sourceVersion: 1,
		entryId: "entry-a",
		entryVersion: 1,
	},
	eligibility: "ineligible",
	staleReason: "Generated before review",
};

describe("merchant KU revision freezing", () => {
	it("uses the authoritative released and eligible row lifecycle over stale generated JSON", () => {
		const revision = freezeMerchantKnowledgeUnitRevisionContent({
			id: "merchant-ku-1",
			content: generatedDraftPayload,
			status: "released",
			eligibility: "eligible",
			staleReason: null,
		});

		expect(revision).toMatchObject({
			id: "merchant-ku-1",
			status: "released",
			eligibility: "eligible",
		});
		expect(revision.staleReason).toBeUndefined();
	});

	it("does not make an unpublished row executable", () => {
		const revision = freezeMerchantKnowledgeUnitRevisionContent({
			id: "merchant-ku-1",
			content: { ...generatedDraftPayload, status: "released", eligibility: "eligible" },
			status: "draft",
			eligibility: "ineligible",
			staleReason: null,
		});

		expect(revision).toMatchObject({ status: "draft", eligibility: "ineligible" });
	});
});
