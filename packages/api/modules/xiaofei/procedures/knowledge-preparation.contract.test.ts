import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const source = readFileSync(path.resolve(import.meta.dirname, "../knowledge-documents.ts"), "utf8");

describe("knowledge preparation contract", () => {
	it("validates before mutation and reuses resumable current KUs on retry", () => {
		expect(source).toContain("const entries = await Promise.all(");
		expect(source).toContain('unit.eligibility !== "stale"');
		expect(source).toContain("const missingEntryIds = entryIds.filter");
		expect(source).toContain("generateKnowledgeUnitsForTenant(context, missingEntryIds)");
	});

	it("returns separately timed Test-CA and session evidence without changing Active", () => {
		for (const stage of ["generated", "reused", "published", "test_ca", "session"])
			expect(source).toContain(`name: "${stage}"`);
		expect(source).toContain("initializeXiaofeiTestHostingForTenant(context)");
		expect(source).toContain("testSessionId");
		expect(source).not.toContain("setXiaofeiOrganizationActiveHostingVersion");
	});
});
