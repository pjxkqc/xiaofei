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
import { orpcClient } from "@shared/lib/orpc-client";
import { CheckCircle2Icon, CircleDashedIcon, CopyIcon, ExternalLinkIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

interface GuideStatus {
	activeBindings: number;
	deliveryMode: "mock" | "webhook";
	callbackUrl: string | null;
}

export function EmailIntegrationGuide() {
	const [origin, setOrigin] = useState("https://<xiaofei-host>");
	const [status, setStatus] = useState<GuideStatus | null>(null);
	const [notice, setNotice] = useState("");
	useEffect(() => {
		setOrigin(window.location.origin);
		void Promise.all([
			orpcClient.xiaofei.listEmailBindings(),
			orpcClient.xiaofei.getEmailDeliverySettings(),
		])
			.then(([bindings, delivery]) =>
				setStatus({
					activeBindings: bindings.items.filter((item) => item.status === "active").length,
					deliveryMode: delivery.mode,
					callbackUrl: delivery.callbackUrl,
				}),
			)
			.catch(() => setNotice("暂时无法读取当前 Organization 的接入状态。"));
	}, []);
	const ingestUrl = `${origin}/api/xiaofei/integrations/v1/email/messages`;
	const receiverMockUrl = `${origin}/api/xiaofei/integrations/v1/email/delivery-mock`;
	const request = useMemo(() => sampleRequest(), []);
	async function copy(value: string, label: string) {
		await navigator.clipboard.writeText(value);
		setNotice(`${label}已复制。`);
	}

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle>给 Worker 同事的最短接入路径</CardTitle>
					<CardDescription>
						只需固定一个入站接口和一个回递接口。先用内置 Mock 走通，再替换真实 Receiver 地址。
					</CardDescription>
				</CardHeader>
				<CardContent className="gap-3 md:grid-cols-4 grid">
					<StatusCard
						ready={(status?.activeBindings ?? 0) > 0}
						title="1. 邮箱绑定"
						detail={
							status ? `${status.activeBindings} 个启用绑定` : "检查 company / mailbox / address"
						}
						href="/integrations/email-bindings"
					/>
					<StatusCard
						ready={false}
						title="2. Worker 投递"
						detail="先在入站验证页生成示例"
						href="/integrations/email-inbound"
					/>
					<StatusCard
						ready={false}
						title="3. 会话消费"
						detail="Inbox 显示消息与处理状态"
						href="/inbox"
					/>
					<StatusCard
						ready={status?.deliveryMode === "mock" || Boolean(status?.callbackUrl)}
						title="4. 回复回递"
						detail={
							status?.deliveryMode === "webhook"
								? (status.callbackUrl ?? "未填写 Receiver")
								: "内置 Receiver Mock"
						}
						href="/integrations/email-delivery"
					/>
				</CardContent>
			</Card>

			<div className="gap-6 xl:grid-cols-2 grid">
				<ContractCard
					title="Worker → 小飞"
					description="Worker 归一化 Kafka 消息后调用。只有数据库事务提交后才返回 200/202。"
					endpoint={ingestUrl}
					onCopy={() => void copy(ingestUrl, "入站地址")}
				>
					<div className="gap-2 flex flex-wrap">
						<Badge status="info">Authorization: Bearer …</Badge>
						<Badge status="info">Idempotency-Key = eventId</Badge>
						<Badge status="info">Content-Type: application/json</Badge>
					</div>
					<pre className="mt-4 max-h-80 p-4 text-xs overflow-auto rounded-lg bg-muted">
						{JSON.stringify(request, null, 2)}
					</pre>
					<div className="mt-3 gap-2 flex flex-wrap">
						<Button
							variant="secondary"
							onClick={() => void copy(JSON.stringify(request, null, 2), "请求 JSON")}
						>
							<CopyIcon className="mr-2 size-4" />
							复制请求 JSON
						</Button>
						<Button variant="outline" asChild>
							<Link href="/integrations/events">查看事件账本</Link>
						</Button>
					</div>
				</ContractCard>

				<ContractCard
					title="小飞 → Worker Receiver"
					description="小飞先写 Outbox，再向 Receiver POST。Receiver 应按 deliveryId 幂等并返回任意 2xx。"
					endpoint={receiverMockUrl}
					onCopy={() => void copy(receiverMockUrl, "Receiver Mock 地址")}
				>
					<ul className="space-y-2 text-sm text-muted-foreground">
						<li>
							• 回复事件：message.reply.requested，含收件人、主题、正文和 replyToSourceMessageId。
						</li>
						<li>• 状态事件：conversation.status.changed，可先用它验证网络和结构。</li>
						<li>• 请求头：Content-Type: application/json；Idempotency-Key 等于 deliveryId。</li>
						<li>• 失败不会丢消息：Outbox 保留 payload、HTTP 状态、尝试次数和安全错误，可重试。</li>
					</ul>
					<div className="mt-4 gap-2 flex flex-wrap">
						<Button asChild>
							<Link href="/integrations/email-delivery">配置与测试 Receiver</Link>
						</Button>
						<Button variant="outline" asChild>
							<Link href="/inbox">
								<ExternalLinkIcon className="mr-2 size-4" />
								查看客户会话
							</Link>
						</Button>
					</div>
				</ContractCard>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Preview 推荐参数</CardTitle>
					<CardDescription>均为虚构值，可直接在绑定和入站验证页面预填。</CardDescription>
				</CardHeader>
				<CardContent className="gap-3 md:grid-cols-3 text-sm grid">
					<Parameter label="companyId" value="fly103-preview-company" />
					<Parameter label="channelAccount.id" value="fly103-preview-mailbox-v2" />
					<Parameter label="channelAccount.address" value="support.fly103@example.com" />
				</CardContent>
			</Card>
			{notice ? (
				<p aria-live="polite" className="text-sm text-muted-foreground">
					{notice}
				</p>
			) : null}
		</div>
	);
}

function StatusCard({
	ready,
	title,
	detail,
	href,
}: {
	ready: boolean;
	title: string;
	detail: string;
	href: string;
}) {
	return (
		<Link href={href} className="space-y-2 p-4 rounded-xl border hover:bg-muted/50">
			<div className="gap-2 flex items-center">
				{ready ? (
					<CheckCircle2Icon className="size-4 text-success" />
				) : (
					<CircleDashedIcon className="size-4 text-muted-foreground" />
				)}
				<span className="text-sm font-medium">{title}</span>
			</div>
			<p className="text-xs break-all text-muted-foreground">{detail}</p>
		</Link>
	);
}

function ContractCard({
	title,
	description,
	endpoint,
	onCopy,
	children,
}: {
	title: string;
	description: string;
	endpoint: string;
	onCopy: () => void;
	children: React.ReactNode;
}) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>{title}</CardTitle>
				<CardDescription>{description}</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="gap-2 mb-4 p-3 flex items-center rounded-lg border">
					<code className="text-xs min-w-0 flex-1 break-all">POST {endpoint}</code>
					<Button size="icon" variant="ghost" aria-label={`复制 ${title} 地址`} onClick={onCopy}>
						<CopyIcon className="size-4" />
					</Button>
				</div>
				{children}
			</CardContent>
		</Card>
	);
}

function Parameter({ label, value }: { label: string; value: string }) {
	return (
		<div className="p-3 rounded-lg border">
			<span className="text-xs block text-muted-foreground">{label}</span>
			<code className="mt-1 block break-all">{value}</code>
		</div>
	);
}

function sampleRequest() {
	return {
		schemaVersion: "email.message.v1",
		eventId: "email:realtime:fly103-preview-company:987654321:demo",
		occurredAt: "2026-08-04T03:20:00.000Z",
		tenant: { companyId: "fly103-preview-company" },
		channel: "email",
		channelAccount: {
			id: "fly103-preview-mailbox-v2",
			address: "support.fly103@example.com",
		},
		conversation: {
			externalId: "email:fly103-preview-company:customer-demo",
			loopdeskSessionId: null,
		},
		message: {
			sourceMessageId: "email:987654321",
			providerMessageId: "<demo@example.com>",
			replyToSourceMessageId: null,
			direction: "inbound",
			senderType: "customer",
			from: { address: "customer@example.com", name: "Demo Customer" },
			to: [{ address: "support.fly103@example.com", name: null }],
			subject: "C-Air Mini room recommendation",
			content: { type: "text/plain", value: "20㎡ room, Wi-Fi required. Which model fits?" },
			attachments: [],
			sentAt: "2026-08-04T03:20:00.000Z",
			labels: [],
			sourceSendType: 10,
		},
		source: {
			system: "mail-service",
			topic: "UAT_RealTimeEmail",
			partition: 0,
			offset: 123456,
			workerVersion: "git-sha-or-image-tag",
		},
	};
}
