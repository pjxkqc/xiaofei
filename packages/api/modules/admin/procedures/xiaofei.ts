import { ORPCError } from "@orpc/server";
import {
	getAdminXiaofeiOrganizationDetail,
	getAdminXiaofeiOverview,
	listAdminXiaofeiOrganizations,
	upsertXiaofeiOrganizationConfig,
} from "@repo/database";
import { z } from "zod";

import { adminProcedure } from "../../../orpc/procedures";

const organizationIdSchema = z.string().min(1).max(128);

export const getXiaofeiOverview = adminProcedure.handler(
	async () => await getAdminXiaofeiOverview(),
);

export const listXiaofeiOrganizations = adminProcedure
	.input(
		z.object({
			query: z.string().trim().max(120).optional(),
			enabled: z.boolean().optional(),
			limit: z.number().int().min(1).max(100).default(20),
			offset: z.number().int().min(0).default(0),
		}),
	)
	.handler(async ({ input }) => await listAdminXiaofeiOrganizations(input));

export const getXiaofeiOrganization = adminProcedure
	.input(z.object({ organizationId: organizationIdSchema }))
	.handler(async ({ input }) => {
		const detail = await getAdminXiaofeiOrganizationDetail(input.organizationId);
		if (!detail) throw new ORPCError("NOT_FOUND", { message: "Organization not found." });
		return detail;
	});

export const updateXiaofeiOrganization = adminProcedure
	.input(
		z.object({
			organizationId: organizationIdSchema,
			externalMerchantId: z.string().trim().min(1).max(120).nullable().optional(),
			xiaofeiEnabled: z.boolean().optional(),
		}),
	)
	.handler(async ({ input }) => {
		try {
			return await upsertXiaofeiOrganizationConfig(input.organizationId, {
				...(input.externalMerchantId === undefined
					? {}
					: { externalMerchantId: input.externalMerchantId }),
				...(input.xiaofeiEnabled === undefined ? {} : { xiaofeiEnabled: input.xiaofeiEnabled }),
			});
		} catch (error) {
			if (isUniqueViolation(error))
				throw new ORPCError("CONFLICT", {
					message: "This external merchant ID is already assigned to another Organization.",
				});
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Unable to update Xiaofei configuration.",
			});
		}
	});

function isUniqueViolation(error: unknown) {
	return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}
