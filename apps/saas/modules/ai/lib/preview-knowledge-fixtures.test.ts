import { describe, expect, it, vi } from "vitest";

import {
	getPreviewKnowledgeFileFixture,
	isPreviewKnowledgeFixtureSelectorVisible,
	loadPreviewKnowledgeFixtureFile,
	previewKnowledgeFileFixtures,
	previewKnowledgeWebFixture,
} from "./preview-knowledge-fixtures";

describe("Preview knowledge fixtures", () => {
	it("exposes only the committed same-origin file and webpage fixtures", () => {
		expect(previewKnowledgeFileFixtures).toHaveLength(5);
		expect(previewKnowledgeFileFixtures.map((fixture) => fixture.path)).toEqual([
			"/knowledge-test/qingfeng-faq.md",
			"/knowledge-test/qingfeng-campaign-notes.txt",
			"/knowledge-test/qingfeng-aftersales-manual.pdf",
			"/knowledge-test/qingfeng-presales-guide.docx",
			"/knowledge-test/qingfeng-product-service-matrix.xlsx",
		]);
		expect(previewKnowledgeWebFixture.path).toBe("/knowledge-test/qingfeng-subscription.html");
	});

	it("does not resolve arbitrary fixture paths", () => {
		expect(getPreviewKnowledgeFileFixture("faq")?.fileName).toBe("qingfeng-faq.md");
		expect(getPreviewKnowledgeFileFixture("../../not-a-fixture")).toBeUndefined();
	});

	it("prepares a selected fixture from its fixed same-origin path without submitting it", async () => {
		const requestSpy = vi.fn(
			async (_input: RequestInfo | URL) => new Response("fixture", { status: 200 }),
		);
		const request = requestSpy as unknown as typeof fetch;

		const file = await loadPreviewKnowledgeFixtureFile("faq", request);

		expect(requestSpy).toHaveBeenCalledWith("/knowledge-test/qingfeng-faq.md");
		expect(file.name).toBe("qingfeng-faq.md");
		expect(file.type).toBe("text/markdown");
	});

	it("shows fixture controls only for Vercel Preview", () => {
		expect(isPreviewKnowledgeFixtureSelectorVisible({ VERCEL_ENV: "preview" })).toBe(true);
		expect(isPreviewKnowledgeFixtureSelectorVisible({ VERCEL_ENV: "production" })).toBe(false);
		expect(isPreviewKnowledgeFixtureSelectorVisible({ VERCEL_ENV: "development" })).toBe(false);
		expect(isPreviewKnowledgeFixtureSelectorVisible({})).toBe(false);
	});
});
