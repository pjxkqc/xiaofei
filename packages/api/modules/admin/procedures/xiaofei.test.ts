import { call } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	getDetail: vi.fn(),
	getOverview: vi.fn(),
	listOrganizations: vi.fn(),
	upsertConfig: vi.fn(),
	getSession: vi.fn(),
}));

vi.mock("@repo/auth", () => ({ auth: { api: { getSession: mocks.getSession } } }));
vi.mock("@repo/database", () => ({
	getAdminXiaofeiOrganizationDetail: mocks.getDetail,
	getAdminXiaofeiOverview: mocks.getOverview,
	listAdminXiaofeiOrganizations: mocks.listOrganizations,
	upsertXiaofeiOrganizationConfig: mocks.upsertConfig,
}));

import {
	getXiaofeiOrganization,
	getXiaofeiOverview,
	listXiaofeiOrganizations,
	updateXiaofeiOrganization,
} from "./xiaofei";

const context = { headers: new Headers() };

describe("admin Xiaofei procedures", () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	it.each([
		[getXiaofeiOverview, undefined],
		[listXiaofeiOrganizations, { limit: 20, offset: 0 }],
		[getXiaofeiOrganization, { organizationId: "org-a" }],
		[updateXiaofeiOrganization, { organizationId: "org-a", xiaofeiEnabled: true }],
	])("denies ordinary users on every Admin procedure", async (procedure, input) => {
		mocks.getSession.mockResolvedValue({
			user: { id: "user", role: "user" },
			session: { id: "session" },
		});
		await expect(call(procedure as never, input as never, { context })).rejects.toMatchObject({
			code: "FORBIDDEN",
		});
	});

	it("uses only the explicit requested Organization ID for detail and configuration", async () => {
		mocks.getSession.mockResolvedValue({
			user: { id: "admin", role: "admin" },
			session: { id: "session", activeOrganizationId: "org-b" },
		});
		mocks.getDetail.mockResolvedValue({ organization: { id: "org-a" } });
		mocks.upsertConfig.mockResolvedValue({ organizationId: "org-a", xiaofeiEnabled: true });
		await call(getXiaofeiOrganization, { organizationId: "org-a" }, { context });
		await call(
			updateXiaofeiOrganization,
			{ organizationId: "org-a", xiaofeiEnabled: true },
			{ context },
		);
		expect(mocks.getDetail).toHaveBeenCalledWith("org-a");
		expect(mocks.upsertConfig).toHaveBeenCalledWith("org-a", { xiaofeiEnabled: true });
	});

	it("maps external merchant unique conflicts to a safe business error", async () => {
		mocks.getSession.mockResolvedValue({
			user: { id: "admin", role: "admin" },
			session: { id: "session" },
		});
		mocks.upsertConfig.mockRejectedValue({ code: "P2002", meta: { target: "secret" } });
		await expect(
			call(
				updateXiaofeiOrganization,
				{ organizationId: "org-a", externalMerchantId: "duplicate" },
				{ context },
			),
		).rejects.toMatchObject({
			code: "CONFLICT",
			message: "This external merchant ID is already assigned to another Organization.",
		});
	});
});
