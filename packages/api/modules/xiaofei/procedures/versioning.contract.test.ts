import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const source = readFileSync(path.resolve(import.meta.dirname, "versioning.ts"), "utf8");

describe("Xiaofei versioned test-turn API contract", () => {
	it("freezes only released, eligible KUs and changes only the Test pointer during initialization", () => {
		expect(source).toContain('unit.status === "released" && unit.eligibility === "eligible"');
		expect(source).toContain(
			"setXiaofeiOrganizationTestHostingVersion(organizationId, hosting.id)",
		);
		expect(source).not.toContain("setXiaofeiOrganizationActiveHostingVersion");
	});

	it("persists an actual TestTurn before answer-bound feedback and does not accept browser evidence", () => {
		expect(source).toContain("createXiaofeiTestTurn(organizationId");
		expect(source).toContain("sourceTestTurnId: z.string().cuid()");
		expect(source).not.toContain("knowledgeUnitRevisionId: z.string");
		expect(source).not.toContain("capabilityVersionId: z.string");
	});

	it("reruns the saved question and returns the persisted idempotent rerun evidence", () => {
		expect(source).toContain("message: feedback.sourceTestTurn.question");
		expect(source).toContain("createXiaofeiTestTurnRerun(organizationId");
		expect(source).toContain("answer: rerun.answer");
		expect(source).toContain("RuntimeMetadataSchema.parse(rerun.runtimeMetadata)");
		expect(source).toContain("resultCapabilityVersionId: rerun.capabilityVersionId");
	});

	it("continues only a same-Organization session pinned to its Test CA and can reset safely", () => {
		expect(source).toContain("getXiaofeiTestSession(organizationId, testSessionId)");
		expect(source).toContain("savedSession?.conversationState");
		expect(source).toContain("conversationState: result.state");
		expect(source).toContain("The Test version changed; start a new test session.");
		expect(source).toContain("export const resetXiaofeiTestSession");
	});

	it("maps no-hit, platform, foreign, and conflicting feedback to fail-closed errors", () => {
		expect(source).toContain("XiaofeiVersioningNotFoundError");
		expect(source).toContain("XiaofeiTestTurnFeedbackConflictError");
		expect(source).toContain("This answer has no correctable merchant knowledge evidence.");
	});
});
