import { createOpenAI, openai } from "@ai-sdk/openai";

import { getOpenAITextModelConfig } from "./config";

const textModelConfig = getOpenAITextModelConfig();
const textModelProvider = createOpenAI({
	apiKey: textModelConfig.apiKey,
	baseURL: textModelConfig.baseURL,
	name: textModelConfig.baseURL ? "xiaofei-openai-compatible" : "openai",
});

// Use Chat Completions explicitly because the configured gateway is
// OpenAI-compatible and does not need to implement the Responses API.
export const textModel = textModelProvider.chat(textModelConfig.model);
export const imageModel = openai("dall-e-3");
export const audioModel = openai("whisper-1");

export * from "ai";
export * from "./config";
export * from "./lib";
