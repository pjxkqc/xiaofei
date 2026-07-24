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
import type { XiaofeiWorkspaceSnapshot } from "@repo/xiaofei";
import { orpcClient } from "@shared/lib/orpc-client";
import {
	BracesIcon,
	CheckCircle2Icon,
	DatabaseIcon,
	FlaskConicalIcon,
	MessageSquareIcon,
	NetworkIcon,
	SaveIcon,
	ShieldCheckIcon,
	SparklesIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

interface ConfigDraft {
	instructions: string;
	maxFollowUps: number;
	knowledgeMarkdown: string;
}

export function XiaofeiAgentSettings() {
	const [snapshot, setSnapshot] = useState<XiaofeiWorkspaceSnapshot | null>(null);
	const [draft, setDraft] = useState<ConfigDraft | null>(null);
	const [saving, setSaving] = useState(false);
	const [reviewing, setReviewing] = useState(false);
	const [evaluating, setEvaluating] = useState(false);

	useEffect(() => {
		void orpcClient.xiaofei
			.getConfig()
			.then((configuration) => {
				setSnapshot(configuration);
				setDraft(toDraft(configuration));
			})
			.catch(() => toastError("无法读取小飞配置"));
	}, []);

	const save = async () => {
		if (!draft) return;
		setSaving(true);
		try {
			const updated = await orpcClient.xiaofei.saveConfig(draft);
			setSnapshot(updated);
			setDraft(toDraft(updated));
			toastSuccess("知识治理已更新", "KU 已重新解析，并生成待审核的能力方案。");
		} catch {
			toastError("配置保存失败", "请检查 Markdown 必填字段和 Agent 指令。");
		} finally {
			setSaving(false);
		}
	};

	const reviewCapability = async () => {
		if (!snapshot) return;
		setReviewing(true);
		try {
			const reviewed = !snapshot.capabilityPlan.reviewed;
			const updated = await orpcClient.xiaofei.reviewCapability({ reviewed });
			setSnapshot(updated);
			setDraft(toDraft(updated));
			toastSuccess(
				reviewed ? "能力方案已审核" : "能力审核已撤回",
				reviewed ? "现在可以运行 KU 命中与会话行为测试。" : "自动会话与测试门禁已暂停。",
			);
		} catch {
			toastError("能力方案审核失败");
		} finally {
			setReviewing(false);
		}
	};

	const runEval = async () => {
		setEvaluating(true);
		try {
			const updated = await orpcClient.xiaofei.runEval();
			setSnapshot(updated);
			setDraft(toDraft(updated));
			toastSuccess(
				"P0 Eval 已完成",
				`${updated.evalSuite.passed}/${updated.evalSuite.cases.length} 条 KU 与会话断言通过。`,
			);
		} catch {
			toastError("P0 Eval 运行失败", "请先保存知识并审核能力方案。");
		} finally {
			setEvaluating(false);
		}
	};

	if (!snapshot || !draft) {
		return (
			<div className="py-24 text-sm flex items-center justify-center text-muted-foreground">
				<SparklesIcon className="mr-2 size-4 animate-pulse" />
				正在加载 Xiaofei Agent 设置…
			</div>
		);
	}

	const hasUnsavedChanges =
		draft.instructions !== snapshot.agent.instructions ||
		draft.maxFollowUps !== snapshot.agent.maxFollowUps ||
		draft.knowledgeMarkdown !== snapshot.knowledgeMarkdown;
	const capabilityReviewed = snapshot.capabilityPlan.reviewed;
	const evalPassed = snapshot.evalSuite.status === "passed" && snapshot.evalSuite.failed === 0;
	const evalReady = capabilityReviewed && evalPassed;
	const isBusy = saving || reviewing || evaluating;

	return (
		<div className="gap-6 flex flex-col">
			<Card>
				<CardContent className="gap-3 md:grid-cols-4 grid">
					<FlowStep
						number={1}
						title="知识治理"
						detail={`${snapshot.knowledgeUnits.filter((unit) => unit.status === "released").length}/${snapshot.knowledgeUnits.length} KU 可调用`}
						done={
							!hasUnsavedChanges &&
							snapshot.knowledgeUnits.some((unit) => unit.status === "released")
						}
					/>
					<FlowStep
						number={2}
						title="能力审核"
						detail={`${snapshot.capabilityPlan.knowledgeUnitIds.length} KU 已映射`}
						done={!hasUnsavedChanges && capabilityReviewed}
					/>
					<FlowStep
						number={3}
						title="测试门禁"
						detail={
							snapshot.evalSuite.cases.length > 0
								? `${snapshot.evalSuite.passed}/${snapshot.evalSuite.cases.length} 通过`
								: "等待运行"
						}
						done={!hasUnsavedChanges && evalReady}
					/>
					<FlowStep
						number={4}
						title="会话验证"
						detail={evalReady ? "可进入 Chatbot" : "测试通过后开放"}
						done={!hasUnsavedChanges && evalReady}
					/>
				</CardContent>
			</Card>

			<div className="gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)] grid">
				<div className="gap-6 min-w-0 flex flex-col">
					<Card>
						<CardHeader>
							<div className="gap-3 flex items-start justify-between">
								<div>
									<CardTitle>Agent 配置</CardTitle>
									<CardDescription className="mt-1.5">
										运行链路固定为 LangGraph 状态编排 + Mastra Agent 按需生成。
									</CardDescription>
								</div>
								<Badge status={snapshot.agent.status === "blocked" ? "error" : "success"}>
									{snapshot.agent.status}
								</Badge>
							</div>
						</CardHeader>
						<CardContent className="gap-5 flex flex-col">
							<div className="gap-2 flex flex-col">
								<Label htmlFor="agent-instructions">Agent 指令</Label>
								<Textarea
									id="agent-instructions"
									value={draft.instructions}
									onChange={(event) => setDraft({ ...draft, instructions: event.target.value })}
									className="min-h-28"
								/>
							</div>

							<div className="gap-2 max-w-40 flex flex-col">
								<Label htmlFor="max-follow-ups">最大追问轮次</Label>
								<Input
									id="max-follow-ups"
									type="number"
									min={1}
									max={5}
									value={draft.maxFollowUps}
									onChange={(event) =>
										setDraft({
											...draft,
											maxFollowUps: Number(event.target.value),
										})
									}
								/>
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<div className="gap-3 flex items-start justify-between">
								<div>
									<CardTitle>1. 知识治理</CardTitle>
									<CardDescription className="mt-1.5">
										保存 Markdown 后解析结构化 KU，并自动重建下一步能力方案。
									</CardDescription>
								</div>
								{hasUnsavedChanges && <Badge status="warning">有未保存修改</Badge>}
							</div>
						</CardHeader>
						<CardContent className="gap-4 flex flex-col">
							<Textarea
								value={draft.knowledgeMarkdown}
								onChange={(event) => setDraft({ ...draft, knowledgeMarkdown: event.target.value })}
								className="font-mono text-xs leading-relaxed min-h-[360px]"
							/>
							<div className="gap-2 grid">
								{snapshot.knowledgeUnits.map((unit) => (
									<div
										key={unit.id}
										className="gap-3 px-3 py-2 flex items-center justify-between rounded-xl border"
									>
										<div className="min-w-0">
											<p className="text-sm font-medium truncate">{unit.title}</p>
											<p className="text-xs truncate text-muted-foreground">
												{unit.scenarioKeywords.join(" · ")}
											</p>
										</div>
										<Badge status={unit.status === "released" ? "success" : "error"}>
											{unit.status}
										</Badge>
									</div>
								))}
							</div>
							<Button onClick={save} disabled={isBusy || !hasUnsavedChanges}>
								<SaveIcon className="mr-2 size-4" />
								{saving ? "正在运行治理…" : "保存 KU 并生成能力方案"}
							</Button>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<div className="gap-3 flex items-start justify-between">
								<div>
									<CardTitle>2. KU → 能力方案</CardTitle>
									<CardDescription className="mt-1.5">
										把已发布 KU 收敛为可接场景、字段矩阵、动作边界和测试建议。
									</CardDescription>
								</div>
								<Badge status={capabilityReviewed ? "success" : "warning"}>
									{capabilityReviewed ? "reviewed" : "待审核"}
								</Badge>
							</div>
						</CardHeader>
						<CardContent className="gap-5 flex flex-col">
							<div className="gap-4 sm:grid-cols-3 grid">
								<PlanList title="可接场景" items={snapshot.capabilityPlan.takeoverScenarios} />
								<PlanList title="不可接边界" items={snapshot.capabilityPlan.rejectScenarios} />
								<PlanList title="动作边界" items={snapshot.capabilityPlan.actionBoundaries} />
							</div>

							<div>
								<p className="mb-2 text-sm font-medium">字段矩阵</p>
								<div className="gap-2 grid">
									{snapshot.capabilityPlan.fieldMatrix.map((row) => (
										<div key={row.knowledgeId} className="p-3 rounded-xl border">
											<div className="gap-2 flex items-center justify-between">
												<p className="text-sm font-medium">{row.scenario}</p>
												<Badge>{row.fields.length} 个字段</Badge>
											</div>
											<p className="mt-1 text-xs text-muted-foreground">
												{row.fields.join(" · ") || "无需追问字段"} → {row.exitWhen}
											</p>
										</div>
									))}
								</div>
							</div>

							<PlanList title="建议测试样本" items={snapshot.capabilityPlan.evalSuggestions} />

							<Button
								variant={capabilityReviewed ? "outline" : "primary"}
								onClick={reviewCapability}
								disabled={
									isBusy || hasUnsavedChanges || snapshot.capabilityPlan.status === "blocked"
								}
							>
								<CheckCircle2Icon className="mr-2 size-4" />
								{reviewing
									? "正在更新审核…"
									: capabilityReviewed
										? "撤回能力审核"
										: "审核并启用能力方案"}
							</Button>
							{hasUnsavedChanges && (
								<p className="text-xs text-center text-muted-foreground">
									请先保存当前知识修改，再审核与最新 KU 对应的能力方案。
								</p>
							)}
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<div className="gap-3 flex items-start justify-between">
								<div>
									<CardTitle>3. 测试门禁</CardTitle>
									<CardDescription className="mt-1.5">
										验证 KU 命中、next_action、Owner 与安全退出，而不是只检查回复文本。
									</CardDescription>
								</div>
								<Badge
									status={
										snapshot.evalSuite.status === "passed"
											? "success"
											: snapshot.evalSuite.status === "blocked"
												? "error"
												: "warning"
									}
								>
									{snapshot.evalSuite.status}
								</Badge>
							</div>
						</CardHeader>
						<CardContent className="gap-4 flex flex-col">
							{snapshot.evalSuite.cases.length > 0 ? (
								<div className="gap-2 grid">
									{snapshot.evalSuite.cases.map((testCase) => (
										<div
											key={testCase.id}
											className="gap-3 p-3 flex items-start justify-between rounded-xl border"
										>
											<div>
												<p className="text-sm font-medium">{testCase.title}</p>
												<p className="mt-1 text-xs text-muted-foreground">
													KU: {testCase.actualKnowledgeId ?? "未命中"} · Action:{" "}
													{testCase.actualAction} · Owner: {testCase.actualOwner}
												</p>
											</div>
											<Badge status={testCase.passed ? "success" : "error"}>
												{testCase.passed ? "passed" : "failed"}
											</Badge>
										</div>
									))}
								</div>
							) : (
								<p className="text-sm text-muted-foreground">
									能力方案审核后运行固定断言，结果会在这里形成可读证据。
								</p>
							)}
							<Button
								variant="outline"
								onClick={runEval}
								disabled={isBusy || hasUnsavedChanges || !capabilityReviewed}
							>
								<FlaskConicalIcon className="mr-2 size-4" />
								{evaluating ? "正在评测…" : "运行 KU 与会话 Eval"}
							</Button>
						</CardContent>
					</Card>
				</div>

				<Card className="lg:sticky lg:top-6 min-w-0 h-fit">
					<CardHeader>
						<CardTitle>发布证据</CardTitle>
						<CardDescription>每一步更新同一份租户快照，门禁状态不会只停留在页面。</CardDescription>
					</CardHeader>
					<CardContent className="gap-3 flex flex-col">
						{snapshot.gates.map((gate) => (
							<div key={gate.id} className="gap-3 flex items-start justify-between">
								<div>
									<p className="text-sm font-medium">{gate.label}</p>
									<p className="text-xs text-muted-foreground">{gate.detail}</p>
								</div>
								<Badge
									status={
										gate.status === "passed"
											? "success"
											: gate.status === "warning"
												? "warning"
												: "error"
									}
								>
									{gate.status}
								</Badge>
							</div>
						))}
						<div className="mt-2 gap-2 flex flex-wrap">
							<Capability icon={BracesIcon} label="KU Capability" />
							<Capability icon={NetworkIcon} label="LangGraph StateGraph" />
							<Capability icon={SparklesIcon} label="Mastra Agent" />
							<Capability icon={DatabaseIcon} label="Neon State" />
							<Capability icon={ShieldCheckIcon} label="Guardrail" />
						</div>
						<div className="mt-2">
							{evalReady && !hasUnsavedChanges ? (
								<Button className="w-full" asChild>
									<Link href="/chatbot">
										<MessageSquareIcon className="mr-2 size-4" />
										4. 打开 Chatbot 验证
									</Link>
								</Button>
							) : (
								<Button className="w-full" disabled>
									<MessageSquareIcon className="mr-2 size-4" />
									测试通过后进入会话验证
								</Button>
							)}
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}

function FlowStep({
	number,
	title,
	detail,
	done,
}: {
	number: number;
	title: string;
	detail: string;
	done: boolean;
}) {
	return (
		<div className="gap-3 p-3 flex items-start rounded-xl border">
			<span
				className={`size-7 text-xs font-semibold flex shrink-0 items-center justify-center rounded-full ${
					done ? "text-white bg-success" : "bg-muted text-muted-foreground"
				}`}
			>
				{done ? <CheckCircle2Icon className="size-4" /> : number}
			</span>
			<div>
				<p className="text-sm font-medium">{title}</p>
				<p className="text-xs text-muted-foreground">{detail}</p>
			</div>
		</div>
	);
}

function PlanList({ title, items }: { title: string; items: string[] }) {
	return (
		<div>
			<p className="mb-2 text-sm font-medium">{title}</p>
			<div className="gap-1.5 flex flex-wrap">
				{items.length > 0 ? (
					items.map((item) => (
						<span key={item} className="px-2.5 py-1 text-xs rounded-full bg-muted">
							{item}
						</span>
					))
				) : (
					<span className="text-xs text-muted-foreground">暂无</span>
				)}
			</div>
		</div>
	);
}

function Capability({
	icon: Icon,
	label,
}: {
	icon: React.ComponentType<{ className?: string }>;
	label: string;
}) {
	return (
		<span className="gap-1.5 px-2.5 py-1.5 text-xs flex items-center rounded-full bg-muted">
			<Icon className="size-3.5" />
			{label}
		</span>
	);
}

function toDraft(snapshot: XiaofeiWorkspaceSnapshot): ConfigDraft {
	return {
		instructions: snapshot.agent.instructions,
		maxFollowUps: snapshot.agent.maxFollowUps,
		knowledgeMarkdown: snapshot.knowledgeMarkdown,
	};
}
