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
import { RuntimeMetadataSchema } from "@repo/xiaofei";
import { orpcClient } from "@shared/lib/orpc-client";
import { RefreshCcwIcon } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { isAdmitted } from "./KnowledgeCapabilities";
import { recoverTestSession } from "./test-session-recovery";

type Overview = Awaited<ReturnType<typeof orpcClient.xiaofei.getVersioningOverview>>;
type CapabilityVersion = NonNullable<NonNullable<Overview["binding"]>["activeCapabilityVersion"]>;
type MembershipRow = CapabilityVersion["knowledgeUnits"][number];
type TestTurn = Awaited<ReturnType<typeof orpcClient.xiaofei.runVersionedTest>>;
type Correction = Awaited<ReturnType<typeof orpcClient.xiaofei.applyTestTurnCorrection>>;
type TestSessionDetail = Awaited<ReturnType<typeof orpcClient.xiaofei.getTestSession>>;
export interface TestTurnView {
	turn: {
		id: string;
		question: string;
		capabilityVersionId: string;
	};
	answer: string;
	metadata: TestTurn["metadata"];
	feedbackAllowed: boolean;
	feedbackMode: "revise" | "supplement";
	interventionId: string | null;
	sourceTestTurnId: string | null;
}
export interface InterventionEvidence {
	interventionId: string;
	source: TestTurnView;
	rerun: TestTurnView | null;
	isComplete: boolean;
}
interface TestSessionSummary {
	id: string;
	turnCount: number;
	writable: boolean;
	firstQuestion: string | null;
	latestAt: string | null;
	capabilityVersionId: string;
	beforeInterventionCount: number;
	afterInterventionCount: number;
	isCurrent: boolean;
}

export function KnowledgeVersioningPanel({
	section = "all",
}: {
	section?: "prepare" | "test" | "hosting" | "all";
}) {
	const [overview, setOverview] = useState<Overview | null>(null);
	const [testSessionId, setTestSessionId] = useState<string | null>(null);
	const [question, setQuestion] = useState("");
	const [turns, setTurns] = useState<TestTurnView[]>([]);
	const [selectedTurnId, setSelectedTurnId] = useState<string | null>(null);
	const [correction, setCorrection] = useState("");
	const [rerun, setRerun] = useState<Correction | null>(null);
	const [sessions, setSessions] = useState<TestSessionSummary[]>([]);
	const [interventionEvidence, setInterventionEvidence] = useState<InterventionEvidence[]>([]);
	const [busy, setBusy] = useState(false);
	const [operation, setOperation] = useState<{
		label: string;
		error: string | null;
		startedAt: number | null;
	}>({
		label: "",
		error: null,
		startedAt: null,
	});
	function beginOperation(label: string) {
		setOperation({ label, error: null, startedAt: Date.now() });
	}
	function completeOperation() {
		setOperation({ label: "", error: null, startedAt: null });
	}
	function failOperation(error: unknown) {
		setOperation({ label: "", error: message(error), startedAt: null });
	}
	const refresh = useCallback(
		async () => setOverview(await orpcClient.xiaofei.getVersioningOverview()),
		[],
	);

	useEffect(() => {
		void refresh().catch(() => toastError("无法读取版本状态"));
	}, [refresh]);
	const loadSession = useCallback(async (next: string) => {
		beginOperation("正在载入所选会话 → 恢复有界测试轮次与干预证据…");
		try {
			const detail = await orpcClient.xiaofei.getTestSession({ testSessionId: next });
			setTestSessionId(next);
			setTurns(detail.turns.map((turn) => toTestSessionTurnView(turn, detail.writable)));
			setInterventionEvidence(toInterventionEvidence(detail.interventionPairs));
			completeOperation();
		} catch (error) {
			failOperation(error);
			throw error;
		}
	}, []);
	const refreshSessions = useCallback(async () => {
		const result = await orpcClient.xiaofei.listTestSessions({ limit: 20 });
		const items = (result.items as unknown[]).map(normalizeTestSessionSummary);
		setSessions(items);
		return { ...result, items };
	}, []);
	const refreshSessionHistory = useCallback(async () => {
		beginOperation("正在读取 Test CA 历史…");
		try {
			const result = await refreshSessions();
			completeOperation();
			return result;
		} catch (error) {
			failOperation(error);
			throw error;
		}
	}, [refreshSessions]);
	useEffect(() => {
		void recoverTestSession({
			list: refreshSessions,
			detail: async (id) => orpcClient.xiaofei.getTestSession({ testSessionId: id }),
		})
			.then(({ items, selected, detail }) => {
				setSessions(items);
				if (selected && detail) {
					setTestSessionId(selected.id);
					setTurns(detail.turns.map((turn) => toTestSessionTurnView(turn, detail.writable)));
					setInterventionEvidence(toInterventionEvidence(detail.interventionPairs));
				}
			})
			.catch((error) => {
				toastError("无法读取 Test CA 历史", message(error));
			});
	}, [refreshSessions]);

	function storeSession(next: string) {
		setTestSessionId(next);
	}
	async function resetSession() {
		beginOperation("正在创建新的 Test CA 会话…");
		setBusy(true);
		try {
			const next = await orpcClient.xiaofei.newTestSession();
			storeSession(next.testSessionId);
			await refreshSessions();
			setTurns([]);
			setInterventionEvidence([]);
			setSelectedTurnId(null);
			setRerun(null);
			setCorrection("");
			completeOperation();
			toastSuccess("已开始新的 Test CA 会话");
		} catch (error) {
			failOperation(error);
			toastError("无法重置会话", message(error));
		} finally {
			setBusy(false);
		}
	}
	async function test() {
		if (!question.trim() || !testSessionId || !testVersion) return;
		beginOperation("排队 → 选择知识 → 生成候选 → Guardrail → 保存测试轮次…");
		setBusy(true);
		try {
			const result = await orpcClient.xiaofei.runVersionedTest({
				question: question.trim(),
				testSessionId,
			});
			storeSession(result.testSessionId);
			await refreshSessions();
			setTurns((history) => [...history, toTestTurnView(result)]);
			setQuestion("");
			completeOperation();
		} catch (error) {
			failOperation(error);
			toastError("测试失败", message(error));
		} finally {
			setBusy(false);
		}
	}
	async function correct(turn: TestTurnView) {
		if (!correction.trim()) return;
		beginOperation("校验权限 → 保存不可变干预 → 生成新 CA → 同题复测…");
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
			await refreshSessions();
			await loadSession(result.rerun.testSessionId);
			completeOperation();
			toastSuccess("已生成 Test CA 并完成同题复测；后续测试已切换为新会话");
		} catch (error) {
			failOperation(error);
			toastError("修正失败", message(error));
		} finally {
			setBusy(false);
		}
	}
	const active = overview?.binding?.activeCapabilityVersion ?? null;
	const testVersion = overview?.binding?.testCapabilityVersion ?? null;
	return (
		<div className="gap-6 flex flex-col">
			<OperationFeedback operation={operation} />
			{section !== "test" && (
				<VersionOverview
					overview={overview}
					active={active}
					testVersion={testVersion}
					busy={busy}
					setBusy={setBusy}
					refresh={refresh}
					section={section}
					onStart={beginOperation}
					onComplete={completeOperation}
					onFail={failOperation}
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
					interventionEvidence={interventionEvidence}
					busy={busy}
					ready={
						testSessionId !== null &&
						testVersion !== null &&
						sessions.some((session) => session.id === testSessionId && session.writable)
					}
					hasTestVersion={testVersion !== null}
					onTest={test}
					onCorrect={correct}
					onReset={resetSession}
					sessions={sessions}
					testSessionId={testSessionId}
					onSelectSession={loadSession}
					onRefreshSessions={refreshSessionHistory}
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
	onStart,
	onComplete,
	onFail,
}: {
	overview: Overview | null;
	active: CapabilityVersion | null;
	testVersion: CapabilityVersion | null;
	busy: boolean;
	setBusy: (busy: boolean) => void;
	refresh: () => Promise<void>;
	section: "prepare" | "hosting" | "all";
	onStart: (label: string) => void;
	onComplete: () => void;
	onFail: (error: unknown) => void;
}) {
	const isPrepare = section === "prepare";
	const testIsActive = active?.id === testVersion?.id && testVersion !== null;
	const [capability, setCapability] = useState<Awaited<
		ReturnType<typeof orpcClient.xiaofei.getConfig>
	> | null>(null);
	useEffect(() => {
		void orpcClient.xiaofei
			.getConfig()
			.then(setCapability)
			.catch(() => undefined);
	}, []);
	const admitted = capability
		? isAdmitted(capability) && capability.capabilityPlan.version === testVersion?.version
		: false;
	async function act(action: () => Promise<unknown>, success: string) {
		onStart("校验版本 → 更新托管指针/状态 → 确认生效…");
		setBusy(true);
		try {
			await action();
			await refresh();
			onComplete();
			toastSuccess(success);
		} catch (error) {
			onFail(error);
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
						disabled={busy || !testVersion || testIsActive || !admitted}
						onClick={() =>
							void act(
								() => orpcClient.xiaofei.activateHostingVersion(),
								"已将当前 Test CA 验收为 Active",
							)
						}
					>
						{testIsActive ? "Test CA 已验收" : "人工验收 Test CA"}
					</Button>
				)}
				<MembershipSummary active={active} testVersion={testVersion} />
				{!isPrepare ? (
					<SupportAcceptance
						admitted={admitted}
						hasActive={active !== null}
						onCapabilityChanged={() =>
							void orpcClient.xiaofei
								.getConfig()
								.then(setCapability)
								.catch(() => undefined)
						}
						onStart={onStart}
						onComplete={onComplete}
						onFail={onFail}
					/>
				) : null}
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

function SupportAcceptance({
	admitted,
	hasActive,
	onCapabilityChanged,
	onStart,
	onComplete,
	onFail,
}: {
	admitted: boolean;
	hasActive: boolean;
	onCapabilityChanged: () => void;
	onStart: (label: string) => void;
	onComplete: () => void;
	onFail: (error: unknown) => void;
}) {
	const [text, setText] = useState("请用这份知识回答一个客户问题。");
	const [conversationId, setConversationId] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [capability, setCapability] = useState<Awaited<
		ReturnType<typeof orpcClient.xiaofei.getConfig>
	> | null>(null);
	const [externalId] = useState(() => globalThis.crypto.randomUUID());
	const refreshCapability = useCallback(
		async () => setCapability(await orpcClient.xiaofei.getConfig()),
		[],
	);
	useEffect(() => {
		void refreshCapability().catch(() => undefined);
	}, [refreshCapability]);
	const reviewed = capability?.capabilityPlan.reviewed === true;
	const evalPassed =
		capability?.evalSuite.status === "passed" &&
		capability.evalSuite.capabilityPlanVersion === capability.capabilityPlan.version;
	async function capabilityAction(action: () => Promise<unknown>, success: string) {
		onStart("正在更新当前能力方案准入状态…");
		setBusy(true);
		try {
			await action();
			await refreshCapability();
			onCapabilityChanged();
			onComplete();
			toastSuccess(success);
		} catch (error) {
			onFail(error);
			toastError("准入步骤失败", message(error));
		} finally {
			setBusy(false);
		}
	}
	async function create() {
		if (!hasActive || !text.trim() || conversationId) return;
		onStart("校验 Active CA → 创建合成会话 → 投影首条消息…");
		setBusy(true);
		try {
			const result = await orpcClient.xiaofei.sendSyntheticSupportMessage({
				externalId,
				text: text.trim(),
			});
			setConversationId(result.conversationId);
			onComplete();
			toastSuccess(
				"已创建 Support 验收会话",
				"这是当前 Organization 的合成客户消息，不会被标记为 Email。",
			);
		} catch (error) {
			onFail(error);
			toastError("无法创建 Support 验收会话", message(error));
		} finally {
			setBusy(false);
		}
	}
	return (
		<div className="gap-3 p-4 flex flex-col rounded-lg border border-dashed">
			<div className="gap-2 text-sm flex flex-col" aria-live="polite">
				<p>步骤 1：审核当前能力方案 — {reviewed ? "已完成" : "待审核"}</p>
				<p>步骤 2：运行当前版本 Eval — {evalPassed ? "已通过" : "待运行或未通过"}</p>
				<p>步骤 3：Test CA 激活 — {hasActive && admitted ? "已 Active" : "待激活"}</p>
			</div>
			<div className="gap-2 flex flex-wrap">
				<Button
					disabled={busy || reviewed}
					onClick={() =>
						void capabilityAction(
							() => orpcClient.xiaofei.reviewCapability({ reviewed: true }),
							"能力方案已审核",
						)
					}
				>
					审核当前能力方案
				</Button>
				<Button
					variant="outline"
					disabled={busy || !reviewed || evalPassed}
					onClick={() =>
						void capabilityAction(() => orpcClient.xiaofei.runEval(), "当前版本 Eval 已通过")
					}
				>
					运行当前版本 Eval
				</Button>
			</div>
			<div>
				<p className="font-medium">选择验收入口</p>
				<p className="text-sm text-muted-foreground">
					可继续 Test CA 沙盒，或创建当前 Organization 的 Support/Inbox 验收会话。
				</p>
			</div>
			{!hasActive ? (
				<output className="text-sm block text-muted-foreground">
					请先验收当前 Test CA 为 Active，才能创建 Support 验收会话。
				</output>
			) : null}
			<Button variant="outline" className="w-fit" asChild>
				<Link href="/knowledge?stage=test">继续 Test CA 沙盒</Link>
			</Button>
			<Label>
				合成客户消息
				<Textarea value={text} onChange={(event) => setText(event.target.value)} disabled={busy} />
			</Label>
			<div className="gap-2 flex flex-wrap">
				<Button
					disabled={busy || !admitted || !hasActive || !text.trim() || conversationId !== null}
					onClick={() => void create()}
				>
					{busy ? "正在创建验收会话…" : conversationId ? "验收会话已创建" : "创建 Support 验收会话"}
				</Button>
				{conversationId ? (
					<Button variant="outline" asChild>
						<Link href={`/inbox?conversationId=${encodeURIComponent(conversationId)}`}>
							在 Inbox 打开并接管
						</Link>
					</Button>
				) : null}
			</div>
			{busy ? (
				<output className="text-sm block text-muted-foreground" aria-live="polite">
					正在校验 Active CA、创建合成会话并准备 Inbox 定位…
				</output>
			) : null}
		</div>
	);
}

function OperationFeedback({
	operation,
}: {
	operation: { label: string; error: string | null; startedAt: number | null };
}) {
	const elapsedSeconds = useElapsedSeconds(operation.startedAt);
	if (!operation.label && !operation.error) return null;
	return (
		<div className="gap-2 p-3 text-sm rounded-lg border bg-muted/30" aria-live="polite">
			{operation.label ? <p>{operation.label}</p> : null}
			{operation.label && elapsedSeconds >= 2 ? (
				<p className="text-muted-foreground">
					已等待 {elapsedSeconds} 秒；服务端仍在处理当前阶段，完成后会保留确定结果。
				</p>
			) : null}
			{operation.error ? (
				<p className="text-destructive" role="alert">
					操作失败：{operation.error} 可保留当前输入后重试。
				</p>
			) : null}
		</div>
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
	interventionEvidence,
	busy,
	ready,
	hasTestVersion,
	onTest,
	onCorrect,
	onReset,
	sessions,
	testSessionId,
	onSelectSession,
	onRefreshSessions,
}: {
	question: string;
	setQuestion: (value: string) => void;
	turns: TestTurnView[];
	selectedTurnId: string | null;
	setSelectedTurnId: (id: string | null) => void;
	correction: string;
	setCorrection: (value: string) => void;
	rerun: Correction | null;
	interventionEvidence: InterventionEvidence[];
	busy: boolean;
	ready: boolean;
	hasTestVersion: boolean;
	onTest: () => Promise<void>;
	onCorrect: (turn: TestTurnView) => Promise<void>;
	onReset: () => Promise<void>;
	sessions: TestSessionSummary[];
	testSessionId: string | null;
	onSelectSession: (id: string) => Promise<void>;
	onRefreshSessions: () => Promise<unknown>;
}) {
	const selected = turns.find((turn) => turn.turn.id === selectedTurnId) ?? null;
	return (
		<Card>
			<CardHeader>
				<div className="gap-3 sm:flex-row sm:items-start sm:justify-between flex flex-col">
					<div>
						<CardTitle>Test CA 多轮会话</CardTitle>
						<CardDescription>
							测试任意回答：商户命中会生成新 KU Revision；平台兜底或未命中会补充为新的商户 KU。
						</CardDescription>
					</div>
					<Button
						variant="outline"
						size="sm"
						disabled={busy || !hasTestVersion}
						onClick={() => void onReset()}
					>
						<RefreshCcwIcon className="mr-2 size-4" />
						重置测试会话
					</Button>
				</div>
			</CardHeader>
			<CardContent className="gap-4 flex flex-col">
				{hasTestVersion ? (
					<div className="gap-2 sm:flex-row flex flex-col">
						<select
							aria-label="选择 Test CA 会话"
							className="px-3 py-2 min-w-0 text-sm flex-1 rounded-md border bg-background"
							value={testSessionId ?? ""}
							onChange={(event) => void onSelectSession(event.target.value)}
						>
							<option value="" disabled>
								选择服务端会话
							</option>
							{sessions.map((session) => (
								<option key={session.id} value={session.id}>
									{session.writable ? "可继续" : "旧 CA（只读）"} · {session.turnCount} 轮 · Before{" "}
									{session.beforeInterventionCount} / After {session.afterInterventionCount} ·{" "}
									{session.firstQuestion ?? "无首题"} · {formatSessionTime(session.latestAt)}
								</option>
							))}
						</select>
						<Button variant="outline" disabled={busy} onClick={() => void onRefreshSessions()}>
							刷新历史
						</Button>
					</div>
				) : null}
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
						{!ready ? (
							<output className="text-sm block text-muted-foreground">
								{testSessionId &&
								sessions.some((session) => session.id === testSessionId && !session.writable)
									? "这是历史 CA，只读；请在当前 Test CA 新建/选择可写会话。"
									: "正在恢复可写测试会话；若仅有历史 CA，请点击“重置测试会话”新建当前会话。"}
							</output>
						) : null}
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
								{turn.feedbackMode === "revise" ? "选择并修正这条回答" : "补充为商户知识并修正"}
							</Button>
						) : (
							<p className="text-xs text-muted-foreground">
								该回答的测试证据已失效，请重置会话后重新测试。
							</p>
						)}
					</div>
				))}
				{selected && (
					<div className="gap-3 p-3 flex flex-col rounded-lg border border-primary">
						<p className="text-sm font-medium">
							{selected.feedbackMode === "revise" ? "正在修正" : "正在补充"}第{" "}
							{turns.findIndex((turn) => turn.turn.id === selected.turn.id) + 1} 轮回答
						</p>
						<Label>
							修正后的商户口径
							<Textarea
								value={correction}
								onChange={(event) => setCorrection(event.target.value)}
								disabled={busy}
							/>
						</Label>
						<Button disabled={busy || !correction.trim()} onClick={() => void onCorrect(selected)}>
							{selected.feedbackMode === "revise"
								? "生成新 KU Revision 并同题复测"
								: "生成商户 KU 并同题复测"}
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
				{interventionEvidence.length ? (
					<div className="gap-3 flex flex-col">
						<p className="text-sm font-medium">已恢复的 Before / After 干预证据</p>
						{interventionEvidence.map((evidence) => (
							<div key={evidence.interventionId} className="gap-3 md:grid-cols-2 grid">
								<AnswerEvidence
									label="Before"
									answer={evidence.source.answer}
									metadata={evidence.source.metadata}
									capabilityVersionId={evidence.source.turn.capabilityVersionId}
									testTurnId={evidence.source.turn.id}
								/>
								{evidence.rerun ? (
									<AnswerEvidence
										label="After"
										answer={evidence.rerun.answer}
										metadata={evidence.rerun.metadata}
										capabilityVersionId={evidence.rerun.turn.capabilityVersionId}
										testTurnId={evidence.rerun.turn.id}
									/>
								) : (
									<div className="p-3 text-sm rounded-lg border text-muted-foreground">
										After 尚未完成；保留 Before 与干预记录，刷新历史后可恢复结果。
									</div>
								)}
							</div>
						))}
					</div>
				) : null}
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
		rows.filter((row: MembershipRow) => row.knowledgeUnitRevision.origin === origin).length;
	const changed = symmetricDifferenceSize(
		new Set(activeRows.map((row) => row.knowledgeUnitRevisionId)),
		new Set(testRows.map((row) => row.knowledgeUnitRevisionId)),
	);
	const testIsActive = active?.id === testVersion?.id && testVersion !== null;
	return (
		<div className="gap-3 flex flex-col">
			<p className="text-sm text-muted-foreground">
				{testIsActive
					? "当前 Test CA 已人工验收，Active 与 Test 一致。"
					: `Test 与 Active 相差 ${changed} 个成员；未人工验收前，Active 不会改变。`}
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
				{rows.map((row: MembershipRow) => (
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

function toTestTurnView(result: TestTurn): TestTurnView {
	return {
		turn: {
			id: result.turn.id,
			question: result.turn.question,
			capabilityVersionId: result.turn.capabilityVersionId,
		},
		answer: result.answer,
		metadata: result.metadata,
		feedbackAllowed: result.feedbackAllowed,
		feedbackMode: result.feedbackMode,
		interventionId: null,
		sourceTestTurnId: null,
	};
}

function toTestSessionTurnView(
	turn: TestSessionDetail["turns"][number],
	writable: boolean,
): TestTurnView {
	const metadata = RuntimeMetadataSchema.safeParse(turn.runtimeMetadata);
	if (!metadata.success) throw new Error("会话测试证据格式无效");
	return {
		turn: {
			id: turn.id,
			question: turn.question,
			capabilityVersionId: turn.capabilityVersionId,
		},
		answer: turn.answer,
		metadata: metadata.data,
		feedbackAllowed: writable && !turn.interventionId,
		feedbackMode:
			metadata.data.knowledgeEvidence?.knowledgeUnitOrigin === "merchant" ? "revise" : "supplement",
		interventionId: turn.interventionId,
		sourceTestTurnId: turn.sourceTestTurnId,
	};
}

export function toInterventionEvidence(
	pairs: TestSessionDetail["interventionPairs"],
): InterventionEvidence[] {
	return pairs.map((pair) => ({
		interventionId: pair.interventionId,
		isComplete: pair.isComplete,
		source: toInterventionTurnView(pair.before),
		rerun: pair.after ? toInterventionTurnView(pair.after) : null,
	}));
}

function toInterventionTurnView(
	turn: TestSessionDetail["interventionPairs"][number]["before"],
): TestTurnView {
	const metadata = RuntimeMetadataSchema.safeParse(turn.runtimeMetadata);
	if (!metadata.success) throw new Error("会话干预证据格式无效");
	return {
		turn: {
			id: turn.id,
			question: "已保存的干预问题",
			capabilityVersionId: turn.capabilityVersionId,
		},
		answer: turn.answer,
		metadata: metadata.data,
		feedbackAllowed: false,
		feedbackMode: "supplement",
		interventionId: null,
		sourceTestTurnId: null,
	};
}

function normalizeTestSessionSummary(value: unknown): TestSessionSummary {
	if (!value || typeof value !== "object") throw new Error("会话历史格式无效");
	const row = value as Record<string, unknown>;
	if (
		typeof row.id !== "string" ||
		typeof row.writable !== "boolean" ||
		typeof row.capabilityVersionId !== "string"
	)
		throw new Error("会话历史格式无效");
	return {
		id: row.id,
		turnCount: typeof row.turnCount === "number" ? row.turnCount : Number(row.turnCount ?? 0),
		writable: row.writable,
		firstQuestion: typeof row.firstQuestion === "string" ? row.firstQuestion : null,
		latestAt: typeof row.latestAt === "string" ? row.latestAt : null,
		capabilityVersionId: row.capabilityVersionId,
		beforeInterventionCount:
			typeof row.beforeInterventionCount === "number" ? row.beforeInterventionCount : 0,
		afterInterventionCount:
			typeof row.afterInterventionCount === "number" ? row.afterInterventionCount : 0,
		isCurrent: row.isCurrent === true,
	};
}

function formatSessionTime(value: string | null) {
	if (!value) return "刚刚";
	const date = new Date(value);
	return Number.isNaN(date.getTime())
		? "时间未知"
		: new Intl.DateTimeFormat("zh-CN", {
				month: "numeric",
				day: "numeric",
				hour: "2-digit",
				minute: "2-digit",
			}).format(date);
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

export function symmetricDifferenceSize(left: Set<string>, right: Set<string>) {
	return new Set([...left, ...right]).size * 2 - left.size - right.size;
}
function message(error: unknown) {
	return error instanceof Error ? error.message : "请稍后重试。";
}
