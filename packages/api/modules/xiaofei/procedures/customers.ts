import { z } from "zod";

import { supportProcedure } from "../../../orpc/procedures";
import {
	archiveOrganizationCustomer,
	createOrganizationCustomer,
	getOrganizationCustomer,
	listOrganizationCustomers,
	updateOrganizationCustomer,
} from "../customer-service";

const externalCustomerId = z.string().trim().min(1).max(120);
const nullableText = z.string().trim().max(200).nullable().optional();
const customerInput = z.object({
	externalCustomerId,
	name: nullableText,
	email: z.string().trim().email().max(320).nullable().optional(),
	whatsappNumber: nullableText,
});
const customerUpdateInput = customerInput.omit({ externalCustomerId: true });

export const listCustomers = supportProcedure.handler(
	async ({ context }) => await listOrganizationCustomers(context),
);
export const getCustomer = supportProcedure
	.input(z.object({ externalCustomerId }))
	.handler(
		async ({ context, input }) => await getOrganizationCustomer(context, input.externalCustomerId),
	);
export const createCustomer = supportProcedure
	.input(customerInput)
	.handler(async ({ context, input }) => await createOrganizationCustomer(context, input));
export const updateCustomer = supportProcedure
	.input(z.object({ externalCustomerId, data: customerUpdateInput }))
	.handler(
		async ({ context, input }) =>
			await updateOrganizationCustomer(context, input.externalCustomerId, input.data),
	);
export const archiveCustomer = supportProcedure
	.input(z.object({ externalCustomerId }))
	.handler(
		async ({ context, input }) =>
			await archiveOrganizationCustomer(context, input.externalCustomerId),
	);
