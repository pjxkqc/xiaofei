import { createOpenAI } from "@ai-sdk/openai";

import { getOpenAITextModelConfig, type OpenAITextModelProfile } from "./config";

export function createTextModel(profile: OpenAITextModelProfile = "reply") {
	const textModelConfig = getOpenAITextModelConfig(process.env, profile);
	const textModelProvider = createOpenAI({
		apiKey: textModelConfig.apiKey,
		baseURL: textModelConfig.baseURL,
		name: textModelConfig.baseURL ? "xiaofei-openai-compatible" : "openai",
	});

	// Use Chat Completions explicitly because the configured gateway is
	// OpenAI-compatible and does not need to implement the Responses API.
	return textModelProvider.chat(textModelConfig.model);
}
