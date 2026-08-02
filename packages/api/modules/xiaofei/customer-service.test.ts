import { beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({
	createXiaofeiCustomer: vi.fn(),
	getXiaofeiCustomer: vi.fn(),
	getXiaofeiCustomerById: vi.fn(),
	listXiaofeiCustomerConversations: vi.fn(),
	listXiaofeiCustomers: vi.fn(),
	updateXiaofeiCustomer: vi.fn(),
}));
const service = vi.hoisted(() => ({
	getOrCreateXiaofeiWorkspace: vi.fn(),
	getXiaofeiOrganizationId: vi.fn(),
	requireXiaofeiOrganizationAdmin: vi.fn(),
}));

vi.mock("@repo/database", () => database);
vi.mock("./service", () => service);

import {
	archiveOrganizationCustomer,
	createOrganizationCustomer,
	getOrganizationCustomer,
	listOrganizationCustomers,
} from "./customer-service";

const customer = {
	id: "customer-1",
	externalCustomerId: "external-1",
	name: "Ada",
	email: null,
	whatsappNumber: null,
	status: "active",
	lastSeenAt: null,
	createdAt: new Date("2026-08-02T00:00:00.000Z"),
	updatedAt: new Date("2026-08-02T00:00:00.000Z"),
	_count: { conversations: 1 },
};
const context = { session: { activeOrganizationId: "org-a" }, user: { id: "user-a" } };

describe("Organization customer service", () => {
	beforeEach(() => vi.resetAllMocks());

	it("lists customers using the server-verified Organization", async () => {
		service.getXiaofeiOrganizationId.mockResolvedValue("org-a");
		database.listXiaofeiCustomers.mockResolvedValue([customer]);
		await expect(listOrganizationCustomers(context)).resolves.toEqual([
			expect.objectContaining({ externalCustomerId: "external-1", conversationCount: 1 }),
		]);
		expect(database.listXiaofeiCustomers).toHaveBeenCalledWith("org-a");
	});

	it("requires owner/admin authority before creating or archiving", async () => {
		service.requireXiaofeiOrganizationAdmin.mockResolvedValue("organization:org-a");
		database.createXiaofeiCustomer.mockResolvedValue({ ...customer, _count: undefined });
		database.getXiaofeiCustomer.mockResolvedValue(customer);
		database.updateXiaofeiCustomer.mockResolvedValue({ ...customer, status: "archived" });
		await createOrganizationCustomer(context, { externalCustomerId: "external-1", name: "Ada" });
		await archiveOrganizationCustomer(context, "external-1");
		expect(database.createXiaofeiCustomer).toHaveBeenCalledWith(
			expect.objectContaining({ organizationId: "org-a" }),
		);
		expect(database.updateXiaofeiCustomer).toHaveBeenCalledWith("org-a", "external-1", {
			status: "archived",
		});
	});

	it("gets conversation history only after resolving the customer inside the same Organization", async () => {
		service.getXiaofeiOrganizationId.mockResolvedValue("org-a");
		service.getOrCreateXiaofeiWorkspace.mockResolvedValue({ workspace: { id: "workspace-a" } });
		database.getXiaofeiCustomer.mockResolvedValue(customer);
		database.getXiaofeiCustomerById.mockResolvedValue(customer);
		database.listXiaofeiCustomerConversations.mockResolvedValue([]);
		await getOrganizationCustomer(context, "external-1");
		expect(database.getXiaofeiCustomer).toHaveBeenCalledWith("org-a", "external-1");
		expect(database.listXiaofeiCustomerConversations).toHaveBeenCalledWith(
			"workspace-a",
			"customer-1",
		);
	});
});
