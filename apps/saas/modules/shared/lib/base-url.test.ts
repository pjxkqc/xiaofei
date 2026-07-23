import { getAllowedAppHosts } from "@repo/utils";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getBaseUrl } from "./base-url";

describe("getBaseUrl (saas)", () => {
	const originalEnv = process.env;

	beforeEach(() => {
		process.env = { ...originalEnv };
		delete process.env.NEXT_PUBLIC_SAAS_URL;
		delete process.env.NEXT_PUBLIC_VERCEL_BRANCH_URL;
		delete process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL;
		delete process.env.NEXT_PUBLIC_VERCEL_URL;
		delete process.env.VERCEL_BRANCH_URL;
		delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
		delete process.env.VERCEL_URL;
		delete process.env.PORT;
	});

	afterEach(() => {
		process.env = originalEnv;
	});

	it("returns the NEXT_PUBLIC_SAAS_URL when set", () => {
		process.env.NEXT_PUBLIC_SAAS_URL = "https://app.example.com";
		expect(getBaseUrl()).toBe("https://app.example.com");
	});

	it("returns a Vercel URL when NEXT_PUBLIC_VERCEL_URL is set", () => {
		process.env.NEXT_PUBLIC_VERCEL_URL = "my-app.vercel.app";
		expect(getBaseUrl()).toBe("https://my-app.vercel.app");
	});

	it("returns the current Vercel deployment URL", () => {
		process.env.VERCEL_URL = "xiaofei-git-feature-pjxkqc.vercel.app";
		process.env.VERCEL_BRANCH_URL = "xiaofei-feature.vercel.app";
		process.env.NEXT_PUBLIC_VERCEL_URL = "xiaofei-public.vercel.app";

		expect(getBaseUrl()).toBe("https://xiaofei-git-feature-pjxkqc.vercel.app");
	});

	it("uses the Vercel branch URL when the deployment URL is unavailable", () => {
		process.env.VERCEL_BRANCH_URL = "xiaofei-feature.vercel.app";

		expect(getBaseUrl()).toBe("https://xiaofei-feature.vercel.app");
	});

	it("returns localhost:3000 by default", () => {
		expect(getBaseUrl()).toBe("http://localhost:3000");
	});

	it("uses PORT env when set and no other env vars", () => {
		process.env.PORT = "4000";
		expect(getBaseUrl()).toBe("http://localhost:4000");
	});

	it("prefers NEXT_PUBLIC_SAAS_URL over NEXT_PUBLIC_VERCEL_URL", () => {
		process.env.NEXT_PUBLIC_SAAS_URL = "https://app.example.com";
		process.env.VERCEL_URL = "xiaofei-preview.vercel.app";
		process.env.NEXT_PUBLIC_VERCEL_URL = "my-app.vercel.app";
		expect(getBaseUrl()).toBe("https://app.example.com");
	});

	it("allows the exact production, branch, and deployment hosts on Vercel", () => {
		process.env = { ...process.env, NODE_ENV: "production" };
		process.env.VERCEL_PROJECT_PRODUCTION_URL = "xiaofei-preview.vercel.app";
		process.env.VERCEL_BRANCH_URL = "xiaofei-preview-git-feature-flyranking16.vercel.app";
		process.env.VERCEL_URL = "xiaofei-preview-abc123-flyranking16.vercel.app";

		expect(getAllowedAppHosts()).toEqual([
			"xiaofei-preview.vercel.app",
			"xiaofei-preview-git-feature-flyranking16.vercel.app",
			"xiaofei-preview-abc123-flyranking16.vercel.app",
		]);
	});

	it("normalizes configured URLs and removes duplicate hosts", () => {
		process.env = { ...process.env, NODE_ENV: "production" };
		process.env.VERCEL_PROJECT_PRODUCTION_URL = "app.example.com";

		expect(getAllowedAppHosts("https://app.example.com/path")).toEqual(["app.example.com"]);
	});
});
