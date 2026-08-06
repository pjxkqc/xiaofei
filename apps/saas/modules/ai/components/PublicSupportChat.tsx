"use client";

import { cn } from "@repo/ui";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent, CardHeader } from "@repo/ui/components/card";
import { Input } from "@repo/ui/components/input";
import { Textarea } from "@repo/ui/components/textarea";
import { toastError } from "@repo/ui/components/toast";
import type { SupportConversation, SupportMessage } from "@repo/xiaofei";
import { orpcClient } from "@shared/lib/orpc-client";
import {
	ArrowUpIcon,
	BotIcon,
	HeadphonesIcon,
	LoaderCircleIcon,
	LogInIcon,
	MessageCircleMoreIcon,
	RefreshCcwIcon,
	UserRoundIcon,
} from "lucide-react";
import Link from "next/link";

import "streamdown/styles.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { Streamdown } from "streamdown";

const STORAGE_KEY = "xiaofei-public-support-conversation";

export function PublicSupportChat() {
	const [conversation, setConversation] = useState<SupportConversation | null>(null);
	const [customerName, setCustomerName] = useState("");
	const [input, setInput] = useState("");
	const [loading, setLoading] = useState(true);
	const [sending, setSending] = useState(false);
	const [pendingMessage, setPendingMessage] = useState<SupportMessage | null>(null);
	const messagesRef = useRef<HTMLDivElement>(null);
	const conversationId = conversation?.id;

	const refreshConversation = useCallback(async (conversationId: string) => {
		const updated = await orpcClient.xiaofei.getPublicConversation({
			conversationId,
		});
		setConversation((current) => {
			if (globalThis.localStorage.getItem(STORAGE_KEY) !== updated.id) {
				return current;
			}
			if (
				current?.id === updated.id &&
				Date.parse(current.updatedAt) > Date.parse(updated.updatedAt)
			) {
				return current;
			}
			return updated;
		});
	}, []);

	useEffect(() => {
		const conversationId = globalThis.localStorage.getItem(STORAGE_KEY);
		if (!conversationId) {
			setLoading(false);
			return;
		}

		void refreshConversation(conversationId)
			.catch(() => globalThis.localStorage.removeItem(STORAGE_KEY))
			.finally(() => setLoading(false));
	}, [refreshConversation]);

	useEffect(() => {
		if (!conversationId) return;
		const interval = globalThis.setInterval(() => {
			void refreshConversation(conversationId).catch(() => undefined);
		}, 3_000);
		return () => globalThis.clearInterval(interval);
	}, [conversationId, refreshConversation]);

	useEffect(() => {
		if (messagesRef.current) {
			messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
		}
	}, [conversation?.messages.length, pendingMessage, sending]);

	const startConversation = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setSending(true);
		try {
			const created = await orpcClient.xiaofei.startSupportConversation({
				customerName,
			});
			globalThis.localStorage.setItem(STORAGE_KEY, created.id);
			setConversation(created);
		} catch {
			toastError("暂时无法开始会话，请稍后重试");
		} finally {
			setSending(false);
		}
	};

	const sendMessage = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!conversation || !input.trim()) return;
		const text = input.trim();
		const optimisticMessage: SupportMessage = {
			id: `pending-${globalThis.crypto.randomUUID()}`,
			role: "customer",
			authorName: conversation.customerName,
			text,
			createdAt: new Date().toISOString(),
		};
		setInput("");
		setPendingMessage(optimisticMessage);
		setSending(true);
		try {
			const updated = await orpcClient.xiaofei.sendPublicMessage({
				conversationId: conversation.id,
				text,
				expectedRevision: conversation.revision,
				expectedOwnerType: conversation.ownerType,
				expectedOwnerEpoch: conversation.ownerEpoch,
			});
			setConversation(updated);
			setPendingMessage(null);
		} catch {
			setPendingMessage(null);
			setInput(text);
			await refreshConversation(conversation.id).catch(() => undefined);
			toastError("会话状态已变化，请确认最新消息后重试");
		} finally {
			setSending(false);
		}
	};

	const resetConversation = () => {
		globalThis.localStorage.removeItem(STORAGE_KEY);
		setConversation(null);
		setInput("");
	};

	if (loading) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-muted/30">
				<LoaderCircleIcon className="size-6 animate-spin text-primary" />
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-linear-to-b from-primary/5 via-background to-muted/40">
			<header className="px-4 py-4 backdrop-blur border-b bg-background/90">
				<div className="max-w-4xl mx-auto flex items-center justify-between">
					<div className="gap-3 flex items-center">
						<span className="size-10 flex items-center justify-center rounded-2xl bg-primary text-primary-foreground">
							<MessageCircleMoreIcon className="size-5" />
						</span>
						<div>
							<p className="font-semibold">Flyranking 客服</p>
							<p className="text-xs text-muted-foreground">小飞与真人客服协同接待</p>
						</div>
					</div>
					<Button variant="ghost" size="sm" asChild>
						<Link href="/login">
							<LogInIcon className="mr-2 size-4" />
							客服登录
						</Link>
					</Button>
				</div>
			</header>

			<main className="max-w-4xl px-4 py-6 mx-auto">
				{conversation ? (
					<Card className="min-h-[calc(100vh-132px)] overflow-hidden">
						<CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between border-b">
							<div>
								<div className="gap-2 flex flex-wrap items-center">
									<h1 className="font-semibold text-lg">在线咨询</h1>
									<Badge status={conversation.online ? "success" : "warning"}>
										{conversation.online ? "客户在线" : "连接中"}
									</Badge>
									<OwnerBadge conversation={conversation} />
								</div>
								<p className="mt-1 text-xs text-muted-foreground">
									会话会保存在当前浏览器，可随时回来继续。
								</p>
							</div>
							<Button variant="outline" size="sm" onClick={resetConversation}>
								<RefreshCcwIcon className="mr-2 size-4" />
								新会话
							</Button>
						</CardHeader>

						<CardContent className="p-0 min-h-0 flex flex-1 flex-col">
							<div
								ref={messagesRef}
								className="gap-4 px-4 py-5 flex h-[calc(100vh-330px)] min-h-[420px] flex-col overflow-y-auto"
							>
								{conversation.messages.map((message) => (
									<MessageBubble key={message.id} message={message} />
								))}
								{pendingMessage && <MessageBubble message={pendingMessage} pending />}
								{sending && (
									<div className="gap-2 text-sm flex items-center text-muted-foreground">
										<LoaderCircleIcon className="size-4 animate-spin" />
										{conversation.ownerType === "ai" ? "小飞正在处理…" : "正在发送…"}
									</div>
								)}
							</div>

							<form onSubmit={sendMessage} className="p-4 relative border-t bg-background">
								<Textarea
									value={input}
									onChange={(event) => setInput(event.target.value)}
									placeholder={
										conversation.status === "closed"
											? "当前会话已结束"
											: conversation.ownerType === "human"
												? "给真人客服发送消息…"
												: "请描述您遇到的问题…"
									}
									className="min-h-16 pr-14 resize-none"
									disabled={conversation.status === "closed" || sending}
									onKeyDown={(event) => {
										if (event.key === "Enter" && !event.shiftKey) {
											event.preventDefault();
											event.currentTarget.form?.requestSubmit();
										}
									}}
								/>
								<Button
									type="submit"
									size="icon"
									className="right-7 bottom-7 absolute"
									disabled={!input.trim() || sending || conversation.status === "closed"}
									aria-label="发送消息"
								>
									<ArrowUpIcon className="size-4" />
								</Button>
							</form>
						</CardContent>
					</Card>
				) : (
					<div className="py-14 sm:py-24 max-w-xl mx-auto">
						<Card>
							<CardContent className="p-7 sm:p-10 gap-6 flex flex-col">
								<div>
									<div className="size-12 mb-5 flex items-center justify-center rounded-2xl bg-primary/10 text-primary">
										<HeadphonesIcon className="size-6" />
									</div>
									<h1 className="font-semibold text-2xl">您好，有什么可以帮您？</h1>
									<p className="mt-2 text-sm leading-6 text-muted-foreground">
										小飞会先根据已审核知识提供帮助；需要人工处理时，会自动转交真人客服。
									</p>
								</div>
								<form onSubmit={startConversation} className="gap-3 flex flex-col">
									<Input
										value={customerName}
										onChange={(event) => setCustomerName(event.target.value)}
										maxLength={80}
										placeholder="您的称呼（可选）"
										aria-label="您的称呼"
									/>
									<Button type="submit" disabled={sending}>
										{sending && <LoaderCircleIcon className="mr-2 size-4 animate-spin" />}
										开始咨询
									</Button>
								</form>
								<div className="gap-4 sm:grid-cols-2 text-xs grid text-muted-foreground">
									<div className="gap-2 p-3 flex items-start rounded-xl bg-muted/60">
										<BotIcon className="mt-0.5 size-4 shrink-0" />
										<span>小飞处理知识问答与资料收集</span>
									</div>
									<div className="gap-2 p-3 flex items-start rounded-xl bg-muted/60">
										<UserRoundIcon className="mt-0.5 size-4 shrink-0" />
										<span>高风险或复杂问题转真人客服</span>
									</div>
								</div>
							</CardContent>
						</Card>
					</div>
				)}
			</main>
		</div>
	);
}

function OwnerBadge({ conversation }: { conversation: SupportConversation }) {
	return (
		<Badge status={conversation.ownerType === "ai" ? "info" : "warning"}>
			{conversation.ownerType === "ai"
				? "小飞接待"
				: conversation.assignedUserName
					? `${conversation.assignedUserName} 接待`
					: "等待真人客服"}
		</Badge>
	);
}

function MessageBubble({
	message,
	pending = false,
}: {
	message: SupportMessage;
	pending?: boolean;
}) {
	const isCustomer = message.role === "customer";
	return (
		<div className={cn("gap-1.5 flex flex-col", isCustomer ? "items-end" : "items-start")}>
			<div className="gap-2 text-xs flex items-center text-muted-foreground">
				<span>{message.authorName}</span>
				<span>{formatTime(message.createdAt)}</span>
				{pending && <span>发送中</span>}
			</div>
			<div
				className={cn(
					"px-4 py-2.5 text-sm leading-6 max-w-[88%] rounded-2xl",
					isCustomer
						? "bg-primary whitespace-pre-wrap text-primary-foreground"
						: "prose prose-sm dark:prose-invert border bg-muted **:max-w-full",
					pending && "opacity-80",
				)}
			>
				{isCustomer ? (
					message.text
				) : (
					<Streamdown className="wrap-break-words">{message.text}</Streamdown>
				)}
			</div>
		</div>
	);
}

function formatTime(value: string): string {
	return new Intl.DateTimeFormat("zh-CN", {
		hour: "2-digit",
		minute: "2-digit",
	}).format(new Date(value));
}
