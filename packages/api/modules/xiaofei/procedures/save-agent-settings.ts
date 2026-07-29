import { runMastraGovernance } from "@repo/ai";
import { updateAgentSettingsSnapshot } from "@repo/xiaofei";
import { z } from "zod";

import { supportProcedure } from "../../../orpc/procedures";
import { getOrCreatePublicXiaofeiWorkspace, savePublicXiaofeiSnapshot } from "../service";

export const saveXiaofeiAgentSettings = supportProcedure
	.route({
		method: "PATCH",
		path: "/xiaofei/agent-settings",
		tags: ["Xiaofei"],
		summary: "Update Xiaofei Agent behavior without rebuilding Knowledge Units",
	})
	.input(
		z.discriminatedUnion("section", [
			z.object({
				section: z.literal("general"),
				instructions: z.string().trim().min(20).max(4_000),
				maxFollowUps: z.number().int().min(1).max(10),
			}),
			z.object({
				section: z.literal("fallback"),
				fallbackPolicy: z.object({
					maxClarifications: z.number().int().min(0).max(10),
					clarificationReply: z.string().trim().min(1).max(1_000),
					attentionReply: z.string().trim().min(1).max(1_000),
					handoffReply: z.string().trim().min(1).max(1_000),
				}),
			}),
		]),
	)
	.handler(async ({ input }) => {
		const { snapshot } = await getOrCreatePublicXiaofeiWorkspace();
		const updated = updateAgentSettingsSnapshot({
			previous: snapshot,
			instructions: input.section === "general" ? input.instructions : snapshot.agent.instructions,
			maxFollowUps: input.section === "general" ? input.maxFollowUps : snapshot.agent.maxFollowUps,
			fallbackPolicy:
				input.section === "fallback" ? input.fallbackPolicy : snapshot.agent.fallbackPolicy,
		});
		return await savePublicXiaofeiSnapshot(await runMastraGovernance(updated));
	});
