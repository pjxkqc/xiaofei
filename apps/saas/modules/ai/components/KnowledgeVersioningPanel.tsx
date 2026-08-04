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
import { RefreshCcwIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

export function KnowledgeVersioningPanel({
	section = "all",
}: {
	section?: "prepare" | "test" | "hosting" | "all";
}) {
	const [overview, setOverview] = useState<Awaited<
		ReturnType<typeof orpcClient.xiaofei.getVersioningOverview>
	> | null>(null);
	const [question, setQuestion] = useState("");
	const [correction, setCorrection] = useState("");
	const [testSessionId, setTestSessionId] = useState(() => globalThis.crypto.randomUUID());
	const [turns, setTurns] = useState<
		Array<Awaited<ReturnType<typeof orpcClient.xiaofei.runVersionedTest>>>
	>([]);
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

	async function resetSession() {
		setBusy(true);
		try {
			const next = await orpcClient.xiaofei.resetTestSession();
			setTestSessionId(next.testSessionId);
			setTurns([]);
			setRerun(null);
			setCorrection("");
			toastSuccess("已开始新的 Test CA 会话");
		} catch (error) {
			toastError("无法重置会话", message(error));
		} finally {
			setBusy(false);
		}
	}

	async function test() {
		if (!question.trim()) return;
		setBusy(true);
		try {
			const result = await orpcClient.xiaofei.runVersionedTest({
				question: question.trim(),
				testSessionId,
			});
			setTestSessionId(result.testSessionId);
			setTurns((history) => [...history, result]);
			setQuestion("");
		} catch (error) {
			toastError("测试失败", message(error));
		} finally {
			setBusy(false);
		}
	}

	async function correct(turn: Awaited<ReturnType<typeof orpcClient.xiaofei.runVersionedTest>>) {
		if (!correction.trim()) return;
		setBusy(true);
		try {
			const result = await orpcClient.xiaofei.applyTestTurnCorrection({
				sourceTestTurnId: turn.turn.id,
				correction: correction.trim(),
			});
			setRerun(result);
			setCorrection("");
			await refresh();
			const next = await orpcClient.xiaofei.resetTestSession();
			setTestSessionId(next.testSessionId);
			setTurns([]);
			toastSuccess("已生成 Test CA 并完成同题复测；后续测试已切换为新会话");
		} catch (error) {
			toastError("修正失败", message(error));
		} finally {
			setBusy(false);
		}
	}

	const active = overview?.binding?.activeCapabilityVersion ?? null;
	const testVersion = overview?.binding?.testCapabilityVersion ?? null;
	return (
		<div className="gap-6 flex flex-col">
			{section !== "test" && (
				<VersionOverview
					overview={overview}
					active={active}
					testVersion={testVersion}
					busy={busy}
					act={act}
					section={section}
				/>
			)}
			{section !== "prepare" && section !== "hosting" && (
				<TestConversation
					question={question}
					setQuestion={setQuestion}
					turns={turns}
					correction={correction}
					setCorrection={setCorrection}
					rerun={rerun}
					busy={busy}
					onTest={test}
					onCorrect={correct}
					onReset={resetSession}
				/>
			)}
		</div>
	);
}

function VersionOverview({
	overview,
	active,
	testVersion,
	busy,
	act,
	section,
}: {
	overview: Awaited<ReturnType<typeof orpcClient.xiaofei.getVersioningOverview>> | null;
	active: any;
	testVersion: any;
	busy: boolean;
	act: (action: () => Promise<unknown>, success: string) => Promise<void>;
	section: "prepare" | "hosting" | "all";
}) {
	const isPrepare = section === "prepare";
	return (
		<Card>
			<CardHeader>
				<CardTitle>{isPrepare ? "平台兜底与商户资料" : "验收与托管"}</CardTitle>
				<CardDescription>
					{isPrepare
						? "平台维护的兜底知识只读；商户资料会冻结为可追溯的 KU revision，再加入 Test CA。"
						: "Test 不会影响 Active。仅在人工验收后，才将 Test CA 指向 Active 并启用托管。"}
				</CardDescription>
			</CardHeader>
			<CardContent className="gap-4 flex flex-col">
				<div className="gap-2 flex flex-wrap">
					<Badge status={overview?.xiaofeiEnabled ? "success" : "warning"}>
						{overview?.xiaofeiEnabled ? "托管已启用" : "托管未启用"}
					</Badge>
					<Badge>平台维护 · 只读</Badge>
					<Badge>商户 KU · 可修正</Badge>
				</div>
				{isPrepare ? (
					<Button
						disabled={busy}
						onClick={() =>
							void act(() => orpcClient.xiaofei.initializeVersioning(), "已冻结知识并创建 Test CA")
						}
					>
						创建 Test CA
					</Button>
				) : (
					<div className="gap-2 sm:flex-row flex flex-col">
						<Button
							disabled={busy || !testVersion}
							onClick={() =>
								void act(
									() => orpcClient.xiaofei.activateHostingVersion(),
									"已将当前 Test CA 验收为 Active",
								)
							}
						>
							人工验收 Test CA
						</Button>
						<Button
							variant="outline"
							disabled={busy || !active}
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
				)}
				<Membership title="Active CA" version={active} />
				<Membership title="Test CA" version={testVersion} />
			</CardContent>
		</Card>
	);
}

function TestConversation({
	question,
	setQuestion,
	turns,
	correction,
	setCorrection,
	rerun,
	busy,
	onTest,
	onCorrect,
	onReset,
}: {
	question: string;
	setQuestion: (value: string) => void;
	turns: Array<Awaited<ReturnType<typeof orpcClient.xiaofei.runVersionedTest>>>;
	correction: string;
	setCorrection: (value: string) => void;
	rerun: Awaited<ReturnType<typeof orpcClient.xiaofei.applyTestTurnCorrection>> | null;
	busy: boolean;
	onTest: () => Promise<void>;
	onCorrect: (
		turn: Awaited<ReturnType<typeof orpcClient.xiaofei.runVersionedTest>>,
	) => Promise<void>;
	onReset: () => Promise<void>;
}) {
	const lastTurn = turns.at(-1);
	return (
		<Card>
			<CardHeader>
				<div className="gap-3 sm:flex-row sm:items-start sm:justify-between flex flex-col">
					<div>
						<CardTitle>Test CA 多轮会话</CardTitle>
						<CardDescription>
							同一 Test session 会保存每轮状态；仅重置或 CA 变更时开始新会话。
						</CardDescription>
					</div>
					<Button variant="outline" size="sm" disabled={busy} onClick={() => void onReset()}>
						<RefreshCcwIcon className="mr-2 size-4" />
						重置测试会话
					</Button>
				</div>
			</CardHeader>
			<CardContent className="gap-4 flex flex-col">
				<div className="gap-2 flex flex-col">
					<Label>
						下一轮问题
						<Input
							value={question}
							onChange={(event) => setQuestion(event.target.value)}
							disabled={busy}
							onKeyDown={(event) => {
								if (event.key === "Enter") {
									event.preventDefault();
									void onTest();
								}
							}}
						/>
					</Label>
					<Button disabled={busy || !question.trim()} onClick={() => void onTest()}>
						发送到 Test CA
					</Button>
				</div>
				{turns.length === 0 ? (
					<p className="text-sm text-muted-foreground">
						从一个问题开始；连续三轮都保留在这里，便于验证上下文和来源。
					</p>
				) : (
					<div className="gap-3 flex flex-col">
						{turns.map((turn, index) => (
							<div key={turn.turn.id} className="gap-2 p-3 flex flex-col rounded-lg border">
								<p className="text-xs text-muted-foreground">
									第 {index + 1} 轮 · {turn.turn.id}
								</p>
								<p className="text-sm font-medium">你：{turn.turn.question}</p>
								<p>小飞：{turn.answer}</p>
								<Evidence
									metadata={turn.metadata}
									capabilityVersionId={turn.turn.capabilityVersionId}
								/>
							</div>
						))}
					</div>
				)}
				{lastTurn && (
					<div className="gap-3 p-3 flex flex-col rounded-lg border border-dashed">
						{lastTurn.feedbackAllowed ? (
							<>
								<Label>
									仅修正这条已保存的商户答案
									<Textarea
										value={correction}
										onChange={(event) => setCorrection(event.target.value)}
										disabled={busy}
									/>
								</Label>
								<Button
									disabled={busy || !correction.trim()}
									onClick={() => void onCorrect(lastTurn)}
								>
									提出修正并同题复测
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
						<div className="p-3 rounded-lg border">
							<p className="font-medium">Before · {rerun.source.id}</p>
							<p className="mt-2">{rerun.source.answer}</p>
						</div>
						<div className="p-3 rounded-lg border border-primary">
							<p className="font-medium">After · {rerun.rerun.id}</p>
							<p className="mt-2">{rerun.answer}</p>
							<Evidence
								metadata={rerun.metadata}
								capabilityVersionId={rerun.resultCapabilityVersionId}
							/>
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
}

function Membership({ title, version }: { title: string; version: any }) {
	const rows = version?.knowledgeUnits ?? [];
	return (
		<div className="rounded-lg border">
			<p className="p-3 text-sm font-medium">
				{title}：{version?.id ?? "未设置"}
			</p>
			{rows.length ? (
				<div className="overflow-auto">
					<table className="text-xs w-full text-left">
						<thead>
							<tr className="border-t">
								<th className="p-2">逻辑 KU</th>
								<th className="p-2">Revision</th>
								<th className="p-2">来源</th>
								<th className="p-2">Role</th>
								<th className="p-2">Priority</th>
							</tr>
						</thead>
						<tbody>
							{rows.map((row: any) => (
								<tr key={row.id} className="border-t">
									<td className="p-2">{row.knowledgeUnitRevision.logicalKnowledgeUnitId}</td>
									<td className="p-2">
										{row.knowledgeUnitRevisionId} · r{row.knowledgeUnitRevision.revision}
									</td>
									<td className="p-2">{row.knowledgeUnitRevision.origin}</td>
									<td className="p-2">{row.role}</td>
									<td className="p-2">{row.priority}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			) : (
				<p className="p-3 text-sm text-muted-foreground">无成员</p>
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
			来源 · CA {capabilityVersionId} · KU revision：
			{metadata?.knowledgeEvidence?.knowledgeUnitRevisionId ?? "未命中，使用安全澄清"}
		</p>
	);
}
function message(error: unknown) {
	return error instanceof Error ? error.message : "请稍后重试。";
}
