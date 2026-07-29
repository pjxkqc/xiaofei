import { cn } from "@repo/ui";
import { Card, CardContent } from "@repo/ui/components/card";
import Link from "next/link";

const AGENT_SETTING_SECTIONS = [
	{
		id: "general",
		number: 1,
		title: "基础设置",
		detail: "Agent 指令与追问轮次",
		href: "/agent-settings/general",
	},
	{
		id: "fallback",
		number: 2,
		title: "兜底与转人工",
		detail: "未命中、待关注与转接话术",
		href: "/agent-settings/fallback",
	},
	{
		id: "status",
		number: 3,
		title: "运行状态",
		detail: "准入门禁与下一步操作",
		href: "/agent-settings/status",
	},
] as const;

export type AgentSettingsSectionId = (typeof AGENT_SETTING_SECTIONS)[number]["id"];

export function AgentSettingsNav({ current }: { current: AgentSettingsSectionId }) {
	return (
		<Card className="mb-6">
			<CardContent className="gap-3 md:grid-cols-3 grid">
				{AGENT_SETTING_SECTIONS.map((section) => {
					const isCurrent = section.id === current;
					return (
						<Link
							key={section.id}
							href={section.href}
							aria-current={isCurrent ? "page" : undefined}
							className={cn(
								"gap-3 p-3 flex items-start rounded-xl border transition-colors hover:bg-muted/50",
								isCurrent && "border-primary bg-primary/5",
							)}
						>
							<span
								className={cn(
									"size-7 text-xs font-semibold flex shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground",
									isCurrent && "bg-primary text-primary-foreground",
								)}
							>
								{section.number}
							</span>
							<span>
								<span className="text-sm font-medium block">{section.title}</span>
								<span className="text-xs block text-muted-foreground">{section.detail}</span>
							</span>
						</Link>
					);
				})}
			</CardContent>
		</Card>
	);
}
