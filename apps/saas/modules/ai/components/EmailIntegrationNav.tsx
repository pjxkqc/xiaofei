import { cn } from "@repo/ui";
import { Card, CardContent } from "@repo/ui/components/card";
import Link from "next/link";

const EMAIL_INTEGRATION_STEPS = [
	{
		id: "guide",
		number: 1,
		title: "接入指引",
		detail: "契约、绑定与 Worker 参数",
		href: "/integrations/email",
	},
	{
		id: "inbound",
		number: 2,
		title: "入站验证",
		detail: "模拟 Worker 投递",
		href: "/integrations/email-inbound",
	},
	{
		id: "conversation",
		number: 3,
		title: "会话消费",
		detail: "确认接收并让小飞处理",
		href: "/inbox",
	},
	{
		id: "delivery",
		number: 4,
		title: "回复回递",
		detail: "Receiver Mock、地址与 Outbox",
		href: "/integrations/email-delivery",
	},
] as const;

export type EmailIntegrationStepId = (typeof EMAIL_INTEGRATION_STEPS)[number]["id"];

export function EmailIntegrationNav({ current }: { current: EmailIntegrationStepId }) {
	return (
		<Card className="mb-6">
			<CardContent className="gap-3 sm:grid-cols-2 xl:grid-cols-4 grid">
				{EMAIL_INTEGRATION_STEPS.map((step) => {
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
