import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { supportProcedure } from "../../../orpc/procedures";
import {
	getIntegrationEvent,
	listIntegrationEvents,
	simulateOrganizationChannelEnvelope,
} from "../integration-events";

const listInput = z.object({
	cursor: z.string().min(1).optional(),
	limit: z.number().int().min(1).max(50).optional(),
	source: z.string().min(1).optional(),
	status: z.string().min(1).optional(),
	topic: z.string().min(1).optional(),
});

export const listIntegrationEventsProcedure = supportProcedure
	.input(listInput)
	.handler(async ({ context, input }) => await listIntegrationEvents(context, input));
export const getIntegrationEventProcedure = supportProcedure
	.input(z.object({ id: z.string().min(1) }))
	.handler(async ({ context, input }) => {
		const event = await getIntegrationEvent(context, input.id);
		if (!event) throw new ORPCError("NOT_FOUND", { message: "Integration event not found." });
		return event;
	});
export const simulateIntegrationEventProcedure = supportProcedure.handler(
	async ({ context }) =>
		await simulateOrganizationChannelEnvelope(context, {
			schemaVersion: "v1",
			source: "preview-simulator",
			eventId: crypto.randomUUID(),
			transport: { kind: "manual", topic: "preview.events" },
			eventType: "preview.sample",
			payload: { message: "Preview event", simulated: true },
		}),
);
