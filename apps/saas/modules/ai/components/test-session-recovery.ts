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
	isCurrent?: () => boolean;
	onDetail?: (detail: TDetail) => void;
}

/** Bounded history recovery: one list request and one detail request for the selected session. */
export async function recoverTestSession<TList extends TestSessionListItem, TDetail>({
	list,
	detail,
	select = (items) => items.find((item) => item.writable),
	onSelected,
	isCurrent = () => true,
	onDetail,
}: TestSessionRecoveryDeps<TList, TDetail>): Promise<{
	items: TList[];
	selected: TList | undefined;
	detail: TDetail | undefined;
}> {
	const result = await list();
	const selected = select(result.items);
	if (!isCurrent()) return { items: result.items, selected, detail: undefined };
	onSelected?.(selected, result.items);
	// A writable empty session is ready immediately; do not let a slow detail
	// request race with the user's first turn.
	if (!selected || selected.turnCount === 0) {
		return { items: result.items, selected, detail: undefined };
	}
	const selectedDetail = await detail(selected.id);
	if (!isCurrent()) return { items: result.items, selected, detail: undefined };
	onDetail?.(selectedDetail);
	return {
		items: result.items,
		selected,
		detail: selectedDetail,
	};
}
