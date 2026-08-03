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
import { orpcClient } from "@shared/lib/orpc-client";
import { ExternalLinkIcon, RefreshCwIcon, SendIcon } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

interface DeliverySettings {
	mode: "mock" | "webhook";
	callbackUrl: string | null;
	canManage: boolean;
	builtInMockPath: string;
}

interface DeliverySummary {
	id: string;
	conversationId: string;
	processingJobId: string | null;
	eventType: string;
	senderType: string;
	destinationMode: string;
	destination: string;
	status: string;
	attempts: number;
	responseStatus: number | null;
	lastError: string | null;
	firstAttemptAt: Date | string | null;
	deliveredAt: Date | string | null;
	createdAt: Date | string;
	updatedAt: Date | string;
}

export function EmailDeliveryManager() {
	const [settings, setSettings] = useState<DeliverySettings | null>(null);
	const [mode, setMode] = useState<"mock" | "webhook">("mock");
	const [callbackUrl, setCallbackUrl] = useState("");
	const [items, setItems] = useState<DeliverySummary[]>([]);
	const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
	const [origin, setOrigin] = useState("https://<xiaofei-host>");
	const [notice, setNotice] = useState("正在加载回递设置与 Outbox…");
	const [busy, setBusy] = useState(false);
	const load = useCallback(async () => {
		try {
			const [nextSettings, deliveries] = await Promise.all([
				orpcClient.xiaofei.getEmailDeliverySettings(),
				orpcClient.xiaofei.listEmailOutboundDeliveries(),
			]);
			setSettings(nextSettings as DeliverySettings);
			setMode(nextSettings.mode);
			setCallbackUrl(nextSettings.callbackUrl ?? "");
			setItems(deliveries as DeliverySummary[]);
			setNotice("");
		} catch {
			setNotice("无法读取 Email 回递配置。");
		}
	}, []);
	useEffect(() => {
		setOrigin(window.location.origin);
		void load();
	}, [load]);
	async function save() {
		setBusy(true);
		try {
			await orpcClient.xiaofei.saveEmailDeliverySettings({
				mode,
				callbackUrl: mode === "webhook" ? callbackUrl.trim() : null,
			});
			setNotice(mode === "mock" ? "已启用内置 Receiver Mock。" : "真实 Receiver 地址已保存。");
			await load();
		} catch {
			setNotice("保存失败：请使用可公开解析的 HTTPS 地址，且不要包含账号、查询参数或片段。");
		} finally {
			setBusy(false);
		}
	}
	async function testCallback() {
		setBusy(true);
		try {
			const result = await orpcClient.xiaofei.sendEmailCallbackTest();
			setNotice(`状态测试已写入 Outbox：${result.deliveryId} · ${result.status}。`);
			await load();
		} catch {
			setNotice("测试失败：请先完成一条 Email 入站 Mock，并检查当前 Receiver 设置。");
		} finally {
			setBusy(false);
		}
	}
	async function showDetail(id: string) {
		try {
			setDetail(
				(await orpcClient.xiaofei.getEmailOutboundDelivery({ id })) as Record<string, unknown>,
			);
		} catch {
			setNotice("无法读取该回递 payload。");
		}
	}
	async function retry(id: string) {
		setBusy(true);
		try {
			const result = await orpcClient.xiaofei.retryEmailOutboundDelivery({ id });
			setNotice(`已使用当前 Receiver 设置重试：${result.status}。`);
			await load();
		} catch {
			setNotice("重试失败；已成功的回递不会重复发送。");
		} finally {
			setBusy(false);
		}
	}

	return (
		<div className="space-y-6">
			<div className="gap-6 xl:grid-cols-[minmax(0,1fr)_360px] grid">
				<Card>
					<CardHeader>
						<CardTitle>Receiver 设置</CardTitle>
						<CardDescription>
							先选内置 Mock 验证 payload；同事接口完成后切换为真实 HTTPS 地址。
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-5">
						<div className="gap-3 sm:grid-cols-2 grid">
							<button
								type="button"
								onClick={() => setMode("mock")}
								className={`p-4 rounded-xl border text-left ${mode === "mock" ? "border-primary bg-primary/5" : ""}`}
							>
								<p className="text-sm font-medium">内置 Receiver Mock</p>
								<p className="mt-1 text-xs text-muted-foreground">
									不访问外部网络；同样校验完整回递契约并记录 Outbox。
								</p>
							</button>
							<button
								type="button"
								onClick={() => setMode("webhook")}
								className={`p-4 rounded-xl border text-left ${mode === "webhook" ? "border-primary bg-primary/5" : ""}`}
							>
								<p className="text-sm font-medium">同事的真实 Receiver</p>
								<p className="mt-1 text-xs text-muted-foreground">
									服务端 POST；超时或非 2xx 会保留为 failed。
								</p>
							</button>
						</div>
						<div className="space-y-1.5">
							<Label htmlFor="email-callback-url">回递 API 地址</Label>
							<Input
								id="email-callback-url"
								value={
									mode === "mock" ? `${origin}${settings?.builtInMockPath ?? ""}` : callbackUrl
								}
								onChange={(event) => setCallbackUrl(event.target.value)}
								disabled={mode === "mock" || !settings?.canManage}
								placeholder="https://worker-uat.example.com/api/xiaofei/replies"
							/>
							<p className="text-xs text-muted-foreground">
								P0 仅接受公开 HTTPS；不支持 URL 内密钥。Receiver 鉴权将在双方冻结方式后单独增加。
							</p>
						</div>
						<div className="gap-2 flex flex-wrap">
							{settings?.canManage ? (
								<Button onClick={() => void save()} disabled={busy}>
									保存 Receiver 设置
								</Button>
							) : (
								<Badge status="warning">仅 Owner / Admin 可修改</Badge>
							)}
							<Button
								variant="secondary"
								onClick={() => void testCallback()}
								disabled={busy || !settings?.canManage}
							>
								<SendIcon className="mr-2 size-4" />
								发送状态测试
							</Button>
							<Button variant="outline" asChild>
								<Link href="/inbox">
									<ExternalLinkIcon className="mr-2 size-4" />去 Inbox 生成真实回复
								</Link>
							</Button>
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
						<CardTitle>Receiver 最小实现</CardTitle>
						<CardDescription>同事只需按 deliveryId 幂等保存，然后返回 2xx。</CardDescription>
					</CardHeader>
					<CardContent className="space-y-3 text-sm">
						<pre className="p-4 text-xs overflow-auto rounded-lg bg-muted">{`POST /api/xiaofei/replies\nContent-Type: application/json\nIdempotency-Key: <deliveryId>\n\n200 OK\n{\n  "status": "accepted",\n  "deliveryId": "<same deliveryId>",\n  "receivedAt": "<ISO 8601>"\n}`}</pre>
						<p className="text-muted-foreground">
							不要在同步响应中等待发邮件；Receiver 应先可靠保存，再由自己的发送任务处理。
						</p>
					</CardContent>
				</Card>
			</div>

			<Card>
				<CardHeader>
					<div className="gap-3 sm:flex-row sm:items-center sm:justify-between flex flex-col">
						<div>
							<CardTitle>回复 Outbox</CardTitle>
							<CardDescription>点击一行查看完整、Organization-scoped 的回递结构。</CardDescription>
						</div>
						<Button variant="outline" onClick={() => void load()}>
							<RefreshCwIcon className="mr-2 size-4" />
							刷新
						</Button>
					</div>
				</CardHeader>
				<CardContent>
					<div className="divide-y rounded-lg border">
						{items.length ? (
							items.map((item) => (
								<div
									key={item.id}
									className="gap-3 p-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_120px_100px_160px] grid items-center"
								>
									<button
										type="button"
										className="text-left"
										onClick={() => void showDetail(item.id)}
									>
										<p className="font-mono text-xs break-all">{item.id}</p>
										<p className="mt-1 text-xs text-muted-foreground">{item.eventType}</p>
									</button>
									<div className="text-sm">
										<p>{item.destination}</p>
										<p className="text-xs text-muted-foreground">{item.senderType}</p>
									</div>
									<Badge
										status={
											item.status === "delivered"
												? "success"
												: item.status === "failed"
													? "warning"
													: "info"
										}
									>
										{deliveryStatusLabel(item.status)}
									</Badge>
									<span className="text-xs text-muted-foreground">
										{item.attempts} 次 · HTTP {item.responseStatus ?? "—"}
									</span>
									<div className="gap-2 flex items-center justify-end">
										<span className="text-xs text-muted-foreground">
											{formatDateTime(item.createdAt)}
										</span>
										{item.status !== "delivered" ? (
											<Button
												size="sm"
												variant="outline"
												disabled={busy}
												onClick={() => void retry(item.id)}
											>
												重试
											</Button>
										) : null}
									</div>
									{item.lastError ? (
										<p className="lg:col-span-5 text-xs text-warning">{item.lastError}</p>
									) : null}
								</div>
							))
						) : (
							<p className="p-8 text-sm text-center text-muted-foreground">
								暂无回递。先发送状态测试，或在 Inbox 处理一条 Email。
							</p>
						)}
					</div>
				</CardContent>
			</Card>

			{detail ? (
				<Card>
					<CardHeader>
						<CardTitle>回递 payload</CardTitle>
						<CardDescription>此处包含消息正文，只在主动选择后加载。</CardDescription>
					</CardHeader>
					<CardContent>
						<pre className="p-4 text-xs max-h-[520px] overflow-auto rounded-lg bg-muted">
							{JSON.stringify(detail, null, 2)}
						</pre>
					</CardContent>
				</Card>
			) : null}
		</div>
	);
}

function deliveryStatusLabel(value: string) {
	return { pending: "待发送", delivered: "已送达", failed: "失败" }[value] ?? value;
}

function formatDateTime(value: Date | string) {
	const date = value instanceof Date ? value : new Date(value);
	return new Intl.DateTimeFormat("zh-CN", {
		month: "numeric",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	}).format(date);
}
