import Firecrawl from "@mendable/firecrawl-js";
import { describe, expect, it, vi } from "vitest";

import {
	FIRECRAWL_PARSER_VERSION,
	FirecrawlKnowledgeContentParser,
	KnowledgeContentParserConfigurationError,
	KnowledgeContentParserError,
} from "./knowledge-content-parser";

vi.mock("@mendable/firecrawl-js", () => ({ default: vi.fn() }));

describe("Firecrawl knowledge content parser", () => {
	it.each([
		{
			fileName: "guide.docx",
			mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		},
		{
			fileName: "guide.xlsx",
			mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
		},
	])(
		"parses local $fileName files with the official SDK and returns normalized Markdown",
		async (input) => {
			const parse = vi.fn().mockResolvedValue({ markdown: "\n# Guide\n\n" });
			vi.mocked(Firecrawl).mockImplementation(function () {
				return { parse, scrape: vi.fn() } as never;
			});
			const parser = new FirecrawlKnowledgeContentParser("fc-test-key");
			await expect(
				parser.parseFile({
					bytes: Buffer.from("document"),
					...input,
				}),
			).resolves.toEqual({
				markdown: "# Guide",
				provider: "firecrawl",
				parserVersion: FIRECRAWL_PARSER_VERSION,
			});
			expect(parse).toHaveBeenCalledWith(
				expect.objectContaining({ filename: input.fileName, contentType: input.mimeType }),
				expect.objectContaining({ formats: ["markdown"], onlyMainContent: true }),
			);
		},
	);

	it("scrapes one validated public URL without crawling", async () => {
		const scrape = vi.fn().mockResolvedValue({ markdown: "Public content" });
		vi.mocked(Firecrawl).mockImplementation(function () {
			return { parse: vi.fn(), scrape } as never;
		});
		const parser = new FirecrawlKnowledgeContentParser("fc-test-key");
		await parser.scrapeUrl({ url: "https://example.com/help" });
		expect(scrape).toHaveBeenCalledWith(
			"https://example.com/help",
			expect.objectContaining({ formats: ["markdown"], onlyMainContent: true }),
		);
	});

	it("fails safely for missing credentials, empty results, and provider errors", async () => {
		expect(() => new FirecrawlKnowledgeContentParser("")).toThrow(
			KnowledgeContentParserConfigurationError,
		);
		vi.mocked(Firecrawl).mockImplementation(function () {
			return {
				parse: vi.fn().mockResolvedValue({}),
				scrape: vi.fn().mockRejectedValue(new Error("fc-key")),
			} as never;
		});
		const parser = new FirecrawlKnowledgeContentParser("fc-test-key");
		await expect(
			parser.parseFile({
				bytes: Buffer.from("file"),
				fileName: "guide.pdf",
				mimeType: "application/pdf",
			}),
		).rejects.toBeInstanceOf(KnowledgeContentParserError);
		await expect(parser.scrapeUrl({ url: "https://example.com" })).rejects.toMatchObject({
			message: "The source could not be parsed. Try again or edit the text manually.",
		});
	});

	it.each([
		"ftp://example.com/file",
		"http://localhost:3000",
		"https://127.0.0.1/admin",
		"https://10.0.0.1/admin",
		"https://172.16.0.1/admin",
		"https://192.168.0.1/admin",
		"https://[::1]/admin",
		"https://[fc00::1]/admin",
		"https://[fe80::1]/admin",
		"https://[::ffff:0:0]/admin",
		"https://[::ffff:7f00:1]/admin",
		"https://[::ffff:a00:1]/admin",
	])("rejects unsafe webpage target %s before calling the provider", async (url) => {
		const scrape = vi.fn();
		vi.mocked(Firecrawl).mockImplementation(function () {
			return { parse: vi.fn(), scrape } as never;
		});
		const parser = new FirecrawlKnowledgeContentParser("fc-test-key");
		await expect(parser.scrapeUrl({ url })).rejects.toMatchObject({
			message: expect.stringContaining("public http or https URL"),
		});
		expect(scrape).not.toHaveBeenCalled();
	});
});
