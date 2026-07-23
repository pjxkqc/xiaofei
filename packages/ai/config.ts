const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";

export interface OpenAITextModelConfig {
	apiKey: string;
	baseURL?: string;
	model: string;
}

export function getOpenAITextModelConfig(
	env: NodeJS.ProcessEnv = process.env,
): OpenAITextModelConfig {
	const apiKey = env.OPENAI_API_KEY?.trim();
	if (!apiKey) {
		throw new Error("OPENAI_API_KEY is required.");
	}

	const baseURL = env.OPENAI_BASE_URL?.trim().replace(/\/+$/, "");
	const model = env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL;

	return {
		apiKey,
		...(baseURL ? { baseURL } : {}),
		model,
	};
}
