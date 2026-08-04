import { ORPCError } from "@orpc/server";
import {
	activateXiaofeiCapabilityVersion,
	applyXiaofeiResponseIntervention,
	createXiaofeiCapabilityVersion,
	createXiaofeiKnowledgeUnitRevision,
	db,
	getXiaofeiOrganizationConfig,
	listXiaofeiKnowledgeUnitRevisions,
	listXiaofeiKnowledgeUnits,
	upsertXiaofeiOrganizationConfig,
} from "@repo/database";
import { KnowledgeUnitSchema } from "@repo/xiaofei";
import { z } from "zod";

import { supportProcedure } from "../../../orpc/procedures";
import {
	getOrCreateXiaofeiWorkspace,
	getXiaofeiOrganizationId,
	requireXiaofeiOrganizationAdmin,
} from "../service";

const hostingKey = "xiaofei-hosting" as const;

export const getXiaofeiVersioningOverview = supportProcedure.handler(async ({ context }) => {
	const organizationId = await getXiaofeiOrganizationId(context);
	const [revisions, binding, config] = await Promise.all([
		listXiaofeiKnowledgeUnitRevisions(organizationId),
		db.xiaofeiCapabilityBinding.findUnique({
			where: { organizationId_capabilityKey: { organizationId, capabilityKey: hostingKey } },
			include: {
				activeCapabilityVersion: {
					include: { knowledgeUnits: { include: { knowledgeUnitRevision: true } } },
				},
				testCapabilityVersion: {
					include: { knowledgeUnits: { include: { knowledgeUnitRevision: true } } },
				},
			},
		}),
		getXiaofeiOrganizationConfig(organizationId),
	]);
	return { revisions, binding, xiaofeiEnabled: config?.xiaofeiEnabled ?? false };
});

/** Creates the first frozen manifest from the current Organization KUs plus read-only platform fallback. */
export const initializeXiaofeiVersioning = supportProcedure.handler(async ({ context }) => {
	await requireXiaofeiOrganizationAdmin(context);
	const organizationId = await getXiaofeiOrganizationId(context);
	const { workspace, snapshot } = await getOrCreateXiaofeiWorkspace(context);
	const units = await listXiaofeiKnowledgeUnits(workspace.id);
	const platformUnits = snapshot.knowledgeUnits.filter((unit) => unit.lineage === undefined);
	const revisions = await Promise.all([
		...platformUnits.map((unit) =>
			createXiaofeiKnowledgeUnitRevision({
				organizationId: null,
				logicalKnowledgeUnitId: `platform:${unit.id}`,
				knowledgeUnitId: null,
				origin: "platform",
				content: unit,
			}),
		),
		...units.map((unit) =>
			createXiaofeiKnowledgeUnitRevision({
				organizationId,
				logicalKnowledgeUnitId: `merchant:${unit.id}`,
				knowledgeUnitId: unit.id,
				origin: "merchant",
				content: unit.content as never,
			}),
		),
	]);
	if (!revisions.length)
		throw new ORPCError("BAD_REQUEST", {
			message: "Add knowledge before creating a hosting version.",
		});
	const version = await createXiaofeiCapabilityVersion({
		organizationId,
		capabilityKey: hostingKey,
		knowledgeUnits: revisions.map((revision) => ({ knowledgeUnitRevisionId: revision.id })),
	});
	await db.xiaofeiCapabilityBinding.upsert({
		where: { organizationId_capabilityKey: { organizationId, capabilityKey: hostingKey } },
		create: { organizationId, capabilityKey: hostingKey, testCapabilityVersionId: version.id },
		update: { testCapabilityVersionId: version.id },
	});
	return { versionId: version.id };
});

export const applyXiaofeiCorrection = supportProcedure
	.input(
		z.object({
			capabilityVersionId: z.string().cuid(),
			knowledgeRevisionId: z.string().cuid(),
			correction: z.string().trim().min(1).max(10_000),
		}),
	)
	.handler(async ({ context, input }) => {
		await requireXiaofeiOrganizationAdmin(context);
		const organizationId = await getXiaofeiOrganizationId(context);
		const revision = await db.xiaofeiKnowledgeUnitRevision.findUnique({
			where: {
				scopeKey_id: { scopeKey: `organization:${organizationId}`, id: input.knowledgeRevisionId },
			},
		});
		if (!revision || revision.origin !== "merchant")
			throw new ORPCError("FORBIDDEN", { message: "Only a hit merchant KU can be corrected." });
		const knowledge = KnowledgeUnitSchema.parse(revision.content);
		const corrected = { ...knowledge, standardReplyPolicy: input.correction };
		const result = await applyXiaofeiResponseIntervention({
			organizationId,
			capabilityKey: hostingKey,
			beforeCapabilityVersionId: input.capabilityVersionId,
			beforeKnowledgeRevisionId: revision.id,
			correction: input.correction,
			correctedContent: corrected,
			beforeResponse: { text: knowledge.standardReplyPolicy },
			afterResponse: { text: corrected.standardReplyPolicy },
		});
		return {
			testCapabilityVersionId: result.resultVersion.id,
			knowledgeRevisionId: result.resultRevision.id,
			before: knowledge.standardReplyPolicy,
			after: corrected.standardReplyPolicy,
		};
	});

export const activateXiaofeiHostingVersion = supportProcedure
	.input(z.object({ capabilityVersionId: z.string().cuid() }))
	.handler(async ({ context, input }) => {
		await requireXiaofeiOrganizationAdmin(context);
		const organizationId = await getXiaofeiOrganizationId(context);
		return await activateXiaofeiCapabilityVersion(
			organizationId,
			hostingKey,
			input.capabilityVersionId,
		);
	});

export const setXiaofeiHostingEnabled = supportProcedure
	.input(z.object({ enabled: z.boolean() }))
	.handler(async ({ context, input }) => {
		await requireXiaofeiOrganizationAdmin(context);
		return await upsertXiaofeiOrganizationConfig(await getXiaofeiOrganizationId(context), {
			xiaofeiEnabled: input.enabled,
		});
	});
