import { cn } from "@repo/ui";
import { Card, CardContent } from "@repo/ui/components/card";
import Link from "next/link";

const KNOWLEDGE_FLOW_STEPS = [
	{
		id: "entries",
		number: 1,
		title: "录入与条目",
		detail: "文件、网页、手工问答",
		href: "/knowledge/entries",
	},
	{
		id: "units",
		number: 2,
		title: "知识单元",
		detail: "生成、复核、发布 KU",
		href: "/knowledge/units",
	},
	{
		id: "capabilities",
		number: 3,
		title: "能力准入",
		detail: "审核能力并运行 Eval",
		href: "/knowledge/capabilities",
	},
	{
		id: "conversation",
		number: 4,
		title: "会话测试",
		detail: "验证命中、兜底与溯源",
		href: "/chatbot",
	},
] as const;

export type KnowledgeFlowStepId = (typeof KNOWLEDGE_FLOW_STEPS)[number]["id"];

export function KnowledgeFlowNav({ current }: { current: KnowledgeFlowStepId }) {
	return (
		<Card className="mb-6">
			<CardContent className="gap-3 sm:grid-cols-2 xl:grid-cols-4 grid">
				{KNOWLEDGE_FLOW_STEPS.map((step) => {
					const isCurrent = step.id === current;
					return (
						<Link
							key={step.id}
							href={step.href}
							aria-current={isCurrent ? "step" : undefined}
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
								{step.number}
							</span>
							<span>
								<span className="text-sm font-medium block">{step.title}</span>
								<span className="text-xs block text-muted-foreground">{step.detail}</span>
							</span>
						</Link>
					);
				})}
			</CardContent>
		</Card>
	);
}
