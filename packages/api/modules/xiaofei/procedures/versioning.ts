import { ORPCError } from "@orpc/server";
import { runXiaofeiTestTurn } from "@repo/ai";
import {
	activateXiaofeiCapabilityVersion,
	applyXiaofeiTestTurnFeedback,
	createXiaofeiCapabilityVersion,
	createXiaofeiKnowledgeUnitRevision,
	createXiaofeiTestTurn,
	createXiaofeiTestTurnRerun,
	getXiaofeiTestSession,
	getXiaofeiOrganizationConfig,
	getXiaofeiOrganizationHostingBinding,
	loadXiaofeiRuntimeHostingCapability,
	listXiaofeiKnowledgeUnitRevisions,
	listXiaofeiKnowledgeUnits,
	listXiaofeiTestSessions,
	getXiaofeiTestSessionDetail,
	setXiaofeiOrganizationTestHostingVersion,
	upsertXiaofeiOrganizationConfig,
	XiaofeiTestTurnFeedbackConflictError,
	XiaofeiTestSessionCapabilityConflictError,
	XiaofeiTestSessionConflictError,
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
import { freezeMerchantKnowledgeUnitRevisionContent } from "./versioning-knowledge";

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
		const testSessionId = input.testSessionId ?? globalThis.crypto.randomUUID();
		const savedSession = await getXiaofeiTestSession(organizationId, testSessionId);
		if (savedSession && savedSession.capabilityVersionId !== capability.manifest.id)
			throw new ORPCError("CONFLICT", {
				message: "The Test version changed; start a new test session.",
			});
		const state =
			savedSession?.conversationState ??
			createConversationState({
				id: testSessionId,
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
				conversationId: testSessionId,
				channelId: "authenticated:chatbot-test",
			}),
		});
		let turn;
		try {
			turn = await createXiaofeiTestTurn(organizationId, {
				testSessionId,
				expectedPreviousTestTurnId: savedSession?.id ?? null,
				question: input.question,
				answer: result.reply,
				capabilityVersionId: capability.manifest.id,
				conversationState: result.state,
				runtimeMetadata: result.metadata,
				requestedAt,
				completedAt: new Date(),
			});
		} catch (error) {
			if (
				error instanceof XiaofeiTestSessionCapabilityConflictError ||
				error instanceof XiaofeiTestSessionConflictError
			)
				throw new ORPCError("CONFLICT", {
					message:
						error instanceof XiaofeiTestSessionCapabilityConflictError
							? "The Test version changed; start a new test session."
							: "This test session changed; reload and try again.",
				});
			throw error;
		}
		return {
			turn,
			testSessionId,
			answer: result.reply,
			metadata: result.metadata,
			feedbackAllowed: true,
			feedbackMode:
				result.metadata.knowledgeEvidence?.knowledgeUnitOrigin === "merchant"
					? ("revise" as const)
					: ("supplement" as const),
		};
	});

/** Starts a new opaque session ID without mutating historical TestTurn evidence. */
export const resetXiaofeiTestSession = supportProcedure.handler(async ({ context }) => {
	await getXiaofeiOrganizationId(context);
	return { testSessionId: globalThis.crypto.randomUUID() };
});

/** Bounded Organization-scoped Test CA history projections. */
export const listXiaofeiTestSessionsProcedure = supportProcedure
	.input(
		z
			.object({
				cursor: z.string().min(1).optional(),
				limit: z.number().int().min(1).max(50).optional(),
			})
			.optional(),
	)
	.handler(async ({ context, input }) =>
		listXiaofeiTestSessions(await getXiaofeiOrganizationId(context), input ?? {}),
	);

export const getXiaofeiTestSessionProcedure = supportProcedure
	.input(z.object({ testSessionId: z.string().trim().min(1).max(128) }))
	.handler(async ({ context, input }) => {
		const detail = await getXiaofeiTestSessionDetail(
			await getXiaofeiOrganizationId(context),
			input.testSessionId,
		);
		if (!detail) throw new ORPCError("NOT_FOUND", { message: "Test session not found." });
		return detail;
	});

export const newXiaofeiTestSession = resetXiaofeiTestSession;

/** Resume is an explicit stale-session check; callers then use runVersionedTest. */
export const resumeXiaofeiTestSession = supportProcedure
	.input(z.object({ testSessionId: z.string().trim().min(1).max(128) }))
	.handler(async ({ context, input }) => {
		const detail = await getXiaofeiTestSessionDetail(
			await getXiaofeiOrganizationId(context),
			input.testSessionId,
		);
		if (!detail) throw new ORPCError("NOT_FOUND", { message: "Test session not found." });
		if (!detail.writable)
			throw new ORPCError("CONFLICT", {
				message: "The Test version changed; start a new test session.",
			});
		return detail;
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
				testSessionId: globalThis.crypto.randomUUID(),
				expectedPreviousTestTurnId: null,
				answer: result.reply,
				capabilityVersionId: capability.manifest.id,
				conversationState: result.state,
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
					message: "This saved answer can no longer be corrected from the current Test CA.",
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
