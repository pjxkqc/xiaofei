import { ORPCError } from "@orpc/server";
import { runXiaofeiTurn } from "@repo/ai";
import {
	loadXiaofeiRuntimeHostingCapability,
	type Prisma,
	commitXiaofeiSyntheticSupportConversation,
	XiaofeiSyntheticSupportCommitConflictError,
	XiaofeiSyntheticSupportConversationConflictError,
	XiaofeiSyntheticSupportTenantConflictError,
	upsertXiaofeiSyntheticSupportConversation,
} from "@repo/database";
import {
	ConversationStateSchema,
	SupportMessageSchema,
	SyntheticAcceptanceMetadataSchema,
	TraceEventSchema,
	createConversationState,
	materializeActiveCapabilitySnapshot,
} from "@repo/xiaofei";
import { z } from "zod";

import { supportProcedure } from "../../../orpc/procedures";
import {
	createKnowledgeWorkspaceBinding,
	getOrCreateXiaofeiWorkspace,
	getXiaofeiOrganizationId,
	requireXiaofeiOrganizationAdmin,
} from "../service";

const textSchema = z.string().trim().min(1).max(10_000);

export const sendSyntheticSupportMessage = supportProcedure
	.input(z.object({ externalId: z.string().trim().min(1).max(200), text: textSchema }))
	.handler(async ({ context, input }) => {
		await requireXiaofeiOrganizationAdmin(context);
		const organizationId = await getXiaofeiOrganizationId(context);
		const { workspace, snapshot } = await getOrCreateXiaofeiWorkspace(context);
		// This is the only external ID used for lookup, create, CAS commit, and Inbox links.
		const conversationId = syntheticSupportConversationId(input.externalId);
		const syntheticAcceptance = createSyntheticAcceptanceMetadata({
			organizationId,
			createdByUserId: context.user.id,
		});
		const baseState = createConversationState({
			id: conversationId,
			tenantId: snapshot.agent.tenantId,
			agentId: snapshot.agent.id,
			maxFollowUps: snapshot.agent.maxFollowUps,
		});
		let existing;
		try {
			// Materialize before invoking AI so simultaneous first turns share one lease.
			existing = await upsertXiaofeiSyntheticSupportConversation({
				organizationId,
				externalId: conversationId,
				state: toJson(baseState),
				messages: toJson([]),
				traceEvents: toJson([]),
				syntheticAcceptance: toJson(syntheticAcceptance),
			});
		} catch (error) {
			throwSyntheticConflict(error);
		}
		if (existing.channel !== "synthetic_support")
			throw new ORPCError("CONFLICT", {
				message: "This support conversation changed; reload and try again.",
			});
		const state = ConversationStateSchema.parse(existing.state);
		const previousMessages = z.array(SupportMessageSchema).parse(existing.messages);
		const previousTraces = z.array(TraceEventSchema).parse(existing.traceEvents);
		const now = new Date();
		const customer = SupportMessageSchema.parse({
			id: crypto.randomUUID(),
			role: "customer",
			authorName: "Synthetic acceptance customer",
			text: input.text,
			createdAt: now.toISOString(),
		});
		let nextState = state;
		let traces = previousTraces;
		let messages = [...previousMessages, customer];
		if (state.ownerType === "ai") {
			const active = await loadXiaofeiRuntimeHostingCapability(organizationId, "active");
			const activeSnapshot = materializeActiveCapabilitySnapshot({
				base: snapshot,
				manifest: active.manifest,
				revisions: active.revisions,
			});
			const result = await runXiaofeiTurn({
				message: input.text,
				state,
				snapshot: activeSnapshot,
				knowledgeWorkspaceBinding: createKnowledgeWorkspaceBinding({
					workspace,
					snapshot: activeSnapshot,
					conversationId,
					channelId: "synthetic_support",
				}),
			});
			nextState = result.state;
			traces = [...traces, ...result.metadata.traces].slice(-80);
			messages.push(
				SupportMessageSchema.parse({
					id: crypto.randomUUID(),
					role: "ai",
					authorName: activeSnapshot.agent.name,
					text: result.reply,
					createdAt: now.toISOString(),
				}),
			);
		}
		let conversation;
		try {
			conversation = await commitXiaofeiSyntheticSupportConversation({
				organizationId,
				externalId: conversationId,
				expectedRevision: existing.revision,
				expectedOwnerType: existing.ownerType,
				expectedOwnerEpoch: existing.ownerEpoch,
				state: toJson(nextState),
				messages: toJson(messages.slice(-160)),
				traceEvents: toJson(traces),
				lastCustomerSeenAt: now,
				lastMessageAt: now,
			});
		} catch (error) {
			throwSyntheticConflict(error);
		}
		return {
			conversationId: conversation.externalId,
			ownerType: ConversationStateSchema.parse(conversation.state).ownerType,
			messages: z.array(SupportMessageSchema).parse(conversation.messages),
		};
	});

function toJson(value: unknown): Prisma.InputJsonValue {
	return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export function syntheticSupportConversationId(externalId: string) {
	return `synthetic:${externalId}`;
}

export function createSyntheticAcceptanceMetadata(
	input: { organizationId: string; createdByUserId: string },
	env: NodeJS.ProcessEnv = process.env,
	now: () => Date = () => new Date(),
) {
	const deploymentEnvironment = env.VERCEL_ENV?.trim();
	const previewHeadSha = env.VERCEL_GIT_COMMIT_SHA?.trim().toLowerCase();
	if (deploymentEnvironment !== "preview" || !previewHeadSha?.match(/^[0-9a-f]{40}$/u))
		throw new ORPCError("BAD_REQUEST", {
			message: "Synthetic Support acceptance is available only on a revision-pinned Preview.",
		});
	return SyntheticAcceptanceMetadataSchema.parse({
		...input,
		deploymentEnvironment,
		previewHeadSha,
		allowExternalDelivery: false,
		createdAt: now().toISOString(),
	});
}

function throwSyntheticConflict(error: unknown): never {
	if (
		error instanceof XiaofeiSyntheticSupportCommitConflictError ||
		error instanceof XiaofeiSyntheticSupportConversationConflictError ||
		error instanceof XiaofeiSyntheticSupportTenantConflictError
	)
		throw new ORPCError("CONFLICT", {
			message: "This support conversation changed; reload and try again.",
		});
	throw error;
}
