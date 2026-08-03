import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const component = readFileSync(path.resolve(import.meta.dirname, "MockWorker.tsx"), "utf8");
const page = readFileSync(
	path.resolve(
		import.meta.dirname,
		"../../../app/(authenticated)/(main)/(account)/integrations/mock-worker/page.tsx",
	),
	"utf8",
);

describe("Mock Worker UI contract", () => {
	it("supports Email and WhatsApp while guarding duplicate submissions", () => {
		expect(component).toContain('useState<"email" | "whatsapp">("email")');
		expect(component).toContain('<option value="email">Email</option>');
		expect(component).toContain('<option value="whatsapp">WhatsApp</option>');
		expect(component).toContain("if (isPending) return;");
		expect(component).toContain("disabled={isPending ||");
		expect(component).toContain('aria-live="polite"');
	});

	it("keeps the mock worker behind the active Organization route guard", () => {
		expect(page).toContain("OrganizationRequired");
		expect(page).toContain("MockWorker");
	});
});
