import { call } from "@orpc/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@repo/auth", () => ({
	auth: {
		api: {
			getSession: vi.fn(),
		},
	},
}));

import { getXiaofeiStatus, xiaofeiStatusSchema } from "./get-status";

describe("getXiaofeiStatus", () => {
	it("returns the allowlisted public status contract without authentication", async () => {
		const result = await call(getXiaofeiStatus, undefined, {
			context: { headers: new Headers() },
		});

		expect(xiaofeiStatusSchema.parse(result)).toEqual(result);
		expect(result).toMatchObject({
			service: "xiaofei",
			status: "ok",
			apiVersion: "1",
		});
		expect(Object.keys(result).sort()).toEqual(
			["apiVersion", "generatedAt", "service", "status"].sort(),
		);
	});
});
