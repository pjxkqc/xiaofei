import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const source = readFileSync(path.resolve(import.meta.dirname, "acceptance.ts"), "utf8");

describe("synthetic support acceptance contract", () => {
	it("loads and persists the scoped synthetic conversation without transport side effects", () => {
		expect(source).toContain("getXiaofeiConversation(workspace.id, conversationId)");
		expect(source).toContain('existing.channel !== "synthetic_support"');
		expect(source).toContain("updateXiaofeiSupportConversation(workspace.id, conversationId");
		expect(source).toContain("messages.slice(-160)");
		expect(source).toContain("traces = [...traces, ...result.metadata.traces].slice(-80)");
		expect(source).not.toContain("Email");
		expect(source).not.toContain("outbound");
	});

	it("uses the exact persisted Active CA and leaves a human-owned conversation to support", () => {
		expect(source).toContain('loadXiaofeiRuntimeHostingCapability(organizationId, "active")');
		expect(source).toContain("materializeActiveCapabilitySnapshot");
		expect(source).toContain('if (state.ownerType === "ai")');
		expect(source).not.toContain("provider");
		expect(source).not.toContain("environment");
	});
});
