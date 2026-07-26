import { readFileSync } from "node:fs";
import path from "node:path";

import { getBetterAuthErrorLogFields } from "@repo/auth/lib/better-auth-error-log";
import {
	createPreviewOperatorSession,
	getOrCreatePreviewOperator,
	isPreviewOneClickLoginEnabled,
} from "@repo/auth/lib/preview-one-click-login";
import { describe, expect, it, vi } from "vitest";

import { requestPreviewOneClickLogin } from "./preview-one-click-login-client";

describe("Preview one-click login", () => {
	it("shows the login affordance only for an explicitly enabled Preview", () => {
		expect(
			isPreviewOneClickLoginEnabled({
				VERCEL_ENV: "preview",
				PREVIEW_ONE_CLICK_LOGIN_ENABLED: "true",
			}),
		).toBe(true);

		expect(
			isPreviewOneClickLoginEnabled({
				VERCEL_ENV: "preview",
				PREVIEW_ONE_CLICK_LOGIN_ENABLED: "false",
			}),
		).toBe(false);
		expect(
			isPreviewOneClickLoginEnabled({
				VERCEL_ENV: "production",
				PREVIEW_ONE_CLICK_LOGIN_ENABLED: "true",
			}),
		).toBe(false);
	});

	it("creates the Preview operator once and reuses it on later sign-ins", async () => {
		const createdUser = { id: "preview-user" };
		const findUserByEmail = vi
			.fn<(_: string) => Promise<typeof createdUser | null>>()
			.mockResolvedValueOnce(null)
			.mockResolvedValue(createdUser);
		const createUser = vi.fn<() => Promise<typeof createdUser>>().mockResolvedValue(createdUser);

		await expect(getOrCreatePreviewOperator({ findUserByEmail, createUser })).resolves.toBe(
			createdUser,
		);
		await expect(getOrCreatePreviewOperator({ findUserByEmail, createUser })).resolves.toBe(
			createdUser,
		);

		expect(createUser).toHaveBeenCalledTimes(1);
	});

	it("creates the Better Auth session and writes its session cookie without returning a token", async () => {
		const session = { id: "session-id", token: "server-only-token" };
		const createSession = vi.fn().mockResolvedValue(session);
		const setSessionCookie = vi.fn().mockResolvedValue(undefined);

		await expect(
			createPreviewOperatorSession({
				user: { id: "preview-user" },
				createSession,
				setSessionCookie,
			}),
		).resolves.toBe(session);

		expect(createSession).toHaveBeenCalledWith("preview-user");
		expect(setSessionCookie).toHaveBeenCalledWith(session, { id: "preview-user" });
	});

	it("sends the real one-click request as a same-origin JSON POST with an empty object", async () => {
		const fetchMock = vi.fn().mockResolvedValue(new Response());
		vi.stubGlobal("fetch", fetchMock);

		await requestPreviewOneClickLogin();

		expect(fetchMock).toHaveBeenCalledWith("/api/auth/preview-one-click-login", {
			method: "POST",
			credentials: "same-origin",
			headers: { "Content-Type": "application/json" },
			body: "{}",
		});
	});

	it("logs Better Auth failures with a strict non-sensitive allowlist", () => {
		expect(
			getBetterAuthErrorLogFields({
				code: "FORBIDDEN",
				status: 403,
				headers: { authorization: "secret" },
				body: { token: "secret" },
				secret: "secret",
			}),
		).toEqual({ event: "better_auth_api_error", code: "FORBIDDEN", status: 403 });
		expect(getBetterAuthErrorLogFields({ code: "secret", status: 418 })).toEqual({
			event: "better_auth_api_error",
			code: "UNKNOWN",
			status: 500,
		});
	});

	it("does not pass the Better Auth context or raw error to the logger", () => {
		const authSource = readFileSync(
			path.resolve(import.meta.dirname, "../../../../../packages/auth/auth.ts"),
			"utf8",
		);

		expect(authSource).toContain(
			'logger.error("Better Auth request failed", getBetterAuthErrorLogFields(error))',
		);
		expect(authSource).not.toContain("logger.error(error, { ctx })");
	});
});
