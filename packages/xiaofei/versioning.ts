import { createHash } from "node:crypto";

import {
	CapabilityVersionManifestSchema,
	KnowledgeUnitRevisionSchema,
	type CapabilityKey,
	type CapabilityVersionManifest,
	type KnowledgeUnit,
	type KnowledgeUnitRevision,
	type KnowledgeVersioningSnapshot,
} from "./contracts";

export interface CreateKnowledgeUnitRevisionInput {
	id: string;
	logicalKnowledgeUnitId: string;
	organizationId: string | null;
	revision: number;
	sourceCapabilityKey: CapabilityKey;
	knowledgeUnit: KnowledgeUnit;
	createdAt: string;
}

/** Creates a content-addressed immutable KU revision; correction creates a successor. */
export function createKnowledgeUnitRevision(
	input: CreateKnowledgeUnitRevisionInput,
): KnowledgeUnitRevision {
	return KnowledgeUnitRevisionSchema.parse({
		...input,
		contentHash: stableHash({
			logicalKnowledgeUnitId: input.logicalKnowledgeUnitId,
			revision: input.revision,
			sourceCapabilityKey: input.sourceCapabilityKey,
			knowledgeUnit: input.knowledgeUnit,
		}),
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
	sourceCapabilityKey: CapabilityKey;
}

/** Resolves evidence only from the active manifest. */
export function resolveRuntimeKnowledgeEvidence(
	versioning: KnowledgeVersioningSnapshot,
	knowledgeUnitId: string | null,
): RuntimeKnowledgeEvidence | null {
	if (!knowledgeUnitId || !versioning.activeCapabilityVersionId) return null;
	const manifest = versioning.capabilityVersionManifests.find(
		(candidate) =>
			candidate.id === versioning.activeCapabilityVersionId && candidate.status === "active",
	);
	if (!manifest) return null;
	const revision = versioning.knowledgeUnitRevisions.find(
		(candidate) =>
			candidate.knowledgeUnit.id === knowledgeUnitId &&
			manifest.knowledgeUnitRevisionIds.includes(candidate.id),
	);
	if (!revision) return null;
	return {
		logicalKnowledgeUnitId: revision.logicalKnowledgeUnitId,
		knowledgeUnitRevisionId: revision.id,
		capabilityVersionId: manifest.id,
		sourceCapabilityKey: revision.sourceCapabilityKey,
	};
}

export type CorrectionAdmission =
	| { allowed: true }
	| {
			allowed: false;
			reason: "platform_baseline" | "cross_organization" | "non_merchant_knowledge";
	  };

/** Only the owning organization may correct merchant knowledge in P0. */
export function evaluateCorrectionAdmission(input: {
	organizationId: string;
	target: KnowledgeUnitRevision;
}): CorrectionAdmission {
	if (input.target.sourceCapabilityKey === "platform-fallback")
		return { allowed: false, reason: "platform_baseline" };
	if (input.target.organizationId !== input.organizationId)
		return { allowed: false, reason: "cross_organization" };
	if (input.target.sourceCapabilityKey !== "merchant-knowledge")
		return { allowed: false, reason: "non_merchant_knowledge" };
	return { allowed: true };
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
