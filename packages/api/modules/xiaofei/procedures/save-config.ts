import { runMastraGovernance } from "@repo/ai";
import { rebuildWorkspaceSnapshot } from "@repo/xiaofei";
import { z } from "zod";

import { supportProcedure } from "../../../orpc/procedures";
import { getOrCreateXiaofeiWorkspace, saveXiaofeiSnapshot } from "../service";

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
			maxFollowUps: z.number().int().min(1).max(5),
			knowledgeMarkdown: z.string().min(50).max(50_000),
		}),
	)
	.handler(async ({ context, input }) => {
		const { snapshot } = await getOrCreateXiaofeiWorkspace(context);
		const rebuilt = rebuildWorkspaceSnapshot({
			previous: snapshot,
			...input,
		});
		const governed = await runMastraGovernance(rebuilt);
		return await saveXiaofeiSnapshot(context, governed);
	});
