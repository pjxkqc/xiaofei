import { createOpenAI } from "@ai-sdk/openai";

import { getOpenAITextModelConfig } from "./config";

export function createTextModel() {
	const textModelConfig = getOpenAITextModelConfig();
	const textModelProvider = createOpenAI({
		apiKey: textModelConfig.apiKey,
		baseURL: textModelConfig.baseURL,
		name: textModelConfig.baseURL ? "xiaofei-openai-compatible" : "openai",
	});

	// Use Chat Completions explicitly because the configured gateway is
	// OpenAI-compatible and does not need to implement the Responses API.
	return textModelProvider.chat(textModelConfig.model);
}
