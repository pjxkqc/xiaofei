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
	const [question, setQuestion] = useState("");
	const [correction, setCorrection] = useState("");
	const [turn, setTurn] = useState<Awaited<
		ReturnType<typeof orpcClient.xiaofei.runVersionedTest>
	> | null>(null);
	const [rerun, setRerun] = useState<Awaited<
		ReturnType<typeof orpcClient.xiaofei.applyTestTurnCorrection>
	> | null>(null);
	const [busy, setBusy] = useState(false);
	const refresh = useCallback(
		async () => setOverview(await orpcClient.xiaofei.getVersioningOverview()),
		[],
	);
	useEffect(() => {
		void refresh().catch(() => toastError("无法读取版本状态"));
	}, [refresh]);
	async function act(action: () => Promise<unknown>, success: string) {
		setBusy(true);
		try {
			await action();
			await refresh();
			toastSuccess(success);
		} catch (error) {
			toastError("操作失败", message(error));
		} finally {
			setBusy(false);
		}
	}
	async function test() {
		if (!question.trim()) return;
		setBusy(true);
		try {
			setRerun(null);
			setTurn(await orpcClient.xiaofei.runVersionedTest({ question: question.trim() }));
		} catch (error) {
			toastError("测试失败", message(error));
		} finally {
			setBusy(false);
		}
	}
	async function correct() {
		if (!turn || !correction.trim()) return;
		setBusy(true);
		try {
			const result = await orpcClient.xiaofei.applyTestTurnCorrection({
				sourceTestTurnId: turn.turn.id,
				correction: correction.trim(),
			});
			setRerun(result);
			setCorrection("");
			await refresh();
			toastSuccess("已生成 Test CA 并完成同题复测");
		} catch (error) {
			toastError("修正失败", message(error));
		} finally {
			setBusy(false);
		}
	}
	const active = overview?.binding?.activeCapabilityVersion;
	const testVersion = overview?.binding?.testCapabilityVersion;
	return (
		<div className="gap-6 flex flex-col">
			<Card>
				<CardHeader>
					<CardTitle>知识版本与托管</CardTitle>
					<CardDescription>
						平台兜底、商户知识和组合托管 CA 均为不可变 revision membership。
					</CardDescription>
				</CardHeader>
				<CardContent className="gap-3 text-sm flex flex-col">
					<div className="gap-2 flex flex-wrap">
						<Badge status={overview?.xiaofeiEnabled ? "success" : "warning"}>
							{overview?.xiaofeiEnabled ? "托管已启用" : "托管安全停用"}
						</Badge>
						<Badge>platform-fallback</Badge>
						<Badge>merchant-knowledge</Badge>
						<Badge>xiaofei-hosting</Badge>
					</div>
					<div className="gap-2 flex flex-wrap">
						<Button
							disabled={busy}
							onClick={() =>
								void act(
									() => orpcClient.xiaofei.initializeVersioning(),
									"已冻结可调用知识并创建 Test CA",
								)
							}
						>
							初始化 Test CA
						</Button>
						<Button
							variant="outline"
							disabled={busy || !testVersion}
							onClick={() =>
								void act(
									() => orpcClient.xiaofei.activateHostingVersion(),
									"已将当前 Test CA 验收为 Active",
								)
							}
						>
							验收并启用 Test CA
						</Button>
						<Button
							variant="outline"
							disabled={busy}
							onClick={() =>
								void act(
									() =>
										orpcClient.xiaofei.setHostingEnabled({ enabled: !overview?.xiaofeiEnabled }),
									overview?.xiaofeiEnabled ? "托管已停用" : "托管已启用",
								)
							}
						>
							{overview?.xiaofeiEnabled ? "停用托管" : "启用托管"}
						</Button>
					</div>
					<Membership title="Active CA" version={active ?? null} />
					<Membership title="Test CA" version={testVersion ?? null} />
				</CardContent>
			</Card>
			<Card>
				<CardHeader>
					<CardTitle>会话测试与单条修正</CardTitle>
					<CardDescription>
						测试始终运行精确 Test CA；反馈只绑定已经保存的真实助手答案。
					</CardDescription>
				</CardHeader>
				<CardContent className="gap-3 flex flex-col">
					<Label>
						问题
						<Input
							value={question}
							onChange={(event) => setQuestion(event.target.value)}
							disabled={busy}
						/>
					</Label>
					<Button disabled={busy || !question.trim()} onClick={() => void test()}>
						运行 Test CA
					</Button>
					{turn && (
						<div className="gap-2 p-3 rounded flex flex-col border">
							<p className="font-medium">助手回答 · TestTurn {turn.turn.id}</p>
							<p>{turn.answer}</p>
							<Evidence
								metadata={turn.metadata}
								capabilityVersionId={turn.turn.capabilityVersionId}
							/>
							{turn.feedbackAllowed ? (
								<>
									<Label>
										修正意见
										<Textarea
											value={correction}
											onChange={(event) => setCorrection(event.target.value)}
											disabled={busy}
										/>
									</Label>
									<Button disabled={busy || !correction.trim()} onClick={() => void correct()}>
										应用修正并同题复测
									</Button>
								</>
							) : (
								<p className="text-sm text-muted-foreground">
									此答案没有可修正的商户知识证据（未命中或平台基线）。
								</p>
							)}
						</div>
					)}
					{rerun && (
						<div className="gap-3 md:grid-cols-2 grid">
							<div className="p-3 rounded border">
								<p className="font-medium">Before · {rerun.source.id}</p>
								<p>{rerun.source.answer}</p>
								<Evidence
									metadata={turn?.metadata}
									capabilityVersionId={rerun.source.capabilityVersionId}
								/>
							</div>
							<div className="p-3 rounded border border-primary">
								<p className="font-medium">After · {rerun.rerun.id}</p>
								<p>{rerun.answer}</p>
								<Evidence
									metadata={rerun.metadata}
									capabilityVersionId={rerun.resultCapabilityVersionId}
								/>
							</div>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
function Membership({
	title,
	version,
}: {
	title: string;
	version: Awaited<
		ReturnType<typeof orpcClient.xiaofei.getVersioningOverview>
	>["binding"] extends infer T
		? T extends { activeCapabilityVersion: infer V }
			? V
			: never
		: never;
}) {
	const rows = version?.knowledgeUnits ?? [];
	return (
		<div className="rounded border">
			<p className="p-2 font-medium">
				{title}：{version?.id ?? "未设置"}
			</p>
			{rows.length ? (
				<div className="overflow-auto">
					<table className="text-xs w-full text-left">
						<thead>
							<tr className="border-t">
								<th>逻辑 KU</th>
								<th>Revision</th>
								<th>来源</th>
								<th>Role</th>
								<th>Priority</th>
							</tr>
						</thead>
						<tbody>
							{rows.map((row) => (
								<tr key={row.id} className="border-t">
									<td>{row.knowledgeUnitRevision.logicalKnowledgeUnitId}</td>
									<td>
										{row.knowledgeUnitRevisionId} · r{row.knowledgeUnitRevision.revision}
									</td>
									<td>{row.knowledgeUnitRevision.origin}</td>
									<td>{row.role}</td>
									<td>{row.priority}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			) : (
				<p className="p-2 text-muted-foreground">无成员</p>
			)}
		</div>
	);
}
function Evidence({
	metadata,
	capabilityVersionId,
}: {
	metadata: { knowledgeEvidence: { knowledgeUnitRevisionId: string } | null } | undefined;
	capabilityVersionId: string;
}) {
	return (
		<p className="text-xs text-muted-foreground">
			CA：{capabilityVersionId} · 命中 KU revision：
			{metadata?.knowledgeEvidence?.knowledgeUnitRevisionId ?? "无"}
		</p>
	);
}
function message(error: unknown) {
	return error instanceof Error ? error.message : "请稍后重试。";
}
