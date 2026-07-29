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
import { NetworkIcon, SaveIcon, SparklesIcon } from "lucide-react";
import { useEffect, useState } from "react";

interface GeneralDraft {
	instructions: string;
	maxFollowUps: number;
}

export function XiaofeiAgentGeneralSettings() {
	const [snapshot, setSnapshot] = useState<XiaofeiWorkspaceSnapshot | null>(null);
	const [draft, setDraft] = useState<GeneralDraft | null>(null);
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		void orpcClient.xiaofei
			.getConfig()
			.then((configuration) => {
				setSnapshot(configuration);
				setDraft(toDraft(configuration));
			})
			.catch(() => toastError("无法读取小飞基础设置"));
	}, []);

	if (!snapshot || !draft) {
		return (
			<div className="py-24 text-sm flex items-center justify-center text-muted-foreground">
				<SparklesIcon className="mr-2 size-4 animate-pulse" />
				正在加载基础设置…
			</div>
		);
	}

	const hasChanges =
		draft.instructions !== snapshot.agent.instructions ||
		draft.maxFollowUps !== snapshot.agent.maxFollowUps;
	const isValid =
		draft.instructions.trim().length >= 20 && draft.maxFollowUps >= 1 && draft.maxFollowUps <= 10;

	const save = async () => {
		setSaving(true);
		try {
			const updated = await orpcClient.xiaofei.saveAgentSettings({
				section: "general",
				...draft,
			});
			setSnapshot(updated);
			setDraft(toDraft(updated));
			toastSuccess("基础设置已保存", "知识与能力审核保持不变；请重新运行 Eval 验证新行为。");
		} catch {
			toastError("基础设置保存失败", "Agent 指令至少 20 个字符，追问轮次须为 1–10。");
		} finally {
			setSaving(false);
		}
	};

	return (
		<div className="gap-6 lg:grid-cols-[minmax(0,1fr)_320px] grid">
			<Card>
				<CardHeader>
					<div className="gap-3 flex items-start justify-between">
						<div>
							<CardTitle>Agent 基础设置</CardTitle>
							<CardDescription className="mt-1.5">
								定义小飞的角色边界，以及一轮任务中允许收集资料的最大追问次数。
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
							className="min-h-44"
						/>
						<p className="text-xs text-muted-foreground">
							用于约束服务范围、回答原则与风险边界；具体知识内容请到“知识治理”维护。
						</p>
					</div>
					<div className="gap-2 max-w-64 flex flex-col">
						<Label htmlFor="max-follow-ups">资料收集最大追问轮次</Label>
						<Input
							id="max-follow-ups"
							type="number"
							min={1}
							max={10}
							value={draft.maxFollowUps}
							onChange={(event) => setDraft({ ...draft, maxFollowUps: Number(event.target.value) })}
						/>
						<p className="text-xs text-muted-foreground">
							适用于已命中知识但仍需补齐必要信息的场景。
						</p>
					</div>
					<Button
						onClick={() => void save()}
						disabled={saving || !hasChanges || !isValid}
						className="sm:w-fit"
					>
						<SaveIcon className="mr-2 size-4" />
						{saving ? "正在保存…" : "保存基础设置"}
					</Button>
				</CardContent>
			</Card>

			<div className="gap-6 flex flex-col">
				<Card>
					<CardHeader>
						<CardTitle>统一 Runtime</CardTitle>
						<CardDescription>Mastra 与 LangGraph 不是两套对话入口。</CardDescription>
					</CardHeader>
					<CardContent className="gap-3 text-sm flex flex-col">
						<div className="gap-2 flex items-start">
							<NetworkIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
							<p>LangGraph 管理会话状态、Owner、追问和转人工流程。</p>
						</div>
						<div className="gap-2 flex items-start">
							<SparklesIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
							<p>Mastra 在流程需要时生成回复，并受 KU 与 Guardrail 约束。</p>
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<CardTitle>保存影响</CardTitle>
					</CardHeader>
					<CardContent className="text-sm text-muted-foreground">
						不会重新解析或覆盖知识单元，也不会撤回能力审核；为保证行为证据可信，当前 Eval
						结果会被清除，需要在能力控制面重新运行。
					</CardContent>
				</Card>
			</div>
		</div>
	);
}

function toDraft(snapshot: XiaofeiWorkspaceSnapshot): GeneralDraft {
	return {
		instructions: snapshot.agent.instructions,
		maxFollowUps: snapshot.agent.maxFollowUps,
	};
}
