export interface TestSessionListItem {
	id: string;
	writable: boolean;
	turnCount?: number;
}

export interface TestSessionRecoveryDeps<TList extends TestSessionListItem, TDetail> {
	list: () => Promise<{ items: TList[] }>;
	detail: (id: string) => Promise<TDetail>;
	select?: (items: TList[]) => TList | undefined;
	onSelected?: (selected: TList | undefined, items: TList[]) => void;
}

/** Bounded history recovery: one list request and one detail request for the selected session. */
export async function recoverTestSession<TList extends TestSessionListItem, TDetail>({
	list,
	detail,
	select = (items) => items.find((item) => item.writable),
	onSelected,
}: TestSessionRecoveryDeps<TList, TDetail>): Promise<{
	items: TList[];
	selected: TList | undefined;
	detail: TDetail | undefined;
}> {
	const result = await list();
	const selected = select(result.items);
	onSelected?.(selected, result.items);
	return {
		items: result.items,
		selected,
		detail: selected ? await detail(selected.id) : undefined,
	};
}
