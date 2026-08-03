import { describe, expect, it } from "vitest";

import {
	filterSupportConversations,
	isSelectedConversationVisible,
	nextSelectedConversationId,
} from "./support-inbox-state";

const conversations = [
	{
		id: "conversation-a",
		customerName: "Ada",
		channel: "whatsapp",
		ownerType: "ai",
		status: "open",
	},
	{
		id: "conversation-b",
		customerName: "Bea",
		channel: "web",
		ownerType: "human",
		status: "closed",
	},
] as const;

describe("Support inbox filtered selection", () => {
	it("switches from a filtered-out selection to the first visible conversation", () => {
		const visible = filterSupportConversations(conversations as never, {
			customer: "Bea",
			channel: "all",
			owner: "all",
			status: "all",
		});
		expect(visible.map((item) => item.id)).toEqual(["conversation-b"]);
		expect(nextSelectedConversationId(visible, "conversation-a")).toBe("conversation-b");
	});

	it("clears selection when no conversation matches and when another Organization replaces the list", () => {
		const none = filterSupportConversations(conversations as never, {
			customer: "nobody",
			channel: "all",
			owner: "all",
			status: "all",
		});
		expect(nextSelectedConversationId(none, "conversation-a")).toBeNull();
		expect(nextSelectedConversationId([{ ...conversations[1] }] as never, "conversation-a")).toBe(
			"conversation-b",
		);
	});

	it("hides stale detail while selection changes from A to B or to no result", () => {
		const visibleB = filterSupportConversations(conversations as never, {
			customer: "Bea",
			channel: "all",
			owner: "all",
			status: "all",
		});
		expect(isSelectedConversationVisible("conversation-a", "conversation-b", visibleB)).toBe(false);
		expect(isSelectedConversationVisible("conversation-a", null, [])).toBe(false);
		expect(isSelectedConversationVisible("conversation-b", "conversation-b", visibleB)).toBe(true);
	});
});
