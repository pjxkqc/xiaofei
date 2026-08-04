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
import { toastError, toastSuccess } from "@repo/ui/components/toast";
import { orpcClient } from "@shared/lib/orpc-client";
import { LoaderCircleIcon, UploadIcon } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const MAX_FILE_BYTES = 4 * 1024 * 1024;
const TEST_SESSION_STORAGE_KEY = "xiaofei.test-session-id";
type Entry = Awaited<ReturnType<typeof orpcClient.xiaofei.listKnowledgeEntries>>["items"][number];
type Document = Awaited<ReturnType<typeof orpcClient.xiaofei.createKnowledgeDocument>>;

export function QuickKnowledgePreparation({ onPrepared }: { onPrepared?: () => void }) {
	const [document, setDocument] = useState<Document | null>(null);
	const [entries, setEntries] = useState<Entry[]>([]);
	const [busy, setBusy] = useState(false);
	const [prepared, setPrepared] = useState(false);
	const refresh = useCallback(async (sourceId?: string) => {
		const result = await orpcClient.xiaofei.listKnowledgeEntries({ limit: 50 });
		setEntries(sourceId ? result.items.filter((entry) => entry.sourceId === sourceId) : []);
	}, []);

	useEffect(() => {
		if (document) void refresh(document.id).catch(() => toastError("无法读取解析结果"));
	}, [document, refresh]);

	async function upload(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const input = event.currentTarget.elements.namedItem("file");
		if (!(input instanceof HTMLInputElement) || !input.files?.[0]) return;
		const file = input.files[0];
		if (file.size > MAX_FILE_BYTES) return toastError("上传失败", "文件不能超过 4 MB。");
		setBusy(true);
		try {
			const created = await orpcClient.xiaofei.createKnowledgeDocument({
				originalFileName: file.name,
				mimeType: file.type,
				category: "PRESALES",
				contentBase64: await fileToBase64(file),
			});
			setDocument(created);
			setPrepared(false);
			event.currentTarget.reset();
			toastSuccess("资料已解析", "已生成可用于 Test CA 的候选条目。");
		} catch (error) {
			toastError("上传失败", message(error));
		} finally {
			setBusy(false);
		}
	}

	async function prepareTestCa() {
		if (!document) return;
		setBusy(true);
		try {
			const sourceEntries = (
				await orpcClient.xiaofei.listKnowledgeEntries({ limit: 50 })
			).items.filter((entry) => entry.sourceId === document.id && entry.eligible);
			if (!sourceEntries.length)
				throw new Error("这份资料没有可用于 Test CA 的当前条目，请先在高级治理中检查解析结果。");
			let currentEntries = sourceEntries;
			for (const entry of currentEntries.filter((item) => item.eligible && item.status === "draft"))
				await orpcClient.xiaofei.updateKnowledgeEntry({ id: entry.id, status: "active" });
			const [allEntries, initialUnits] = await Promise.all([
				orpcClient.xiaofei.listKnowledgeEntries({ limit: 50 }),
				orpcClient.xiaofei.listKnowledgeUnits(),
			]);
			currentEntries = allEntries.items.filter(
				(entry) => entry.sourceId === document.id && entry.eligible && entry.status === "active",
			);
			if (!currentEntries.length) throw new Error("这份资料没有可用的当前条目，无法准备 Test CA。");
			const unitEntryIds = new Set(
				initialUnits.filter((unit) => unit.eligibility !== "stale").map((unit) => unit.entryId),
			);
			const missingEntryIds = currentEntries
				.filter((entry) => !unitEntryIds.has(entry.id))
				.map((entry) => entry.id);
			if (missingEntryIds.length)
				await orpcClient.xiaofei.generateKnowledgeUnits({ entryIds: missingEntryIds });
			const units = await orpcClient.xiaofei.listKnowledgeUnits();
			const sourceUnits = units.filter(
				(item) =>
					currentEntries.some((entry) => entry.id === item.entryId) && item.eligibility !== "stale",
			);
			for (const unit of sourceUnits) {
				if (unit.status === "draft") {
					await orpcClient.xiaofei.transitionKnowledgeUnit({ id: unit.id, action: "review" });
					await orpcClient.xiaofei.transitionKnowledgeUnit({ id: unit.id, action: "publish" });
				} else if (unit.status === "review_ready")
					await orpcClient.xiaofei.transitionKnowledgeUnit({ id: unit.id, action: "publish" });
			}
			const releasedUnits = (await orpcClient.xiaofei.listKnowledgeUnits()).filter(
				(unit) =>
					currentEntries.some((entry) => entry.id === unit.entryId) &&
					unit.eligibility === "eligible" &&
					unit.status === "released",
			);
			if (!releasedUnits.length) throw new Error("这份资料没有已发布的可用 KU，无法准备 Test CA。");
			await orpcClient.xiaofei.initializeVersioning();
			const session = await orpcClient.xiaofei.resetTestSession();
			sessionStorage.setItem(TEST_SESSION_STORAGE_KEY, session.testSessionId);
			setPrepared(true);
			onPrepared?.();
			await refresh(document.id);
			toastSuccess("Test CA 已准备", "资料、KU 和新测试会话已就绪；Active 没有改变。");
		} catch (error) {
			toastError("无法准备 Test CA", message(error));
		} finally {
			setBusy(false);
		}
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>上传一份商户资料</CardTitle>
				<CardDescription>
					平台兜底始终由平台维护、商户只读。上传后会显示解析结果；准备 Test CA
					会安全地完成当前资料的必要步骤。
				</CardDescription>
			</CardHeader>
			<CardContent className="gap-5 flex flex-col">
				{!document ? (
					<form className="gap-3 max-w-xl flex flex-col" onSubmit={upload}>
						<Label>
							商户文档
							<Input
								name="file"
								type="file"
								accept=".md,.txt,.pdf,.docx,.xlsx"
								required
								disabled={busy}
							/>
						</Label>
						<Button disabled={busy}>
							{busy ? (
								<LoaderCircleIcon className="mr-2 size-4 animate-spin" />
							) : (
								<UploadIcon className="mr-2 size-4" />
							)}
							上传并解析
						</Button>
					</form>
				) : (
					<div className="gap-4 flex flex-col">
						<div className="p-4 rounded-lg border bg-muted/30">
							<p className="font-medium">{document.originalFileName ?? "商户资料"}</p>
							<p className="mt-1 text-sm text-muted-foreground">
								已解析 {entries.length} 个当前条目。
								{entries.length ? "系统将只处理这些条目，并复用已有 KU。" : "正在读取解析条目。"}
							</p>
						</div>
						{prepared ? (
							<div className="gap-3 p-4 flex flex-col rounded-lg border border-primary bg-primary/5">
								<p className="font-medium">Test CA 已准备</p>
								<p className="text-sm text-muted-foreground">已为新的 Test CA 开始独立测试会话。</p>
								<Button asChild>
									<Link href="/knowledge?stage=test">进入测试与修正</Link>
								</Button>
							</div>
						) : (
							<Button disabled={busy || entries.length === 0} onClick={() => void prepareTestCa()}>
								{busy && <LoaderCircleIcon className="mr-2 size-4 animate-spin" />}准备 Test CA
							</Button>
						)}
						<Link
							className="text-sm text-muted-foreground hover:text-foreground"
							href="/knowledge?stage=advanced"
						>
							查看完整条目与高级治理
						</Link>
					</div>
				)}
			</CardContent>
		</Card>
	);
}

function message(error: unknown) {
	return error instanceof Error ? error.message : "请稍后重试。";
}
async function fileToBase64(file: File) {
	const bytes = new Uint8Array(await file.arrayBuffer());
	let binary = "";
	for (let index = 0; index < bytes.length; index += 32_768)
		binary += String.fromCharCode(...bytes.subarray(index, index + 32_768));
	return btoa(binary);
}
