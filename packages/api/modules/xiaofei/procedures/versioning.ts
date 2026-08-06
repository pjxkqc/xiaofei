import { ORPCError } from "@orpc/server";
import { runXiaofeiTestTurn } from "@repo/ai";
import {
	activateXiaofeiCapabilityVersion,
	applyXiaofeiTestTurnFeedback,
	createXiaofeiTestTurn,
	createXiaofeiTestTurnRerun,
	createXiaofeiTestSession,
	getXiaofeiTestSessionRuntimeState,
	getXiaofeiOrganizationConfig,
	getXiaofeiOrganizationHostingBinding,
	getXiaofeiVersioningOverviewData,
	loadXiaofeiRuntimeHostingCapability,
	listXiaofeiTestSessions,
	getXiaofeiTestSessionDetail,
	upsertXiaofeiOrganizationConfig,
	XiaofeiTestTurnFeedbackConflictError,
	XiaofeiTestCapabilityConflictError,
	XiaofeiTestSessionCapabilityConflictError,
	XiaofeiTestSessionConflictError,
	XiaofeiVersioningNotFoundError,
} from "@repo/database";
import {
	createConversationState,
	isCapabilityAdmitted,
	RuntimeMetadataSchema,
} from "@repo/xiaofei";
import { z } from "zod";

import { supportProcedure } from "../../../orpc/procedures";
import {
	createKnowledgeWorkspaceBinding,
	getOrCreateXiaofeiWorkspace,
	getXiaofeiOrganizationId,
	requireXiaofeiOrganizationAdmin,
} from "../service";
import {
	getXiaofeiTestAdmissionTarget,
	initializeXiaofeiTestHostingForTenant,
} from "../versioning-service";

const hostingKey = "xiaofei-hosting" as const;
const questionSchema = z.string().trim().min(1).max(10_000);

export const getXiaofeiVersioningOverview = supportProcedure.handler(async ({ context }) => {
	const organizationId = await getXiaofeiOrganizationId(context);
	const [[revisions, binding], config] = await Promise.all([
		getXiaofeiVersioningOverviewData(organizationId),
		getXiaofeiOrganizationConfig(organizationId),
	]);
	return { revisions, binding, xiaofeiEnabled: config?.xiaofeiEnabled ?? false };
});

export const initializeXiaofeiVersioning = supportProcedure.handler(async ({ context }) => {
	try {
		return await initializeXiaofeiTestHostingForTenant(context);
	} catch (error) {
		if (error instanceof XiaofeiTestCapabilityConflictError)
			throw new ORPCError("CONFLICT", {
				message: "The Test version changed during preparation; reload before retrying.",
				data: testCapabilityConflictData(error),
			});
		throw error;
	}
});

export const runXiaofeiVersionedTest = supportProcedure
	.input(
		z.object({
			question: questionSchema,
			testSessionId: z.string().min(1).max(128),
			capabilityVersionId: z.string().min(1).max(128),
		}),
	)
	.handler(async ({ context, input }) => {
		const organizationId = await getXiaofeiOrganizationId(context);
		const [{ workspace, snapshot }, capability, session] = await Promise.all([
			getOrCreateXiaofeiWorkspace(context),
			loadXiaofeiRuntimeHostingCapability(organizationId, "test"),
			getXiaofeiTestSessionRuntimeState(organizationId, input.testSessionId),
		]);
		const testSessionId = input.testSessionId;
		if (!session) throw new ORPCError("NOT_FOUND", { message: "Test session not found." });
		if (
			session.capabilityVersionId !== input.capabilityVersionId ||
			capability.manifest.id !== input.capabilityVersionId
		)
			throw testCapabilityConflict(
				input.capabilityVersionId,
				capability.manifest.id,
				"The Test version changed; start a new test session.",
			);
		const state =
			session.conversationState ??
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
				expectedPreviousTestTurnId: session.latestTestTurnId,
				question: input.question,
				answer: result.reply,
				capabilityVersionId: input.capabilityVersionId,
				conversationState: result.state,
				runtimeMetadata: result.metadata,
				requestedAt,
				completedAt: new Date(),
			});
		} catch (error) {
			if (error instanceof XiaofeiTestSessionCapabilityConflictError) {
				const binding = await getXiaofeiOrganizationHostingBinding(organizationId);
				throw testCapabilityConflict(
					input.capabilityVersionId,
					binding?.testCapabilityVersionId ?? null,
					"The Test version changed; start a new test session.",
				);
			}
			if (error instanceof XiaofeiTestSessionConflictError)
				throw new ORPCError("CONFLICT", {
					message: "This test session changed; reload and try again.",
					data: testSessionConflictData(input.capabilityVersionId, capability.manifest.id),
				});
			if (error instanceof XiaofeiTestCapabilityConflictError)
				throw new ORPCError("CONFLICT", {
					message: "The Test version changed; start a new test session.",
					data: testCapabilityConflictData(error),
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
	const organizationId = await getXiaofeiOrganizationId(context);
	const capability = await loadXiaofeiRuntimeHostingCapability(organizationId, "test");
	const testSessionId = globalThis.crypto.randomUUID();
	await createXiaofeiTestSession(organizationId, {
		id: testSessionId,
		capabilityVersionId: capability.manifest.id,
	});
	return { testSessionId, capabilityVersionId: capability.manifest.id };
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
		return {
			...detail,
			interventionPairs: projectInterventionPairs(detail.interventionPairs),
		};
	});

/**
 * Keep persistence-only response payloads behind the API boundary. The UI needs
 * the immutable TestTurn facts and runtime evidence, never provider/persistence
 * response JSON that may contain fields outside the browser contract.
 */
export function projectInterventionPairs(
	pairs: Array<{
		interventionId: string;
		isComplete: boolean;
		correction: string;
		beforeResponse: unknown;
		afterResponse: unknown;
		before: {
			id: string;
			testSessionId: string;
			capabilityVersionId: string;
			answer: string;
			runtimeMetadata: unknown;
		};
		after: {
			id: string;
			testSessionId: string;
			capabilityVersionId: string;
			answer: string;
			runtimeMetadata: unknown;
		} | null;
	}>,
) {
	return pairs.map(({ interventionId, isComplete, correction, before, after }) => ({
		interventionId,
		isComplete,
		correction,
		before,
		after: isComplete ? after : null,
	}));
}

export const newXiaofeiTestSession = resetXiaofeiTestSession;

/** Resume is an explicit stale-session check; callers then use runVersionedTest. */
export const resumeXiaofeiTestSession = supportProcedure
	.input(z.object({ testSessionId: z.string().trim().min(1).max(128) }))
	.handler(async ({ context, input }) => {
		const organizationId = await getXiaofeiOrganizationId(context);
		const [detail, binding] = await Promise.all([
			getXiaofeiTestSessionDetail(organizationId, input.testSessionId),
			getXiaofeiOrganizationHostingBinding(organizationId),
		]);
		if (!detail) throw new ORPCError("NOT_FOUND", { message: "Test session not found." });
		if (!detail.writable)
			throw testCapabilityConflict(
				detail.capabilityVersionId,
				binding?.testCapabilityVersionId ?? null,
				"The Test version changed; start a new test session.",
			);
		return detail;
	});

export const applyXiaofeiTestTurnCorrection = supportProcedure
	.input(
		z.object({
			sourceTestTurnId: z.string().cuid(),
			testSessionId: z.string().trim().min(1).max(128),
			capabilityVersionId: z.string().cuid(),
			correction: questionSchema,
		}),
	)
	.handler(async ({ context, input }) => {
		await requireXiaofeiOrganizationAdmin(context);
		const organizationId = await getXiaofeiOrganizationId(context);
		let expectedResultCapabilityVersionId = input.capabilityVersionId;
		try {
			const feedback = await applyXiaofeiTestTurnFeedback({
				organizationId,
				sourceTestTurnId: input.sourceTestTurnId,
				testSessionId: input.testSessionId,
				expectedCapabilityVersionId: input.capabilityVersionId,
				correction: input.correction,
			});
			if (feedback.existingRerun)
				return {
					source: feedback.sourceTestTurn,
					rerun: feedback.existingRerun,
					...persistedCorrectionResult(feedback.existingRerun),
				};
			expectedResultCapabilityVersionId = feedback.resultVersion.id;
			const [{ workspace, snapshot }, capability] = await Promise.all([
				getOrCreateXiaofeiWorkspace(context),
				loadXiaofeiRuntimeHostingCapability(organizationId, "test"),
			]);
			if (capability.manifest.id !== feedback.resultVersion.id)
				throw testCapabilityConflict(
					feedback.resultVersion.id,
					capability.manifest.id,
					"The Test version changed; start a new correction.",
				);
			const testSessionId = globalThis.crypto.randomUUID();
			await createXiaofeiTestSession(organizationId, {
				id: testSessionId,
				capabilityVersionId: capability.manifest.id,
			});
			const state = createConversationState({
				id: testSessionId,
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
				testSessionId,
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
			if (error instanceof XiaofeiTestCapabilityConflictError)
				throw new ORPCError("CONFLICT", {
					message: "The Test version changed; reload before applying this correction.",
					data: testCapabilityConflictData(error),
				});
			if (error instanceof XiaofeiTestSessionCapabilityConflictError) {
				const binding = await getXiaofeiOrganizationHostingBinding(organizationId);
				throw testCapabilityConflict(
					expectedResultCapabilityVersionId,
					binding?.testCapabilityVersionId ?? null,
					"The Test version changed during rerun; reload before retrying.",
				);
			}
			if (error instanceof XiaofeiTestSessionConflictError) {
				const binding = await getXiaofeiOrganizationHostingBinding(organizationId);
				throw new ORPCError("CONFLICT", {
					message: "The Test version changed during rerun; reload before retrying.",
					data: testSessionConflictData(
						expectedResultCapabilityVersionId,
						binding?.testCapabilityVersionId ?? null,
					),
				});
			}
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

function testCapabilityConflictData(error: XiaofeiTestCapabilityConflictError) {
	return {
		code: error.code,
		expectedCapabilityVersionId: error.expectedCapabilityVersionId,
		currentCapabilityVersionId: error.currentCapabilityVersionId,
	};
}

function testCapabilityConflict(
	expectedCapabilityVersionId: string,
	currentCapabilityVersionId: string | null,
	message: string,
) {
	return new ORPCError("CONFLICT", {
		message,
		data: {
			code: "TEST_CA_VERSION_CONFLICT",
			expectedCapabilityVersionId,
			currentCapabilityVersionId,
		},
	});
}

function testSessionConflictData(
	expectedCapabilityVersionId: string,
	currentCapabilityVersionId: string | null,
) {
	return {
		code: "TEST_SESSION_STATE_CONFLICT",
		expectedCapabilityVersionId,
		currentCapabilityVersionId,
	};
}

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
	const admissionTarget = await getXiaofeiTestAdmissionTarget(context);
	if (!isCapabilityAdmitted(admissionTarget.snapshot))
		throw new ORPCError("BAD_REQUEST", {
			message: "Review and run the current Test CA Eval before activation.",
		});
	if (!admissionTarget.capabilityVersionId)
		throw new ORPCError("BAD_REQUEST", {
			message: "No Test hosting version is ready for activation.",
		});
	try {
		return await activateXiaofeiCapabilityVersion(
			organizationId,
			hostingKey,
			admissionTarget.capabilityVersionId,
		);
	} catch (error) {
		if (error instanceof XiaofeiTestCapabilityConflictError)
			throw new ORPCError("CONFLICT", {
				message: "The Test version changed after admission; review the current version first.",
				data: testCapabilityConflictData(error),
			});
		throw error;
	}
});

export const setXiaofeiHostingEnabled = supportProcedure
	.input(z.object({ enabled: z.boolean() }))
	.handler(async ({ context, input }) => {
		await requireXiaofeiOrganizationAdmin(context);
		return await upsertXiaofeiOrganizationConfig(await getXiaofeiOrganizationId(context), {
			xiaofeiEnabled: input.enabled,
		});
	});
