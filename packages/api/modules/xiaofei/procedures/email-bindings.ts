import {
	createXiaofeiOrganizationEmailChannelBinding,
	disableXiaofeiOrganizationEmailChannelBinding,
	enableXiaofeiOrganizationEmailChannelBinding,
	listXiaofeiOrganizationEmailChannelBindings,
	updateXiaofeiOrganizationEmailChannelBinding,
} from "@repo/database";
import { z } from "zod";

import { supportProcedure } from "../../../orpc/procedures";
import { getXiaofeiOrganizationId, requireXiaofeiOrganizationAdmin } from "../service";

const bindingInput = z.object({
	companyId: z.string().trim().min(1).max(120),
	channelAccountId: z.string().trim().min(1).max(200),
	address: z.string().trim().email().max(320),
	status: z.enum(["active", "disabled"]).optional(),
});

export const listEmailBindingsProcedure = supportProcedure.handler(async ({ context }) => {
	const organizationId = await getXiaofeiOrganizationId(context);
	const tenantKey = await requireXiaofeiOrganizationAdmin(context).catch(() => null);
	return {
		items: await listXiaofeiOrganizationEmailChannelBindings(organizationId),
		canManage: tenantKey !== null,
	};
});
export const createEmailBindingProcedure = supportProcedure
	.input(bindingInput)
	.handler(async ({ context, input }) => {
		await requireXiaofeiOrganizationAdmin(context);
		return createXiaofeiOrganizationEmailChannelBinding(
			await getXiaofeiOrganizationId(context),
			input,
		);
	});
export const updateEmailBindingProcedure = supportProcedure
	.input(z.object({ id: z.string().min(1), data: bindingInput.partial() }))
	.handler(async ({ context, input }) => {
		await requireXiaofeiOrganizationAdmin(context);
		return updateXiaofeiOrganizationEmailChannelBinding(
			await getXiaofeiOrganizationId(context),
			input.id,
			input.data,
		);
	});
export const enableEmailBindingProcedure = supportProcedure
	.input(z.object({ id: z.string().min(1) }))
	.handler(async ({ context, input }) => {
		await requireXiaofeiOrganizationAdmin(context);
		return enableXiaofeiOrganizationEmailChannelBinding(
			await getXiaofeiOrganizationId(context),
			input.id,
		);
	});
export const disableEmailBindingProcedure = supportProcedure
	.input(z.object({ id: z.string().min(1) }))
	.handler(async ({ context, input }) => {
		await requireXiaofeiOrganizationAdmin(context);
		return disableXiaofeiOrganizationEmailChannelBinding(
			await getXiaofeiOrganizationId(context),
			input.id,
		);
	});
