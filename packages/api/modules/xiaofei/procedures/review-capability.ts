import { ORPCError } from "@orpc/server";
import { setCapabilityPlanReview } from "@repo/xiaofei";
import { z } from "zod";

import { supportProcedure } from "../../../orpc/procedures";
import { getOrCreatePublicXiaofeiWorkspace, savePublicXiaofeiSnapshot } from "../service";

export const reviewXiaofeiCapability = supportProcedure
	.route({
		method: "POST",
		path: "/xiaofei/capability/review",
		tags: ["Xiaofei"],
		summary: "Review the capability plan derived from released Knowledge Units",
	})
	.input(z.object({ reviewed: z.boolean() }))
	.handler(async ({ input }) => {
		const { snapshot } = await getOrCreatePublicXiaofeiWorkspace();
		if (input.reviewed && snapshot.capabilityPlan.status === "blocked") {
			throw new ORPCError("BAD_REQUEST", {
				message: "At least one released Knowledge Unit is required.",
			});
		}

		return await savePublicXiaofeiSnapshot(setCapabilityPlanReview(snapshot, input.reviewed));
	});
