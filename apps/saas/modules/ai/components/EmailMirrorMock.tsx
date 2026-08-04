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
import { orpcClient } from "@shared/lib/orpc-client";
import { CopyIcon, ExternalLinkIcon, RefreshCwIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

interface Binding {
	id: string;
	companyId: string;
	channelAccountId: string;
	address: string;
	status: "active" | "disabled";
}
type Scenario =
	| "inbound_customer"
	| "outbound_loopdesk"
	| "outbound_xiaofei"
	| "duplicate"
	| "payload_conflict"
	| "missing_binding"
	| "disabled_binding";

const SCENARIOS: Array<{ value: Scenario; label: string; detail: string }> = [
	{
		value: "inbound_customer",
		label: "客户入站（推荐）",
		detail: "创建客户、会话、消息和待处理任务",
	},
	{ value: "outbound_loopdesk", label: "LoopDesk 已发送", detail: "只补充上下文，不创建任务" },
	{ value: "outbound_xiaofei", label: "小飞回声", detail: "只补充上下文，验证不会自循环" },
	{ value: "duplicate", label: "同事件重投", detail: "第一次 accepted，第二次 duplicate" },
	{ value: "payload_conflict", label: "幂等冲突", detail: "同 eventId 改正文，安全拒绝" },
	{ value: "missing_binding", label: "无绑定", detail: "验证未知 company fail closed" },
	{ value: "disabled_binding", label: "已禁用绑定", detail: "验证暂停接入" },
];

export function EmailMirrorMock() {
	const [bindings, setBindings] = useState<Binding[]>([]);
	const [selected, setSelected] = useState("");
	const [scenario, setScenario] = useState<Scenario>("inbound_customer");
	const [notice, setNotice] = useState("");
	const [customerEmail, setCustomerEmail] = useState("customer.preview@example.com");
	const [subject, setSubject] = useState("C-Air Mini room recommendation");
	const [text, setText] = useState("20㎡ room, Wi-Fi required. Which model fits?");
	const [eventId, setEventId] = useState(() => makeEventId());
	const [conversationSuffix, setConversationSuffix] = useState("customer-preview-demo");
	const [running, setRunning] = useState(false);
	const [lastConversationId, setLastConversationId] = useState<string | null>(null);
	useEffect(() => {
		void (async () => {
			try {
				const result = (await orpcClient.xiaofei.listEmailBindings()) as { items: Binding[] };
				setBindings(result.items);
				setSelected(
					(result.items.find((item) => item.status === "active") ?? result.items[0])?.id ?? "",
				);
			} catch {
				setNotice("无法读取当前 Organization 的 Email 绑定。");
			}
		})();
	}, []);
	const selectedBinding = bindings.find((item) => item.id === selected);
	const externalConversationId = selectedBinding
		? `email:${selectedBinding.companyId}:${conversationSuffix}`
		: "email:<companyId>:customer-preview-demo";
	const preview = useMemo(
		() =>
			selectedBinding
				? makeWorkerPreview({
						binding: selectedBinding,
						externalConversationId,
						eventId,
						customerEmail,
						subject,
						text,
					})
				: null,
		[selectedBinding, externalConversationId, eventId, customerEmail, subject, text],
	);
	function regenerate() {
		setEventId(makeEventId());
		setConversationSuffix(`customer-${crypto.randomUUID().slice(0, 8)}`);
		setLastConversationId(null);
		setNotice("已生成新的 eventId 与会话 ID；重投场景会在一次运行中复用同一组值。");
	}
	async function run() {
		const binding =
			scenario === "disabled_binding"
				? bindings.find((item) => item.status === "disabled")
				: selectedBinding?.status === "active"
					? selectedBinding
					: bindings.find((item) => item.status === "active");
		if (!binding) {
			setNotice(
				scenario === "disabled_binding"
					? "请先在邮箱绑定页创建并禁用一个绑定。"
					: "请先创建或选择一个启用的邮箱绑定。",
			);
			return;
		}
		const input = {
			companyId: scenario === "missing_binding" ? "missing-company" : binding.companyId,
			channelAccountId: binding.channelAccountId,
			address: binding.address,
			externalConversationId: `email:${scenario === "missing_binding" ? "missing-company" : binding.companyId}:${conversationSuffix}`,
			eventId,
			occurredAt: new Date().toISOString(),
			scenario:
				scenario === "outbound_loopdesk" || scenario === "outbound_xiaofei"
					? scenario
					: ("inbound_customer" as const),
			customerEmail,
			subject: subject.trim() || null,
			text,
		};
		setRunning(true);
		setLastConversationId(null);
		try {
			const first = await orpcClient.xiaofei.runMockEmailMirror(input);
			if (scenario === "duplicate") {
				const duplicate = await orpcClient.xiaofei.runMockEmailMirror(input);
				setNotice(
					`通过：第一次 ${first.status}，重投 ${duplicate.status}；仍是同一个任务 ${duplicate.jobId ?? "none"}。`,
				);
				setLastConversationId(input.externalConversationId);
				return;
			}
			if (scenario === "payload_conflict")
				await orpcClient.xiaofei.runMockEmailMirror({ ...input, text: `${text} changed` });
			setNotice(
				`通过：${first.status}；${first.jobId ? `已创建待处理任务 ${first.jobId}` : "没有创建处理任务"}。`,
			);
			setLastConversationId(input.externalConversationId);
		} catch {
			setNotice(
				["payload_conflict", "missing_binding", "disabled_binding"].includes(scenario)
					? `通过：${scenarioLabel(scenario)}被安全拒绝，没有产生额外业务记录。`
					: "投递失败，请检查绑定和表单字段。",
			);
		} finally {
			setRunning(false);
		}
	}
	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<div className="gap-3 sm:flex-row sm:items-start sm:justify-between flex flex-col">
						<div>
							<CardTitle>Worker 入站模拟</CardTitle>
							<CardDescription className="mt-1">
								使用真实 Email Mirror 服务层，但不暴露 S2S Token，也不发 HTTP 回环。
							</CardDescription>
						</div>
						<Button variant="outline" onClick={regenerate}>
							<RefreshCwIcon className="mr-2 size-4" />
							新建一组测试 ID
						</Button>
					</div>
				</CardHeader>
				<CardContent className="space-y-5">
					<div className="gap-4 md:grid-cols-2 grid">
						<div className="space-y-1.5">
							<Label htmlFor="mirror-binding">当前 Organization 邮箱绑定</Label>
							<select
								id="mirror-binding"
								className="h-10 px-3 w-full rounded-md border bg-background"
								value={selected}
								onChange={(event) => setSelected(event.target.value)}
							>
								{bindings.map((binding) => (
									<option key={binding.id} value={binding.id}>
										{binding.companyId} · {binding.address} · {binding.status}
									</option>
								))}
							</select>
						</div>
						<div className="space-y-1.5">
							<Label htmlFor="mirror-scenario">要验证的场景</Label>
							<select
								id="mirror-scenario"
								className="h-10 px-3 w-full rounded-md border bg-background"
								value={scenario}
								onChange={(event) => setScenario(event.target.value as Scenario)}
							>
								{SCENARIOS.map((item) => (
									<option key={item.value} value={item.value}>
										{item.label}
									</option>
								))}
							</select>
							<p className="text-xs text-muted-foreground">
								{SCENARIOS.find((item) => item.value === scenario)?.detail}
							</p>
						</div>
					</div>
					<div className="gap-4 md:grid-cols-2 grid">
						<Field label="客户邮箱" id="mirror-customer-email">
							<Input
								id="mirror-customer-email"
								value={customerEmail}
								onChange={(event) => setCustomerEmail(event.target.value)}
							/>
						</Field>
						<Field label="邮件主题" id="mirror-subject">
							<Input
								id="mirror-subject"
								value={subject}
								onChange={(event) => setSubject(event.target.value)}
							/>
						</Field>
						<Field label="eventId（重复投递必须不变）" id="mirror-event-id">
							<Input
								id="mirror-event-id"
								value={eventId}
								onChange={(event) => setEventId(event.target.value)}
							/>
						</Field>
						<Field label="会话 ID 后缀" id="mirror-conversation-suffix">
							<Input
								id="mirror-conversation-suffix"
								value={conversationSuffix}
								onChange={(event) => setConversationSuffix(event.target.value)}
							/>
						</Field>
					</div>
					<Field label="邮件正文" id="mirror-body">
						<Textarea
							id="mirror-body"
							className="min-h-24"
							value={text}
							onChange={(event) => setText(event.target.value)}
						/>
					</Field>
					<div className="gap-3 flex flex-wrap items-center">
						<Button onClick={() => void run()} disabled={!selected || running || !text.trim()}>
							{running ? "正在投递…" : "投递并创建会话"}
						</Button>
						<Button variant="outline" asChild>
							<Link href="/integrations/email-bindings">管理邮箱绑定</Link>
						</Button>
						{lastConversationId ? (
							<Button variant="secondary" asChild>
								<Link href="/inbox">
									<ExternalLinkIcon className="mr-2 size-4" />去 Inbox 查看并处理
								</Link>
							</Button>
						) : null}
					</div>
					{notice ? (
						<p aria-live="polite" className="text-sm text-muted-foreground">
							{notice}
						</p>
					) : null}
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<div className="gap-3 sm:flex-row sm:items-center sm:justify-between flex flex-col">
						<div>
							<CardTitle>同事实际要发送的 JSON</CardTitle>
							<CardDescription>Mock 表单会映射成同一份 email.message.v1 业务结构。</CardDescription>
						</div>
						{preview ? (
							<Button
								variant="outline"
								onClick={() => void navigator.clipboard.writeText(JSON.stringify(preview, null, 2))}
							>
								<CopyIcon className="mr-2 size-4" />
								复制 JSON
							</Button>
						) : null}
					</div>
				</CardHeader>
				<CardContent>
					<div className="mb-3 gap-2 flex flex-wrap">
						<Badge status="info">POST /api/xiaofei/integrations/v1/email/messages</Badge>
						<Badge status="info">Idempotency-Key: {eventId}</Badge>
					</div>
					<pre className="p-4 text-xs max-h-[520px] overflow-auto rounded-lg bg-muted">
						{preview ? JSON.stringify(preview, null, 2) : "请先创建邮箱绑定。"}
					</pre>
				</CardContent>
			</Card>
		</div>
	);
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
	return (
		<div className="space-y-1.5">
			<Label htmlFor={id}>{label}</Label>
			{children}
		</div>
	);
}

function makeEventId() {
	return `mock:email:${crypto.randomUUID()}`;
}

function scenarioLabel(value: Scenario) {
	return SCENARIOS.find((item) => item.value === value)?.label ?? value;
}

function makeWorkerPreview(input: {
	binding: Binding;
	externalConversationId: string;
	eventId: string;
	customerEmail: string;
	subject: string;
	text: string;
}) {
	const occurredAt = new Date().toISOString();
	return {
		schemaVersion: "email.message.v1",
		eventId: input.eventId,
		occurredAt,
		tenant: { companyId: input.binding.companyId },
		channel: "email",
		channelAccount: { id: input.binding.channelAccountId, address: input.binding.address },
		conversation: { externalId: input.externalConversationId, loopdeskSessionId: null },
		message: {
			sourceMessageId: `email:${input.eventId}`,
			providerMessageId: null,
			replyToSourceMessageId: null,
			direction: "inbound",
			senderType: "customer",
			from: { address: input.customerEmail, name: "Preview Customer" },
			to: [{ address: input.binding.address, name: null }],
			subject: input.subject || null,
			content: { type: "text/plain", value: input.text },
			attachments: [],
			sentAt: occurredAt,
			labels: [],
			sourceSendType: 10,
		},
		source: {
			system: "mail-service",
			topic: "UAT_RealTimeEmail",
			partition: 0,
			offset: 123456,
			workerVersion: "preview-worker",
		},
	};
}
