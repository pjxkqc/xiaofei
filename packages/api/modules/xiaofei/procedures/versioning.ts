import { ORPCError } from "@orpc/server";
import { runXiaofeiTestTurn } from "@repo/ai";
import {
	activateXiaofeiCapabilityVersion,
	applyXiaofeiTestTurnFeedback,
	createXiaofeiCapabilityVersion,
	createXiaofeiKnowledgeUnitRevision,
	createXiaofeiTestTurn,
	createXiaofeiTestTurnRerun,
	getXiaofeiOrganizationConfig,
	getXiaofeiOrganizationHostingBinding,
	loadXiaofeiRuntimeHostingCapability,
	listXiaofeiKnowledgeUnitRevisions,
	listXiaofeiKnowledgeUnits,
	setXiaofeiOrganizationTestHostingVersion,
	upsertXiaofeiOrganizationConfig,
	XiaofeiTestTurnFeedbackConflictError,
	XiaofeiVersioningNotFoundError,
} from "@repo/database";
import { createConversationState, RuntimeMetadataSchema } from "@repo/xiaofei";
import { z } from "zod";

import { supportProcedure } from "../../../orpc/procedures";
import {
	createKnowledgeWorkspaceBinding,
	getOrCreateXiaofeiWorkspace,
	getXiaofeiOrganizationId,
	requireXiaofeiOrganizationAdmin,
} from "../service";

const hostingKey = "xiaofei-hosting" as const;
const questionSchema = z.string().trim().min(1).max(10_000);

export const getXiaofeiVersioningOverview = supportProcedure.handler(async ({ context }) => {
	const organizationId = await getXiaofeiOrganizationId(context);
	const [revisions, binding, config] = await Promise.all([
		listXiaofeiKnowledgeUnitRevisions(organizationId),
		getXiaofeiOrganizationHostingBinding(organizationId),
		getXiaofeiOrganizationConfig(organizationId),
	]);
	return { revisions, binding, xiaofeiEnabled: config?.xiaofeiEnabled ?? false };
});

export const initializeXiaofeiVersioning = supportProcedure.handler(async ({ context }) => {
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
				content: unit.content as never,
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
});

export const runXiaofeiVersionedTest = supportProcedure
	.input(
		z.object({ question: questionSchema, testSessionId: z.string().min(1).max(128).optional() }),
	)
	.handler(async ({ context, input }) => {
		const organizationId = await getXiaofeiOrganizationId(context);
		const [{ workspace, snapshot }, capability] = await Promise.all([
			getOrCreateXiaofeiWorkspace(context),
			loadXiaofeiRuntimeHostingCapability(organizationId, "test"),
		]);
		const state = createConversationState({
			id: globalThis.crypto.randomUUID(),
			tenantId: snapshot.agent.tenantId,
			agentId: snapshot.agent.id,
			maxFollowUps: snapshot.agent.maxFollowUps,
		});
		const requestedAt = new Date();
		const result = await runXiaofeiTestTurn({
			message: input.question,
			state,
			baseSnapshot: snapshot,
			manifest: capability.manifest,
			revisions: capability.revisions,
			knowledgeWorkspaceBinding: createKnowledgeWorkspaceBinding({
				workspace,
				snapshot,
				conversationId: state.id,
				channelId: "authenticated:chatbot-test",
			}),
		});
		const turn = await createXiaofeiTestTurn(organizationId, {
			testSessionId: input.testSessionId ?? state.id,
			question: input.question,
			answer: result.reply,
			capabilityVersionId: capability.manifest.id,
			runtimeMetadata: result.metadata,
			requestedAt,
			completedAt: new Date(),
		});
		return {
			turn,
			answer: result.reply,
			metadata: result.metadata,
			feedbackAllowed: result.metadata.knowledgeEvidence?.knowledgeUnitOrigin === "merchant",
		};
	});

export const applyXiaofeiTestTurnCorrection = supportProcedure
	.input(z.object({ sourceTestTurnId: z.string().cuid(), correction: questionSchema }))
	.handler(async ({ context, input }) => {
		await requireXiaofeiOrganizationAdmin(context);
		const organizationId = await getXiaofeiOrganizationId(context);
		try {
			const feedback = await applyXiaofeiTestTurnFeedback({
				organizationId,
				sourceTestTurnId: input.sourceTestTurnId,
				correction: input.correction,
			});
			const [{ workspace, snapshot }, capability] = await Promise.all([
				getOrCreateXiaofeiWorkspace(context),
				loadXiaofeiRuntimeHostingCapability(organizationId, "test"),
			]);
			if (capability.manifest.id !== feedback.resultVersion.id)
				throw new ORPCError("CONFLICT", {
					message: "The Test version changed; start a new correction.",
				});
			const state = createConversationState({
				id: globalThis.crypto.randomUUID(),
				tenantId: snapshot.agent.tenantId,
				agentId: snapshot.agent.id,
				maxFollowUps: snapshot.agent.maxFollowUps,
			});
			const requestedAt = new Date();
			const result = await runXiaofeiTestTurn({
				message: feedback.sourceTestTurn.question,
				state,
				baseSnapshot: snapshot,
				manifest: capability.manifest,
				revisions: capability.revisions,
				knowledgeWorkspaceBinding: createKnowledgeWorkspaceBinding({
					workspace,
					snapshot,
					conversationId: state.id,
					channelId: "authenticated:chatbot-test",
				}),
			});
			const rerun = await createXiaofeiTestTurnRerun(organizationId, {
				interventionId: feedback.intervention.id,
				answer: result.reply,
				capabilityVersionId: capability.manifest.id,
				runtimeMetadata: result.metadata,
				requestedAt,
				completedAt: new Date(),
			});
			return {
				source: feedback.sourceTestTurn,
				rerun,
				...persistedCorrectionResult(rerun),
			};
		} catch (error) {
			if (error instanceof XiaofeiTestTurnFeedbackConflictError)
				throw new ORPCError("CONFLICT", {
					message: "A different correction is already applied to this answer.",
				});
			if (error instanceof XiaofeiVersioningNotFoundError)
				throw new ORPCError("BAD_REQUEST", {
					message: "This answer has no correctable merchant knowledge evidence.",
				});
			throw error;
		}
	});

/** Return the database record, including an idempotently reused rerun, as the UI evidence. */
export function persistedCorrectionResult(rerun: {
	answer: string;
	runtimeMetadata: unknown;
	capabilityVersionId: string;
}) {
	return {
		answer: rerun.answer,
		metadata: RuntimeMetadataSchema.parse(rerun.runtimeMetadata),
		resultCapabilityVersionId: rerun.capabilityVersionId,
	};
}

export const activateXiaofeiHostingVersion = supportProcedure.handler(async ({ context }) => {
	await requireXiaofeiOrganizationAdmin(context);
	const organizationId = await getXiaofeiOrganizationId(context);
	const binding = await getXiaofeiOrganizationHostingBinding(organizationId);
	if (!binding?.testCapabilityVersionId)
		throw new ORPCError("BAD_REQUEST", {
			message: "No Test hosting version is ready for activation.",
		});
	return await activateXiaofeiCapabilityVersion(
		organizationId,
		hostingKey,
		binding.testCapabilityVersionId,
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
