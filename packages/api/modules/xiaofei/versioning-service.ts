import { ORPCError } from "@orpc/server";
import {
	createXiaofeiCapabilityVersion,
	createXiaofeiKnowledgeUnitRevision,
	getXiaofeiOrganizationHostingBinding,
	listXiaofeiKnowledgeUnits,
	loadXiaofeiRuntimeHostingCapability,
	setXiaofeiOrganizationTestHostingVersion,
} from "@repo/database";
import { materializeTestCapabilityReviewSnapshot } from "@repo/xiaofei";

import { freezeMerchantKnowledgeUnitRevisionContent } from "./procedures/versioning-knowledge";
import {
	getOrCreateXiaofeiWorkspace,
	getXiaofeiOrganizationId,
	requireXiaofeiOrganizationAdmin,
	type XiaofeiAuthContext,
} from "./service";

const hostingKey = "xiaofei-hosting" as const;

/**
 * Returns the workspace projection for the exact current Test CA. This keeps
 * review/Eval UI and activation aligned with the same immutable revisions that
 * Test turns and Active runtime materialization use.
 */
export async function getXiaofeiTestAdmissionSnapshot(context: XiaofeiAuthContext) {
	const organizationId = await getXiaofeiOrganizationId(context);
	const [{ snapshot }, binding] = await Promise.all([
		getOrCreateXiaofeiWorkspace(context),
		getXiaofeiOrganizationHostingBinding(organizationId),
	]);
	if (!binding?.testCapabilityVersionId) return snapshot;
	const capability = await loadXiaofeiRuntimeHostingCapability(organizationId, "test");
	return materializeTestCapabilityReviewSnapshot({
		base: snapshot,
		manifest: capability.manifest,
		revisions: capability.revisions,
	});
}

/** Materializes a new immutable Test CA; it intentionally never changes Active. */
export async function initializeXiaofeiTestHostingForTenant(context: XiaofeiAuthContext) {
	await requireXiaofeiOrganizationAdmin(context);
	const organizationId = await getXiaofeiOrganizationId(context);
	const { workspace, snapshot } = await getOrCreateXiaofeiWorkspace(context);
	const units = await listXiaofeiKnowledgeUnits(workspace.id);
	const platform = snapshot.knowledgeUnits.filter(
		(unit) =>
			unit.lineage === undefined && unit.status === "released" && unit.eligibility === "eligible",
	);
	const merchant = units.filter(
		(unit) => unit.status === "released" && unit.eligibility === "eligible",
	);
	const platformRevisions = await Promise.all(
		platform.map((unit) =>
			createXiaofeiKnowledgeUnitRevision({
				organizationId: null,
				logicalKnowledgeUnitId: `platform:${unit.id}`,
				origin: "platform",
				content: unit,
			}),
		),
	);
	const merchantRevisions = await Promise.all(
		merchant.map((unit) =>
			createXiaofeiKnowledgeUnitRevision({
				organizationId,
				logicalKnowledgeUnitId: `merchant:${unit.id}`,
				knowledgeUnitId: unit.id,
				origin: "merchant",
				content: freezeMerchantKnowledgeUnitRevisionContent(unit),
			}),
		),
	);
	if (!platformRevisions.length && !merchantRevisions.length)
		throw new ORPCError("BAD_REQUEST", {
			message: "Publish eligible knowledge before creating a version.",
		});
	if (platformRevisions.length)
		await createXiaofeiCapabilityVersion({
			organizationId,
			capabilityKey: "platform-fallback",
			knowledgeUnits: platformRevisions.map((revision, index) => ({
				knowledgeUnitRevisionId: revision.id,
				role: "fallback",
				priority: -index,
			})),
		});
	if (merchantRevisions.length)
		await createXiaofeiCapabilityVersion({
			organizationId,
			capabilityKey: "merchant-knowledge",
			knowledgeUnits: merchantRevisions.map((revision, index) => ({
				knowledgeUnitRevisionId: revision.id,
				role: "primary",
				priority: merchantRevisions.length - index,
			})),
		});
	const hosting = await createXiaofeiCapabilityVersion({
		organizationId,
		capabilityKey: hostingKey,
		knowledgeUnits: [
			...platformRevisions.map((revision, index) => ({
				knowledgeUnitRevisionId: revision.id,
				role: "fallback",
				priority: -index,
			})),
			...merchantRevisions.map((revision, index) => ({
				knowledgeUnitRevisionId: revision.id,
				role: "primary",
				priority: merchantRevisions.length - index,
			})),
		],
	});
	await setXiaofeiOrganizationTestHostingVersion(organizationId, hosting.id);
	return { versionId: hosting.id };
}
