import { describe, expect, it } from "vitest";

import { getOpenAITextModelConfig } from "./config";

describe("getOpenAITextModelConfig", () => {
	it("uses an OpenAI-compatible gateway and configured model", () => {
		expect(
			getOpenAITextModelConfig({
				OPENAI_API_KEY: " test-key ",
				OPENAI_BASE_URL: " https://gateway.example.test/v1/ ",
				OPENAI_MODEL: " test-model ",
			}),
		).toEqual({
			apiKey: "test-key",
			baseURL: "https://gateway.example.test/v1",
			model: "test-model",
		});
	});

	it("keeps the official OpenAI endpoint and default model when optional settings are absent", () => {
		expect(
			getOpenAITextModelConfig({
				OPENAI_API_KEY: "test-key",
			}),
		).toEqual({
			apiKey: "test-key",
			model: "gpt-4o-mini",
		});
	});

	it("fails with the missing variable name without exposing configuration values", () => {
		expect(() => getOpenAITextModelConfig({})).toThrow("OPENAI_API_KEY is required.");
	});
});
