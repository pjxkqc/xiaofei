import { createHash } from "node:crypto";

import {
	CapabilityVersionManifestSchema,
	KnowledgeUnitRevisionSchema,
	KnowledgeVersioningSnapshotSchema,
	XiaofeiWorkspaceSnapshotSchema,
	type CapabilityKey,
	type CapabilityVersionManifest,
	type KnowledgeUnit,
	type KnowledgeUnitOrigin,
	type KnowledgeUnitRevision,
	type KnowledgeVersioningSnapshot,
} from "./contracts";
import { deriveCapabilityPlan, deriveReleaseGates } from "./defaults";

export interface CreateKnowledgeUnitRevisionInput {
	id: string;
	logicalKnowledgeUnitId: string;
	organizationId: string | null;
	revision: number;
	origin: KnowledgeUnitOrigin;
	knowledgeUnit: KnowledgeUnit;
	createdAt: string;
}

/** Creates a content-addressed immutable KU revision; correction creates a successor. */
export function createKnowledgeUnitRevision(
	input: CreateKnowledgeUnitRevisionInput,
): KnowledgeUnitRevision {
	return KnowledgeUnitRevisionSchema.parse({
		...input,
		contentHash: stableHash(knowledgeUnitContentSnapshot(input.knowledgeUnit)),
	});
}

export interface CreateCapabilityVersionManifestInput {
	id: string;
	organizationId: string;
	capabilityKey: CapabilityKey;
	status: "test" | "active" | "retired";
	knowledgeUnitRevisionIds: string[];
	createdAt: string;
}

/** The manifest hash is deterministic across input ordering and JSON key order. */
export function createCapabilityVersionManifest(
	input: CreateCapabilityVersionManifestInput,
): CapabilityVersionManifest {
	const knowledgeUnitRevisionIds = [...input.knowledgeUnitRevisionIds].sort();
	return CapabilityVersionManifestSchema.parse({
		...input,
		knowledgeUnitRevisionIds,
		manifestHash: stableHash({
			organizationId: input.organizationId,
			capabilityKey: input.capabilityKey,
			knowledgeUnitRevisionIds,
		}),
	});
}

export interface RuntimeKnowledgeEvidence {
	logicalKnowledgeUnitId: string;
	knowledgeUnitRevisionId: string;
	capabilityVersionId: string;
	capabilityKey: CapabilityKey;
	knowledgeUnitOrigin: KnowledgeUnitOrigin;
}

/** Resolves evidence only from the active manifest. */
export function resolveRuntimeKnowledgeEvidence(
	versioning: KnowledgeVersioningSnapshot,
	knowledgeUnitId: string | null,
): RuntimeKnowledgeEvidence | null {
	const validated = KnowledgeVersioningSnapshotSchema.parse(versioning);
	if (!knowledgeUnitId || !validated.activeCapabilityVersionId) return null;
	const manifest = validated.capabilityVersionManifests.find(
		(candidate) =>
			candidate.id === validated.activeCapabilityVersionId && candidate.status === "active",
	);
	if (!manifest) return null;
	const revision = validated.knowledgeUnitRevisions.find(
		(candidate) =>
			candidate.knowledgeUnit.id === knowledgeUnitId &&
			manifest.knowledgeUnitRevisionIds.includes(candidate.id),
	);
	if (!revision) return null;
	return {
		logicalKnowledgeUnitId: revision.logicalKnowledgeUnitId,
		knowledgeUnitRevisionId: revision.id,
		capabilityVersionId: manifest.id,
		capabilityKey: manifest.capabilityKey,
		knowledgeUnitOrigin: revision.origin,
	};
}

function materializeExactCapabilitySnapshot(
	input: {
		base: import("./contracts").XiaofeiWorkspaceSnapshot;
		manifest: CapabilityVersionManifest;
		revisions: KnowledgeUnitRevision[];
	},
	expectedStatus: "test" | "active",
): import("./contracts").XiaofeiWorkspaceSnapshot {
	if (
		input.manifest.status !== expectedStatus ||
		input.manifest.capabilityKey !== "xiaofei-hosting" ||
		input.base.agent.tenantId !== `organization:${input.manifest.organizationId}`
	)
		throw new Error("Capability manifest is not the requested organization hosting version.");
	const ids = input.manifest.knowledgeUnitRevisionIds;
	if (new Set(ids).size !== ids.length || input.revisions.length !== ids.length)
		throw new Error("Capability manifest revisions must be exact and unique.");
	const byId = new Map(input.revisions.map((revision) => [revision.id, revision]));
	if (ids.some((id) => !byId.has(id)))
		throw new Error("Capability manifest has missing revisions.");
	const exact = ids.map((id) => byId.get(id)!);
	for (const revision of exact) {
		if (
			revision.knowledgeUnit.status !== "released" ||
			revision.knowledgeUnit.eligibility !== "eligible"
		)
			throw new Error("Capability revision is not published and eligible.");
		if (revision.origin === "merchant" && revision.organizationId !== input.manifest.organizationId)
			throw new Error("Capability revision crosses organizations.");
		if (
			createKnowledgeUnitRevision({ ...revision, contentHash: undefined } as never).contentHash !==
			revision.contentHash
		)
			throw new Error("Capability revision content hash mismatch.");
	}
	const expected = createCapabilityVersionManifest({
		...input.manifest,
		manifestHash: undefined,
	} as never);
	if (expected.manifestHash !== input.manifest.manifestHash)
		throw new Error("Capability manifest hash mismatch.");
	const knowledgeUnits = exact.map((revision) => revision.knowledgeUnit);
	const capabilityPlan = {
		...deriveCapabilityPlan(knowledgeUnits, input.manifest.createdAt),
		version: `ca-${input.manifest.manifestHash}`,
		reviewed: true,
	};
	const evalSuite = canTransferEvalEvidence(input.base, input.revisions, capabilityPlan)
		? {
				...input.base.evalSuite,
				// The immutable manifest creates a new runtime plan version. The
				// evidence is transferable only when the reviewed logical KU set and
				// content are unchanged, so bind the passed Eval to that version.
				capabilityPlanVersion: capabilityPlan.version,
			}
		: input.base.evalSuite;
	const runtimeManifest = { ...input.manifest, status: "active" as const };
	return XiaofeiWorkspaceSnapshotSchema.parse({
		...input.base,
		knowledgeUnits,
		capabilityPlan,
		evalSuite,
		knowledgeVersioning: {
			knowledgeUnitRevisions: exact,
			capabilityVersionManifests: [runtimeManifest],
			activeCapabilityVersionId: runtimeManifest.id,
		},
	});
}

/**
 * Eval evidence follows an immutable CA only when it still describes the same
 * reviewed logical knowledge and content. A changed source stays fail-closed.
 */
function canTransferEvalEvidence(
	base: import("./contracts").XiaofeiWorkspaceSnapshot,
	revisions: KnowledgeUnitRevision[],
	capabilityPlan: import("./contracts").CapabilityPlan,
): boolean {
	if (
		base.evalSuite.status !== "passed" ||
		base.evalSuite.capabilityPlanVersion !== base.capabilityPlan.version ||
		!base.capabilityPlan.reviewed ||
		base.capabilityPlan.status !== "review_ready"
	)
		return false;
	const baseIds = [...base.capabilityPlan.knowledgeUnitIds].sort();
	const materializedIds = [...capabilityPlan.knowledgeUnitIds].sort();
	if (baseIds.length !== materializedIds.length) return false;
	const baseIdSet = new Set(baseIds);
	if (base.knowledgeUnits.filter((unit) => baseIdSet.has(unit.id)).length !== baseIds.length)
		return false;

	// A persisted CA can legitimately use a different revision-row/manifest
	// identity while preserving the exact reviewed behavior. Compare the
	// immutable content plus platform/merchant partition instead of requiring
	// the workspace KU row IDs to be reused by the CA materialization.
	const baseFingerprints = base.knowledgeUnits
		.filter((unit) => baseIdSet.has(unit.id))
		.map((unit) => `${unit.lineage ? "merchant" : "platform"}:${knowledgeUnitContentHash(unit)}`)
		.sort();
	const materializedFingerprints = revisions
		.map((revision) => `${revision.origin}:${knowledgeUnitContentHash(revision.knowledgeUnit)}`)
		.sort();
	return (
		baseFingerprints.length === materializedFingerprints.length &&
		baseFingerprints.every((fingerprint, index) => fingerprint === materializedFingerprints[index])
	);
}

function knowledgeUnitContentHash(knowledgeUnit: KnowledgeUnit): string {
	return stableHash(knowledgeUnitContentSnapshot(knowledgeUnit));
}

/** Creates an isolated Test CA runtime snapshot without changing the live active pointer. */
export function materializeTestCapabilitySnapshot(input: {
	base: import("./contracts").XiaofeiWorkspaceSnapshot;
	manifest: CapabilityVersionManifest;
	revisions: KnowledgeUnitRevision[];
}): import("./contracts").XiaofeiWorkspaceSnapshot {
	return materializeExactCapabilitySnapshot(input, "test");
}

/**
 * Reconciles the authenticated capability-review view with the current Test CA.
 * A changed manifest or KU content is deliberately unreviewed and has no Eval
 * evidence until an owner/admin reviews and evaluates that exact version.
 */
export function materializeTestCapabilityReviewSnapshot(input: {
	base: import("./contracts").XiaofeiWorkspaceSnapshot;
	manifest: CapabilityVersionManifest;
	revisions: KnowledgeUnitRevision[];
}): import("./contracts").XiaofeiWorkspaceSnapshot {
	const materialized = materializeExactCapabilitySnapshot(input, "test");
	const basePlan = input.base.capabilityPlan;
	const planMatches =
		basePlan.version === materialized.capabilityPlan.version &&
		basePlan.knowledgeUnitIds.length === materialized.capabilityPlan.knowledgeUnitIds.length &&
		basePlan.knowledgeUnitIds.every((id) =>
			materialized.capabilityPlan.knowledgeUnitIds.includes(id),
		);
	const evalIsCurrent =
		materialized.evalSuite.status === "passed" &&
		materialized.evalSuite.capabilityPlanVersion === materialized.capabilityPlan.version;
	const reviewed = evalIsCurrent || (planMatches && basePlan.reviewed);
	const capabilityPlan = { ...materialized.capabilityPlan, reviewed };
	const evalSuite = reviewed
		? materialized.evalSuite
		: {
				status: "warning" as const,
				passed: 0,
				failed: 0,
				cases: [],
				updatedAt: input.manifest.createdAt,
				capabilityPlanVersion: null,
			};
	return XiaofeiWorkspaceSnapshotSchema.parse({
		...materialized,
		capabilityPlan,
		evalSuite,
		gates: deriveReleaseGates(
			materialized.knowledgeUnits,
			capabilityPlan,
			evalSuite.status,
			materialized.tools,
		),
		// The database pointer remains authoritative; this is a review projection.
		knowledgeVersioning: input.base.knowledgeVersioning,
	});
}

/** Materializes the persisted Active CA with the same exact-revision checks as Test CA. */
export function materializeActiveCapabilitySnapshot(input: {
	base: import("./contracts").XiaofeiWorkspaceSnapshot;
	manifest: CapabilityVersionManifest;
	revisions: KnowledgeUnitRevision[];
}): import("./contracts").XiaofeiWorkspaceSnapshot {
	return materializeExactCapabilitySnapshot(input, "active");
}

export type CorrectionAdmission =
	| { allowed: true }
	| { allowed: false; reason: "platform_baseline" | "cross_organization" };

/** Only the owning organization may correct merchant knowledge in P0. */
export function evaluateCorrectionAdmission(input: {
	organizationId: string;
	target: KnowledgeUnitRevision;
}): CorrectionAdmission {
	if (input.target.origin === "platform") return { allowed: false, reason: "platform_baseline" };
	if (input.target.organizationId !== input.organizationId)
		return { allowed: false, reason: "cross_organization" };
	return { allowed: true };
}

/** Content only: excludes revision identity, lifecycle, and source lineage. */
function knowledgeUnitContentSnapshot(
	knowledgeUnit: KnowledgeUnit,
): Omit<KnowledgeUnit, "id" | "status" | "lineage" | "eligibility" | "staleReason"> {
	const {
		id: _id,
		status: _status,
		lineage: _lineage,
		eligibility: _eligibility,
		staleReason: _staleReason,
		...content
	} = knowledgeUnit;
	return content;
}

function stableHash(value: unknown): string {
	return createHash("sha256").update(stableJson(value)).digest("hex");
}

function stableJson(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
	if (value && typeof value === "object") {
		const record = value as Record<string, unknown>;
		return `{${Object.keys(record)
			.sort()
			.map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
			.join(",")}}`;
	}
	return JSON.stringify(value);
}
