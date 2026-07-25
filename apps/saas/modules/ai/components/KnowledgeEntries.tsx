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
import { useCallback, useEffect, useState } from "react";

interface Entry {
	id: string;
	question: string;
	answer: string;
	similarQueries: string[];
	tags: string[];
	category: string | null;
	status: string;
	eligible?: boolean;
	sourceId: string | null;
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

export function KnowledgeEntries() {
	const [entries, setEntries] = useState<Entry[]>([]);
	const [selected, setSelected] = useState<Entry | null>(null);
	const [busy, setBusy] = useState(false);
	const [category, setCategory] = useState<"PRESALES" | "POSTSALES">("PRESALES");
	const [manualPairs, setManualPairs] = useState<ManualPair[]>([emptyManualPair(1)]);
	const refresh = useCallback(
		async () => setEntries((await orpcClient.xiaofei.listKnowledgeEntries({ limit: 50 })).items),
		[],
	);
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
			await refresh();
			toastSuccess("网页已添加");
		} catch (error) {
			toastError("网页导入失败", message(error));
		} finally {
			setBusy(false);
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
	return (
		<div className="gap-6 flex flex-col">
			<div className="gap-4 lg:grid-cols-3 grid">
				<EntryCard
					title="文件上传"
					description="MD、TXT 本地处理；PDF、DOCX、XLSX 安全地经服务端解析。最多 4 MB。"
				>
					<form className="gap-3 flex flex-col" onSubmit={submitFile}>
						<Input
							name="file"
							type="file"
							accept=".md,.txt,.pdf,.docx,.xlsx"
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
						<Input
							name="url"
							type="url"
							placeholder="https://example.com/help"
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
						<CardDescription>{entries.length} 个当前租户条目</CardDescription>
					</CardHeader>
					<CardContent className="gap-2 flex max-h-[600px] flex-col overflow-auto">
						{entries.map((entry) => (
							<button
								key={entry.id}
								type="button"
								className="p-3 rounded-md text-left hover:bg-muted"
								onClick={() => void openEntry(entry.id)}
								disabled={busy}
							>
								<p className="font-medium line-clamp-2">{entry.question}</p>
								<p className="text-xs text-muted-foreground">
									{entry.eligible ? "可用" : "需复核"} · {entry.status}
								</p>
							</button>
						))}
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
								<Field name="question" label="问题" value={selected.question} />
								<Field name="answer" label="答案" value={selected.answer} area />
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
function Field(props: { name: string; label: string; value: string; area?: boolean }) {
	return (
		<Label>
			{props.label}
			{props.area ? (
				<Textarea name={props.name} defaultValue={props.value} required className="mt-1 min-h-48" />
			) : (
				<Input name={props.name} defaultValue={props.value} required className="mt-1" />
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
