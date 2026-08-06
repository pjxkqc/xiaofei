import { describe, expect, it, vi } from "vitest";

import { resetFileUploadForm } from "./QuickKnowledgePreparation";

describe("resetFileUploadForm", () => {
	it("resets the captured form after a successful upload", () => {
		const reset = vi.fn();

		resetFileUploadForm({ reset });

		expect(reset).toHaveBeenCalledOnce();
	});
});
