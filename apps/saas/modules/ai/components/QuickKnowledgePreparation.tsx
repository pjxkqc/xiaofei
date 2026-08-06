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
type PreparationPhase = "idle" | "uploading" | "preparing" | "failed";
interface PreparationFailureEvidence {
	retryKey: string;
	failedStage: string;
	partialCount: number;
	committedStages: Array<{ name: string; count: number; elapsedMs: number }>;
}

const UPLOAD_STEPS = ["上传请求已提交", "服务端校验并解析", "等待持久化结果"] as const;
const PREPARATION_STEPS = [
	"准备请求已提交",
	"服务端激活条目并准备 Test CA",
	"等待持久化结果",
] as const;

export function QuickKnowledgePreparation({ onPrepared }: { onPrepared?: () => void }) {
	const [document, setDocument] = useState<Document | null>(null);
	const [entries, setEntries] = useState<Entry[]>([]);
	const [busy, setBusy] = useState(false);
	const [prepared, setPrepared] = useState(false);
	const [preparation, setPreparation] = useState<Preparation | null>(null);
	const [phase, setPhase] = useState<PreparationPhase>("idle");
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [failureEvidence, setFailureEvidence] = useState<PreparationFailureEvidence | null>(null);
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
		const form = event.currentTarget;
		const input = form.elements.namedItem("file");
		if (!(input instanceof HTMLInputElement) || !input.files?.[0]) return;
		const file = input.files[0];
		if (file.size > MAX_FILE_BYTES) return toastError("上传失败", "文件不能超过 4 MB。");
		setPhase("uploading");
		setErrorMessage(null);
		setFailureEvidence(null);
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
			resetFileUploadForm(form);
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
		setFailureEvidence(null);
		setStartedAt(Date.now());
		setBusy(true);
		try {
			const sourceEntries = entries.filter(
				(entry) => entry.sourceId === document.id && entry.eligible,
			);
			if (!sourceEntries.length)
				throw new Error("这份资料没有可用于 Test CA 的当前条目，请先在高级治理中检查解析结果。");
			const result = await orpcClient.xiaofei.prepareKnowledge({
				entryIds: sourceEntries.map((entry) => entry.id),
			});
			setPreparation(result);
			setEntries((current) =>
				current.map((entry) =>
					sourceEntries.some((sourceEntry) => sourceEntry.id === entry.id)
						? { ...entry, status: "active" }
						: entry,
				),
			);
			setPrepared(true);
			setPhase("idle");
			setStartedAt(null);
			onPrepared?.();
			toastSuccess("Test CA 已准备", "资料、KU 和服务端测试会话已就绪；Active 没有改变。");
		} catch (error) {
			setPhase("failed");
			setErrorMessage(message(error));
			setFailureEvidence(toPreparationFailureEvidence(error));
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
					<div className="gap-2 text-sm flex flex-col text-muted-foreground" aria-live="polite">
						<output className="font-medium block">
							{phase === "uploading"
								? "资料已提交，服务端正在校验、解析并保存…"
								: "准备请求已提交，服务端正在处理并保存结果…"}
						</output>
						<ol
							className="gap-1 sm:gap-2 sm:flex-row sm:flex-wrap flex flex-col"
							aria-label="知识准备阶段"
						>
							{(phase === "uploading" ? UPLOAD_STEPS : PREPARATION_STEPS).map((step, index) => {
								const status = index === 0 ? "已完成" : index === 1 ? "进行中" : "待处理";
								return (
									<li key={step} className="gap-1.5 text-xs flex items-center">
										<span
											className={`size-5 flex items-center justify-center rounded-full border ${status === "进行中" ? "border-primary bg-primary text-primary-foreground" : "bg-background"}`}
										>
											{status === "已完成" ? "✓" : index + 1}
										</span>
										<span>
											{step} · {status}
										</span>
									</li>
								);
							})}
						</ol>
						{elapsedSeconds >= 2 ? (
							<p>已等待 {elapsedSeconds} 秒，完成后会显示各阶段耗时。</p>
						) : null}
					</div>
				) : null}
				{errorMessage ? (
					<div className="gap-2 text-sm flex flex-col text-destructive" role="alert">
						<p>{errorMessage} 当前资料和输入已保留，可直接重试。</p>
						{failureEvidence ? (
							<div className="text-xs text-muted-foreground">
								<p>
									失败阶段：{preparationStageLabel(failureEvidence.failedStage)}
									{failureEvidence.partialCount > 0
										? `（已完成 ${failureEvidence.partialCount} 项）`
										: ""}
									；安全重试标识：{failureEvidence.retryKey}
								</p>
								{failureEvidence.committedStages.length ? (
									<p>
										已持久化：
										{failureEvidence.committedStages
											.map((stage) => `${preparationStageLabel(stage.name)} ${stage.count} 项`)
											.join("、")}
									</p>
								) : null}
							</div>
						) : null}
					</div>
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
												{preparationStageLabel(stage.name)}：完成 · {stage.count} 项 ·{" "}
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

function toPreparationFailureEvidence(error: unknown): PreparationFailureEvidence | null {
	if (!error || typeof error !== "object" || !("data" in error)) return null;
	const data = error.data;
	if (!data || typeof data !== "object") return null;
	const record = data as Record<string, unknown>;
	if (
		record.code !== "KNOWLEDGE_PREPARATION_INCOMPLETE" ||
		typeof record.retryKey !== "string" ||
		typeof record.failedStage !== "string" ||
		typeof record.partialCount !== "number" ||
		!Array.isArray(record.committedStages)
	)
		return null;
	const committedStages = record.committedStages.flatMap((stage) => {
		if (!stage || typeof stage !== "object") return [];
		const row = stage as Record<string, unknown>;
		return typeof row.name === "string" &&
			typeof row.count === "number" &&
			typeof row.elapsedMs === "number"
			? [{ name: row.name, count: row.count, elapsedMs: row.elapsedMs }]
			: [];
	});
	return {
		retryKey: record.retryKey,
		failedStage: record.failedStage,
		partialCount: record.partialCount,
		committedStages,
	};
}

function preparationStageLabel(stage: string) {
	return (
		{
			activated: "激活条目",
			generated: "生成 KU",
			reused: "复用 KU",
			published: "发布 KU",
			test_ca: "创建 Test CA",
			session: "建立测试会话",
		}[stage] ?? stage
	);
}

export function resetFileUploadForm(form: Pick<HTMLFormElement, "reset">) {
	form.reset();
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
