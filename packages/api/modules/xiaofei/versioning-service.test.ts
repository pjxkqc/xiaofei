import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	getBinding: vi.fn(),
	getWorkspace: vi.fn(),
	loadCapability: vi.fn(),
	verifyMembership: vi.fn(),
}));

vi.mock("@repo/database", () => ({
	getXiaofeiOrganizationHostingBinding: mocks.getBinding,
	getXiaofeiWorkspace: mocks.getWorkspace,
	loadXiaofeiRuntimeHostingCapability: mocks.loadCapability,
}));
vi.mock("../organizations/lib/membership", () => ({
	verifyOrganizationMembership: mocks.verifyMembership,
}));

import {
	createCapabilityVersionManifest,
	createDefaultWorkspaceSnapshot,
	createKnowledgeUnitRevision,
	runP0EvalSuite,
} from "@repo/xiaofei";

import { getXiaofeiTestAdmissionSnapshot } from "./versioning-service";

const ORGANIZATION_ID = "organization-a";
const TENANT_ID = `organization:${ORGANIZATION_ID}`;
const CREATED_AT = "2026-08-06T00:00:00.000Z";

describe("current Test CA admission projection", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		mocks.verifyMembership.mockResolvedValue({ role: "owner" });
		mocks.getBinding.mockResolvedValue({ testCapabilityVersionId: "test-ca" });
	});

	it("marks a changed Test CA unreviewed instead of exposing stale workspace Eval", async () => {
		const base = createDefaultWorkspaceSnapshot(TENANT_ID, () => CREATED_AT);
		base.capabilityPlan.reviewed = true;
		base.evalSuite = await runP0EvalSuite(base, () => CREATED_AT);
		const revisions = base.knowledgeUnits.map((knowledgeUnit, index) =>
			createKnowledgeUnitRevision({
				id: `revision-${index}`,
				logicalKnowledgeUnitId: `logical-${index}`,
				organizationId: null,
				revision: 1,
				origin: "platform",
				knowledgeUnit:
					index === 0
						? { ...knowledgeUnit, standardReplyPolicy: "Changed after Eval." }
						: knowledgeUnit,
				createdAt: CREATED_AT,
			}),
		);
		const manifest = createCapabilityVersionManifest({
			id: "test-ca",
			organizationId: ORGANIZATION_ID,
			capabilityKey: "xiaofei-hosting",
			status: "test",
			knowledgeUnitRevisionIds: revisions.map((revision) => revision.id),
			createdAt: "2026-08-06T00:01:00.000Z",
		});
		mocks.getWorkspace.mockResolvedValue({
			id: "workspace-a",
			tenantKey: TENANT_ID,
			snapshot: base,
		});
		mocks.loadCapability.mockResolvedValue({ manifest, revisions });

		const result = await getXiaofeiTestAdmissionSnapshot({
			session: { activeOrganizationId: ORGANIZATION_ID },
			user: { id: "support-user" },
		});

		expect(result.capabilityPlan.reviewed).toBe(false);
		expect(result.evalSuite.status).toBe("warning");
		expect(result.evalSuite.capabilityPlanVersion).toBeNull();
		expect(result.knowledgeUnits).toHaveLength(revisions.length);
	});
});
