export const previewOneClickLoginPath = "/preview-one-click-login";
export const previewOperatorEmail = "preview-operator@xiaofei.invalid";

type PreviewLoginEnvironment = {
	PREVIEW_ONE_CLICK_LOGIN_ENABLED?: string;
	VERCEL_ENV?: string;
};

type PreviewOperator = {
	id: string;
};

export function isPreviewOneClickLoginEnabled(environment?: PreviewLoginEnvironment) {
	const resolvedEnvironment = environment ?? (process.env as PreviewLoginEnvironment);

	return (
		resolvedEnvironment.VERCEL_ENV === "preview" &&
		resolvedEnvironment.PREVIEW_ONE_CLICK_LOGIN_ENABLED === "true"
	);
}

export async function getOrCreatePreviewOperator<TUser extends PreviewOperator>({
	findUserByEmail,
	createUser,
}: {
	findUserByEmail: (email: string) => Promise<TUser | null>;
	createUser: () => Promise<TUser>;
}) {
	const existingUser = await findUserByEmail(previewOperatorEmail);

	if (existingUser) {
		return existingUser;
	}

	try {
		return await createUser();
	} catch (error) {
		// Another request can create the fixed Preview operator first. Re-read it
		// rather than creating a second identity or surfacing a unique constraint.
		const concurrentlyCreatedUser = await findUserByEmail(previewOperatorEmail);

		if (concurrentlyCreatedUser) {
			return concurrentlyCreatedUser;
		}

		throw error;
	}
}

export async function createPreviewOperatorSession<TUser extends PreviewOperator, TSession>({
	user,
	createSession,
	setSessionCookie,
}: {
	user: TUser;
	createSession: (userId: string) => Promise<TSession | null>;
	setSessionCookie: (session: TSession, user: TUser) => Promise<void>;
}) {
	const session = await createSession(user.id);

	if (!session) {
		return null;
	}

	await setSessionCookie(session, user);
	return session;
}
