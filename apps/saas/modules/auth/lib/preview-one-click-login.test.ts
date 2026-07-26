import {
	createPreviewOperatorSession,
	getOrCreatePreviewOperator,
	isPreviewOneClickLoginEnabled,
} from "@repo/auth/lib/preview-one-click-login";
import { describe, expect, it, vi } from "vitest";

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
});
