export const previewOneClickLoginPath = "/preview-one-click-login";
export const previewOperatorEmail = "preview-operator@xiaofei.invalid";

export const previewRoleAccounts = [
	{
		role: "Owner A",
		email: "preview-owner@xiaofei.invalid",
		password: "PreviewOnly-Owner-2026!",
		organization: "FLY-99 验收商户 A",
	},
	{
		role: "Admin A",
		email: "preview-admin@xiaofei.invalid",
		password: "PreviewOnly-Admin-2026!",
		organization: "FLY-99 验收商户 A",
	},
	{
		role: "Member A",
		email: "preview-member@xiaofei.invalid",
		password: "PreviewOnly-Member-2026!",
		organization: "FLY-99 验收商户 A",
	},
	{
		role: "Owner B",
		email: "preview-owner-b@xiaofei.invalid",
		password: "PreviewOnly-OwnerB-2026!",
		organization: "FLY-99 验收商户 B",
	},
] as const;

export const previewFixtureOrganizations = [
	{ name: "FLY-99 验收商户 A", slug: "fly-99-a" },
	{ name: "FLY-99 验收商户 B", slug: "fly-99-b" },
] as const;

type PreviewLoginEnvironment = {
	PREVIEW_ONE_CLICK_LOGIN_ENABLED?: string;
	VERCEL_ENV?: string;
};

type PreviewOperator = {
	id: string;
};

export function createPreviewFixtureInput(passwordHashes: Record<string, string>) {
	return {
		users: [
			{ email: previewOperatorEmail, name: "Preview operator" },
			...previewRoleAccounts.map((account) => ({
				email: account.email,
				name: account.role,
				passwordHash: passwordHashes[account.email],
			})),
		],
		organizations: [...previewFixtureOrganizations],
		memberships: [
			{ organizationSlug: "fly-99-a", userEmail: previewOperatorEmail, role: "owner" },
			{ organizationSlug: "fly-99-a", userEmail: "preview-owner@xiaofei.invalid", role: "owner" },
			{ organizationSlug: "fly-99-a", userEmail: "preview-admin@xiaofei.invalid", role: "admin" },
			{ organizationSlug: "fly-99-a", userEmail: "preview-member@xiaofei.invalid", role: "member" },
			{ organizationSlug: "fly-99-b", userEmail: previewOperatorEmail, role: "owner" },
			{ organizationSlug: "fly-99-b", userEmail: "preview-owner-b@xiaofei.invalid", role: "owner" },
		],
		customers: [
			{
				organizationSlug: "fly-99-a",
				externalCustomerId: "fly99-demo-customer-a",
				name: "王小明（FLY-99 已编辑）",
				email: "fly99.customer@example.com",
				whatsappNumber: "+8613800000099",
				status: "archived",
			},
			{
				organizationSlug: "fly-99-b",
				externalCustomerId: "fly99-demo-customer-b",
				name: "李小雨（FLY-99 隔离验收）",
				email: "fly99.customer-b@example.com",
				whatsappNumber: "+8613800000100",
				status: "active",
			},
		],
	};
}

export async function initializePreviewFixtures({
	hashPassword,
	synchronizeFixtures,
}: {
	hashPassword: (password: string) => Promise<string>;
	synchronizeFixtures: (input: ReturnType<typeof createPreviewFixtureInput>) => Promise<unknown>;
}) {
	const hashes = Object.fromEntries(
		await Promise.all(
			previewRoleAccounts.map(async (account) => [
				account.email,
				await hashPassword(account.password),
			]),
		),
	) as Record<string, string>;
	return synchronizeFixtures(createPreviewFixtureInput(hashes));
}

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
