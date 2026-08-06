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
type Entry = Awaited<ReturnType<typeof orpcClient.xiaofei.listKnowledgeEntries>>["items"][number];
type Document = Awaited<ReturnType<typeof orpcClient.xiaofei.createKnowledgeDocument>>;
type Preparation = Awaited<ReturnType<typeof orpcClient.xiaofei.prepareKnowledge>>;

export function QuickKnowledgePreparation({ onPrepared }: { onPrepared?: () => void }) {
	const [document, setDocument] = useState<Document | null>(null);
	const [entries, setEntries] = useState<Entry[]>([]);
	const [busy, setBusy] = useState(false);
	const [prepared, setPrepared] = useState(false);
	const [preparation, setPreparation] = useState<Preparation | null>(null);
	const [phase, setPhase] = useState<"idle" | "uploading" | "preparing" | "failed">("idle");
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [startedAt, setStartedAt] = useState<number | null>(null);
	const elapsedSeconds = useElapsedSeconds(startedAt);
	const refresh = useCallback(async (sourceId?: string) => {
		const result = await orpcClient.xiaofei.listKnowledgeEntries({ limit: 50 });
		const items = result.items as Entry[];
		setEntries(sourceId ? items.filter((entry) => entry.sourceId === sourceId) : []);
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
		setPhase("uploading");
		setErrorMessage(null);
		setStartedAt(Date.now());
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
			setPreparation(null);
			setPhase("idle");
			setStartedAt(null);
			event.currentTarget.reset();
			toastSuccess("资料已解析", "已生成可用于 Test CA 的候选条目。");
		} catch (error) {
			setPhase("failed");
			setErrorMessage(message(error));
			setStartedAt(null);
			toastError("上传失败", message(error));
		} finally {
			setBusy(false);
		}
	}

	async function prepareTestCa() {
		if (!document) return;
		setPhase("preparing");
		setErrorMessage(null);
		setStartedAt(Date.now());
		setBusy(true);
		try {
			const sourceEntries = (
				(await orpcClient.xiaofei.listKnowledgeEntries({ limit: 50 })).items as Entry[]
			).filter((entry) => entry.sourceId === document.id && entry.eligible);
			if (!sourceEntries.length)
				throw new Error("这份资料没有可用于 Test CA 的当前条目，请先在高级治理中检查解析结果。");
			await Promise.all(
				sourceEntries
					.filter((entry) => entry.status === "draft")
					.map((entry) =>
						orpcClient.xiaofei.updateKnowledgeEntry({ id: entry.id, status: "active" }),
					),
			);
			const allEntries = (await orpcClient.xiaofei.listKnowledgeEntries({ limit: 50 }))
				.items as Entry[];
			const currentEntries = allEntries.filter(
				(entry) => entry.sourceId === document.id && entry.eligible && entry.status === "active",
			);
			if (!currentEntries.length) throw new Error("这份资料没有可用的当前条目，无法准备 Test CA。");
			const result = await orpcClient.xiaofei.prepareKnowledge({
				entryIds: currentEntries.map((entry) => entry.id),
			});
			setPreparation(result);
			setPrepared(true);
			setPhase("idle");
			setStartedAt(null);
			onPrepared?.();
			await refresh(document.id);
			toastSuccess("Test CA 已准备", "资料、KU 和服务端测试会话已就绪；Active 没有改变。");
		} catch (error) {
			setPhase("failed");
			setErrorMessage(message(error));
			setStartedAt(null);
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
				{busy ? (
					<div className="gap-1 text-sm text-muted-foreground" aria-live="polite">
						<output className="block">
							{phase === "uploading"
								? "上传 → 校验 → 解析中，请保持页面打开…"
								: "校验条目 → 生成/复用 KU → 发布 → 创建 Test CA → 建立会话中…"}
						</output>
						{elapsedSeconds >= 2 ? (
							<p>已等待 {elapsedSeconds} 秒，完成后会显示各阶段耗时。</p>
						) : null}
					</div>
				) : null}
				{errorMessage ? (
					<p className="text-sm text-destructive" role="alert">
						{errorMessage} 当前资料和输入已保留，可直接重试。
					</p>
				) : null}
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
							{busy ? "正在上传并解析…" : "上传并解析"}
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
								<p className="text-sm text-muted-foreground">
									已为新的 Test CA 创建可恢复的服务端测试会话。
								</p>
								{preparation ? (
									<ul className="text-xs text-muted-foreground">
										{(
											preparation.stages as Array<{
												name: string;
												count: number;
												elapsedMs: number;
											}>
										).map((stage) => (
											<li key={stage.name}>
												{stage.name}：完成 · {stage.count} 项 ·{" "}
												{(stage.elapsedMs / 1000).toFixed(1)} 秒
											</li>
										))}
									</ul>
								) : null}
								<Button asChild>
									<Link href="/knowledge?stage=test">进入测试与修正</Link>
								</Button>
							</div>
						) : (
							<Button disabled={busy || entries.length === 0} onClick={() => void prepareTestCa()}>
								{busy && <LoaderCircleIcon className="mr-2 size-4 animate-spin" />}
								{busy ? "正在准备 Test CA…" : "准备 Test CA"}
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

function useElapsedSeconds(startedAt: number | null) {
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		if (startedAt === null) return;
		setNow(Date.now());
		const timer = globalThis.setInterval(() => setNow(Date.now()), 1_000);
		return () => globalThis.clearInterval(timer);
	}, [startedAt]);
	return startedAt === null ? 0 : Math.max(0, Math.floor((now - startedAt) / 1_000));
}
