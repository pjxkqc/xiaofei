import { ORPCError } from "@orpc/server";
import { setCapabilityPlanReview } from "@repo/xiaofei";
import { z } from "zod";

import { supportProcedure } from "../../../orpc/procedures";
import {
	getOrCreateXiaofeiWorkspace,
	requireXiaofeiOrganizationAdmin,
	saveXiaofeiSnapshot,
} from "../service";

export const reviewXiaofeiCapability = supportProcedure
	.route({
		method: "POST",
		path: "/xiaofei/capability/review",
		tags: ["Xiaofei"],
		summary: "Review the capability plan derived from released Knowledge Units",
	})
	.input(z.object({ reviewed: z.boolean() }))
	.handler(async ({ context, input }) => {
		await requireXiaofeiOrganizationAdmin(context);
		const { snapshot } = await getOrCreateXiaofeiWorkspace(context);
		if (input.reviewed && snapshot.capabilityPlan.status === "blocked") {
			throw new ORPCError("BAD_REQUEST", {
				message: "At least one released Knowledge Unit is required.",
			});
		}

		return await saveXiaofeiSnapshot(context, setCapabilityPlanReview(snapshot, input.reviewed));
	});
