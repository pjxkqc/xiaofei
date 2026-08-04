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
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const TEST_SESSION_STORAGE_KEY = "xiaofei.test-session-id";
type Overview = Awaited<ReturnType<typeof orpcClient.xiaofei.getVersioningOverview>>;
type CapabilityVersion = NonNullable<NonNullable<Overview["binding"]>["activeCapabilityVersion"]>;
type MembershipRow = CapabilityVersion["knowledgeUnits"][number];
type TestTurn = Awaited<ReturnType<typeof orpcClient.xiaofei.runVersionedTest>>;
type Correction = Awaited<ReturnType<typeof orpcClient.xiaofei.applyTestTurnCorrection>>;

export function KnowledgeVersioningPanel({
	section = "all",
}: {
	section?: "prepare" | "test" | "hosting" | "all";
}) {
	const [overview, setOverview] = useState<Overview | null>(null);
	const [testSessionId, setTestSessionId] = useState<string | null>(null);
	const [question, setQuestion] = useState("");
	const [turns, setTurns] = useState<TestTurn[]>([]);
	const [selectedTurnId, setSelectedTurnId] = useState<string | null>(null);
	const [correction, setCorrection] = useState("");
	const [rerun, setRerun] = useState<Correction | null>(null);
	const [busy, setBusy] = useState(false);
	const refresh = useCallback(
		async () => setOverview(await orpcClient.xiaofei.getVersioningOverview()),
		[],
	);

	useEffect(() => {
		void refresh().catch(() => toastError("无法读取版本状态"));
	}, [refresh]);
	useEffect(() => {
		const saved = sessionStorage.getItem(TEST_SESSION_STORAGE_KEY);
		const next = saved ?? globalThis.crypto.randomUUID();
		sessionStorage.setItem(TEST_SESSION_STORAGE_KEY, next);
		setTestSessionId(next);
	}, []);

	function storeSession(next: string) {
		sessionStorage.setItem(TEST_SESSION_STORAGE_KEY, next);
		setTestSessionId(next);
	}
	async function resetSession() {
		setBusy(true);
		try {
			const next = await orpcClient.xiaofei.resetTestSession();
			storeSession(next.testSessionId);
			setTurns([]);
			setSelectedTurnId(null);
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
		if (!question.trim() || !testSessionId || !testVersion) return;
		setBusy(true);
		try {
			const result = await orpcClient.xiaofei.runVersionedTest({
				question: question.trim(),
				testSessionId,
			});
			storeSession(result.testSessionId);
			setTurns((history) => [...history, result]);
			setQuestion("");
		} catch (error) {
			toastError("测试失败", message(error));
		} finally {
			setBusy(false);
		}
	}
	async function correct(turn: TestTurn) {
		if (!correction.trim()) return;
		setBusy(true);
		try {
			const result = await orpcClient.xiaofei.applyTestTurnCorrection({
				sourceTestTurnId: turn.turn.id,
				correction: correction.trim(),
			});
			setRerun(result);
			setCorrection("");
			setSelectedTurnId(null);
			await refresh();
			const next = await orpcClient.xiaofei.resetTestSession();
			storeSession(next.testSessionId);
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
					setBusy={setBusy}
					refresh={refresh}
					section={section}
				/>
			)}
			{section !== "prepare" && section !== "hosting" && (
				<TestConversation
					question={question}
					setQuestion={setQuestion}
					turns={turns}
					selectedTurnId={selectedTurnId}
					setSelectedTurnId={setSelectedTurnId}
					correction={correction}
					setCorrection={setCorrection}
					rerun={rerun}
					busy={busy}
					ready={testSessionId !== null && testVersion !== null}
					hasTestVersion={testVersion !== null}
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
	setBusy,
	refresh,
	section,
}: {
	overview: Overview | null;
	active: CapabilityVersion | null;
	testVersion: CapabilityVersion | null;
	busy: boolean;
	setBusy: (busy: boolean) => void;
	refresh: () => Promise<void>;
	section: "prepare" | "hosting" | "all";
}) {
	const isPrepare = section === "prepare";
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
	return (
		<Card>
			<CardHeader>
				<CardTitle>{isPrepare ? "平台兜底与商户资料" : "验收与托管"}</CardTitle>
				<CardDescription>
					{isPrepare
						? "平台维护、商户只读的兜底知识会与商户资料一起组成 Test CA。"
						: "未验收的 Test CA 不会改变 Active；人工验收后才可启用托管。"}
				</CardDescription>
			</CardHeader>
			<CardContent className="gap-4 flex flex-col">
				<div className="gap-2 flex flex-wrap">
					<Badge status={overview?.xiaofeiEnabled ? "success" : "warning"}>
						{overview?.xiaofeiEnabled ? "托管已启用" : "托管未启用"}
					</Badge>
					<Badge>平台维护 · 只读</Badge>
				</div>
				{!isPrepare && (
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
				)}
				<MembershipSummary active={active} testVersion={testVersion} />
				{!isPrepare && (
					<Button
						variant="outline"
						disabled={busy || !active}
						onClick={() =>
							void act(
								() => orpcClient.xiaofei.setHostingEnabled({ enabled: !overview?.xiaofeiEnabled }),
								overview?.xiaofeiEnabled ? "托管已停用" : "托管已启用",
							)
						}
					>
						{overview?.xiaofeiEnabled ? "停用托管" : "启用托管"}
					</Button>
				)}
			</CardContent>
		</Card>
	);
}

function TestConversation({
	question,
	setQuestion,
	turns,
	selectedTurnId,
	setSelectedTurnId,
	correction,
	setCorrection,
	rerun,
	busy,
	ready,
	hasTestVersion,
	onTest,
	onCorrect,
	onReset,
}: {
	question: string;
	setQuestion: (value: string) => void;
	turns: TestTurn[];
	selectedTurnId: string | null;
	setSelectedTurnId: (id: string | null) => void;
	correction: string;
	setCorrection: (value: string) => void;
	rerun: Correction | null;
	busy: boolean;
	ready: boolean;
	hasTestVersion: boolean;
	onTest: () => Promise<void>;
	onCorrect: (turn: TestTurn) => Promise<void>;
	onReset: () => Promise<void>;
}) {
	const selected = turns.find((turn) => turn.turn.id === selectedTurnId) ?? null;
	return (
		<Card>
			<CardHeader>
				<div className="gap-3 sm:flex-row sm:items-start sm:justify-between flex flex-col">
					<div>
						<CardTitle>Test CA 多轮会话</CardTitle>
						<CardDescription>
							浏览器会保留本次 Test session；刷新或离开后再回来，下一轮仍继续同一服务端状态。
						</CardDescription>
					</div>
					<Button
						variant="outline"
						size="sm"
						disabled={busy || !ready}
						onClick={() => void onReset()}
					>
						<RefreshCcwIcon className="mr-2 size-4" />
						重置测试会话
					</Button>
				</div>
			</CardHeader>
			<CardContent className="gap-4 flex flex-col">
				{!hasTestVersion ? (
					<div className="gap-3 p-4 flex flex-col rounded-lg border border-dashed">
						<p className="font-medium">还没有 Test CA</p>
						<p className="text-sm text-muted-foreground">请先准备知识，再开始多轮测试与修正。</p>
						<Button className="w-fit" asChild>
							<Link href="/knowledge?stage=prepare">先去准备知识</Link>
						</Button>
					</div>
				) : (
					<>
						<Label>
							下一轮问题
							<Input
								value={question}
								onChange={(event) => setQuestion(event.target.value)}
								disabled={busy || !ready}
							/>
						</Label>
						<Button disabled={busy || !ready || !question.trim()} onClick={() => void onTest()}>
							发送到 Test CA
						</Button>
						{!ready ? <p className="text-sm text-muted-foreground">正在恢复测试会话…</p> : null}
					</>
				)}
				{turns.map((turn, index) => (
					<div
						key={turn.turn.id}
						className={`gap-2 p-3 flex flex-col rounded-lg border ${selectedTurnId === turn.turn.id ? "border-primary bg-primary/5" : ""}`}
					>
						<p className="text-xs text-muted-foreground">第 {index + 1} 轮</p>
						<p className="text-sm font-medium">你：{turn.turn.question}</p>
						<p>小飞：{turn.answer}</p>
						<Evidence
							metadata={turn.metadata}
							capabilityVersionId={turn.turn.capabilityVersionId}
							testTurnId={turn.turn.id}
						/>
						{turn.feedbackAllowed ? (
							<Button
								variant="outline"
								size="sm"
								className="w-fit"
								disabled={busy}
								onClick={() => setSelectedTurnId(turn.turn.id)}
							>
								选择并修正这条回答
							</Button>
						) : (
							<p className="text-xs text-muted-foreground">
								该回答来自平台兜底或未命中，不能作为商户修正依据。
							</p>
						)}
					</div>
				))}
				{selected && (
					<div className="gap-3 p-3 flex flex-col rounded-lg border border-primary">
						<p className="text-sm font-medium">
							正在修正第 {turns.findIndex((turn) => turn.turn.id === selected.turn.id) + 1}{" "}
							轮商户回答
						</p>
						<Label>
							修正意见
							<Textarea
								value={correction}
								onChange={(event) => setCorrection(event.target.value)}
								disabled={busy}
							/>
						</Label>
						<Button disabled={busy || !correction.trim()} onClick={() => void onCorrect(selected)}>
							提出修正并同题复测
						</Button>
					</div>
				)}
				{rerun && (
					<div className="gap-3 md:grid-cols-2 grid">
						<AnswerEvidence
							label="Before"
							answer={rerun.source.answer}
							testTurnId={rerun.source.id}
							capabilityVersionId={rerun.source.capabilityVersionId}
						/>
						<AnswerEvidence
							label="After"
							answer={rerun.answer}
							metadata={rerun.metadata}
							capabilityVersionId={rerun.resultCapabilityVersionId}
							testTurnId={rerun.rerun.id}
						/>
					</div>
				)}
			</CardContent>
		</Card>
	);
}

function MembershipSummary({
	active,
	testVersion,
}: {
	active: CapabilityVersion | null;
	testVersion: CapabilityVersion | null;
}) {
	const activeRows = active?.knowledgeUnits ?? [];
	const testRows = testVersion?.knowledgeUnits ?? [];
	const count = (rows: MembershipRow[], origin: "platform" | "merchant") =>
		rows.filter((row) => row.knowledgeUnitRevision.origin === origin).length;
	const changed = symmetricDifferenceSize(
		new Set(activeRows.map((row) => row.knowledgeUnitRevisionId)),
		new Set(testRows.map((row) => row.knowledgeUnitRevisionId)),
	);
	return (
		<div className="gap-3 flex flex-col">
			<p className="text-sm text-muted-foreground">
				Test 与 Active 相差 {changed} 个成员；未人工验收前，Active 不会改变。
			</p>
			<div className="gap-3 sm:grid-cols-2 grid">
				<MembershipCard
					title="Active"
					rows={activeRows}
					platform={count(activeRows, "platform")}
					merchant={count(activeRows, "merchant")}
				/>
				<MembershipCard
					title="Test"
					rows={testRows}
					platform={count(testRows, "platform")}
					merchant={count(testRows, "merchant")}
				/>
			</div>
		</div>
	);
}
function MembershipCard({
	title,
	rows,
	platform,
	merchant,
}: {
	title: string;
	rows: MembershipRow[];
	platform: number;
	merchant: number;
}) {
	return (
		<div className="p-3 rounded-lg border">
			<p className="font-medium">{title} CA</p>
			<p className="mt-1 text-sm text-muted-foreground">
				平台兜底 {platform} · 商户资料 {merchant}
			</p>
			<details className="mt-3 text-xs text-muted-foreground">
				<summary className="cursor-pointer">查看成员与技术 ID</summary>
				<p className="mt-2">多个 KU revision 共同组成一个 CA；同一 revision 可被多个版本复用。</p>
				<p className="mt-2">CA 版本：{rows[0]?.capabilityVersionId ?? "暂无成员"}</p>
				{rows.map((row) => (
					<p key={row.id} className="mt-1">
						{row.knowledgeUnitRevision.origin === "merchant" ? "商户资料" : "平台兜底"} · 逻辑 KU：
						{row.knowledgeUnitRevision.logicalKnowledgeUnitId} · KU revision：
						{row.knowledgeUnitRevisionId}
					</p>
				))}
			</details>
		</div>
	);
}
function AnswerEvidence({
	label,
	answer,
	metadata,
	capabilityVersionId,
	testTurnId,
}: {
	label: string;
	answer: string;
	metadata?: TestTurn["metadata"];
	capabilityVersionId?: string;
	testTurnId?: string;
}) {
	return (
		<div className="p-3 rounded-lg border">
			<p className="font-medium">{label}</p>
			<p className="mt-2">{answer}</p>
			{metadata && capabilityVersionId ? (
				<Evidence
					metadata={metadata}
					capabilityVersionId={capabilityVersionId}
					testTurnId={testTurnId}
				/>
			) : null}
			{!metadata && capabilityVersionId ? (
				<details className="text-xs text-muted-foreground">
					<summary className="cursor-pointer">来源证据</summary>
					<p className="mt-1">
						TestTurn：{testTurnId ?? "当前轮"} · CA：{capabilityVersionId}
					</p>
				</details>
			) : null}
		</div>
	);
}
function Evidence({
	metadata,
	capabilityVersionId,
	testTurnId,
}: {
	metadata: TestTurn["metadata"];
	capabilityVersionId: string;
	testTurnId?: string;
}) {
	const evidence = metadata.knowledgeEvidence;
	const origin =
		evidence?.knowledgeUnitOrigin === "merchant"
			? "商户资料"
			: evidence?.knowledgeUnitOrigin === "platform"
				? "平台兜底"
				: "未命中";
	return (
		<details className="text-xs text-muted-foreground">
			<summary className="cursor-pointer">来源：{origin}</summary>
			<p className="mt-1">
				TestTurn：{testTurnId ?? "当前轮"} · CA：{capabilityVersionId} · KU revision：
				{evidence?.knowledgeUnitRevisionId ?? "无"}
			</p>
		</details>
	);
}

export function symmetricDifferenceSize(left: Set<string>, right: Set<string>) {
	return new Set([...left, ...right]).size * 2 - left.size - right.size;
}
function message(error: unknown) {
	return error instanceof Error ? error.message : "请稍后重试。";
}
