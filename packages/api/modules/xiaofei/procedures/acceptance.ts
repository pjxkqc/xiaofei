import { runXiaofeiTurn } from "@repo/ai";
import { upsertXiaofeiSyntheticSupportConversation } from "@repo/database";
import {
	ConversationStateSchema,
	SupportMessageSchema,
	createConversationState,
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
		const state = createConversationState({
			id: conversationId,
			tenantId: snapshot.agent.tenantId,
			agentId: snapshot.agent.id,
			maxFollowUps: snapshot.agent.maxFollowUps,
		});
		const result = await runXiaofeiTurn({
			message: input.text,
			state,
			snapshot,
			knowledgeWorkspaceBinding: createKnowledgeWorkspaceBinding({
				workspace,
				snapshot,
				conversationId,
				channelId: "synthetic_support",
			}),
		});
		const now = new Date();
		const customer = SupportMessageSchema.parse({
			id: crypto.randomUUID(),
			role: "customer",
			authorName: "Synthetic acceptance customer",
			text: input.text,
			createdAt: now.toISOString(),
		});
		const reply = SupportMessageSchema.parse({
			id: crypto.randomUUID(),
			role: "ai",
			authorName: snapshot.agent.name,
			text: result.reply,
			createdAt: now.toISOString(),
		});
		const conversation = await upsertXiaofeiSyntheticSupportConversation({
			organizationId,
			externalId: input.externalId,
			state: result.state,
			messages: [customer, reply],
			traceEvents: result.metadata.traces,
			lastCustomerSeenAt: now,
			lastMessageAt: now,
		});
		return {
			conversationId: conversation.externalId,
			reply: result.reply,
			ownerType: ConversationStateSchema.parse(result.state).ownerType,
		};
	});
