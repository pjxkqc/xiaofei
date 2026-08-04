import { db } from "../client";

export interface PreviewFixtureUser {
	email: string;
	name: string;
	role?: string;
	passwordHash?: string;
	activeOrganizationSlug?: string;
}

export interface PreviewFixtureOrganization {
	name: string;
	slug: string;
}

export interface PreviewFixtureMembership {
	organizationSlug: string;
	userEmail: string;
	role: string;
}

export interface PreviewFixtureCustomer {
	organizationSlug: string;
	externalCustomerId: string;
	name: string;
	email: string;
	whatsappNumber: string;
	status: string;
}

export interface PreviewFixtureInput {
	users: PreviewFixtureUser[];
	organizations: PreviewFixtureOrganization[];
	memberships: PreviewFixtureMembership[];
	customers: PreviewFixtureCustomer[];
}

/**
 * Reconciles only the named Preview fixture records. It never deletes data or
 * touches users, Organizations, customers, or conversations outside the manifest.
 */
export async function synchronizePreviewFixtures(input: PreviewFixtureInput) {
	return db.$transaction(
		async (transaction) => {
			const organizations = new Map<string, { id: string }>();
			for (const fixture of input.organizations) {
				const organization = await transaction.organization.upsert({
					where: { slug: fixture.slug },
					create: { name: fixture.name, slug: fixture.slug, createdAt: new Date() },
					update: { name: fixture.name },
				});
				organizations.set(fixture.slug, organization);
			}

			const users = new Map<string, { id: string }>();
			for (const fixture of input.users) {
				const activeOrganizationId = fixture.activeOrganizationSlug
					? organizations.get(fixture.activeOrganizationSlug)?.id
					: undefined;
				if (fixture.activeOrganizationSlug && !activeOrganizationId) {
					throw new Error("Invalid Preview fixture active Organization");
				}

				const user = await transaction.user.upsert({
					where: { email: fixture.email },
					create: {
						email: fixture.email,
						name: fixture.name,
						role: fixture.role ?? "user",
						emailVerified: true,
						onboardingComplete: true,
						createdAt: new Date(),
						updatedAt: new Date(),
						...(activeOrganizationId ? { lastActiveOrganizationId: activeOrganizationId } : {}),
					},
					update: {
						name: fixture.name,
						role: fixture.role ?? "user",
						emailVerified: true,
						onboardingComplete: true,
						...(activeOrganizationId ? { lastActiveOrganizationId: activeOrganizationId } : {}),
					},
				});
				users.set(fixture.email, user);

				if (fixture.passwordHash) {
					const account = await transaction.account.findFirst({
						where: { userId: user.id, providerId: "credential" },
						select: { id: true },
					});
					if (account) {
						await transaction.account.update({
							where: { id: account.id },
							data: { accountId: user.id, password: fixture.passwordHash },
						});
					} else {
						await transaction.account.create({
							data: {
								userId: user.id,
								accountId: user.id,
								providerId: "credential",
								password: fixture.passwordHash,
								createdAt: new Date(),
								updatedAt: new Date(),
							},
						});
					}
				}
			}

			for (const fixture of input.memberships) {
				const organization = organizations.get(fixture.organizationSlug);
				const user = users.get(fixture.userEmail);
				if (!organization || !user) throw new Error("Invalid Preview fixture membership");
				await transaction.member.upsert({
					where: { organizationId_userId: { organizationId: organization.id, userId: user.id } },
					create: {
						organizationId: organization.id,
						userId: user.id,
						role: fixture.role,
						createdAt: new Date(),
					},
					update: { role: fixture.role },
				});
			}

			for (const fixture of input.customers) {
				const organization = organizations.get(fixture.organizationSlug);
				if (!organization) throw new Error("Invalid Preview fixture customer");
				await transaction.xiaofeiCustomer.upsert({
					where: {
						organizationId_externalCustomerId: {
							organizationId: organization.id,
							externalCustomerId: fixture.externalCustomerId,
						},
					},
					create: {
						organizationId: organization.id,
						externalCustomerId: fixture.externalCustomerId,
						name: fixture.name,
						email: fixture.email,
						whatsappNumber: fixture.whatsappNumber,
						status: fixture.status,
					},
					update: {
						name: fixture.name,
						email: fixture.email,
						whatsappNumber: fixture.whatsappNumber,
						status: fixture.status,
					},
				});
			}
		},
		{
			isolationLevel: "Serializable",
			// Neon Preview computes can be cold or briefly connection-bound. Prisma's
			// default two-second interactive-transaction wait surfaced as a false
			// Preview sign-in failure even though the fixture data was intact.
			maxWait: 15_000,
			timeout: 20_000,
		},
	);
}
