import { z } from "zod";

import { protectedProcedure } from "../../../orpc/procedures";
import { resetConversation } from "../service";

export const resetXiaofeiConversation = protectedProcedure
	.route({
		method: "DELETE",
		path: "/xiaofei/conversations/{conversationId}",
		tags: ["Xiaofei"],
		summary: "Reset a Xiaofei preview conversation",
	})
	.input(
		z.object({
			conversationId: z.string().min(1).max(128),
		}),
	)
	.handler(async ({ context, input }) => {
		await resetConversation(context, input.conversationId);
		return { success: true };
	});
