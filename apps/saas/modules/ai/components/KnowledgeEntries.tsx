"use client";

import { Button } from "@repo/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/card";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { Textarea } from "@repo/ui/components/textarea";
import { toastError, toastSuccess } from "@repo/ui/components/toast";
import { orpcClient } from "@shared/lib/orpc-client";
import { LoaderCircleIcon, SaveIcon, Trash2Icon, UploadIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import {
	groupKnowledgeEntries,
	isKnowledgeEntrySelectable,
	type KnowledgeEntryListItem,
	type KnowledgeSourceListItem,
	reconcileSelectableEntryIds,
} from "../lib/knowledge-entry-groups";
import {
	getPreviewKnowledgeFileFixture,
	getPreviewKnowledgeWebFixtureUrl,
	loadPreviewKnowledgeFixtureFile,
	previewKnowledgeFileFixtures,
	previewKnowledgeWebFixture,
} from "../lib/preview-knowledge-fixtures";

interface Entry extends KnowledgeEntryListItem {
	answer: string;
	similarQueries: string[];
	tags: string[];
	category: string | null;
}
interface ManualPair {
	id: number;
	question: string;
	answer: string;
	similar: string;
	tags: string;
}
const MAX_FILE_BYTES = 4 * 1024 * 1024;
const MAX_MANUAL_PAIRS = 20;
const MAX_LISTED_ENTRIES = 500;
const MAX_LISTED_SOURCES = 100;

export function KnowledgeEntries({
	previewFixtureSelectorVisible = false,
}: {
	previewFixtureSelectorVisible?: boolean;
}) {
	const [entries, setEntries] = useState<Entry[]>([]);
	const [sources, setSources] = useState<KnowledgeSourceListItem[]>([]);
	const [selected, setSelected] = useState<Entry | null>(null);
	const [selectedEntryIds, setSelectedEntryIds] = useState<string[]>([]);
	const [busy, setBusy] = useState(false);
	const [category, setCategory] = useState<"PRESALES" | "POSTSALES">("PRESALES");
	const [manualPairs, setManualPairs] = useState<ManualPair[]>([emptyManualPair(1)]);
	const [previewFileId, setPreviewFileId] = useState("");
	const [previewWebUrl, setPreviewWebUrl] = useState("");
	const fileFormRef = useRef<HTMLFormElement>(null);
	const refresh = useCallback(async () => {
		const [nextEntries, nextSources] = await Promise.all([
			loadKnowledgeEntries(),
			loadKnowledgeSources(),
		]);
		setEntries(nextEntries);
		setSources(nextSources);
		setSelectedEntryIds((current) => reconcileSelectableEntryIds(current, nextEntries));
	}, []);
	useEffect(() => {
		void refresh().catch(() => toastError("无法读取知识条目"));
	}, [refresh]);
	async function submitFile(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const formElement = event.currentTarget;
		const input = formElement.elements.namedItem("file");
		if (!(input instanceof HTMLInputElement) || !input.files?.[0]) return;
		const file = input.files[0];
		if (file.size > MAX_FILE_BYTES) return toastError("上传失败", "文件不能超过 4 MB。");
		setBusy(true);
		try {
			await orpcClient.xiaofei.createKnowledgeDocument({
				originalFileName: file.name,
				mimeType: file.type,
				category,
				contentBase64: await fileToBase64(file),
			});
			formElement.reset();
			setPreviewFileId("");
			await refresh();
			toastSuccess("知识已添加", "已创建可编辑的标准化条目。");
		} catch (error) {
			toastError("上传失败", message(error));
		} finally {
			setBusy(false);
		}
	}
	async function submitWeb(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const formElement = event.currentTarget;
		const formData = new FormData(formElement);
		setBusy(true);
		try {
			await orpcClient.xiaofei.createKnowledgeWeb({ url: formString(formData, "url"), category });
			formElement.reset();
			setPreviewWebUrl("");
			await refresh();
			toastSuccess("网页已添加");
		} catch (error) {
			toastError("网页导入失败", message(error));
		} finally {
			setBusy(false);
		}
	}
	async function preparePreviewFile(id: string) {
		setPreviewFileId(id);
		const fileInput = fileFormRef.current?.elements.namedItem("file");
		if (!(fileInput instanceof HTMLInputElement)) {
			setPreviewFileId("");
			return;
		}
		fileInput.value = "";
		if (!id) {
			return;
		}
		if (!getPreviewKnowledgeFileFixture(id)) {
			setPreviewFileId("");
			return;
		}
		try {
			const files = new DataTransfer();
			files.items.add(await loadPreviewKnowledgeFixtureFile(id));
			fileInput.files = files.files;
			toastSuccess("已准备测试文件", "点击现有上传按钮后才会创建记录。");
		} catch (error) {
			setPreviewFileId("");
			fileInput.value = "";
			toastError("无法准备测试文件", message(error));
		}
	}
	async function submitManual(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const formElement = event.currentTarget;
		setBusy(true);
		try {
			await orpcClient.xiaofei.createManualKnowledgeEntries({
				category,
				pairs: manualPairs.map(({ question, answer, similar, tags }) => ({
					question,
					answer,
					similarQueries: split(similar),
					tags: split(tags),
				})),
			});
			formElement.reset();
			setManualPairs([emptyManualPair(1)]);
			await refresh();
			toastSuccess("问答已添加");
		} catch (error) {
			toastError("问答保存失败", message(error));
		} finally {
			setBusy(false);
		}
	}
	function addManualPair() {
		setManualPairs((current) =>
			current.length >= MAX_MANUAL_PAIRS
				? current
				: [...current, emptyManualPair(current.at(-1)!.id + 1)],
		);
	}
	function updateManualPair(id: number, field: keyof Omit<ManualPair, "id">, value: string) {
		setManualPairs((current) =>
			current.map((pair) => (pair.id === id ? { ...pair, [field]: value } : pair)),
		);
	}
	function removeManualPair(id: number) {
		setManualPairs((current) =>
			current.length === 1 ? current : current.filter((pair) => pair.id !== id),
		);
	}
	async function openEntry(id: string) {
		setBusy(true);
		try {
			setSelected(await orpcClient.xiaofei.getKnowledgeEntry({ id }));
		} catch (error) {
			toastError("无法打开条目", message(error));
		} finally {
			setBusy(false);
		}
	}
	async function save(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!selected) return;
		const form = new FormData(event.currentTarget);
		setBusy(true);
		try {
			const updated = await orpcClient.xiaofei.updateKnowledgeEntry({
				id: selected.id,
				question: formString(form, "question"),
				answer: formString(form, "answer"),
				similarQueries: split(formString(form, "similar")),
				tags: split(formString(form, "tags")),
				status: formString(form, "status") as "draft" | "active" | "archived",
			});
			if (!updated) throw new Error("The entry could not be saved.");
			setSelected(updated);
			await refresh();
			toastSuccess("条目已保存");
		} catch (error) {
			toastError("条目保存失败", message(error));
		} finally {
			setBusy(false);
		}
	}
	async function remove() {
		if (!selected || !confirm(`删除“${selected.question}”？`)) return;
		setBusy(true);
		try {
			await orpcClient.xiaofei.deleteKnowledgeEntry({ id: selected.id });
			setSelected(null);
			await refresh();
			toastSuccess("条目已删除");
		} catch (error) {
			toastError("删除失败", message(error));
		} finally {
			setBusy(false);
		}
	}
	async function activateSelected() {
		const selectableIds = reconcileSelectableEntryIds(selectedEntryIds, entries);
		if (!selectableIds.length) {
			setSelectedEntryIds([]);
			return toastError("没有可启用的条目", "只能启用来源当前有效的草稿条目。");
		}
		setBusy(true);
		try {
			const results: PromiseSettledResult<unknown>[] = [];
			for (const id of selectableIds) {
				try {
					results.push({
						status: "fulfilled",
						value: await orpcClient.xiaofei.updateKnowledgeEntry({ id, status: "active" }),
					});
				} catch (reason) {
					results.push({ status: "rejected", reason });
				}
			}
			setSelectedEntryIds([]);
			await refresh();
			const failedCount = results.filter((result) => result.status === "rejected").length;
			if (failedCount) {
				toastError(
					"部分条目启用失败",
					`${selectableIds.length - failedCount} 项已启用，${failedCount} 项请刷新后重试。`,
				);
			} else {
				toastSuccess("已启用所选条目", "现在可在知识单元页面选择这些当前条目。");
			}
		} catch (error) {
			toastError("批量启用失败", message(error));
		} finally {
			setBusy(false);
		}
	}
	return (
		<div className="gap-6 flex flex-col">
			<div className="gap-4 lg:grid-cols-3 grid">
				<EntryCard
					title="文件上传"
					description="MD、TXT 本地处理；PDF、DOCX、XLSX 安全地经服务端解析。最多 4 MB。"
				>
					<form ref={fileFormRef} className="gap-3 flex flex-col" onSubmit={submitFile}>
						{previewFixtureSelectorVisible && (
							<PreviewFixtureExplanation>
								<Label>
									Preview 测试文件
									<select
										aria-label="Preview 测试文件"
										className="h-10 px-3 mt-1 w-full rounded-md border bg-background"
										value={previewFileId}
										onChange={(event) => void preparePreviewFile(event.target.value)}
										disabled={busy}
									>
										<option value="">选择一份虚构资料</option>
										{previewKnowledgeFileFixtures.map((fixture) => (
											<option key={fixture.id} value={fixture.id}>
												{fixture.label}
											</option>
										))}
									</select>
								</Label>
							</PreviewFixtureExplanation>
						)}
						<Input
							name="file"
							type="file"
							accept=".md,.txt,.pdf,.docx,.xlsx"
							onChange={() => setPreviewFileId("")}
							required
							disabled={busy}
						/>
						<Category value={category} onChange={setCategory} />
						<Button disabled={busy}>
							<UploadIcon className="mr-2 size-4" />
							上传并创建条目
						</Button>
					</form>
				</EntryCard>
				<EntryCard title="网页链接" description="只抓取单个公开 HTTP(S) 页面，不会递归抓取。">
					<form className="gap-3 flex flex-col" onSubmit={submitWeb}>
						{previewFixtureSelectorVisible && (
							<PreviewFixtureExplanation>
								<Label>
									Preview 测试网页
									<select
										aria-label="Preview 测试网页"
										className="h-10 px-3 mt-1 w-full rounded-md border bg-background"
										onChange={(event) =>
											setPreviewWebUrl(
												getPreviewKnowledgeWebFixtureUrl(
													event.target.value,
													window.location.origin,
												),
											)
										}
										disabled={busy}
									>
										<option value="">选择同源虚构网页</option>
										<option value={previewKnowledgeWebFixture.path}>
											{previewKnowledgeWebFixture.label}
										</option>
									</select>
								</Label>
							</PreviewFixtureExplanation>
						)}
						<Input
							name="url"
							type="url"
							placeholder="https://example.com/help"
							value={previewWebUrl}
							onChange={(event) => setPreviewWebUrl(event.target.value)}
							required
							disabled={busy}
						/>
						<Category value={category} onChange={setCategory} />
						<Button disabled={busy}>抓取并创建条目</Button>
					</form>
				</EntryCard>
				<EntryCard
					title="手动问答"
					description="直接录入；可添加相似问法和标签。一次可提交最多 20 组。"
				>
					<form className="gap-3 flex flex-col" onSubmit={submitManual}>
						{manualPairs.map((pair, index) => (
							<div key={pair.id} className="gap-2 p-3 flex flex-col rounded-md border">
								<div className="text-sm font-medium flex items-center justify-between">
									问答 {index + 1}
									<Button
										type="button"
										variant="ghost"
										size="sm"
										onClick={() => removeManualPair(pair.id)}
										disabled={busy || manualPairs.length === 1}
									>
										删除
									</Button>
								</div>
								<Input
									value={pair.question}
									onChange={(event) => updateManualPair(pair.id, "question", event.target.value)}
									placeholder="问题"
									required
									disabled={busy}
								/>
								<Textarea
									value={pair.answer}
									onChange={(event) => updateManualPair(pair.id, "answer", event.target.value)}
									placeholder="答案"
									required
									disabled={busy}
								/>
								<Input
									value={pair.similar}
									onChange={(event) => updateManualPair(pair.id, "similar", event.target.value)}
									placeholder="相似问法（逗号分隔，可选）"
									disabled={busy}
								/>
								<Input
									value={pair.tags}
									onChange={(event) => updateManualPair(pair.id, "tags", event.target.value)}
									placeholder="标签（逗号分隔，可选）"
									disabled={busy}
								/>
							</div>
						))}
						<Button
							type="button"
							variant="outline"
							onClick={addManualPair}
							disabled={busy || manualPairs.length >= MAX_MANUAL_PAIRS}
						>
							添加问答{" "}
							{manualPairs.length >= MAX_MANUAL_PAIRS
								? "（最多 20 组）"
								: `（${manualPairs.length}/20）`}
						</Button>
						<Category value={category} onChange={setCategory} />
						<Button disabled={busy}>添加问答</Button>
					</form>
				</EntryCard>
			</div>
			<div className="gap-5 lg:grid-cols-[340px_minmax(0,1fr)] grid">
				<Card>
					<CardHeader>
						<CardTitle>知识条目</CardTitle>
						<CardDescription>
							{entries.length} 个当前租户条目；按来源分组，可批量启用复核后的条目。
						</CardDescription>
					</CardHeader>
					<CardContent className="gap-2 flex max-h-[600px] flex-col overflow-auto">
						{groupKnowledgeEntries(entries, sources).map((group) => (
							<div key={group.key} className="gap-1 flex flex-col">
								<p className="px-3 pt-2 text-xs font-medium text-muted-foreground">
									来源：{group.label}（{group.entries.length} 项）
								</p>
								{group.entries.map((entry) => (
									<div
										key={entry.id}
										className="gap-2 p-3 flex items-start rounded-md hover:bg-muted"
									>
										<input
											aria-label={`选择 ${entry.question}`}
											type="checkbox"
											checked={selectedEntryIds.includes(entry.id)}
											onChange={() =>
												setSelectedEntryIds((current) =>
													current.includes(entry.id)
														? current.filter((id) => id !== entry.id)
														: [...current, entry.id],
												)
											}
											disabled={busy || !isKnowledgeEntrySelectable(entry)}
										/>
										<button
											type="button"
											className="flex-1 text-left"
											onClick={() => void openEntry(entry.id)}
											disabled={busy}
										>
											<p className="font-medium line-clamp-2">{entry.question}</p>
											<p className="text-xs text-muted-foreground">
												{entry.eligible ? "可用" : "需复核"} · {entry.status}
											</p>
										</button>
									</div>
								))}
							</div>
						))}
						<Button
							type="button"
							variant="outline"
							onClick={() => void activateSelected()}
							disabled={busy || !selectedEntryIds.length}
						>
							启用所选条目（{selectedEntryIds.length}）
						</Button>
					</CardContent>
				</Card>
				<Card>
					{selected ? (
						<form key={selected.id} onSubmit={save}>
							<CardHeader>
								<CardTitle>编辑条目</CardTitle>
								<CardDescription>
									{selected.eligible ? "来源当前有效" : "来源已更新或删除；请复核。"}
								</CardDescription>
							</CardHeader>
							<CardContent className="gap-4 flex flex-col">
								<Field name="question" label="问题" value={selected.question} required />
								<Field name="answer" label="答案" value={selected.answer} area required />
								<Field name="similar" label="相似问法" value={selected.similarQueries.join(", ")} />
								<Field name="tags" label="标签" value={selected.tags.join(", ")} />
								<Label>
									状态
									<select
										name="status"
										defaultValue={selected.status}
										className="h-10 px-3 mt-1 w-full rounded-md border bg-background"
									>
										<option value="draft">草稿</option>
										<option value="active">启用</option>
										<option value="archived">归档</option>
									</select>
								</Label>
								<div className="gap-2 flex">
									<Button
										type="button"
										variant="outline"
										onClick={() => void remove()}
										disabled={busy}
									>
										<Trash2Icon className="mr-2 size-4" />
										删除
									</Button>
									<Button disabled={busy}>
										{busy && <LoaderCircleIcon className="mr-2 size-4 animate-spin" />}
										<SaveIcon className="mr-2 size-4" />
										保存
									</Button>
								</div>
							</CardContent>
						</form>
					) : (
						<CardContent className="py-24 text-center text-muted-foreground">
							选择一个条目查看来源状态并编辑。
						</CardContent>
					)}
				</Card>
			</div>
		</div>
	);
}
function EntryCard(props: { title: string; description: string; children: React.ReactNode }) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>{props.title}</CardTitle>
				<CardDescription>{props.description}</CardDescription>
			</CardHeader>
			<CardContent>{props.children}</CardContent>
		</Card>
	);
}
function PreviewFixtureExplanation(props: { children: React.ReactNode }) {
	return (
		<div className="p-3 gap-2 flex flex-col rounded-md border border-dashed bg-muted/30">
			<p className="text-xs text-muted-foreground">
				Preview 专用：这些是可重复使用的虚构测试资料；选择仅准备输入，不会创建记录。
			</p>
			{props.children}
		</div>
	);
}
function Category(props: { value: string; onChange: (value: "PRESALES" | "POSTSALES") => void }) {
	return (
		<Label>
			业务分类
			<select
				className="h-10 px-3 mt-1 w-full rounded-md border bg-background"
				value={props.value}
				onChange={(event) => props.onChange(event.target.value as "PRESALES" | "POSTSALES")}
			>
				<option value="PRESALES">售前</option>
				<option value="POSTSALES">售后</option>
			</select>
		</Label>
	);
}
function Field(props: {
	name: string;
	label: string;
	value: string;
	area?: boolean;
	required?: boolean;
}) {
	return (
		<Label>
			{props.label}
			{props.area ? (
				<Textarea
					name={props.name}
					defaultValue={props.value}
					required={props.required}
					className="mt-1 min-h-48"
				/>
			) : (
				<Input
					name={props.name}
					defaultValue={props.value}
					required={props.required}
					className="mt-1"
				/>
			)}
		</Label>
	);
}
function split(value: string) {
	return value
		.split(",")
		.map((part) => part.trim())
		.filter(Boolean);
}
function emptyManualPair(id: number): ManualPair {
	return { id, question: "", answer: "", similar: "", tags: "" };
}
function formString(form: FormData, name: string) {
	const value = form.get(name);
	return typeof value === "string" ? value : "";
}
function message(error: unknown) {
	return error instanceof Error ? error.message : undefined;
}
async function fileToBase64(file: File) {
	const bytes = new Uint8Array(await file.arrayBuffer());
	let binary = "";
	for (let index = 0; index < bytes.length; index += 32_768)
		binary += String.fromCharCode(...bytes.subarray(index, index + 32_768));
	return btoa(binary);
}

async function loadKnowledgeEntries(): Promise<Entry[]> {
	const entries: Entry[] = [];
	const seenCursors = new Set<string>();
	let cursor: string | undefined;
	while (entries.length < MAX_LISTED_ENTRIES) {
		const page = await orpcClient.xiaofei.listKnowledgeEntries({ cursor, limit: 50 });
		entries.push(...(page.items as Entry[]));
		const nextCursor = page.nextCursor ?? undefined;
		if (!nextCursor || seenCursors.has(nextCursor)) break;
		seenCursors.add(nextCursor);
		cursor = nextCursor;
	}
	return entries.slice(0, MAX_LISTED_ENTRIES);
}

async function loadKnowledgeSources(): Promise<KnowledgeSourceListItem[]> {
	const sources: KnowledgeSourceListItem[] = [];
	const seenCursors = new Set<string>();
	let cursor: string | undefined;
	while (sources.length < MAX_LISTED_SOURCES) {
		const page = await orpcClient.xiaofei.listKnowledgeDocuments({ cursor, limit: 50 });
		sources.push(...(page.items as KnowledgeSourceListItem[]));
		const nextCursor = page.nextCursor ?? undefined;
		if (!nextCursor || seenCursors.has(nextCursor)) break;
		seenCursors.add(nextCursor);
		cursor = nextCursor;
	}
	return sources.slice(0, MAX_LISTED_SOURCES);
}
