import type { SupportConversationSummary } from "@repo/xiaofei";

export interface SupportInboxFilters {
	customer: string;
	channel: string;
	owner: string;
	status: string;
}

export function filterSupportConversations(
	conversations: SupportConversationSummary[],
	filters: SupportInboxFilters,
) {
	const customer = filters.customer.trim().toLowerCase();
	return conversations.filter(
		(item) =>
			(filters.status === "all" || item.status === filters.status) &&
			(filters.owner === "all" || item.ownerType === filters.owner) &&
			(filters.channel === "all" || item.channel === filters.channel) &&
			(!customer || item.customerName.toLowerCase().includes(customer)),
	);
}

/** Never retain a selection that is absent from the current tenant-filtered list. */
export function nextSelectedConversationId(
	conversations: SupportConversationSummary[],
	selectedId: string | null,
) {
	return conversations.some((item) => item.id === selectedId)
		? selectedId
		: (conversations[0]?.id ?? null);
}
