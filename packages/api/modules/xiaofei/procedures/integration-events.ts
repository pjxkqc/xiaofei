import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { supportProcedure } from "../../../orpc/procedures";
import {
	getIntegrationEvent,
	listIntegrationEvents,
	runMockWorker,
	runMockEmailMirror,
	listEmailMirrorMetadata,
	getEmailMirrorDetail,
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

export const runMockWorkerProcedure = supportProcedure
	.input(
		z.object({
			externalMerchantId: z.string().trim().min(1).max(120),
			externalCustomerId: z.string().trim().min(1).max(120),
			channel: z.enum(["email", "whatsapp"]),
			externalConversationId: z.string().trim().min(1).max(200),
			externalMessageId: z.string().trim().min(1).max(200),
			title: z.string().trim().max(300).optional(),
			text: z.string().trim().min(1).max(10_000),
		}),
	)
	.handler(
		async ({ context, input }) =>
			await runMockWorker(context, { ...input, direction: "inbound", origin: "customer" }),
	);

export const runMockEmailMirrorProcedure = supportProcedure
	.input(
		z.object({
			companyId: z.string().min(1),
			channelAccountId: z.string().min(1),
			address: z.string().email(),
			externalConversationId: z.string().min(1),
			eventId: z.string().min(1),
			occurredAt: z.iso.datetime(),
			scenario: z.enum(["inbound_customer", "outbound_loopdesk", "outbound_xiaofei"]),
			text: z.string().min(1).max(10_000),
		}),
	)
	.handler(async ({ context, input }) => runMockEmailMirror(context, input));
export const listEmailMirrorMetadataProcedure = supportProcedure.handler(({ context }) =>
	listEmailMirrorMetadata(context),
);
export const getEmailMirrorDetailProcedure = supportProcedure
	.input(z.object({ id: z.string().min(1) }))
	.handler(async ({ context, input }) => {
		const event = await getEmailMirrorDetail(context, input.id);
		if (!event) throw new ORPCError("NOT_FOUND", { message: "Email mirror event not found." });
		return event;
	});
