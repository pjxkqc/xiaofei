import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@repo/database", () => ({
	deleteXiaofeiConversation: vi.fn(),
	getXiaofeiConversation: vi.fn(),
	getXiaofeiWorkspace: vi.fn(),
	upsertXiaofeiConversation: vi.fn(),
	upsertXiaofeiWorkspace: vi.fn(),
}));

vi.mock("../organizations/lib/membership", () => ({
	verifyOrganizationMembership: vi.fn(),
}));

import { createDefaultWorkspaceSnapshot } from "@repo/xiaofei";

import { verifyOrganizationMembership } from "../organizations/lib/membership";
import { createKnowledgeWorkspaceBinding, getXiaofeiTenantKey } from "./service";

describe("authenticated Xiaofei workspace binding", () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	it("derives an authenticated organization tenant only after membership verification", async () => {
		vi.mocked(verifyOrganizationMembership).mockResolvedValue({ id: "member-1" } as never);

		await expect(
			getXiaofeiTenantKey({
				session: { activeOrganizationId: "org-1" },
				user: { id: "user-1" },
			}),
		).resolves.toBe("organization:org-1");
		expect(verifyOrganizationMembership).toHaveBeenCalledWith("org-1", "user-1");
	});

	it("rejects an active organization that the authenticated user cannot access", async () => {
		vi.mocked(verifyOrganizationMembership).mockResolvedValue(null);

		await expect(
			getXiaofeiTenantKey({
				session: { activeOrganizationId: "org-1" },
				user: { id: "user-1" },
			}),
		).rejects.toThrow("active organization");
	});

	it("uses only persisted workspace and loaded snapshot values for the runtime binding", () => {
		const snapshot = createDefaultWorkspaceSnapshot("organization:org-1");

		expect(
			createKnowledgeWorkspaceBinding({
				workspace: { tenantKey: "organization:org-1" },
				snapshot,
				conversationId: "conversation-1",
				channelId: "authenticated:chatbot",
			}),
		).toEqual({
			tenantId: "organization:org-1",
			conversationId: "conversation-1",
			channelId: "authenticated:chatbot",
			knowledgeWorkspaceId: "organization:org-1:knowledge",
		});
	});

	it("does not replace a mismatched persisted tenant with a synthetic snapshot tenant", () => {
		const snapshot = createDefaultWorkspaceSnapshot("organization:org-1");

		expect(
			createKnowledgeWorkspaceBinding({
				workspace: { tenantKey: "organization:other-org" },
				snapshot,
				conversationId: "conversation-1",
				channelId: "authenticated:chatbot",
			}),
		).toMatchObject({ tenantId: "organization:other-org" });
	});
});
