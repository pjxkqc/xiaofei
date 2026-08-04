"use client";

import { Badge } from "@repo/ui/components/badge";
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
import { useCallback, useEffect, useState } from "react";

export function KnowledgeVersioningPanel() {
	const [overview, setOverview] = useState<Awaited<
		ReturnType<typeof orpcClient.xiaofei.getVersioningOverview>
	> | null>(null);
	const [busy, setBusy] = useState(false);
	const [question, setQuestion] = useState("请用这条知识回答客户问题");
	const [correction, setCorrection] = useState("");
	const [selectedRevisionId, setSelectedRevisionId] = useState("");
	const [comparison, setComparison] = useState<{
		question: string;
		before: string;
		after: string;
		beforeVersionId: string;
		testVersionId: string;
		knowledgeRevisionId: string;
	} | null>(null);
	const refresh = useCallback(
		async () => setOverview(await orpcClient.xiaofei.getVersioningOverview()),
		[],
	);
	useEffect(() => {
		void refresh().catch(() => toastError("无法读取知识版本状态"));
	}, [refresh]);
	async function initialize() {
		setBusy(true);
		try {
			await orpcClient.xiaofei.initializeVersioning();
			await refresh();
			toastSuccess("已生成测试版本", "平台兜底与当前商户 KU 已冻结为可追溯版本。");
		} catch (error) {
			toastError("无法生成版本", message(error));
		} finally {
			setBusy(false);
		}
	}
	async function activate() {
		const id = overview?.binding?.testCapabilityVersionId;
		if (!id) return;
		setBusy(true);
		try {
			await orpcClient.xiaofei.activateHostingVersion({ capabilityVersionId: id });
			await refresh();
			toastSuccess("已验收启用测试版本");
		} catch (error) {
			toastError("启用失败", message(error));
		} finally {
			setBusy(false);
		}
	}
	async function toggleEnabled() {
		setBusy(true);
		try {
			await orpcClient.xiaofei.setHostingEnabled({ enabled: !overview?.xiaofeiEnabled });
			await refresh();
			toastSuccess(overview?.xiaofeiEnabled ? "小飞托管已停用" : "小飞托管已启用");
		} catch (error) {
			toastError("托管设置失败", message(error));
		} finally {
			setBusy(false);
		}
	}
	const active = overview?.binding?.activeCapabilityVersion;
	const test = overview?.binding?.testCapabilityVersion;
	const correctionVersion = test ?? active;
	const merchantHits =
		correctionVersion?.knowledgeUnits.filter(
			(member) => member.knowledgeUnitRevision.origin === "merchant",
		) ?? [];
	async function applyCorrection() {
		if (!correctionVersion || !selectedRevisionId || !correction.trim()) return;
		setBusy(true);
		try {
			const result = await orpcClient.xiaofei.applyCorrection({
				capabilityVersionId: correctionVersion.id,
				knowledgeRevisionId: selectedRevisionId,
				correction: correction.trim(),
			});
			setComparison({
				question,
				before: result.before,
				after: result.after,
				beforeVersionId: correctionVersion.id,
				testVersionId: result.testCapabilityVersionId,
				knowledgeRevisionId: result.knowledgeRevisionId,
			});
			setCorrection("");
			await refresh();
			toastSuccess("已生成测试版本", "下方显示的是同一问题的确定性 before/after 预览。");
		} catch (error) {
			toastError("修正失败", message(error));
		} finally {
			setBusy(false);
		}
	}
	return (
		<Card>
			<CardHeader>
				<CardTitle>三步闭环：知识版本与托管</CardTitle>
				<CardDescription>
					平台兜底只读；商户 KU 以 revision 冻结，CA 版本通过 M:N 成员关系引用它们。
				</CardDescription>
			</CardHeader>
			<CardContent className="gap-3 text-sm flex flex-col">
				<div className="gap-2 flex flex-wrap">
					<Badge status={overview?.xiaofeiEnabled ? "success" : "warning"}>
						{overview?.xiaofeiEnabled ? "托管已启用" : "托管安全停用"}
					</Badge>
					<Badge>
						{overview?.revisions.filter((item) => item.origin === "platform").length ?? 0} 平台基线
						revision（只读）
					</Badge>
					<Badge>
						{overview?.revisions.filter((item) => item.origin === "merchant").length ?? 0} 商户 KU
						revision
					</Badge>
				</div>
				<p>
					Active CA：{active?.id ?? "尚未验收"}{" "}
					{active ? `· ${active.knowledgeUnits.length} 个 KU revision` : ""}
				</p>
				<p>
					Test CA：{test?.id ?? "尚未创建"}{" "}
					{test ? `· ${test.knowledgeUnits.length} 个 KU revision` : ""}
				</p>
				<div className="gap-2 flex flex-wrap">
					<Button onClick={() => void initialize()} disabled={busy}>
						从当前知识生成测试版本
					</Button>
					<Button variant="outline" onClick={() => void activate()} disabled={busy || !test}>
						验收并启用 Test CA
					</Button>
					<Button variant="outline" onClick={() => void toggleEnabled()} disabled={busy}>
						{overview?.xiaofeiEnabled ? "停用托管" : "启用托管"}
					</Button>
				</div>
				<p className="text-xs text-muted-foreground">
					修正只允许命中的商户 KU；每次修正都会新增 KU revision 与 Test CA，不会覆盖 Active CA。
				</p>
				<div className="gap-3 mt-2 p-3 flex flex-col rounded-md border bg-muted/30">
					<p className="font-medium">同问题复测与单条修正（确定性 Preview）</p>
					<Label>
						测试问题
						<Input
							value={question}
							onChange={(event) => setQuestion(event.target.value)}
							disabled={busy}
						/>
					</Label>
					<Label>
						命中的商户 KU revision
						<select
							className="mt-1 p-2 w-full rounded-md border bg-background"
							value={selectedRevisionId}
							onChange={(event) => setSelectedRevisionId(event.target.value)}
							disabled={busy || !merchantHits.length}
						>
							<option value="">选择可修正的商户 KU</option>
							{merchantHits.map((member) => (
								<option key={member.knowledgeUnitRevisionId} value={member.knowledgeUnitRevisionId}>
									{member.knowledgeUnitRevision.logicalKnowledgeUnitId} · r
									{member.knowledgeUnitRevision.revision}
								</option>
							))}
						</select>
					</Label>
					<Label>
						修正后的标准口径
						<Textarea
							value={correction}
							onChange={(event) => setCorrection(event.target.value)}
							disabled={busy}
							className="mt-1"
						/>
					</Label>
					<Button
						onClick={() => void applyCorrection()}
						disabled={busy || !selectedRevisionId || !correction.trim() || !correctionVersion}
					>
						生成测试版本并同题复测
					</Button>
					{!merchantHits.length && (
						<p className="text-xs text-muted-foreground">
							先生成版本；平台基线和未命中答案没有可选修正目标。
						</p>
					)}
					{comparison && (
						<div className="gap-2 md:grid-cols-2 grid">
							<div className="p-3 rounded border">
								<p className="font-medium">Before · {comparison.beforeVersionId}</p>
								<p>问题：{comparison.question}</p>
								<p>{comparison.before}</p>
							</div>
							<div className="p-3 rounded border border-primary">
								<p className="font-medium">After（Test）· {comparison.testVersionId}</p>
								<p>同一问题：{comparison.question}</p>
								<p>{comparison.after}</p>
								<p className="text-xs text-muted-foreground">
									命中 KU revision：{comparison.knowledgeRevisionId}
								</p>
							</div>
						</div>
					)}
				</div>
			</CardContent>
		</Card>
	);
}
function message(error: unknown) {
	return error instanceof Error ? error.message : "请稍后重试。";
}
