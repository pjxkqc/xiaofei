import { describe, expect, it } from "vitest";

import { symmetricDifferenceSize } from "./KnowledgeVersioningPanel";

describe("symmetricDifferenceSize", () => {
	it("reports revision replacements even when Active and Test have equal member counts", () => {
		expect(
			symmetricDifferenceSize(
				new Set(["platform-v1", "merchant-price-v1"]),
				new Set(["platform-v1", "merchant-price-v2"]),
			),
		).toBe(2);
	});
});
