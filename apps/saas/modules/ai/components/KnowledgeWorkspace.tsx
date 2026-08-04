"use client";

import { isPreviewKnowledgeFixtureSelectorVisible } from "@ai/lib/preview-knowledge-fixtures";
import { Button } from "@repo/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/card";
import { BookOpenTextIcon, CheckCircle2Icon, FlaskConicalIcon, Settings2Icon } from "lucide-react";
import Link from "next/link";

import { KnowledgeCapabilities } from "./KnowledgeCapabilities";
import { KnowledgeDocuments } from "./KnowledgeDocuments";
import { KnowledgeEntries } from "./KnowledgeEntries";
import { KnowledgeUnits } from "./KnowledgeUnits";
import { KnowledgeVersioningPanel } from "./KnowledgeVersioningPanel";
import { XiaofeiAgentGeneralSettings } from "./XiaofeiAgentGeneralSettings";
import { XiaofeiAgentStatus } from "./XiaofeiAgentStatus";
import { XiaofeiFallbackSettings } from "./XiaofeiFallbackSettings";

const STAGES = [
	{
		id: "prepare",
		number: 1,
		title: "知识准备",
		detail: "平台兜底 + 商户资料",
		icon: BookOpenTextIcon,
	},
	{ id: "test", number: 2, title: "测试与修正", detail: "多轮 Test CA", icon: FlaskConicalIcon },
	{
		id: "hosting",
		number: 3,
		title: "验收与托管",
		detail: "人工验收后启用",
		icon: CheckCircle2Icon,
	},
] as const;

type KnowledgeWorkspaceStage = (typeof STAGES)[number]["id"] | "advanced";

export function KnowledgeWorkspace({ stage }: { stage: KnowledgeWorkspaceStage }) {
	return (
		<div className="gap-6 flex flex-col">
			<nav aria-label="知识与托管阶段" className="gap-2 md:grid-cols-3 grid">
				{STAGES.map((item) => {
					const Icon = item.icon;
					const current = item.id === stage;
					return (
						<Link
							key={item.id}
							href={`/knowledge?stage=${item.id}`}
							aria-current={current ? "step" : undefined}
							className={`gap-3 p-4 flex items-center rounded-xl border transition-colors hover:bg-muted/50 ${current ? "border-primary bg-primary/5" : "bg-card"}`}
						>
							<span
								className={`size-8 text-sm font-semibold flex shrink-0 items-center justify-center rounded-full ${current ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
							>
								{item.number}
							</span>
							<span>
								<span className="gap-1.5 text-sm font-medium flex items-center">
									<Icon className="size-4" />
									{item.title}
								</span>
								<span className="text-xs text-muted-foreground">{item.detail}</span>
							</span>
						</Link>
					);
				})}
			</nav>

			{stage === "prepare" && <Preparation />}
			{stage === "test" && <KnowledgeVersioningPanel section="test" />}
			{stage === "hosting" && <KnowledgeVersioningPanel section="hosting" />}
			{stage === "advanced" && <AdvancedGovernance />}
		</div>
	);
}

function Preparation() {
	return (
		<div className="gap-6 flex flex-col">
			<KnowledgeVersioningPanel section="prepare" />
			<KnowledgeEntries
				previewFixtureSelectorVisible={isPreviewKnowledgeFixtureSelectorVisible()}
			/>
			<Card>
				<CardHeader>
					<CardTitle>下一步</CardTitle>
					<CardDescription>上传并确认商户资料后，创建 Test CA，再进入多轮测试。</CardDescription>
				</CardHeader>
				<CardContent>
					<Button asChild>
						<Link href="/knowledge?stage=test">进入测试与修正</Link>
					</Button>
				</CardContent>
			</Card>
			<AdvancedLink />
		</div>
	);
}

function AdvancedLink() {
	return (
		<Card className="border-dashed">
			<CardContent className="gap-3 sm:flex-row sm:items-center sm:justify-between flex flex-col">
				<div>
					<p className="text-sm font-medium">需要精细治理？</p>
					<p className="text-xs text-muted-foreground">
						条目/KU 生命周期、Eval、Agent 指令和未命中话术默认收起，避免打断主流程。
					</p>
				</div>
				<Button variant="outline" asChild>
					<Link href="/knowledge?stage=advanced">
						<Settings2Icon className="mr-2 size-4" />
						高级治理
					</Link>
				</Button>
			</CardContent>
		</Card>
	);
}

function AdvancedGovernance() {
	return (
		<details open className="rounded-xl border bg-card">
			<summary className="px-5 py-4 text-sm font-medium cursor-pointer">高级治理与诊断</summary>
			<div className="gap-8 p-5 flex flex-col border-t">
				<KnowledgeDocuments
					previewFixtureSelectorVisible={isPreviewKnowledgeFixtureSelectorVisible()}
				/>
				<KnowledgeUnits />
				<KnowledgeCapabilities />
				<XiaofeiAgentStatus />
				<XiaofeiAgentGeneralSettings />
				<XiaofeiFallbackSettings />
			</div>
		</details>
	);
}
