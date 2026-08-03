import { z } from "zod";

import { publicProcedure, supportProcedure } from "../../../orpc/procedures";
import {
	getPublicSupportConversation,
	getSupportConversation,
	listSupportConversations,
	sendHumanSupportMessage,
	sendPublicSupportMessage,
	setSupportConversationOwner,
	startPublicSupportConversation,
} from "../support-service";

export const publicConversationIdSchema = z.string().uuid();
export const agentConversationIdSchema = z.string().trim().min(1).max(200);
const messageSchema = z.string().trim().min(1).max(2_000);

export const startSupportConversation = publicProcedure
	.route({
		method: "POST",
		path: "/xiaofei/public/conversations",
		tags: ["Xiaofei Support"],
		summary: "Start a public customer support conversation",
	})
	.input(z.object({ customerName: z.string().trim().max(80).default("") }))
	.handler(async ({ input }) => await startPublicSupportConversation(input.customerName));

export const getPublicConversation = publicProcedure
	.route({
		method: "GET",
		path: "/xiaofei/public/conversations/{conversationId}",
		tags: ["Xiaofei Support"],
		summary: "Read and heartbeat a public customer support conversation",
	})
	.input(z.object({ conversationId: publicConversationIdSchema }))
	.handler(async ({ input }) => await getPublicSupportConversation(input.conversationId));

export const sendPublicMessage = publicProcedure
	.route({
		method: "POST",
		path: "/xiaofei/public/conversations/{conversationId}/messages",
		tags: ["Xiaofei Support"],
		summary: "Send a customer message to Xiaofei or the assigned human agent",
	})
	.input(z.object({ conversationId: publicConversationIdSchema, text: messageSchema }))
	.handler(async ({ input }) => await sendPublicSupportMessage(input.conversationId, input.text));

export const listAgentConversations = supportProcedure
	.route({
		method: "GET",
		path: "/xiaofei/support/conversations",
		tags: ["Xiaofei Support"],
		summary: "List customer support conversations for support agents",
	})
	.handler(async ({ context }) => await listSupportConversations(context));

export const getAgentConversation = supportProcedure
	.route({
		method: "GET",
		path: "/xiaofei/support/conversations/{conversationId}",
		tags: ["Xiaofei Support"],
		summary: "Read a customer support conversation",
	})
	.input(z.object({ conversationId: agentConversationIdSchema }))
	.handler(
		async ({ context, input }) => await getSupportConversation(context, input.conversationId),
	);

export const setAgentConversationOwner = supportProcedure
	.route({
		method: "POST",
		path: "/xiaofei/support/conversations/{conversationId}/owner",
		tags: ["Xiaofei Support"],
		summary: "Transfer a support conversation between Xiaofei and a human agent",
	})
	.input(
		z.object({
			conversationId: agentConversationIdSchema,
			owner: z.enum(["ai", "human"]),
		}),
	)
	.handler(
		async ({ context, input }) =>
			await setSupportConversationOwner({
				context,
				externalId: input.conversationId,
				owner: input.owner,
				user: { id: context.user.id, name: context.user.name },
			}),
	);

export const sendAgentMessage = supportProcedure
	.route({
		method: "POST",
		path: "/xiaofei/support/conversations/{conversationId}/messages",
		tags: ["Xiaofei Support"],
		summary: "Send a human support reply",
	})
	.input(z.object({ conversationId: agentConversationIdSchema, text: messageSchema }))
	.handler(
		async ({ context, input }) =>
			await sendHumanSupportMessage({
				context,
				externalId: input.conversationId,
				text: input.text,
				user: { id: context.user.id, name: context.user.name },
			}),
	);
