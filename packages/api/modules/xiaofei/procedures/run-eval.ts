import { ORPCError } from "@orpc/server";
import { deriveReleaseGates, runP0EvalSuite } from "@repo/xiaofei";

import { supportProcedure } from "../../../orpc/procedures";
import { getOrCreatePublicXiaofeiWorkspace, savePublicXiaofeiSnapshot } from "../service";

export const runXiaofeiEval = supportProcedure
	.route({
		method: "POST",
		path: "/xiaofei/eval",
		tags: ["Xiaofei"],
		summary: "Run deterministic Xiaofei P0 release assertions",
	})
	.handler(async () => {
		const { snapshot } = await getOrCreatePublicXiaofeiWorkspace();
		if (!snapshot.capabilityPlan.reviewed) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Review the KU capability plan before running P0 Eval.",
			});
		}
		const evalSuite = await runP0EvalSuite(snapshot);
		return await savePublicXiaofeiSnapshot({
			...snapshot,
			evalSuite,
			gates: deriveReleaseGates(
				snapshot.knowledgeUnits,
				snapshot.capabilityPlan,
				evalSuite.status,
				snapshot.tools,
			),
			updatedAt: evalSuite.updatedAt,
		});
	});
