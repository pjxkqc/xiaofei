import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
	const transaction = {
		user: { upsert: vi.fn() },
		account: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
		organization: { upsert: vi.fn() },
		member: { upsert: vi.fn() },
		xiaofeiCustomer: { upsert: vi.fn() },
	};
	return { transaction, db: { $transaction: vi.fn() } };
});

vi.mock("../client", () => ({ db: mocks.db }));

import { synchronizePreviewFixtures } from "./preview-fixtures";

describe("synchronizePreviewFixtures", () => {
	it("upserts fixture records and never deletes unrelated data", async () => {
		mocks.transaction.user.upsert
			.mockResolvedValueOnce({ id: "operator" })
			.mockResolvedValueOnce({ id: "owner" });
		mocks.transaction.account.findFirst.mockResolvedValue(null);
		mocks.transaction.organization.upsert
			.mockResolvedValueOnce({ id: "org-a" })
			.mockResolvedValueOnce({ id: "org-b" });
		mocks.db.$transaction.mockImplementation(
			async (callback: (transaction: typeof mocks.transaction) => unknown) =>
				callback(mocks.transaction),
		);

		await synchronizePreviewFixtures({
			users: [
				{ email: "operator@example.invalid", name: "Operator" },
				{ email: "owner@example.invalid", name: "Owner", passwordHash: "hash" },
			],
			organizations: [
				{ name: "A", slug: "a" },
				{ name: "B", slug: "b" },
			],
			memberships: [{ organizationSlug: "a", userEmail: "owner@example.invalid", role: "owner" }],
			customers: [
				{
					organizationSlug: "b",
					externalCustomerId: "customer-b",
					name: "B",
					email: "b@example.invalid",
					whatsappNumber: "+1",
					status: "active",
				},
			],
		});

		expect(mocks.transaction.user.upsert).toHaveBeenCalledTimes(2);
		expect(mocks.transaction.account.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					accountId: "owner",
					password: "hash",
					providerId: "credential",
				}),
			}),
		);
		expect(mocks.transaction.member.upsert).toHaveBeenCalledWith(
			expect.objectContaining({ update: { role: "owner" } }),
		);
		expect(mocks.transaction.xiaofeiCustomer.upsert).toHaveBeenCalledWith(
			expect.objectContaining({ update: expect.objectContaining({ status: "active" }) }),
		);
		expect(mocks.transaction).not.toHaveProperty("delete");
		expect(mocks.db.$transaction).toHaveBeenCalledWith(expect.any(Function), {
			isolationLevel: "Serializable",
			timeout: 20_000,
		});
	});

	it("repairs an existing credential account with the Better Auth user ID account key", async () => {
		mocks.transaction.user.upsert.mockReset().mockResolvedValue({ id: "fixture-user" });
		mocks.transaction.account.findFirst.mockReset().mockResolvedValue({ id: "credential-account" });
		mocks.transaction.account.update.mockReset();
		mocks.transaction.organization.upsert.mockReset();
		mocks.transaction.member.upsert.mockReset();
		mocks.transaction.xiaofeiCustomer.upsert.mockReset();
		mocks.db.$transaction.mockImplementation(
			async (callback: (transaction: typeof mocks.transaction) => unknown) =>
				callback(mocks.transaction),
		);

		await synchronizePreviewFixtures({
			users: [
				{
					email: "fixture@example.invalid",
					name: "Fixture",
					role: "admin",
					passwordHash: "new-hash",
				},
			],
			organizations: [],
			memberships: [],
			customers: [],
		});

		expect(mocks.transaction.account.update).toHaveBeenCalledWith({
			where: { id: "credential-account" },
			data: { accountId: "fixture-user", password: "new-hash" },
		});
		expect(mocks.transaction.user.upsert).toHaveBeenCalledWith(
			expect.objectContaining({ update: expect.objectContaining({ role: "admin" }) }),
		);
	});
});
