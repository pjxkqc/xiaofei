import { streamToEventIterator } from "@orpc/client";
import { createUIMessageStream, runXiaofeiTurn, type UIMessage } from "@repo/ai";
import { getXiaofeiOrganizationConfig, loadXiaofeiRuntimeHostingCapability } from "@repo/database";
import {
	deriveReleaseGates,
	materializeActiveCapabilitySnapshot,
	runP0EvalSuite,
	RuntimeMetadataSchema,
	type RuntimeMetadata,
	XiaofeiWorkspaceSnapshotSchema,
} from "@repo/xiaofei";
import z from "zod";

import { protectedProcedure } from "../../../orpc/procedures";
import {
	createKnowledgeWorkspaceBinding,
	getOrCreateConversation,
	getOrCreateXiaofeiWorkspace,
	getXiaofeiOrganizationId,
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
		const organizationId = await getXiaofeiOrganizationId(context);
		const [{ workspace, snapshot }, config] = await Promise.all([
			getOrCreateXiaofeiWorkspace(context),
			getXiaofeiOrganizationConfig(organizationId),
		]);
		if (!config?.xiaofeiEnabled)
			throw new Error("Xiaofei hosting is safely disabled for this Organization.");
		const capability = await loadXiaofeiRuntimeHostingCapability(organizationId, "active");
		const materialized = materializeActiveCapabilitySnapshot({
			base: snapshot,
			manifest: capability.manifest,
			revisions: capability.revisions,
		});
		const hostedSnapshot = await attachActualP0EvalEvidence(materialized);
		const conversation = await getOrCreateConversation({
			workspaceId: workspace.id,
			externalId: input.conversationId,
			snapshot: hostedSnapshot,
		});
		const result = await runXiaofeiTurn({
			message,
			state: conversation.state,
			snapshot: hostedSnapshot,
			knowledgeWorkspaceBinding: createKnowledgeWorkspaceBinding({
				workspace,
				snapshot: hostedSnapshot,
				conversationId: conversation.state.id,
				channelId: "authenticated:chatbot",
			}),
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

/**
 * A hosting CA is only admissible using the P0 suite calculated for that exact
 * materialized snapshot.  `runXiaofeiTurn` then owns the normal fail-closed
 * admission decision; this function must never manufacture a passing suite.
 */
export async function attachActualP0EvalEvidence(materialized: RuntimeParameters) {
	const evalSuite = await runP0EvalSuite(materialized);
	return XiaofeiWorkspaceSnapshotSchema.parse({
		...materialized,
		evalSuite,
		gates: deriveReleaseGates(
			materialized.knowledgeUnits,
			materialized.capabilityPlan,
			evalSuite.status,
			materialized.tools,
		),
	});
}

type RuntimeParameters = Parameters<typeof runP0EvalSuite>[0];

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
