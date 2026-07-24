import { streamToEventIterator } from "@orpc/client";
import { createUIMessageStream, runXiaofeiTurn, type UIMessage } from "@repo/ai";
import { RuntimeMetadataSchema, type RuntimeMetadata } from "@repo/xiaofei";
import z from "zod";

import { protectedProcedure } from "../../../orpc/procedures";
import {
	getOrCreateConversation,
	getOrCreateXiaofeiWorkspace,
	saveConversation,
} from "../../xiaofei/service";

type XiaofeiDataParts = Record<string, unknown> & {
	"xiaofei-runtime": RuntimeMetadata;
};

type XiaofeiUIMessage = UIMessage<unknown, XiaofeiDataParts>;

export const streamMessage = protectedProcedure
	.route({
		method: "POST",
		path: "/ai/stream",
		tags: ["AI"],
		summary: "Run a governed Xiaofei Agent turn",
		description: "Run LangGraph state orchestration with governed Mastra Agent generation",
	})
	.input(
		z.object({
			conversationId: z.string().min(1).max(128),
			messages: z.array(z.any() as z.ZodType<XiaofeiUIMessage>),
		}),
	)
	.handler(async ({ context, input }) => {
		const message = getLastUserText(input.messages);
		const { workspace, snapshot } = await getOrCreateXiaofeiWorkspace(context);
		const conversation = await getOrCreateConversation({
			workspaceId: workspace.id,
			externalId: input.conversationId,
			snapshot,
		});
		const result = await runXiaofeiTurn({
			message,
			state: conversation.state,
			snapshot,
		});
		const traces = [...conversation.traces, ...result.metadata.traces].slice(-80);
		await saveConversation({
			workspaceId: workspace.id,
			externalId: input.conversationId,
			state: result.state,
			traces,
		});

		const response = createUIMessageStream<XiaofeiUIMessage>({
			originalMessages: input.messages,
			execute({ writer }) {
				writer.write({
					type: "data-xiaofei-runtime",
					data: RuntimeMetadataSchema.parse(result.metadata),
				});
				const textPartId = globalThis.crypto.randomUUID();
				writer.write({ type: "text-start", id: textPartId });
				writer.write({ type: "text-delta", id: textPartId, delta: result.reply });
				writer.write({ type: "text-end", id: textPartId });
			},
			onError() {
				return "Xiaofei could not complete this governed turn.";
			},
		});

		return streamToEventIterator(response);
	});

function getLastUserText(messages: XiaofeiUIMessage[]): string {
	let lastUserMessage: XiaofeiUIMessage | undefined;
	for (let index = messages.length - 1; index >= 0; index -= 1) {
		if (messages[index]?.role === "user") {
			lastUserMessage = messages[index];
			break;
		}
	}
	const text = lastUserMessage?.parts
		.flatMap((part) => (part.type === "text" ? [part.text] : []))
		.join("\n")
		.trim();
	if (!text) throw new Error("A user text message is required.");
	return text;
}
