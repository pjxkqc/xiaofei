"use client";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/card";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { Textarea } from "@repo/ui/components/textarea";
import { toastError, toastSuccess } from "@repo/ui/components/toast";
import { orpcClient } from "@shared/lib/orpc-client";
import {
	ArchiveIcon,
	FileTextIcon,
	LoaderCircleIcon,
	SaveIcon,
	Trash2Icon,
	UploadIcon,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface KnowledgeDocumentSummary {
	id: string;
	originalFileName: string;
	mimeType: string;
	fileType: "MARKDOWN" | "TEXT" | "DOCX";
	category: "PRESALES" | "POSTSALES";
	status: string;
	createdAt: Date;
	updatedAt: Date;
}

interface KnowledgeDocument extends KnowledgeDocumentSummary {
	workspaceId: string;
	bodyText: string;
}

const DOCUMENT_PAGE_SIZE = 25;
const MAX_UPLOAD_FILE_BYTES = 2 * 1024 * 1024;

interface DocumentDraft {
	originalFileName: string;
	category: "PRESALES" | "POSTSALES";
	status: "draft" | "active" | "archived";
	bodyText: string;
}

export function KnowledgeDocuments() {
	const [documents, setDocuments] = useState<KnowledgeDocumentSummary[]>([]);
	const [selected, setSelected] = useState<KnowledgeDocument | null>(null);
	const [draft, setDraft] = useState<DocumentDraft | null>(null);
	const [uploadCategory, setUploadCategory] = useState<"PRESALES" | "POSTSALES">("PRESALES");
	const [pageCursor, setPageCursor] = useState<string | undefined>();
	const [previousCursors, setPreviousCursors] = useState<Array<string | undefined>>([]);
	const [nextCursor, setNextCursor] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [busy, setBusy] = useState(false);

	const refreshDocuments = useCallback(async (cursor?: string) => {
		const page = await orpcClient.xiaofei.listKnowledgeDocuments({
			cursor,
			limit: DOCUMENT_PAGE_SIZE,
		});
		setDocuments(page.items);
		setNextCursor(page.nextCursor);
	}, []);

	useEffect(() => {
		void refreshDocuments(pageCursor)
			.catch(() => toastError("无法读取知识文档"))
			.finally(() => setLoading(false));
	}, [pageCursor, refreshDocuments]);

	async function openDocument(id: string) {
		setBusy(true);
		try {
			const document = await orpcClient.xiaofei.getKnowledgeDocument({ id });
			setSelected(document);
			setDraft(toDraft(document));
		} catch (error) {
			toastError("无法打开文档", getErrorMessage(error));
		} finally {
			setBusy(false);
		}
	}

	async function uploadDocument(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = event.currentTarget;
		const fileInput = form.elements.namedItem("knowledge-file");
		if (!(fileInput instanceof HTMLInputElement) || !fileInput.files?.[0]) return;

		const file = fileInput.files[0];
		if (file.size > MAX_UPLOAD_FILE_BYTES) {
			toastError("文档上传失败", "文件不能超过 2 MB。");
			return;
		}

		setBusy(true);
		try {
			const created = await orpcClient.xiaofei.createKnowledgeDocument({
				originalFileName: file.name,
				mimeType: file.type,
				category: uploadCategory,
				contentBase64: await fileToBase64(file),
			});
			form.reset();
			setPageCursor(undefined);
			setPreviousCursors([]);
			await refreshDocuments(undefined);
			await openDocument(created.id);
			toastSuccess("文档已上传", "文本已提取并保存到当前租户。");
		} catch (error) {
			toastError("文档上传失败", getErrorMessage(error));
		} finally {
			setBusy(false);
		}
	}

	async function saveDocument(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!selected || !draft) return;
		setBusy(true);
		try {
			const updated = await orpcClient.xiaofei.updateKnowledgeDocument({
				id: selected.id,
				...draft,
			});
			if (!updated) throw new Error("The document could not be saved.");
			setSelected(updated);
			setDraft(toDraft(updated));
			await refreshDocuments(pageCursor);
			toastSuccess("文档已保存");
		} catch (error) {
			toastError("文档保存失败", getErrorMessage(error));
		} finally {
			setBusy(false);
		}
	}

	async function deleteDocument() {
		if (!selected || !globalThis.confirm(`删除“${selected.originalFileName}”？此操作无法撤销。`)) {
			return;
		}
		setBusy(true);
		try {
			await orpcClient.xiaofei.deleteKnowledgeDocument({ id: selected.id });
			setSelected(null);
			setDraft(null);
			if (documents.length === 1 && previousCursors.length > 0) {
				goToPreviousPage();
			} else {
				await refreshDocuments(pageCursor);
			}
			toastSuccess("文档已删除");
		} catch (error) {
			toastError("文档删除失败", getErrorMessage(error));
		} finally {
			setBusy(false);
		}
	}

	function goToNextPage() {
		if (!nextCursor) return;
		setLoading(true);
		setSelected(null);
		setDraft(null);
		setPreviousCursors((current) => [...current, pageCursor]);
		setPageCursor(nextCursor);
	}

	function goToPreviousPage() {
		if (previousCursors.length === 0) return;
		setLoading(true);
		setSelected(null);
		setDraft(null);
		const cursors = previousCursors.slice(0, -1);
		setPageCursor(previousCursors.at(-1));
		setPreviousCursors(cursors);
	}

	return (
		<div className="gap-6 flex flex-col">
			<Card>
				<CardHeader>
					<CardTitle>上传源文档</CardTitle>
					<CardDescription>
						支持 UTF-8 Markdown、TXT 和 DOCX（最多 2 MB）。DOCX 仅提取普通段落文本，不处理图片、OCR
						或复杂表格。
					</CardDescription>
				</CardHeader>
				<CardContent>
					<form
						className="gap-4 md:grid-cols-[1fr_220px_auto] grid items-end"
						onSubmit={uploadDocument}
					>
						<div className="gap-2 flex flex-col">
							<Label htmlFor="knowledge-file">文档文件</Label>
							<Input
								id="knowledge-file"
								name="knowledge-file"
								type="file"
								accept=".md,.txt,.docx,text/markdown,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
								required
								disabled={busy}
							/>
						</div>
						<div className="gap-2 flex flex-col">
							<Label htmlFor="upload-category">业务分类</Label>
							<select
								id="upload-category"
								className="h-10 px-3 text-sm rounded-md border bg-background"
								value={uploadCategory}
								onChange={(event) =>
									setUploadCategory(event.target.value as "PRESALES" | "POSTSALES")
								}
								disabled={busy}
							>
								<option value="PRESALES">售前</option>
								<option value="POSTSALES">售后</option>
							</select>
						</div>
						<Button type="submit" disabled={busy}>
							{busy ? (
								<LoaderCircleIcon className="mr-2 size-4 animate-spin" />
							) : (
								<UploadIcon className="mr-2 size-4" />
							)}
							上传并提取
						</Button>
					</form>
				</CardContent>
			</Card>

			<div className="gap-5 lg:grid-cols-[340px_minmax(0,1fr)] grid min-h-[620px]">
				<Card className="overflow-hidden">
					<CardHeader className="border-b">
						<CardTitle>文档列表</CardTitle>
						<CardDescription>
							第 {previousCursors.length + 1} 页 · 本页 {documents.length} 个文档
						</CardDescription>
					</CardHeader>
					<CardContent className="p-2 gap-1 flex max-h-[620px] flex-col overflow-y-auto">
						{loading ? (
							<div className="py-20 flex justify-center">
								<LoaderCircleIcon className="size-5 animate-spin text-primary" />
							</div>
						) : documents.length === 0 ? (
							<div className="px-5 py-20 text-center">
								<FileTextIcon className="size-8 mb-3 mx-auto text-muted-foreground" />
								<p className="text-sm font-medium">还没有知识文档</p>
								<p className="mt-1 text-xs text-muted-foreground">上传一个源文件开始管理。</p>
							</div>
						) : (
							documents.map((document) => (
								<button
									key={document.id}
									type="button"
									className={`p-3 gap-2 rounded-xl text-left transition ${
										selected?.id === document.id ? "bg-primary/10" : "hover:bg-muted"
									}`}
									onClick={() => void openDocument(document.id)}
									disabled={busy}
								>
									<div className="gap-2 flex items-start justify-between">
										<span className="text-sm font-medium break-all">
											{document.originalFileName}
										</span>
										<Badge status={document.status === "active" ? "success" : "info"}>
											{statusLabel(document.status)}
										</Badge>
									</div>
									<p className="text-xs text-muted-foreground">
										{document.category === "PRESALES" ? "售前" : "售后"} · {document.fileType}
									</p>
									<p className="text-xs text-muted-foreground">
										更新于 {new Date(document.updatedAt).toLocaleString()}
									</p>
								</button>
							))
						)}
					</CardContent>
					<CardFooter className="p-3 gap-2 justify-between border-t">
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={goToPreviousPage}
							disabled={busy || loading || previousCursors.length === 0}
						>
							上一页
						</Button>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={goToNextPage}
							disabled={busy || loading || !nextCursor}
						>
							下一页
						</Button>
					</CardFooter>
				</Card>

				<Card className="min-w-0">
					{selected && draft ? (
						<form onSubmit={saveDocument}>
							<CardHeader className="border-b">
								<div className="gap-3 sm:flex-row sm:items-start sm:justify-between flex flex-col">
									<div>
										<CardTitle>编辑文档</CardTitle>
										<CardDescription>
											{selected.mimeType} · {selected.bodyText.length.toLocaleString()} 字符
										</CardDescription>
									</div>
									<div className="gap-2 flex">
										<Button
											type="button"
											variant="outline"
											onClick={() => void deleteDocument()}
											disabled={busy}
										>
											<Trash2Icon className="mr-2 size-4" />
											删除
										</Button>
										<Button type="submit" disabled={busy}>
											<SaveIcon className="mr-2 size-4" />
											保存
										</Button>
									</div>
								</div>
							</CardHeader>
							<CardContent className="pt-6 gap-5 flex flex-col">
								<div className="gap-4 sm:grid-cols-3 grid">
									<div className="gap-2 sm:col-span-3 flex flex-col">
										<Label htmlFor="document-name">文件名</Label>
										<Input
											id="document-name"
											value={draft.originalFileName}
											onChange={(event) =>
												setDraft({ ...draft, originalFileName: event.target.value })
											}
											maxLength={255}
											required
										/>
									</div>
									<div className="gap-2 flex flex-col">
										<Label htmlFor="document-category">业务分类</Label>
										<select
											id="document-category"
											className="h-10 px-3 text-sm rounded-md border bg-background"
											value={draft.category}
											onChange={(event) =>
												setDraft({
													...draft,
													category: event.target.value as DocumentDraft["category"],
												})
											}
										>
											<option value="PRESALES">售前</option>
											<option value="POSTSALES">售后</option>
										</select>
									</div>
									<div className="gap-2 flex flex-col">
										<Label htmlFor="document-status">生命周期</Label>
										<select
											id="document-status"
											className="h-10 px-3 text-sm rounded-md border bg-background"
											value={draft.status}
											onChange={(event) =>
												setDraft({
													...draft,
													status: event.target.value as DocumentDraft["status"],
												})
											}
										>
											<option value="draft">草稿</option>
											<option value="active">启用</option>
											<option value="archived">归档</option>
										</select>
									</div>
									<div className="gap-2 flex flex-col">
										<Label>存储类型</Label>
										<div className="h-10 px-3 gap-2 text-sm flex items-center rounded-md border bg-muted/40">
											<ArchiveIcon className="size-4 text-muted-foreground" />
											{selected.fileType}
										</div>
									</div>
								</div>
								<div className="gap-2 flex flex-col">
									<Label htmlFor="document-body">提取文本</Label>
									<Textarea
										id="document-body"
										className="font-mono text-sm min-h-[340px]"
										value={draft.bodyText}
										onChange={(event) => setDraft({ ...draft, bodyText: event.target.value })}
										maxLength={500_000}
										required
									/>
								</div>
							</CardContent>
						</form>
					) : (
						<CardContent className="py-32 text-center">
							<FileTextIcon className="size-10 mb-4 mx-auto text-muted-foreground" />
							<p className="font-medium">选择一个文档查看和编辑</p>
							<p className="mt-1 text-sm text-muted-foreground">
								文件内容只通过租户授权的服务端过程读取。
							</p>
						</CardContent>
					)}
				</Card>
			</div>
		</div>
	);
}

function toDraft(document: KnowledgeDocument): DocumentDraft {
	return {
		originalFileName: document.originalFileName,
		category: document.category,
		status: document.status as DocumentDraft["status"],
		bodyText: document.bodyText,
	};
}

function statusLabel(status: string): string {
	return { draft: "草稿", active: "启用", archived: "归档" }[status] ?? status;
}

async function fileToBase64(file: File): Promise<string> {
	const bytes = new Uint8Array(await file.arrayBuffer());
	let binary = "";
	for (let index = 0; index < bytes.length; index += 32_768) {
		binary += String.fromCharCode(...bytes.subarray(index, index + 32_768));
	}
	return btoa(binary);
}

function getErrorMessage(error: unknown): string | undefined {
	return error instanceof Error ? error.message : undefined;
}
