export interface KnowledgeEntryListItem {
	id: string;
	question: string;
	status: string;
	eligible?: boolean;
	sourceId: string | null;
}

export interface KnowledgeSourceListItem {
	id: string;
	sourceType: string;
	originalFileName: string | null;
	sourceUrl: string | null;
}

export interface KnowledgeEntryGroup<TEntry extends KnowledgeEntryListItem> {
	key: string;
	label: string;
	entries: TEntry[];
}

export function isKnowledgeEntrySelectable(entry: KnowledgeEntryListItem): boolean {
	return entry.eligible === true && entry.status === "draft";
}

export function reconcileSelectableEntryIds(
	selectedIds: string[],
	entries: KnowledgeEntryListItem[],
): string[] {
	const selectableIds = new Set(
		entries.filter(isKnowledgeEntrySelectable).map((entry) => entry.id),
	);
	return selectedIds.filter((id) => selectableIds.has(id));
}

export function groupKnowledgeEntries<TEntry extends KnowledgeEntryListItem>(
	entries: TEntry[],
	sources: KnowledgeSourceListItem[],
): KnowledgeEntryGroup<TEntry>[] {
	const sourcesById = new Map(sources.map((source) => [source.id, source]));
	const groups = new Map<string, KnowledgeEntryGroup<TEntry>>();
	for (const entry of entries) {
		const key = entry.sourceId ?? "manual";
		const existing = groups.get(key);
		if (existing) {
			existing.entries.push(entry);
			continue;
		}
		groups.set(key, {
			key,
			label: entry.sourceId ? knowledgeSourceLabel(sourcesById.get(entry.sourceId)) : "手动录入",
			entries: [entry],
		});
	}
	return [...groups.values()];
}

function knowledgeSourceLabel(source?: KnowledgeSourceListItem): string {
	if (!source) return "已删除来源";
	const fileName = source.originalFileName?.trim();
	if (fileName) return fileName;
	const sourceUrl = source.sourceUrl?.trim();
	if (sourceUrl) return sourceUrl;
	if (source.sourceType === "MANUAL") return "手动录入";
	if (source.sourceType === "WEB") return "网页资料";
	if (source.sourceType === "FILE") return "上传文件";
	return "知识来源";
}
