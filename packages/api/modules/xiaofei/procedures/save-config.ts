import { runMastraGovernance } from "@repo/ai";
import { listXiaofeiKnowledgeUnits } from "@repo/database";
import { rebuildWorkspaceSnapshot } from "@repo/xiaofei";
import { z } from "zod";

import { supportProcedure } from "../../../orpc/procedures";
import {
	getOrCreateXiaofeiWorkspace,
	mergeManagedKnowledgeUnitsIntoSnapshot,
	requireXiaofeiOrganizationAdmin,
	saveXiaofeiSnapshot,
} from "../service";

export const saveXiaofeiConfig = supportProcedure
	.route({
		method: "PUT",
		path: "/xiaofei/config",
		tags: ["Xiaofei"],
		summary: "Save and validate Xiaofei Agent configuration",
	})
	.input(
		z.object({
			instructions: z.string().min(20).max(4_000),
			maxFollowUps: z.number().int().min(1).max(10),
			fallbackPolicy: z
				.object({
					maxClarifications: z.number().int().min(0).max(10),
					clarificationReply: z.string().trim().min(1).max(1_000),
					attentionReply: z.string().trim().min(1).max(1_000),
					handoffReply: z.string().trim().min(1).max(1_000),
				})
				.optional(),
			knowledgeMarkdown: z.string().min(50).max(50_000),
		}),
	)
	.handler(async ({ context, input }) => {
		await requireXiaofeiOrganizationAdmin(context);
		const { workspace, snapshot } = await getOrCreateXiaofeiWorkspace(context);
		const rebuilt = rebuildWorkspaceSnapshot({
			previous: snapshot,
			...input,
		});
		const managedUnits = await listXiaofeiKnowledgeUnits(workspace.id);
		const synchronized =
			managedUnits.length > 0
				? mergeManagedKnowledgeUnitsIntoSnapshot(rebuilt, managedUnits)
				: rebuilt;
		const governed = await runMastraGovernance(synchronized);
		return await saveXiaofeiSnapshot(context, governed);
	});
