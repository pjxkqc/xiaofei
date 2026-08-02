import { ORPCError } from "@orpc/server";
import {
	createXiaofeiCustomer,
	getXiaofeiCustomer,
	getXiaofeiCustomerById,
	listXiaofeiCustomerConversations,
	listXiaofeiCustomers,
	updateXiaofeiCustomer,
} from "@repo/database";
import {
	CustomerSchema,
	SupportConversationSummarySchema,
	type Customer,
	type SupportConversationSummary,
} from "@repo/xiaofei";

import {
	getOrCreateXiaofeiWorkspace,
	getXiaofeiOrganizationId,
	requireXiaofeiOrganizationAdmin,
	type XiaofeiAuthContext,
} from "./service";

type CustomerInput = {
	externalCustomerId: string;
	name?: string | null;
	email?: string | null;
	whatsappNumber?: string | null;
};
type CustomerUpdateInput = Omit<CustomerInput, "externalCustomerId"> & { status?: "archived" };

export async function listOrganizationCustomers(context: XiaofeiAuthContext): Promise<Customer[]> {
	const organizationId = await getXiaofeiOrganizationId(context);
	return (await listXiaofeiCustomers(organizationId)).map(toCustomer);
}

export async function getOrganizationCustomer(
	context: XiaofeiAuthContext,
	externalCustomerId: string,
): Promise<{ customer: Customer; conversations: SupportConversationSummary[] }> {
	const organizationId = await getXiaofeiOrganizationId(context);
	const customer = await getXiaofeiCustomer(organizationId, externalCustomerId);
	if (!customer) throw new ORPCError("NOT_FOUND", { message: "Customer not found." });
	const counted = await getXiaofeiCustomerById(organizationId, customer.id);
	const { workspace } = await getOrCreateXiaofeiWorkspace(context);
	const conversations = await listXiaofeiCustomerConversations(workspace.id, customer.id);
	return {
		customer: toCustomer({ ...customer, _count: counted?._count ?? { conversations: 0 } }),
		conversations: conversations.map(toConversationSummary),
	};
}

export async function createOrganizationCustomer(
	context: XiaofeiAuthContext,
	input: CustomerInput,
) {
	const tenantKey = await requireXiaofeiOrganizationAdmin(context);
	const organizationId = tenantKey.slice("organization:".length);
	try {
		return toCustomer(await createXiaofeiCustomer({ organizationId, ...input }));
	} catch (error) {
		if (isUniqueViolation(error)) {
			throw new ORPCError("CONFLICT", { message: "Customer external ID already exists." });
		}
		throw error;
	}
}

export async function updateOrganizationCustomer(
	context: XiaofeiAuthContext,
	externalCustomerId: string,
	input: CustomerUpdateInput,
) {
	const tenantKey = await requireXiaofeiOrganizationAdmin(context);
	const organizationId = tenantKey.slice("organization:".length);
	const existing = await getXiaofeiCustomer(organizationId, externalCustomerId);
	if (!existing) throw new ORPCError("NOT_FOUND", { message: "Customer not found." });
	return toCustomer(await updateXiaofeiCustomer(organizationId, externalCustomerId, input));
}

export async function archiveOrganizationCustomer(
	context: XiaofeiAuthContext,
	externalCustomerId: string,
) {
	return await updateOrganizationCustomer(context, externalCustomerId, { status: "archived" });
}

function toCustomer(record: {
	id: string;
	externalCustomerId: string;
	name: string | null;
	email: string | null;
	whatsappNumber: string | null;
	status: string;
	lastSeenAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
	_count?: { conversations: number };
}): Customer {
	return CustomerSchema.parse({
		...record,
		status: record.status === "archived" ? "archived" : "active",
		lastSeenAt: record.lastSeenAt?.toISOString() ?? null,
		createdAt: record.createdAt.toISOString(),
		updatedAt: record.updatedAt.toISOString(),
		conversationCount: record._count?.conversations ?? 0,
	});
}

function toConversationSummary(record: {
	externalId: string;
	customerId: string | null;
	customerName: string | null;
	channel: string;
	status: string;
	assignedUserName: string | null;
	lastCustomerSeenAt: Date | null;
	lastMessageAt: Date | null;
	updatedAt: Date;
	state: unknown;
	messages: unknown;
}) {
	// Customer detail is a read-only audit view. The inbox remains the owner-state authority.
	const state = record.state as { ownerType?: string; stage?: string; operatorAttention?: unknown };
	const messages = Array.isArray(record.messages) ? record.messages : [];
	const last = messages[messages.length - 1] as { text?: unknown } | undefined;
	return SupportConversationSummarySchema.parse({
		id: record.externalId,
		customerId: record.customerId,
		customerName: record.customerName ?? "访客",
		channel: record.channel,
		status: record.status,
		ownerType: state.ownerType ?? "ai",
		stage: state.stage ?? "new",
		attentionRequired: state.operatorAttention !== null && state.operatorAttention !== undefined,
		attentionReason: null,
		attentionSince: null,
		online:
			record.lastCustomerSeenAt !== null &&
			Date.now() - record.lastCustomerSeenAt.getTime() <= 30_000,
		assignedUserName: record.assignedUserName,
		lastMessage: typeof last?.text === "string" ? last.text : "",
		lastMessageAt: record.lastMessageAt?.toISOString() ?? null,
		updatedAt: record.updatedAt.toISOString(),
	});
}

function isUniqueViolation(error: unknown) {
	return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}
