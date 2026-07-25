import Firecrawl from "@mendable/firecrawl-js";
import { ORPCError } from "@orpc/server";
import * as ipaddr from "ipaddr.js";

export const FIRECRAWL_PARSER_VERSION = "firecrawl-v2";

export interface KnowledgeContentParser {
	parseFile(input: KnowledgeFileParseInput): Promise<KnowledgeParsedContent>;
	scrapeUrl(input: KnowledgeUrlScrapeInput): Promise<KnowledgeParsedContent>;
}

export interface KnowledgeFileParseInput {
	bytes: Uint8Array;
	fileName: string;
	mimeType: string;
}

export interface KnowledgeUrlScrapeInput {
	url: string;
}

export interface KnowledgeParsedContent {
	markdown: string;
	provider: "firecrawl";
	parserVersion: typeof FIRECRAWL_PARSER_VERSION;
}

export class FirecrawlKnowledgeContentParser implements KnowledgeContentParser {
	private readonly client: Firecrawl;

	constructor(apiKey = process.env.FIRECRAWL_API_KEY) {
		if (!apiKey) throw new KnowledgeContentParserConfigurationError();
		this.client = new Firecrawl({ apiKey });
	}

	async parseFile(input: KnowledgeFileParseInput): Promise<KnowledgeParsedContent> {
		try {
			const document = await this.client.parse(
				{ data: input.bytes, filename: input.fileName, contentType: input.mimeType },
				{ formats: ["markdown"], onlyMainContent: true, timeout: 30_000 },
			);
			return toParsedContent(document.markdown);
		} catch (error) {
			throw toKnowledgeContentParserError(error);
		}
	}

	async scrapeUrl(input: KnowledgeUrlScrapeInput): Promise<KnowledgeParsedContent> {
		validatePublicHttpUrl(input.url);
		try {
			const document = await this.client.scrape(input.url, {
				formats: ["markdown"],
				onlyMainContent: true,
				timeout: 30_000,
			});
			return toParsedContent(document.markdown);
		} catch (error) {
			throw toKnowledgeContentParserError(error);
		}
	}
}

export class KnowledgeContentParserConfigurationError extends Error {
	constructor() {
		super("Knowledge content parsing is not configured.");
		this.name = "KnowledgeContentParserConfigurationError";
	}
}

export class KnowledgeContentParserError extends Error {
	constructor() {
		super("The source could not be parsed. Try again or edit the text manually.");
		this.name = "KnowledgeContentParserError";
	}
}

export function createKnowledgeContentParser(): KnowledgeContentParser {
	return new FirecrawlKnowledgeContentParser();
}

export function validatePublicHttpUrl(value: string): void {
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		throw invalidPublicUrlError();
	}
	if ((url.protocol !== "http:" && url.protocol !== "https:") || !url.hostname) {
		throw invalidPublicUrlError();
	}
	const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
	if (hostname === "localhost" || hostname.endsWith(".localhost") || isPrivateIpAddress(hostname)) {
		throw invalidPublicUrlError();
	}
}

function toParsedContent(markdown: string | undefined): KnowledgeParsedContent {
	const normalizedMarkdown = markdown?.replaceAll("\u0000", "").trim();
	if (!normalizedMarkdown) throw new KnowledgeContentParserError();
	return {
		markdown: normalizedMarkdown,
		provider: "firecrawl",
		parserVersion: FIRECRAWL_PARSER_VERSION,
	};
}

function toKnowledgeContentParserError(error: unknown): Error {
	if (error instanceof KnowledgeContentParserError) return error;
	return new KnowledgeContentParserError();
}

function invalidPublicUrlError(): ORPCError<"BAD_REQUEST", unknown> {
	return new ORPCError("BAD_REQUEST", {
		message:
			"Enter a public http or https URL. Localhost and private-network addresses are not allowed.",
	});
}

function isPrivateIpAddress(hostname: string): boolean {
	const normalizedHostname = hostname.replace(/^\[|\]$/g, "");
	if (!ipaddr.isValid(normalizedHostname)) return false;
	return BLOCKED_IP_RANGES.has(ipaddr.process(normalizedHostname).range());
}

const BLOCKED_IP_RANGES = new Set([
	"unspecified",
	"broadcast",
	"multicast",
	"linkLocal",
	"loopback",
	"carrierGradeNat",
	"private",
	"uniqueLocal",
	"reserved",
]);
