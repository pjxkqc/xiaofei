import { describe, expect, it, vi } from "vitest";

vi.mock("../support-service", () => ({
	getPublicSupportConversation: vi.fn(),
	getSupportConversation: vi.fn(),
	listSupportConversations: vi.fn(),
	sendHumanSupportMessage: vi.fn(),
	sendPublicSupportMessage: vi.fn(),
	setSupportConversationOwner: vi.fn(),
	startPublicSupportConversation: vi.fn(),
}));
vi.mock("@repo/database", () => ({}));
vi.mock("@repo/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));

import { agentConversationIdSchema, publicConversationIdSchema } from "./support-conversations";

describe("support conversation ID boundary", () => {
	const externalConversationId = "fly101-email-conv";
	const legacyConversationId = "f420b1da-7d44-487a-9d65-e39e0b0dc68e";

	it("accepts an external channel ID for authenticated agent read, owner, and send inputs", () => {
		expect(agentConversationIdSchema.parse(externalConversationId)).toBe(externalConversationId);
		expect(agentConversationIdSchema.parse(` ${externalConversationId} `)).toBe(
			externalConversationId,
		);
		expect(agentConversationIdSchema.parse(legacyConversationId)).toBe(legacyConversationId);
	});

	it("keeps public read and send conversation IDs UUID-only", () => {
		expect(() => publicConversationIdSchema.parse(externalConversationId)).toThrow();
		expect(publicConversationIdSchema.parse(legacyConversationId)).toBe(legacyConversationId);
	});
});
