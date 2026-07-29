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
import { toastError } from "@repo/ui/components/toast";
import { isKnowledgeUnitEligible, type XiaofeiWorkspaceSnapshot } from "@repo/xiaofei";
import { orpcClient } from "@shared/lib/orpc-client";
import {
	BookOpenTextIcon,
	BracesIcon,
	DatabaseIcon,
	MessageSquareIcon,
	NetworkIcon,
	ShieldCheckIcon,
	SparklesIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

export function XiaofeiAgentStatus() {
	const [snapshot, setSnapshot] = useState<XiaofeiWorkspaceSnapshot | null>(null);

	useEffect(() => {
		void orpcClient.xiaofei
			.getConfig()
			.then(setSnapshot)
			.catch(() => toastError("无法读取 Agent 运行状态"));
	}, []);

	if (!snapshot) {
		return (
			<div className="py-24 text-sm flex items-center justify-center text-muted-foreground">
				<SparklesIcon className="mr-2 size-4 animate-pulse" />
				正在加载运行状态…
			</div>
		);
	}

	const callableUnits = snapshot.knowledgeUnits.filter(isKnowledgeUnitEligible).length;
	const evalCurrent =
		snapshot.evalSuite.status === "passed" &&
		snapshot.evalSuite.failed === 0 &&
		snapshot.evalSuite.capabilityPlanVersion === snapshot.capabilityPlan.version;
	const admitted =
		callableUnits > 0 &&
		snapshot.capabilityPlan.reviewed &&
		snapshot.capabilityPlan.status === "review_ready" &&
		evalCurrent;

	return (
		<div className="gap-6 flex flex-col">
			<div className="gap-4 md:grid-cols-3 grid">
				<SummaryCard
					title="Agent"
					value={snapshot.agent.status}
					detail={`最多追问 ${snapshot.agent.maxFollowUps} 轮`}
					status={snapshot.agent.status === "blocked" ? "error" : "success"}
				/>
				<SummaryCard
					title="可调用知识"
					value={`${callableUnits} KU`}
					detail={`${snapshot.capabilityPlan.knowledgeUnitIds.length} 个已进入能力方案`}
					status={callableUnits > 0 ? "success" : "error"}
				/>
				<SummaryCard
					title="会话准入"
					value={admitted ? "已开放" : "待完成"}
					detail={
						snapshot.evalSuite.cases.length > 0
							? `Eval ${snapshot.evalSuite.passed}/${snapshot.evalSuite.cases.length}`
							: "尚无当前版本 Eval 证据"
					}
					status={admitted ? "success" : "warning"}
				/>
			</div>

			<div className="gap-6 lg:grid-cols-[minmax(0,1fr)_360px] grid">
				<Card>
					<CardHeader>
						<CardTitle>发布门禁</CardTitle>
						<CardDescription>
							这里集中查看状态；知识、审核、Eval 与会话测试仍在“知识治理”完成。
						</CardDescription>
					</CardHeader>
					<CardContent className="gap-4 flex flex-col">
						{snapshot.gates.map((gate) => (
							<div
								key={gate.id}
								className="gap-3 pb-4 last:pb-0 flex items-start justify-between border-b last:border-0"
							>
								<div>
									<p className="text-sm font-medium">{gate.label}</p>
									<p className="mt-1 text-xs text-muted-foreground">{gate.detail}</p>
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
					</CardContent>
				</Card>

				<div className="gap-6 flex flex-col">
					<Card>
						<CardHeader>
							<CardTitle>{admitted ? "可以开始会话验证" : "下一步"}</CardTitle>
							<CardDescription>{getNextStep(snapshot, evalCurrent)}</CardDescription>
						</CardHeader>
						<CardContent className="gap-2 flex flex-col">
							{admitted ? (
								<>
									<Button asChild>
										<Link href="/chatbot">
											<MessageSquareIcon className="mr-2 size-4" />
											进入会话测试
										</Link>
									</Button>
									<Button variant="outline" asChild>
										<Link href="/support" target="_blank">
											打开客户页面
										</Link>
									</Button>
								</>
							) : (
								<Button asChild>
									<Link href={callableUnits > 0 ? "/knowledge/capabilities" : "/knowledge/entries"}>
										<ShieldCheckIcon className="mr-2 size-4" />
										{callableUnits > 0 ? "前往能力与 Eval" : "前往知识录入"}
									</Link>
								</Button>
							)}
						</CardContent>
					</Card>
					<Card>
						<CardHeader>
							<CardTitle>运行能力</CardTitle>
						</CardHeader>
						<CardContent className="gap-2 flex flex-wrap">
							<Capability icon={BracesIcon} label="KU Capability" />
							<Capability icon={NetworkIcon} label="LangGraph" />
							<Capability icon={SparklesIcon} label="Mastra Agent" />
							<Capability icon={DatabaseIcon} label="Neon State" />
							<Capability icon={ShieldCheckIcon} label="Guardrail" />
						</CardContent>
					</Card>
				</div>
			</div>

			<Card>
				<CardContent className="gap-3 sm:flex-row sm:items-center sm:justify-between flex flex-col">
					<div className="gap-3 flex items-center">
						<BookOpenTextIcon className="size-5 text-muted-foreground" />
						<div>
							<p className="text-sm font-medium">知识内容不在 Agent Settings 维护</p>
							<p className="text-xs text-muted-foreground">
								上传、解析、知识条目、KU 发布和能力审核统一进入知识治理闭环。
							</p>
						</div>
					</div>
					<Button variant="outline" asChild>
						<Link href="/knowledge/entries">打开知识治理</Link>
					</Button>
				</CardContent>
			</Card>
		</div>
	);
}

function SummaryCard({
	title,
	value,
	detail,
	status,
}: {
	title: string;
	value: string;
	detail: string;
	status: "success" | "warning" | "error";
}) {
	return (
		<Card>
			<CardContent>
				<div className="gap-3 flex items-start justify-between">
					<div>
						<p className="text-xs text-muted-foreground">{title}</p>
						<p className="mt-1 text-lg font-semibold">{value}</p>
						<p className="mt-1 text-xs text-muted-foreground">{detail}</p>
					</div>
					<Badge status={status}>{status === "success" ? "ready" : status}</Badge>
				</div>
			</CardContent>
		</Card>
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

function getNextStep(snapshot: XiaofeiWorkspaceSnapshot, evalCurrent: boolean): string {
	if (snapshot.capabilityPlan.knowledgeUnitIds.length === 0) {
		return "先录入知识并发布至少一个可调用 KU。";
	}
	if (!snapshot.capabilityPlan.reviewed) {
		return "当前能力方案尚未审核，请到能力控制面完成审核。";
	}
	if (!evalCurrent) {
		return "Agent 设置已变化或尚未评测，请重新运行当前能力版本的 Eval。";
	}
	return "能力审核与当前版本 Eval 均已通过。";
}
