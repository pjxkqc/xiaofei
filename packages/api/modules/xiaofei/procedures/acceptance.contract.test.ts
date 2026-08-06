import { describe, expect, it, vi } from "vitest";

vi.mock("@repo/ai", () => ({ runXiaofeiTurn: vi.fn() }));
vi.mock("@repo/database", () => ({}));
vi.mock("@repo/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));

import { syntheticSupportConversationId } from "./acceptance";

describe("synthetic support identity", () => {
	it("uses one stable, opaque Inbox identity for every turn", () => {
		const first = syntheticSupportConversationId("acceptance-42");
		const second = syntheticSupportConversationId("acceptance-42");

		expect(first).toBe("synthetic:acceptance-42");
		expect(second).toBe(first);
	});
});
