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
import { toastError, toastSuccess } from "@repo/ui/components/toast";
import type { XiaofeiWorkspaceSnapshot } from "@repo/xiaofei";
import { orpcClient } from "@shared/lib/orpc-client";
import { FlaskConicalIcon, MessageSquareIcon, ShieldCheckIcon } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

export function KnowledgeCapabilities() {
	const [snapshot, setSnapshot] = useState<XiaofeiWorkspaceSnapshot | null>(null);
	const [busy, setBusy] = useState(false);
	const refresh = useCallback(async () => setSnapshot(await orpcClient.xiaofei.getConfig()), []);
	useEffect(() => void refresh().catch(() => toastError("无法读取能力方案")), [refresh]);
	if (!snapshot)
		return <div className="py-24 text-sm text-muted-foreground">正在加载能力方案…</div>;
	const admitted = isAdmitted(snapshot);
	const hasPublishedKnowledge = snapshot.capabilityPlan.knowledgeUnitIds.length > 0;
	const toggleReview = async () => {
		setBusy(true);
		try {
			const updated = await orpcClient.xiaofei.reviewCapability({
				reviewed: !snapshot.capabilityPlan.reviewed,
			});
			setSnapshot(updated);
			toastSuccess(updated.capabilityPlan.reviewed ? "能力方案已审核" : "能力审核已撤回");
		} catch {
			toastError("能力审核失败", "请先发布至少一个非 stale KU。");
		} finally {
			setBusy(false);
		}
	};
	const runEval = async () => {
		setBusy(true);
		try {
			setSnapshot(await orpcClient.xiaofei.runEval());
			toastSuccess("Eval 证据已更新");
		} catch {
			toastError("Eval 未通过", "请先审核当前能力方案。");
		} finally {
			setBusy(false);
		}
	};
	return (
		<div className="gap-6 flex flex-col">
			<Card>
				<CardHeader>
					<div className="gap-3 flex items-start justify-between">
						<div>
							<CardTitle>当前可调用能力</CardTitle>
							<CardDescription className="mt-1.5">
								仅当前审核、发布且未 stale 的 KU 可进入 Chatbot。
							</CardDescription>
						</div>
						<Badge status={admitted ? "success" : "warning"}>
							{admitted ? "已准入" : "未准入"}
						</Badge>
					</div>
				</CardHeader>
				<CardContent className="gap-3 flex flex-col">
					<div className="gap-2 text-sm flex flex-wrap">
						<Badge>{snapshot.capabilityPlan.knowledgeUnitIds.length} 个 KU</Badge>
						<Badge>{snapshot.capabilityPlan.reviewed ? "已审核" : "待审核"}</Badge>
						<Badge>{snapshot.evalSuite.status === "passed" ? "Eval 通过" : "Eval 未通过"}</Badge>
					</div>
					<p className="text-sm text-muted-foreground">
						版本：{snapshot.capabilityPlan.version}。来源或条目变更会清除当前 Eval 准入，Chatbot
						将安全转人工。
					</p>
					<div className="gap-2 flex flex-wrap">
						<Button
							onClick={() => void toggleReview()}
							disabled={busy || (!hasPublishedKnowledge && !snapshot.capabilityPlan.reviewed)}
						>
							<ShieldCheckIcon className="mr-2 size-4" />
							{snapshot.capabilityPlan.reviewed ? "撤回审核" : "审核能力方案"}
						</Button>
						<Button
							variant="outline"
							onClick={() => void runEval()}
							disabled={busy || !snapshot.capabilityPlan.reviewed}
						>
							<FlaskConicalIcon className="mr-2 size-4" />
							运行 Eval
						</Button>
						<Button variant="outline" asChild>
							<Link href="/knowledge/units">审核、发布或撤销 KU</Link>
						</Button>
						{admitted ? (
							<Button asChild>
								<Link href="/chatbot">
									<MessageSquareIcon className="mr-2 size-4" />
									进入会话测试
								</Link>
							</Button>
						) : (
							<Button disabled>
								<MessageSquareIcon className="mr-2 size-4" />
								审核并通过 Eval 后测试
							</Button>
						)}
					</div>
					{!hasPublishedKnowledge && (
						<p className="text-sm text-amber-700 dark:text-amber-400">
							尚无已发布 KU。请返回第 2 步完成审核和发布，再进行能力审核。
						</p>
					)}
				</CardContent>
			</Card>
			<Card>
				<CardHeader>
					<CardTitle>能力边界</CardTitle>
					<CardDescription>
						能力计划从当前发布 KU 派生；这里不会自动发布或自动准入。
					</CardDescription>
				</CardHeader>
				<CardContent className="gap-4 md:grid-cols-2 grid">
					{[
						["可接场景", snapshot.capabilityPlan.takeoverScenarios],
						["人工边界", snapshot.capabilityPlan.handoffBoundaries],
						["拒绝边界", snapshot.capabilityPlan.rejectScenarios],
						["Eval 样本", snapshot.capabilityPlan.evalSuggestions],
					].map(([title, values]) => (
						<div key={title as string}>
							<p className="font-medium text-sm">{title}</p>
							<ul className="mt-2 pl-5 text-sm list-disc text-muted-foreground">
								{(values as string[]).map((value) => (
									<li key={value}>{value}</li>
								))}
							</ul>
						</div>
					))}
				</CardContent>
			</Card>
		</div>
	);
}

export function isAdmitted(snapshot: XiaofeiWorkspaceSnapshot): boolean {
	return (
		snapshot.capabilityPlan.reviewed &&
		snapshot.capabilityPlan.status === "review_ready" &&
		snapshot.evalSuite.status === "passed" &&
		snapshot.evalSuite.capabilityPlanVersion === snapshot.capabilityPlan.version &&
		snapshot.capabilityPlan.knowledgeUnitIds.length > 0
	);
}
