import { readFileSync } from "node:fs";
import path from "node:path";

import { getBetterAuthErrorLogFields } from "@repo/auth/lib/better-auth-error-log";
import {
	createPreviewOperatorSession,
	createPreviewFixtureInput,
	getOrCreatePreviewOperator,
	initializePreviewFixtures,
	isPreviewOneClickLoginEnabled,
	previewRoleAccounts,
} from "@repo/auth/lib/preview-one-click-login";
import { describe, expect, it, vi } from "vitest";

import {
	completePreviewOneClickLogin,
	getLoginRedirectPath,
	requestPreviewOneClickLogin,
	sanitizePreviewRedirectPath,
} from "./preview-one-click-login-client";

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

	it("keeps the public role manifest unique and maps fixed Organization roles", () => {
		expect(new Set(previewRoleAccounts.map((account) => account.email)).size).toBe(
			previewRoleAccounts.length,
		);
		const input = createPreviewFixtureInput({
			"preview-global-admin@xiaofei.invalid": "global-admin-hash",
			"preview-owner@xiaofei.invalid": "owner-hash",
			"preview-admin@xiaofei.invalid": "admin-hash",
			"preview-member@xiaofei.invalid": "member-hash",
			"preview-owner-b@xiaofei.invalid": "owner-b-hash",
		});
		expect(input.users).toContainEqual(
			expect.objectContaining({
				email: "preview-global-admin@xiaofei.invalid",
				role: "admin",
				passwordHash: "global-admin-hash",
			}),
		);
		expect(
			input.memberships.some(
				(membership) => membership.userEmail === "preview-global-admin@xiaofei.invalid",
			),
		).toBe(false);
		expect(input.memberships).toEqual(
			expect.arrayContaining([
				{ organizationSlug: "fly-99-a", userEmail: "preview-owner@xiaofei.invalid", role: "owner" },
				{ organizationSlug: "fly-99-a", userEmail: "preview-admin@xiaofei.invalid", role: "admin" },
				{
					organizationSlug: "fly-99-a",
					userEmail: "preview-member@xiaofei.invalid",
					role: "member",
				},
				{
					organizationSlug: "fly-99-b",
					userEmail: "preview-owner-b@xiaofei.invalid",
					role: "owner",
				},
			]),
		);
	});

	it("reconciles fixed hashes and roles on repeated initialization without deleting unrelated data", async () => {
		const hashPassword = vi.fn(async (password: string) => `hash:${password}`);
		const synchronizeFixtures = vi.fn(
			async (_input: ReturnType<typeof createPreviewFixtureInput>) => undefined,
		);
		await initializePreviewFixtures({ hashPassword, synchronizeFixtures });
		await initializePreviewFixtures({ hashPassword, synchronizeFixtures });
		expect(hashPassword).toHaveBeenCalledTimes(previewRoleAccounts.length * 2);
		expect(synchronizeFixtures).toHaveBeenCalledTimes(2);
		const first = synchronizeFixtures.mock.calls[0][0];
		expect(
			first.users
				.slice(1)
				.every((user) => "passwordHash" in user && user.passwordHash.startsWith("hash:")),
		).toBe(true);
		expect(first.customers).toHaveLength(2);
		expect(first).not.toHaveProperty("delete");
		const globalAdmin = first.users.find(
			(user) => user.email === "preview-global-admin@xiaofei.invalid",
		);
		expect(globalAdmin && "role" in globalAdmin ? globalAdmin.role : undefined).toBe("admin");
	});

	it("renders role accounts only behind the Preview login flag", () => {
		const loginFormSource = readFileSync(
			path.resolve(import.meta.dirname, "../components/LoginForm.tsx"),
			"utf8",
		);
		expect(loginFormSource).toContain("previewOneClickLoginEnabled &&");
		expect(loginFormSource).toContain("Test role accounts");
		expect(loginFormSource).not.toContain('from "@repo/auth"');
		const loginPageSource = readFileSync(
			path.resolve(import.meta.dirname, "../../../app/(unauthenticated)/login/page.tsx"),
			"utf8",
		);
		expect(loginPageSource).toContain("previewOneClickLoginEnabled ? previewRoleAccounts : []");
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

	it("uses a full-page navigation away from /login after a successful Preview sign-in", async () => {
		const navigate = vi.fn();

		await completePreviewOneClickLogin({
			redirectPath: "/knowledge/units",
			request: vi.fn().mockResolvedValue(new Response()),
			navigate,
		});

		expect(navigate).toHaveBeenCalledWith("/knowledge/units");
	});

	it.each([
		["/knowledge/units?tab=draft#review", "/knowledge/units?tab=draft#review"],
		["/\\evil.example", "/"],
		["\\\\evil.example", "/"],
		["//evil.example", "/"],
		["https://evil.example", "/"],
		["/\u0000evil.example", "/"],
		["/\tevil.example", "/"],
		["/\nevil.example", "/"],
	])("allows only safe same-origin paths: %j", (input, expected) => {
		expect(sanitizePreviewRedirectPath(input)).toBe(expected);
	});

	it.each([
		["/knowledge/units", "/knowledge/units"],
		["/\\evil.example", "/"],
		["//evil.example", "/"],
		["https://evil.example", "/"],
		["/\u0000evil.example", "/"],
	])(
		"sanitizes the already-authenticated login redirect before navigation: %j",
		(redirectTo, expected) => {
			expect(
				getLoginRedirectPath({
					invitationId: null,
					redirectTo,
					fallbackPath: "/",
				}),
			).toBe(expected);
		},
	);

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
