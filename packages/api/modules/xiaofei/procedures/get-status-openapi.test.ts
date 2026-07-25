import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { describe, expect, it, vi } from "vitest";

vi.mock("@repo/auth", () => ({
	auth: {
		api: {
			getSession: vi.fn(),
		},
	},
}));

import { publicProcedure } from "../../../orpc/procedures";
import { getXiaofeiStatus } from "./get-status";

const testRouter = publicProcedure.router({
	xiaofei: {
		status: getXiaofeiStatus,
	},
});

const handler = new OpenAPIHandler(testRouter, {
	plugins: [
		new OpenAPIReferencePlugin({
			schemaConverters: [new ZodToJsonSchemaConverter()],
			specGenerateOptions: {
				info: {
					title: "Test API",
					version: "1.0.0",
				},
				servers: [{ url: "/api" }],
			},
			docsPath: "/docs",
		}),
	],
});

describe("Xiaofei status OpenAPI route", () => {
	it("serves the public GET route", async () => {
		const { matched, response } = await handler.handle(
			new Request("http://localhost/api/xiaofei/status"),
			{
				prefix: "/api",
				context: { headers: new Headers() },
			},
		);

		expect(matched).toBe(true);
		expect(response?.status).toBe(200);
		await expect(response?.json()).resolves.toMatchObject({
			service: "xiaofei",
			status: "ok",
			apiVersion: "1",
		});
	});

	it("includes the status operation in the API reference", async () => {
		const { matched, response } = await handler.handle(new Request("http://localhost/api/docs"), {
			prefix: "/api",
			context: { headers: new Headers() },
		});

		expect(matched).toBe(true);
		expect(response?.status).toBe(200);
		await expect(response?.text()).resolves.toContain("xiaofei.status");
	});
});
