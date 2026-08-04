import { describe, expect, it } from "vitest";

import {
	createCapabilityVersionManifest,
	createDefaultWorkspaceSnapshot,
	createKnowledgeUnitRevision,
	evaluateCorrectionAdmission,
	resolveRuntimeKnowledgeEvidence,
} from "./index";

const CREATED_AT = "2026-08-05T00:00:00.000Z";
const snapshot = createDefaultWorkspaceSnapshot("organization-a", () => CREATED_AT);
const unit = snapshot.knowledgeUnits[0]!;

function revision(input: Partial<Parameters<typeof createKnowledgeUnitRevision>[0]> = {}) {
	return createKnowledgeUnitRevision({
		id: "ku-revision-1",
		logicalKnowledgeUnitId: "logical-ku-1",
		organizationId: "organization-a",
		revision: 1,
		sourceCapabilityKey: "merchant-knowledge",
		knowledgeUnit: unit,
		createdAt: CREATED_AT,
		...input,
	});
}

describe("knowledge revision and capability version contracts", () => {
	it("keeps logical KU identity separate from an immutable content-addressed revision", () => {
		const first = revision();
		const successor = revision({ id: "ku-revision-2", revision: 2 });
		expect(first.logicalKnowledgeUnitId).toBe(successor.logicalKnowledgeUnitId);
		expect(first.id).not.toBe(successor.id);
		expect(first.contentHash).not.toBe("");
	});

	it("creates order-independent manifests that can reuse one revision", () => {
		const first = createCapabilityVersionManifest({
			id: "ca-test-1",
			organizationId: "organization-a",
			capabilityKey: "merchant-knowledge",
			status: "test",
			knowledgeUnitRevisionIds: ["ku-revision-2", "ku-revision-1"],
			createdAt: CREATED_AT,
		});
		const reordered = createCapabilityVersionManifest({
			id: "ca-test-2",
			organizationId: "organization-a",
			capabilityKey: "merchant-knowledge",
			status: "test",
			knowledgeUnitRevisionIds: ["ku-revision-1", "ku-revision-2"],
			createdAt: CREATED_AT,
		});
		expect(first.manifestHash).toBe(reordered.manifestHash);
		expect(first.knowledgeUnitRevisionIds).toEqual(["ku-revision-1", "ku-revision-2"]);
	});

	it("returns exact active KU revision, CA version, and source evidence for an answer", () => {
		const merchantRevision = revision();
		const active = createCapabilityVersionManifest({
			id: "ca-active-1",
			organizationId: "organization-a",
			capabilityKey: "xiaofei-hosting",
			status: "active",
			knowledgeUnitRevisionIds: [merchantRevision.id],
			createdAt: CREATED_AT,
		});
		expect(
			resolveRuntimeKnowledgeEvidence(
				{
					knowledgeUnitRevisions: [merchantRevision],
					capabilityVersionManifests: [active],
					activeCapabilityVersionId: active.id,
				},
				unit.id,
			),
		).toEqual({
			logicalKnowledgeUnitId: "logical-ku-1",
			knowledgeUnitRevisionId: merchantRevision.id,
			capabilityVersionId: active.id,
			sourceCapabilityKey: "merchant-knowledge",
		});
	});

	it("rejects corrections to platform, hosting, and another organization's KU revision", () => {
		expect(
			evaluateCorrectionAdmission({ organizationId: "organization-a", target: revision() }),
		).toEqual({ allowed: true });
		expect(
			evaluateCorrectionAdmission({
				organizationId: "organization-a",
				target: revision({ organizationId: null, sourceCapabilityKey: "platform-fallback" }),
			}),
		).toEqual({ allowed: false, reason: "platform_baseline" });
		expect(
			evaluateCorrectionAdmission({ organizationId: "organization-b", target: revision() }),
		).toEqual({ allowed: false, reason: "cross_organization" });
		expect(
			evaluateCorrectionAdmission({
				organizationId: "organization-a",
				target: revision({ sourceCapabilityKey: "xiaofei-hosting" }),
			}),
		).toEqual({ allowed: false, reason: "non_merchant_knowledge" });
	});
});
