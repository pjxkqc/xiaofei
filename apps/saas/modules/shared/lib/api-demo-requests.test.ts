import { describe, expect, it, vi } from "vitest";

import {
	EXTERNAL_STATUS_URL,
	runExternalStatusRequest,
	runTypedStatusRequest,
	TYPED_RPC_STATUS_URL,
} from "./api-demo-requests";

function createClock(...values: number[]): () => number {
	return vi.fn(() => values.shift() ?? 0);
}

describe("API demo requests", () => {
	it("records the external HTTP response metadata and JSON", async () => {
		const body = {
			service: "xiaofei",
			status: "ok",
			apiVersion: "1",
			generatedAt: "2026-07-25T00:00:00.000Z",
		};
		const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
			new Response(JSON.stringify(body), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		);

		const result = await runExternalStatusRequest(fetcher, createClock(10, 23));

		expect(fetcher).toHaveBeenCalledWith(EXTERNAL_STATUS_URL, {
			method: "GET",
			headers: { Accept: "application/json" },
		});
		expect(result).toEqual({
			method: "GET",
			url: EXTERNAL_STATUS_URL,
			httpStatus: 200,
			durationMs: 13,
			state: "success",
			body,
		});
	});

	it("records typed RPC results while marking transport status unavailable", async () => {
		const body = { service: "xiaofei", status: "ok" };

		const result = await runTypedStatusRequest(
			vi.fn().mockResolvedValue(body),
			createClock(100, 104),
		);

		expect(result).toEqual({
			method: "POST",
			url: TYPED_RPC_STATUS_URL,
			httpStatus: null,
			durationMs: 4,
			state: "success",
			body,
		});
	});

	it("does not expose thrown error details", async () => {
		const result = await runTypedStatusRequest(
			vi.fn().mockRejectedValue(new Error("secret internal trace")),
			createClock(1, 2),
		);

		expect(JSON.stringify(result.body)).not.toContain("secret internal trace");
		expect(result.state).toBe("error");
	});
});
