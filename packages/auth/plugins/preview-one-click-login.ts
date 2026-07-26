import { createUser, getUserByEmail } from "@repo/database";
import { APIError, createAuthEndpoint, formCsrfMiddleware } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";

import {
	createPreviewOperatorSession,
	getOrCreatePreviewOperator,
	isPreviewOneClickLoginEnabled,
	previewOneClickLoginPath,
	previewOperatorEmail,
} from "../lib/preview-one-click-login";

export function previewOneClickLoginPlugin() {
	return {
		id: "preview-one-click-login",
		endpoints: {
			previewOneClickLogin: createAuthEndpoint(
				previewOneClickLoginPath,
				{
					method: "POST",
					use: [formCsrfMiddleware],
				},
				async (ctx) => {
					if (!isPreviewOneClickLoginEnabled()) {
						throw APIError.fromStatus("NOT_FOUND", { message: "Not found" });
					}

					const user = await getOrCreatePreviewOperator({
						findUserByEmail: getUserByEmail,
						createUser: () =>
							createUser({
								email: previewOperatorEmail,
								name: "Preview operator",
								role: "user",
								emailVerified: true,
								onboardingComplete: true,
							}),
					});

					const session = await createPreviewOperatorSession({
						user,
						createSession: (userId) => ctx.context.internalAdapter.createSession(userId),
						setSessionCookie: (createdSession, sessionUser) =>
							setSessionCookie(ctx, { session: createdSession, user: sessionUser }),
					});

					if (!session) {
						throw APIError.from("INTERNAL_SERVER_ERROR", {
							code: "PREVIEW_LOGIN_SESSION_FAILED",
							message: "Unable to start Preview session",
						});
					}

					return ctx.json({ ok: true });
				},
			),
		},
	};
}
