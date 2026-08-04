import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const source = readFileSync(path.resolve(import.meta.dirname, "stream-message.ts"), "utf8");

describe("hosted Xiaofei capability admission contract", () => {
	it("evaluates the exact materialized Active snapshot instead of fabricating a passing suite", () => {
		expect(source).toContain("runP0EvalSuite(materialized)");
		expect(source).toContain("evalSuite,");
		expect(source).toContain("evalSuite.status,");
		expect(source).not.toContain('status: "passed"');
		expect(source).not.toContain('"passed",\n\t\t\tmaterialized.tools');
	});

	it("loads only the Organization Active hosting capability and safely rejects disabled hosting", () => {
		expect(source).toContain('loadXiaofeiRuntimeHostingCapability(organizationId, "active")');
		expect(source).not.toContain('loadXiaofeiRuntimeHostingCapability(organizationId, "test")');
		expect(source).toContain("if (!config?.xiaofeiEnabled)");
	});
});
