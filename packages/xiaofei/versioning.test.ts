import { describe, expect, it } from "vitest";

import {
	KnowledgeVersioningSnapshotSchema,
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
		origin: "merchant",
		knowledgeUnit: unit,
		createdAt: CREATED_AT,
		...input,
	});
}

function activeManifest(knowledgeUnitRevisionIds: string[]) {
	return createCapabilityVersionManifest({
		id: "ca-active-1",
		organizationId: "organization-a",
		capabilityKey: "xiaofei-hosting",
		status: "active",
		knowledgeUnitRevisionIds,
		createdAt: CREATED_AT,
	});
}

describe("knowledge revision and capability version contracts", () => {
	it("hashes immutable KU content, not revision identity, and changes with answer policy", () => {
		const first = revision();
		const identicalSuccessor = revision({ id: "ku-revision-2", revision: 2 });
		const changedPolicy = revision({
			id: "ku-revision-3",
			revision: 3,
			knowledgeUnit: { ...unit, standardReplyPolicy: "使用新的、经过审核的回复口径。" },
		});
		const changedAnswer = revision({
			id: "ku-revision-4",
			revision: 4,
			knowledgeUnit: { ...unit, fallbackReply: "这是新的安全兜底回复。" },
		});
		expect(first.logicalKnowledgeUnitId).toBe(identicalSuccessor.logicalKnowledgeUnitId);
		expect(first.contentHash).toBe(identicalSuccessor.contentHash);
		expect(changedPolicy.contentHash).not.toBe(first.contentHash);
		expect(changedAnswer.contentHash).not.toBe(first.contentHash);
	});

	it("creates order-independent manifests and separates CA capability from KU origin", () => {
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
		expect(() => revision({ origin: "xiaofei-hosting" as never })).toThrow();
	});

	it("returns both hosting capability and merchant KU origin as answer evidence", () => {
		const merchantRevision = revision();
		const active = activeManifest([merchantRevision.id]);
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
			capabilityKey: "xiaofei-hosting",
			knowledgeUnitOrigin: "merchant",
		});
	});

	it("rejects invalid manifest references, logical duplicates, tenant mismatches, and ambiguous active manifests", () => {
		const first = revision();
		const successor = revision({ id: "ku-revision-2", revision: 2 });
		const active = activeManifest([first.id]);
		const base = {
			knowledgeUnitRevisions: [first],
			capabilityVersionManifests: [active],
			activeCapabilityVersionId: active.id,
		};
		expect(
			KnowledgeVersioningSnapshotSchema.safeParse({
				...base,
				capabilityVersionManifests: [{ ...active, knowledgeUnitRevisionIds: ["missing"] }],
			}).success,
		).toBe(false);
		expect(
			KnowledgeVersioningSnapshotSchema.safeParse({
				...base,
				knowledgeUnitRevisions: [first, successor],
				capabilityVersionManifests: [
					{ ...active, knowledgeUnitRevisionIds: [first.id, successor.id] },
				],
			}).success,
		).toBe(false);
		expect(
			KnowledgeVersioningSnapshotSchema.safeParse({
				...base,
				knowledgeUnitRevisions: [revision({ organizationId: "organization-b" })],
			}).success,
		).toBe(false);
		expect(
			KnowledgeVersioningSnapshotSchema.safeParse({
				...base,
				capabilityVersionManifests: [active, { ...active, id: "ca-active-2" }],
				activeCapabilityVersionId: active.id,
			}).success,
		).toBe(true);
		expect(
			KnowledgeVersioningSnapshotSchema.safeParse({
				...base,
				capabilityVersionManifests: [active, { ...active }],
				activeCapabilityVersionId: active.id,
			}).success,
		).toBe(false);
		expect(() =>
			resolveRuntimeKnowledgeEvidence(
				{
					...base,
					capabilityVersionManifests: [{ ...active, knowledgeUnitRevisionIds: ["missing"] }],
				},
				unit.id,
			),
		).toThrow();
	});

	it("rejects platform and cross-organization corrections by KU origin", () => {
		expect(
			evaluateCorrectionAdmission({ organizationId: "organization-a", target: revision() }),
		).toEqual({ allowed: true });
		expect(
			evaluateCorrectionAdmission({
				organizationId: "organization-a",
				target: revision({ organizationId: null, origin: "platform" }),
			}),
		).toEqual({ allowed: false, reason: "platform_baseline" });
		expect(
			evaluateCorrectionAdmission({ organizationId: "organization-b", target: revision() }),
		).toEqual({ allowed: false, reason: "cross_organization" });
	});
});
