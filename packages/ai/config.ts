const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";

export const OPENAI_TEXT_MODEL_PROFILES = ["knowledge", "reply"] as const;

export type OpenAITextModelProfile = (typeof OPENAI_TEXT_MODEL_PROFILES)[number];

export interface OpenAITextModelConfig {
	apiKey: string;
	baseURL?: string;
	model: string;
}

export function getOpenAITextModelConfig(
	env: NodeJS.ProcessEnv = process.env,
	profile: OpenAITextModelProfile = "reply",
): OpenAITextModelConfig {
	const apiKey = env.OPENAI_API_KEY?.trim();
	if (!apiKey) {
		throw new Error("OPENAI_API_KEY is required.");
	}

	const baseURL = env.OPENAI_BASE_URL?.trim().replace(/\/+$/, "");
	const profileModel =
		profile === "knowledge" ? env.OPENAI_KNOWLEDGE_MODEL?.trim() : env.OPENAI_REPLY_MODEL?.trim();
	const model = profileModel || env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL;

	return {
		apiKey,
		...(baseURL ? { baseURL } : {}),
		model,
	};
}
