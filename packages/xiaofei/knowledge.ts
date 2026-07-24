import { KnowledgeUnitSchema, type KnowledgeUnit, type RequiredSlot } from "./contracts";

const FIELD_LABELS = {
	applicableScenarios: "适用场景",
	inapplicableScenarios: "不适用场景",
	scenarioKeywords: "场景关键词",
	forbiddenOutputs: "禁止输出",
	handoffRules: "转人工条件",
	standardReplyPolicy: "标准口径",
	fallbackReply: "兜底话术",
} as const;

export function parseKnowledgeMarkdown(markdown: string): KnowledgeUnit[] {
	return markdown
		.split(/^##\s+/mu)
		.slice(1)
		.map(parseSection)
		.filter((unit): unit is KnowledgeUnit => unit !== null);
}

function parseSection(section: string): KnowledgeUnit | null {
	const [titleLine, ...bodyLines] = section.trim().split("\n");
	const title = titleLine?.trim();
	if (!title) return null;

	const body = bodyLines.join("\n");
	const requiredSlots = parseRequiredSlots(body);
	const scenarioKeywords = readList(body, FIELD_LABELS.scenarioKeywords);
	const forbiddenOutputs = readList(body, FIELD_LABELS.forbiddenOutputs);
	const handoffRules = readList(body, FIELD_LABELS.handoffRules);
	const standardReplyPolicy = readText(body, FIELD_LABELS.standardReplyPolicy);
	const fallbackReply = readText(body, FIELD_LABELS.fallbackReply);
	const blockers = [
		...(scenarioKeywords.length === 0 ? ["缺少场景关键词"] : []),
		...(forbiddenOutputs.length === 0 ? ["缺少禁止输出"] : []),
		...(handoffRules.length === 0 ? ["缺少转人工条件"] : []),
		...(!standardReplyPolicy ? ["缺少标准口径"] : []),
		...(!fallbackReply ? ["缺少兜底话术"] : []),
	];

	return KnowledgeUnitSchema.parse({
		id: slugify(title),
		title,
		status: blockers.length === 0 ? "released" : "blocked",
		scenarioKeywords,
		applicableScenarios: readList(body, FIELD_LABELS.applicableScenarios),
		inapplicableScenarios: readList(body, FIELD_LABELS.inapplicableScenarios),
		requiredSlots,
		forbiddenOutputs,
		handoffRules,
		standardReplyPolicy: standardReplyPolicy || "只回答已确认事实，不承诺处理结果。",
		fallbackReply: fallbackReply || "这个问题需要人工客服核实，我会转交人工继续处理。",
		sourceSection: title,
		quality: {
			status: blockers.length === 0 ? "passed" : "blocked",
			blockers,
			warnings:
				requiredSlots.length === 0 ? ["该知识单元没有必问字段，请确认是否为纯问答场景。"] : [],
		},
	});
}

function parseRequiredSlots(body: string): RequiredSlot[] {
	const match = body.match(/(?:^|\n)必问字段\s*[:：]\s*\n((?:\s*-\s*.+\n?)*)/u);
	if (!match?.[1]) return [];

	return match[1]
		.split("\n")
		.map((line) => line.replace(/^\s*-\s*/u, "").trim())
		.filter(Boolean)
		.flatMap((line) => {
			const [key, label, askText] = line.split("|").map((part) => part?.trim());
			if (!key || !label || !askText) return [];
			return [{ key, label, askText, required: true }];
		});
}

function readList(body: string, label: string): string[] {
	return readText(body, label)
		.split(/[,，、]/u)
		.map((value) => value.trim())
		.filter(Boolean);
}

function readText(body: string, label: string): string {
	const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
	const match = body.match(new RegExp(`(?:^|\\n)${escapedLabel}\\s*[:：]\\s*(.+)`, "u"));
	return match?.[1]?.trim() ?? "";
}

function slugify(value: string): string {
	const slug = value
		.toLowerCase()
		.replace(/[^\p{Letter}\p{Number}]+/gu, "-")
		.replace(/^-|-$/gu, "")
		.slice(0, 48);
	return slug || "knowledge-unit";
}
