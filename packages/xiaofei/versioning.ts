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
import { deriveCapabilityPlan } from "./defaults";

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

/** Creates an isolated test snapshot without changing the live active pointer. */
export function materializeTestCapabilitySnapshot(input: {
	base: import("./contracts").XiaofeiWorkspaceSnapshot;
	manifest: CapabilityVersionManifest;
	revisions: KnowledgeUnitRevision[];
}): import("./contracts").XiaofeiWorkspaceSnapshot {
	if (
		input.manifest.status !== "test" ||
		input.manifest.capabilityKey !== "xiaofei-hosting" ||
		input.manifest.organizationId !== input.base.agent.tenantId
	)
		throw new Error("Test manifest is not an organization hosting test version.");
	const ids = input.manifest.knowledgeUnitRevisionIds;
	if (new Set(ids).size !== ids.length || input.revisions.length !== ids.length)
		throw new Error("Test manifest revisions must be exact and unique.");
	const byId = new Map(input.revisions.map((revision) => [revision.id, revision]));
	if (ids.some((id) => !byId.has(id))) throw new Error("Test manifest has missing revisions.");
	const exact = ids.map((id) => byId.get(id)!);
	for (const revision of exact) {
		if (
			revision.knowledgeUnit.status !== "released" ||
			revision.knowledgeUnit.eligibility !== "eligible"
		)
			throw new Error("Test revision is not published and eligible.");
		if (revision.origin === "merchant" && revision.organizationId !== input.manifest.organizationId)
			throw new Error("Test revision crosses organizations.");
		if (
			createKnowledgeUnitRevision({ ...revision, contentHash: undefined } as never).contentHash !==
			revision.contentHash
		)
			throw new Error("Test revision content hash mismatch.");
	}
	const expected = createCapabilityVersionManifest({
		...input.manifest,
		manifestHash: undefined,
	} as never);
	if (expected.manifestHash !== input.manifest.manifestHash)
		throw new Error("Test manifest hash mismatch.");
	const knowledgeUnits = exact.map((revision) => revision.knowledgeUnit);
	const capabilityPlan = {
		...deriveCapabilityPlan(knowledgeUnits, input.manifest.createdAt),
		reviewed: true,
	};
	const runtimeManifest = { ...input.manifest, status: "active" as const };
	return XiaofeiWorkspaceSnapshotSchema.parse({
		...input.base,
		knowledgeUnits,
		capabilityPlan,
		knowledgeVersioning: {
			knowledgeUnitRevisions: exact,
			capabilityVersionManifests: [runtimeManifest],
			activeCapabilityVersionId: runtimeManifest.id,
		},
	});
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
