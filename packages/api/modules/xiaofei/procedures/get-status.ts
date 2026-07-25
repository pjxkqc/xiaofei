import { z } from "zod";

import { publicProcedure } from "../../../orpc/procedures";

export const xiaofeiStatusSchema = z.object({
	service: z.literal("xiaofei"),
	status: z.literal("ok"),
	apiVersion: z.literal("1"),
	generatedAt: z.iso.datetime(),
});

export const getXiaofeiStatus = publicProcedure
	.route({
		method: "GET",
		path: "/xiaofei/status",
		tags: ["Xiaofei"],
		summary: "Get Xiaofei API status",
		description: "Return the public, database-free Xiaofei API status contract.",
	})
	.output(xiaofeiStatusSchema)
	.handler(async () => ({
		service: "xiaofei" as const,
		status: "ok" as const,
		apiVersion: "1" as const,
		generatedAt: new Date().toISOString(),
	}));
