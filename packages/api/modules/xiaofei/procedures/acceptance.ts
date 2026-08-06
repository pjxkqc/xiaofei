import { ORPCError } from "@orpc/server";
import { runXiaofeiTurn } from "@repo/ai";
import {
	getXiaofeiConversation,
	loadXiaofeiRuntimeHostingCapability,
	type Prisma,
	updateXiaofeiSupportConversation,
	upsertXiaofeiSyntheticSupportConversation,
} from "@repo/database";
import {
	ConversationStateSchema,
	SupportMessageSchema,
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
		const conversationId = `synthetic:${input.externalId}`;
		const existing = await getXiaofeiConversation(workspace.id, conversationId);
		if (existing && existing.channel !== "synthetic_support")
			throw new ORPCError("CONFLICT", {
				message: "This synthetic support ID is already owned by another channel.",
			});
		const state = existing
			? ConversationStateSchema.parse(existing.state)
			: createConversationState({
					id: conversationId,
					tenantId: snapshot.agent.tenantId,
					agentId: snapshot.agent.id,
					maxFollowUps: snapshot.agent.maxFollowUps,
				});
		const previousMessages = existing ? z.array(SupportMessageSchema).parse(existing.messages) : [];
		const previousTraces = existing ? z.array(TraceEventSchema).parse(existing.traceEvents) : [];
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
		const conversation = existing
			? await updateXiaofeiSupportConversation(workspace.id, conversationId, {
					state: toJson(nextState),
					messages: toJson(messages.slice(-160)),
					traceEvents: toJson(traces),
					lastCustomerSeenAt: now,
					lastMessageAt: now,
				})
			: await upsertXiaofeiSyntheticSupportConversation({
					organizationId,
					externalId: input.externalId,
					state: toJson(nextState),
					messages: toJson(messages.slice(-160)),
					traceEvents: toJson(traces),
					lastCustomerSeenAt: now,
					lastMessageAt: now,
				});
		return {
			conversationId: conversation.externalId,
			ownerType: ConversationStateSchema.parse(conversation.state).ownerType,
			messages: z.array(SupportMessageSchema).parse(conversation.messages),
		};
	});

function toJson(value: unknown): Prisma.InputJsonValue {
	return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
