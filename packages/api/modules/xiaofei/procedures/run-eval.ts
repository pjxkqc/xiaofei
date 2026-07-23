import { deriveReleaseGates, runP0EvalSuite } from "@repo/xiaofei";

import { protectedProcedure } from "../../../orpc/procedures";
import { getOrCreateXiaofeiWorkspace, saveXiaofeiSnapshot } from "../service";

export const runXiaofeiEval = protectedProcedure
	.route({
		method: "POST",
		path: "/xiaofei/eval",
		tags: ["Xiaofei"],
		summary: "Run deterministic Xiaofei P0 release assertions",
	})
	.handler(async ({ context }) => {
		const { snapshot } = await getOrCreateXiaofeiWorkspace(context);
		const evalSuite = await runP0EvalSuite(snapshot);
		return await saveXiaofeiSnapshot(context, {
			...snapshot,
			evalSuite,
			gates: deriveReleaseGates(snapshot.knowledgeUnits, evalSuite.status, snapshot.tools),
			updatedAt: evalSuite.updatedAt,
		});
	});
