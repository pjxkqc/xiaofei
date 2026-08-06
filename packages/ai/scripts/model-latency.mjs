const profile = process.env.MODEL_LATENCY_PROFILE;
const label = process.env.MODEL_LATENCY_LABEL;
const apiKey = process.env.OPENAI_API_KEY?.trim();
const baseURL =
	process.env.OPENAI_BASE_URL?.trim().replace(/\/+$/, "") || "https://api.openai.com/v1";
const profileModel =
	profile === "knowledge" ? process.env.OPENAI_KNOWLEDGE_MODEL : process.env.OPENAI_REPLY_MODEL;
const model = profileModel?.trim() || process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";

if (!["knowledge", "reply"].includes(profile) || !label || !apiKey) {
	throw new Error("MODEL_LATENCY_PROFILE, MODEL_LATENCY_LABEL, and OPENAI_API_KEY are required.");
}

const samples = [];
for (const phase of ["cold", "warm"]) {
	for (let attempt = 0; attempt < 5; attempt += 1) {
		const startedAt = performance.now();
		try {
			const request = {
				model,
				messages: [
					{
						role: "user",
						content:
							profile === "knowledge"
								? "Return a JSON object with a single string field named title."
								: "Reply with the single word: ready",
					},
				],
				max_tokens: 8,
				temperature: 0,
				...(profile === "knowledge"
					? {
							response_format: {
								type: "json_schema",
								json_schema: {
									name: "latency_probe",
									strict: true,
									schema: {
										type: "object",
										properties: { title: { type: "string" } },
										required: ["title"],
										additionalProperties: false,
									},
								},
							},
						}
					: {}),
			};
			const response = await fetch(`${baseURL}/chat/completions`, {
				method: "POST",
				headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
				body: JSON.stringify(request),
			});
			const result = response.ok ? await response.json() : null;
			const structuredOutput = result?.choices?.[0]?.message?.content;
			const ok =
				response.ok &&
				(profile !== "knowledge" ||
					(typeof structuredOutput === "string" &&
						typeof JSON.parse(structuredOutput).title === "string"));
			samples.push({ phase, ok, latencyMs: Math.round(performance.now() - startedAt) });
		} catch {
			samples.push({ phase, ok: false, latencyMs: Math.round(performance.now() - startedAt) });
		}
	}
}

function summarize(phase) {
	const values = samples
		.filter((sample) => sample.phase === phase)
		.map((sample) => sample.latencyMs)
		.sort((a, b) => a - b);
	return {
		successes: samples.filter((sample) => sample.phase === phase && sample.ok).length,
		p50Ms: values[Math.ceil(values.length * 0.5) - 1],
		p95Ms: values[Math.ceil(values.length * 0.95) - 1],
	};
}

console.log(
	JSON.stringify({
		label,
		profile,
		available: samples.some((sample) => sample.ok),
		cold: summarize("cold"),
		warm: summarize("warm"),
	}),
);
