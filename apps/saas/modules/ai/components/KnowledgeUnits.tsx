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
import { LoaderCircleIcon, SaveIcon, Trash2Icon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface Entry {
	id: string;
	question: string;
	status: string;
	eligible: boolean;
}
interface UnitContent {
	standardReplyPolicy: string;
	fallbackReply: string;
}
interface Unit {
	id: string;
	title: string;
	status: string;
	eligibility: string;
	staleReason: string | null;
	entryId: string;
	content: UnitContent;
}

export function KnowledgeUnits() {
	const [entries, setEntries] = useState<Entry[]>([]);
	const [units, setUnits] = useState<Unit[]>([]);
	const [selected, setSelected] = useState<Unit | null>(null);
	const [selectedEntryIds, setSelectedEntryIds] = useState<string[]>([]);
	const [busy, setBusy] = useState(false);
	const refresh = useCallback(async () => {
		const [entryResult, unitResult] = await Promise.all([
			orpcClient.xiaofei.listKnowledgeEntries({ limit: 50 }),
			orpcClient.xiaofei.listKnowledgeUnits(),
		]);
		setEntries(entryResult.items);
		const parsedUnits = unitResult.map((unit) => ({ ...unit, content: readContent(unit.content) }));
		setUnits(parsedUnits);
		setSelected((current) => parsedUnits.find((unit) => unit.id === current?.id) ?? null);
	}, []);
	useEffect(() => {
		void refresh().catch(() => toastError("无法读取知识单元"));
	}, [refresh]);
	async function generate() {
		if (!selectedEntryIds.length) return toastError("请选择至少一个当前有效的知识条目。");
		setBusy(true);
		try {
			await orpcClient.xiaofei.generateKnowledgeUnits({ entryIds: selectedEntryIds });
			setSelectedEntryIds([]);
			await refresh();
			toastSuccess("已生成草稿", "生成结果需要人工审核后才能发布。");
		} catch (error) {
			toastError("生成失败", message(error));
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
			await orpcClient.xiaofei.updateKnowledgeUnit({
				id: selected.id,
				title: text(form, "title"),
				standardReplyPolicy: text(form, "policy"),
				fallbackReply: text(form, "fallback"),
			});
			await refresh();
			toastSuccess("知识单元已保存");
		} catch (error) {
			toastError("保存失败", message(error));
		} finally {
			setBusy(false);
		}
	}
	async function transition(action: "review" | "revokeReview" | "publish" | "revokePublish") {
		if (!selected) return;
		setBusy(true);
		try {
			await orpcClient.xiaofei.transitionKnowledgeUnit({ id: selected.id, action });
			await refresh();
			toastSuccess("知识单元状态已更新");
		} catch (error) {
			toastError("状态更新失败", message(error));
		} finally {
			setBusy(false);
		}
	}
	async function remove() {
		if (!selected || !confirm(`删除“${selected.title}”？`)) return;
		setBusy(true);
		try {
			await orpcClient.xiaofei.deleteKnowledgeUnit({ id: selected.id });
			await refresh();
			toastSuccess("知识单元已删除");
		} catch (error) {
			toastError("删除失败", message(error));
		} finally {
			setBusy(false);
		}
	}
	return (
		<div className="gap-6 flex flex-col">
			<Card>
				<CardHeader>
					<CardTitle>从已标准化条目生成草稿</CardTitle>
					<CardDescription>
						条目内容作为不可信参考数据发送到服务器端模型。所有结果均为不可调用草稿。
					</CardDescription>
				</CardHeader>
				<CardContent className="gap-3 flex flex-col">
					{entries
						.filter((entry) => entry.eligible && entry.status === "active")
						.map((entry) => (
							<Label key={entry.id} className="gap-2 p-3 flex cursor-pointer rounded-md border">
								<input
									type="checkbox"
									checked={selectedEntryIds.includes(entry.id)}
									onChange={() =>
										setSelectedEntryIds((current) =>
											current.includes(entry.id)
												? current.filter((id) => id !== entry.id)
												: [...current, entry.id],
										)
									}
									disabled={busy}
								/>
								{entry.question}
							</Label>
						))}
					<Button
						type="button"
						onClick={() => void generate()}
						disabled={busy || !selectedEntryIds.length}
					>
						{busy && <LoaderCircleIcon className="mr-2 size-4 animate-spin" />}生成 KU 草稿
					</Button>
				</CardContent>
			</Card>
			<div className="gap-5 lg:grid-cols-[340px_minmax(0,1fr)] grid">
				<Card>
					<CardHeader>
						<CardTitle>知识单元</CardTitle>
						<CardDescription>{units.length} 个当前租户单元</CardDescription>
					</CardHeader>
					<CardContent className="gap-2 flex max-h-[600px] flex-col overflow-auto">
						{units.map((unit) => (
							<button
								key={unit.id}
								type="button"
								className="p-3 rounded-md text-left hover:bg-muted"
								onClick={() => setSelected(unit)}
								disabled={busy}
							>
								<p className="font-medium line-clamp-2">{unit.title}</p>
								<p className="text-xs text-muted-foreground">
									{unit.status} · {unit.eligibility}
								</p>
							</button>
						))}
					</CardContent>
				</Card>
				<Card>
					{selected ? (
						<form key={selected.id} onSubmit={save}>
							<CardHeader>
								<CardTitle>审核知识单元</CardTitle>
								<CardDescription>
									{selected.eligibility === "stale"
										? `来源已失效：${selected.staleReason ?? "需重新生成"}`
										: "发布前必须先人工审核。"}
								</CardDescription>
							</CardHeader>
							<CardContent className="gap-4 flex flex-col">
								<Field name="title" label="标题" value={selected.title} />
								<Field
									name="policy"
									label="标准口径"
									value={selected.content.standardReplyPolicy}
									area
								/>
								<Field
									name="fallback"
									label="兜底话术"
									value={selected.content.fallbackReply}
									area
								/>
								<div className="gap-2 flex flex-wrap">
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
										<SaveIcon className="mr-2 size-4" />
										保存草稿
									</Button>
									{selected.status === "draft" && (
										<Button
											type="button"
											variant="outline"
											onClick={() => void transition("review")}
											disabled={busy || selected.eligibility === "stale"}
										>
											完成审核
										</Button>
									)}
									{selected.status === "review_ready" && (
										<>
											<Button
												type="button"
												onClick={() => void transition("publish")}
												disabled={busy}
											>
												发布
											</Button>
											<Button
												type="button"
												variant="outline"
												onClick={() => void transition("revokeReview")}
												disabled={busy}
											>
												撤回审核
											</Button>
										</>
									)}
									{selected.status === "released" && (
										<Button
											type="button"
											variant="outline"
											onClick={() => void transition("revokePublish")}
											disabled={busy}
										>
											撤销发布
										</Button>
									)}
								</div>
							</CardContent>
						</form>
					) : (
						<CardContent className="py-24 text-center text-muted-foreground">
							选择一个知识单元进行审核或编辑。
						</CardContent>
					)}
				</Card>
			</div>
		</div>
	);
}
function Field(props: { name: string; label: string; value: string; area?: boolean }) {
	return (
		<Label>
			{props.label}
			{props.area ? (
				<Textarea name={props.name} defaultValue={props.value} required className="mt-1 min-h-32" />
			) : (
				<Input name={props.name} defaultValue={props.value} required className="mt-1" />
			)}
		</Label>
	);
}
function text(form: FormData, name: string) {
	const value = form.get(name);
	return typeof value === "string" ? value : "";
}
function message(error: unknown) {
	return error instanceof Error ? error.message : undefined;
}
function readContent(value: unknown): UnitContent {
	if (
		typeof value === "object" &&
		value !== null &&
		"standardReplyPolicy" in value &&
		"fallbackReply" in value &&
		typeof value.standardReplyPolicy === "string" &&
		typeof value.fallbackReply === "string"
	)
		return { standardReplyPolicy: value.standardReplyPolicy, fallbackReply: value.fallbackReply };
	return { standardReplyPolicy: "", fallbackReply: "" };
}
