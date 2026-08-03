import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { supportProcedure } from "../../../orpc/procedures";
import {
	getEmailDeliverySettings,
	getEmailOutboundDelivery,
	listEmailOutboundDeliveries,
	processMirroredEmailJob,
	retryEmailOutboundDelivery,
	saveEmailDeliverySettings,
	sendEmailCallbackTest,
} from "../email-delivery";

export const getEmailDeliverySettingsProcedure = supportProcedure.handler(({ context }) =>
	getEmailDeliverySettings(context),
);

export const saveEmailDeliverySettingsProcedure = supportProcedure
	.input(
		z.object({
			mode: z.enum(["mock", "webhook"]),
			callbackUrl: z.string().trim().max(2_000).nullable(),
		}),
	)
	.handler(({ context, input }) => saveEmailDeliverySettings(context, input));

export const listEmailOutboundDeliveriesProcedure = supportProcedure.handler(({ context }) =>
	listEmailOutboundDeliveries(context),
);

export const getEmailOutboundDeliveryProcedure = supportProcedure
	.input(z.object({ id: z.string().min(1) }))
	.handler(async ({ context, input }) => {
		const delivery = await getEmailOutboundDelivery(context, input.id);
		if (!delivery) throw new ORPCError("NOT_FOUND", { message: "Outbound delivery not found." });
		return delivery;
	});

export const processMirroredEmailJobProcedure = supportProcedure
	.input(z.object({ jobId: z.string().min(1) }))
	.handler(({ context, input }) => processMirroredEmailJob(context, input.jobId));

export const sendEmailCallbackTestProcedure = supportProcedure.handler(({ context }) =>
	sendEmailCallbackTest(context),
);

export const retryEmailOutboundDeliveryProcedure = supportProcedure
	.input(z.object({ id: z.string().min(1) }))
	.handler(({ context, input }) => retryEmailOutboundDelivery(context, input.id));
