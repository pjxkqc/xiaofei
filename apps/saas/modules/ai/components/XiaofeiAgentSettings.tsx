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
	DatabaseIcon,
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
			toastSuccess("配置已保存", "Mastra 治理 Workflow 已重新执行，KU 与门禁状态已更新。");
		} catch {
			toastError("配置保存失败", "请检查 Markdown 必填字段和 Agent 指令。");
		} finally {
			setSaving(false);
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
				`${updated.evalSuite.passed}/${updated.evalSuite.cases.length} 条业务断言通过。`,
			);
		} catch {
			toastError("P0 Eval 运行失败");
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

	return (
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
						<CardTitle>Knowledge Units</CardTitle>
						<CardDescription>
							一个 Markdown 来源即可生成多条结构化 KU；缺少安全字段时会阻塞发布。
						</CardDescription>
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
					</CardContent>
				</Card>
			</div>

			<Card className="lg:sticky lg:top-6 min-w-0 h-fit">
				<CardHeader>
					<CardTitle>框架门禁</CardTitle>
					<CardDescription>保存时运行治理 Workflow，评测通过后才具备完整发布证据。</CardDescription>
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
						<Capability icon={NetworkIcon} label="LangGraph StateGraph" />
						<Capability icon={SparklesIcon} label="Mastra Agent" />
						<Capability icon={DatabaseIcon} label="Neon State" />
						<Capability icon={ShieldCheckIcon} label="Guardrail" />
					</div>
					<div className="mt-2 gap-2 grid">
						<Button onClick={save} disabled={saving || evaluating}>
							<SaveIcon className="mr-2 size-4" />
							{saving ? "正在验证…" : "保存并运行治理"}
						</Button>
						<Button variant="outline" onClick={runEval} disabled={saving || evaluating}>
							<ShieldCheckIcon className="mr-2 size-4" />
							{evaluating ? "正在评测…" : "运行 P0 Eval"}
						</Button>
						<Button variant="outline" asChild>
							<Link href="/chatbot">
								<MessageSquareIcon className="mr-2 size-4" />
								打开 Chatbot 验证
							</Link>
						</Button>
					</div>
					{snapshot.evalSuite.cases.length > 0 && (
						<p className="text-xs text-center text-muted-foreground">
							最近评测：{snapshot.evalSuite.passed}/{snapshot.evalSuite.cases.length} 通过
						</p>
					)}
				</CardContent>
			</Card>
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
