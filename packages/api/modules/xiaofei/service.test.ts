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

import { getXiaofeiWorkspace, upsertXiaofeiWorkspace } from "@repo/database";
import { createDefaultWorkspaceSnapshot } from "@repo/xiaofei";

import { verifyOrganizationMembership } from "../organizations/lib/membership";
import {
	clearKnowledgeWorkspaceAdmission,
	createKnowledgeWorkspaceBinding,
	getOrCreateXiaofeiWorkspaceByTenantKey,
	getXiaofeiTenantKey,
	requireXiaofeiOrganizationAdmin,
	PUBLIC_SUPPORT_TENANT_KEY,
	savePublicXiaofeiSnapshot,
	synchronizeKnowledgeWorkspaceSnapshot,
} from "./service";

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

	it("rejects a missing active organization instead of falling back to a personal workspace", async () => {
		await expect(getXiaofeiTenantKey({ session: {}, user: { id: "user-1" } })).rejects.toThrow(
			"Select an organization",
		);
	});

	it("requires an owner or admin for Xiaofei governance", async () => {
		vi.mocked(verifyOrganizationMembership).mockResolvedValue({ role: "member" } as never);
		await expect(
			requireXiaofeiOrganizationAdmin({
				session: { activeOrganizationId: "org-1" },
				user: { id: "user-1" },
			}),
		).rejects.toThrow("owner or admin");
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

	it("loads a legacy persisted snapshot with domain fallback defaults", async () => {
		const legacySnapshot = JSON.parse(
			JSON.stringify(createDefaultWorkspaceSnapshot("organization:org-1")),
		) as { agent: Record<string, unknown> };
		delete legacySnapshot.agent.fallbackPolicy;
		vi.mocked(getXiaofeiWorkspace).mockResolvedValue({
			id: "workspace-1",
			tenantKey: "organization:org-1",
			snapshot: legacySnapshot,
		} as never);

		const result = await getOrCreateXiaofeiWorkspaceByTenantKey("organization:org-1");

		expect(result.snapshot.agent.fallbackPolicy).toMatchObject({
			maxClarifications: 5,
			clarificationReply: expect.stringContaining("先不急着转人工"),
			attentionReply: expect.stringContaining("待关注"),
		});
	});

	it("persists operator-reviewed configuration to the shared public support workspace", async () => {
		const snapshot = createDefaultWorkspaceSnapshot(PUBLIC_SUPPORT_TENANT_KEY);

		await savePublicXiaofeiSnapshot(snapshot);

		expect(upsertXiaofeiWorkspace).toHaveBeenCalledWith(
			PUBLIC_SUPPORT_TENANT_KEY,
			expect.objectContaining({
				agent: expect.objectContaining({ tenantId: PUBLIC_SUPPORT_TENANT_KEY }),
			}),
		);
	});

	it("revokes admission evidence without erasing built-in knowledge during a managed KU change", async () => {
		const snapshot = createDefaultWorkspaceSnapshot(PUBLIC_SUPPORT_TENANT_KEY);
		vi.mocked(getXiaofeiWorkspace).mockResolvedValue({
			id: "workspace-1",
			tenantKey: PUBLIC_SUPPORT_TENANT_KEY,
			snapshot,
		} as never);

		await clearKnowledgeWorkspaceAdmission(PUBLIC_SUPPORT_TENANT_KEY);

		expect(upsertXiaofeiWorkspace).toHaveBeenCalledWith(
			PUBLIC_SUPPORT_TENANT_KEY,
			expect.objectContaining({
				knowledgeUnits: expect.arrayContaining([
					expect.objectContaining({ id: snapshot.knowledgeUnits[0]!.id }),
				]),
				capabilityPlan: expect.objectContaining({ knowledgeUnitIds: [] }),
				evalSuite: expect.objectContaining({ status: "warning" }),
			}),
		);
	});

	it("merges source-managed KUs with built-in knowledge when synchronizing admission", async () => {
		const snapshot = createDefaultWorkspaceSnapshot(PUBLIC_SUPPORT_TENANT_KEY);
		const managedUnit = {
			...snapshot.knowledgeUnits[0]!,
			id: "c-air-mini-parameters",
			title: "澄风 C-Air 常见问答",
			scenarioKeywords: ["C-Air Mini", "Wi-Fi联网模块"],
			lineage: {
				workspaceId: snapshot.knowledgeWorkspaceId,
				sourceId: "source-1",
				sourceContentHash: "hash-1",
				sourceVersion: 1,
				entryId: "entry-1",
				entryVersion: 1,
			},
		};
		vi.mocked(getXiaofeiWorkspace).mockResolvedValue({
			id: "workspace-1",
			tenantKey: PUBLIC_SUPPORT_TENANT_KEY,
			snapshot,
		} as never);

		const synchronized = await synchronizeKnowledgeWorkspaceSnapshot({
			tenantKey: PUBLIC_SUPPORT_TENANT_KEY,
			units: [
				{
					content: managedUnit,
					status: "released",
					eligibility: "eligible",
					staleReason: null,
				},
			],
		});

		expect(synchronized.knowledgeUnits).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ id: managedUnit.id, eligibility: "eligible" }),
				expect.objectContaining({ id: snapshot.knowledgeUnits[0]!.id }),
			]),
		);
		expect(synchronized.capabilityPlan.knowledgeUnitIds).toEqual(
			expect.arrayContaining([managedUnit.id, snapshot.knowledgeUnits[0]!.id]),
		);
	});

	it("rejects a snapshot from another tenant before writing the public workspace", async () => {
		const snapshot = createDefaultWorkspaceSnapshot("user:other");

		await expect(savePublicXiaofeiSnapshot(snapshot)).rejects.toThrow(
			"does not belong to the selected workspace",
		);
		expect(upsertXiaofeiWorkspace).not.toHaveBeenCalled();
	});
});
