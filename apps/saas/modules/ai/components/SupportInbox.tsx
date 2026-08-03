"use client";

import { useActiveOrganization } from "@organizations/hooks/use-active-organization";
import { cn } from "@repo/ui";
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
import { Textarea } from "@repo/ui/components/textarea";
import { toastError, toastSuccess } from "@repo/ui/components/toast";
import type {
	SupportConversation,
	SupportConversationSummary,
	SupportMessage,
} from "@repo/xiaofei";
import { orpcClient } from "@shared/lib/orpc-client";
import {
	ArrowUpIcon,
	BellRingIcon,
	BotIcon,
	BookOpenIcon,
	ExternalLinkIcon,
	LoaderCircleIcon,
	MessageSquareTextIcon,
	UserRoundCheckIcon,
	UsersRoundIcon,
} from "lucide-react";
import Link from "next/link";

import "streamdown/styles.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Streamdown } from "streamdown";

import { filterSupportConversations, nextSelectedConversationId } from "../lib/support-inbox-state";

export function SupportInbox() {
	const { activeOrganization } = useActiveOrganization();
	const [conversations, setConversations] = useState<SupportConversationSummary[]>([]);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [conversation, setConversation] = useState<SupportConversation | null>(null);
	const [conversationOrganizationId, setConversationOrganizationId] = useState<
		string | undefined
	>();
	const [input, setInput] = useState("");
	const [loading, setLoading] = useState(true);
	const [busy, setBusy] = useState(false);
	const [customerFilter, setCustomerFilter] = useState("");
	const [channelFilter, setChannelFilter] = useState("all");
	const [ownerFilter, setOwnerFilter] = useState("all");
	const [statusFilter, setStatusFilter] = useState("all");
	const messagesRef = useRef<HTMLDivElement>(null);
	const activeOrganizationIdRef = useRef(activeOrganization?.id);
	activeOrganizationIdRef.current = activeOrganization?.id;

	const refreshList = useCallback(async () => {
		const requestedOrganizationId = activeOrganizationIdRef.current;
		const items = await orpcClient.xiaofei.listAgentConversations();
		if (activeOrganizationIdRef.current !== requestedOrganizationId) return;
		setConversations(items);
		setSelectedId((current) => current ?? items[0]?.id ?? null);
	}, []);

	const refreshSelected = useCallback(async (conversationId: string) => {
		const requestedOrganizationId = activeOrganizationIdRef.current;
		const nextConversation = await orpcClient.xiaofei.getAgentConversation({ conversationId });
		if (activeOrganizationIdRef.current !== requestedOrganizationId) return;
		setConversation(nextConversation);
		setConversationOrganizationId(requestedOrganizationId);
	}, []);

	useEffect(() => {
		setSelectedId(null);
		setConversation(null);
		setConversationOrganizationId(undefined);
		setConversations([]);
		void refreshList()
			.catch(() => toastError("无法读取客户会话"))
			.finally(() => setLoading(false));
		const interval = globalThis.setInterval(() => {
			void refreshList().catch(() => undefined);
		}, 3_000);
		return () => globalThis.clearInterval(interval);
	}, [activeOrganization?.id, refreshList]);

	useEffect(() => {
		if (!selectedId) {
			setConversation(null);
			setConversationOrganizationId(undefined);
			return;
		}
		void refreshSelected(selectedId).catch(() => toastError("无法读取会话详情"));
		const interval = globalThis.setInterval(() => {
			void refreshSelected(selectedId).catch(() => undefined);
		}, 3_000);
		return () => globalThis.clearInterval(interval);
	}, [refreshSelected, selectedId]);

	useEffect(() => {
		if (messagesRef.current) {
			messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
		}
	}, [conversation?.messages.length]);

	const setOwner = async (owner: "ai" | "human") => {
		if (!conversation) return;
		setBusy(true);
		try {
			const updated = await orpcClient.xiaofei.setAgentConversationOwner({
				conversationId: conversation.id,
				owner,
			});
			setConversation(updated);
			await refreshList();
			toastSuccess(owner === "human" ? "已由真人客服接管" : "已交还小飞");
		} catch {
			toastError("更新接管状态失败");
		} finally {
			setBusy(false);
		}
	};

	const sendMessage = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!conversation || !input.trim()) return;
		const text = input.trim();
		setInput("");
		setBusy(true);
		try {
			const updated = await orpcClient.xiaofei.sendAgentMessage({
				conversationId: conversation.id,
				text,
			});
			setConversation(updated);
			await refreshList();
		} catch {
			setInput(text);
			toastError("客服回复发送失败");
		} finally {
			setBusy(false);
		}
	};
	const filteredConversations = useMemo(
		() =>
			filterSupportConversations(conversations, {
				customer: customerFilter,
				channel: channelFilter,
				owner: ownerFilter,
				status: statusFilter,
			}),
		[conversations, customerFilter, channelFilter, ownerFilter, statusFilter],
	);
	const visibleConversation =
		conversationOrganizationId === activeOrganization?.id ? conversation : null;

	useEffect(() => {
		setSelectedId((current) => nextSelectedConversationId(filteredConversations, current));
	}, [filteredConversations]);

	return (
		<div className="gap-6 flex flex-col">
			<Card>
				<CardContent className="gap-3 sm:flex-row sm:items-center sm:justify-between flex flex-col">
					<div className="gap-3 flex items-center">
						<div className="size-10 flex items-center justify-center rounded-xl bg-primary/10 text-primary">
							<UsersRoundIcon className="size-5" />
						</div>
						<div>
							<p className="font-medium">客服角色工作区</p>
							<p className="text-xs text-muted-foreground">
								查看当前 Organization 的客服会话、接管小飞并发送真人回复。
							</p>
						</div>
					</div>
					<div className="gap-2 flex flex-wrap">
						<Button variant="outline" size="sm" asChild>
							<Link href="/support" target="_blank">
								<ExternalLinkIcon className="mr-2 size-4" />
								打开客户页面
							</Link>
						</Button>
						<Button variant="outline" size="sm" asChild>
							<Link href="/agent-settings">
								<BookOpenIcon className="mr-2 size-4" />
								知识治理
							</Link>
						</Button>
					</div>
				</CardContent>
			</Card>

			<div className="gap-5 lg:grid-cols-[340px_minmax(0,1fr)] grid min-h-[680px]">
				<Card className="min-w-0 overflow-hidden">
					<CardHeader className="border-b">
						<div className="gap-2 flex items-center justify-between">
							<div>
								<CardTitle>客户会话</CardTitle>
								<CardDescription>{filteredConversations.length} 个会话</CardDescription>
							</div>
							<Badge status="info">{conversations.filter((item) => item.online).length} 在线</Badge>
						</div>
					</CardHeader>
					<div className="gap-2 px-4 py-3 sm:grid-cols-2 lg:grid-cols-4 grid border-b">
						<Input
							aria-label="Filter customer"
							value={customerFilter}
							onChange={(event) => setCustomerFilter(event.target.value)}
							placeholder="客户"
						/>
						<select
							aria-label="Filter channel"
							className="px-3 text-sm rounded-md border bg-background"
							value={channelFilter}
							onChange={(event) => setChannelFilter(event.target.value)}
						>
							<option value="all">全部渠道</option>
							{[...new Set(conversations.map((item) => item.channel))].map((channel) => (
								<option key={channel} value={channel}>
									{channel}
								</option>
							))}
						</select>
						<select
							aria-label="Filter owner"
							className="px-3 text-sm rounded-md border bg-background"
							value={ownerFilter}
							onChange={(event) => setOwnerFilter(event.target.value)}
						>
							<option value="all">全部 Owner</option>
							<option value="ai">小飞</option>
							<option value="human">人工</option>
						</select>
						<select
							aria-label="Filter status"
							className="px-3 text-sm rounded-md border bg-background"
							value={statusFilter}
							onChange={(event) => setStatusFilter(event.target.value)}
						>
							<option value="all">全部状态</option>
							<option value="open">Open</option>
							<option value="closed">Closed</option>
						</select>
					</div>
					<CardContent className="p-2 gap-1 flex max-h-[680px] flex-col overflow-y-auto">
						{loading ? (
							<div className="py-20 flex justify-center">
								<LoaderCircleIcon className="size-5 animate-spin text-primary" />
							</div>
						) : filteredConversations.length === 0 ? (
							<div className="px-5 py-20 text-center">
								<MessageSquareTextIcon className="size-8 mb-3 mx-auto text-muted-foreground" />
								<p className="text-sm font-medium">还没有客户会话</p>
								<p className="mt-1 text-xs text-muted-foreground">
									组织级消息接入后，会话会显示在这里供客服处理。
								</p>
							</div>
						) : (
							filteredConversations.map((item) => (
								<ConversationItem
									key={item.id}
									conversation={item}
									selected={item.id === selectedId}
									onSelect={() => setSelectedId(item.id)}
								/>
							))
						)}
					</CardContent>
				</Card>

				<Card className="min-w-0 overflow-hidden">
					{visibleConversation ? (
						<>
							<CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between border-b">
								<div>
									<div className="gap-2 flex flex-wrap items-center">
										<CardTitle>{visibleConversation.customerName}</CardTitle>
										<Badge status={visibleConversation.online ? "success" : "warning"}>
											{visibleConversation.online ? "在线" : "离线"}
										</Badge>
										<OwnerBadge conversation={visibleConversation} />
										{visibleConversation.attentionRequired && (
											<Badge status="warning">
												<BellRingIcon className="mr-1 size-3" />
												待人工关注
											</Badge>
										)}
									</div>
									<CardDescription className="mt-1">
										{visibleConversation.attentionRequired
											? "知识暂未命中；小飞仍在接待并会继续尝试匹配，人工可旁观或主动接管。"
											: visibleConversation.handoffReason
												? `转人工原因：${visibleConversation.handoffReason}`
												: "Organization 消息接入"}
									</CardDescription>
								</div>
								<Button
									size="sm"
									variant={visibleConversation.ownerType === "ai" ? "primary" : "outline"}
									disabled={busy || visibleConversation.status === "closed"}
									onClick={() =>
										void setOwner(visibleConversation.ownerType === "ai" ? "human" : "ai")
									}
								>
									{visibleConversation.ownerType === "ai" ? (
										<UserRoundCheckIcon className="mr-2 size-4" />
									) : (
										<BotIcon className="mr-2 size-4" />
									)}
									{visibleConversation.ownerType === "ai" ? "人工接管" : "交还小飞"}
								</Button>
							</CardHeader>

							<CardContent className="p-0 min-h-0 flex flex-1 flex-col">
								<div
									ref={messagesRef}
									className="gap-4 px-5 py-5 flex h-[520px] flex-col overflow-y-auto"
								>
									{visibleConversation.messages.map((message) => (
										<AgentMessageBubble key={message.id} message={message} />
									))}
								</div>

								<form onSubmit={sendMessage} className="p-4 relative border-t">
									<Textarea
										value={input}
										onChange={(event) => setInput(event.target.value)}
										placeholder={
											visibleConversation.ownerType === "human"
												? "输入真人客服回复…"
												: "请先点击“人工接管”再回复"
										}
										className="min-h-16 pr-14 resize-none"
										disabled={visibleConversation.ownerType !== "human" || busy}
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
										disabled={!input.trim() || busy || visibleConversation.ownerType !== "human"}
										aria-label="发送客服回复"
									>
										{busy ? (
											<LoaderCircleIcon className="size-4 animate-spin" />
										) : (
											<ArrowUpIcon className="size-4" />
										)}
									</Button>
								</form>
							</CardContent>
						</>
					) : (
						<CardContent className="flex min-h-[680px] items-center justify-center">
							<div className="text-center text-muted-foreground">
								<MessageSquareTextIcon className="size-10 mb-3 mx-auto" />
								<p className="text-sm">选择一个客户会话查看详情</p>
							</div>
						</CardContent>
					)}
				</Card>
			</div>
		</div>
	);
}

function ConversationItem({
	conversation,
	selected,
	onSelect,
}: {
	conversation: SupportConversationSummary;
	selected: boolean;
	onSelect: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onSelect}
			className={cn(
				"p-3 w-full rounded-xl border border-transparent text-left transition-colors hover:bg-muted/70",
				selected && "border-border bg-muted",
			)}
		>
			<div className="gap-2 flex items-center justify-between">
				<p className="text-sm font-medium truncate">{conversation.customerName}</p>
				<span
					className={cn(
						"size-2 shrink-0 rounded-full",
						conversation.online ? "bg-success" : "bg-muted-foreground/40",
					)}
					aria-label={conversation.online ? "在线" : "离线"}
				/>
			</div>
			<p className="mt-1 text-[11px] text-muted-foreground">{conversation.channel}</p>
			<p className="mt-1 text-xs truncate text-muted-foreground">
				{conversation.lastMessage ? plainTextMessagePreview(conversation.lastMessage) : "新会话"}
			</p>
			<div className="mt-2 gap-2 flex items-center justify-between">
				<div className="gap-1.5 flex items-center">
					<span className="text-[11px] text-muted-foreground">
						{conversation.ownerType === "ai" ? "小飞接待" : "人工接待"}
					</span>
					{conversation.attentionRequired && (
						<span className="font-medium text-warning text-[11px]">待关注</span>
					)}
				</div>
				<span className="text-[11px] text-muted-foreground">
					{formatListTime(conversation.lastMessageAt ?? conversation.updatedAt)}
				</span>
			</div>
		</button>
	);
}

function plainTextMessagePreview(value: string): string {
	return value
		.replace(/!\[([^\]]*)\]\([^)]*\)/gu, "$1")
		.replace(/\[([^\]]+)\]\([^)]*\)/gu, "$1")
		.replace(/^\s*(?:[-+*]|\d+[.)])\s+/gmu, "")
		.replace(/[*_~`>#]/gu, "")
		.replace(/\s+/gu, " ")
		.trim();
}

function OwnerBadge({ conversation }: { conversation: SupportConversation }) {
	return (
		<Badge status={conversation.ownerType === "ai" ? "info" : "warning"}>
			{conversation.ownerType === "ai"
				? "小飞接待"
				: conversation.assignedUserName
					? `${conversation.assignedUserName} 接待`
					: "等待人工"}
		</Badge>
	);
}

function AgentMessageBubble({ message }: { message: SupportMessage }) {
	const isCustomer = message.role === "customer";
	return (
		<div className={cn("gap-1.5 flex flex-col", isCustomer ? "items-start" : "items-end")}>
			<div className="gap-2 text-xs flex items-center text-muted-foreground">
				<span>{message.authorName}</span>
				<span>{formatListTime(message.createdAt)}</span>
			</div>
			<div
				className={cn(
					"px-4 py-2.5 text-sm leading-6 max-w-[88%] rounded-2xl",
					isCustomer
						? "border bg-muted whitespace-pre-wrap"
						: "prose prose-sm prose-invert bg-primary text-primary-foreground **:max-w-full",
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

function formatListTime(value: string): string {
	return new Intl.DateTimeFormat("zh-CN", {
		month: "numeric",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	}).format(new Date(value));
}
