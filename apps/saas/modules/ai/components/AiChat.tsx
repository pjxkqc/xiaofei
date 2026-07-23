"use client";

import { useChat } from "@ai-sdk/react";
import { eventIteratorToStream } from "@orpc/client";
import { cn } from "@repo/ui";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Textarea } from "@repo/ui/components/textarea";
import { toastError } from "@repo/ui/components/toast";
import type { RuntimeMetadata } from "@repo/xiaofei";
import { orpcClient } from "@shared/lib/orpc-client";
import type { UIMessage } from "ai";
import {
	ArrowUpIcon,
	BotIcon,
	EllipsisIcon,
	PackageSearchIcon,
	ShieldCheckIcon,
	UserRoundCheckIcon,
} from "lucide-react";

import "streamdown/styles.css";
import { useEffect, useRef, useState } from "react";
import { Streamdown } from "streamdown";

type XiaofeiDataParts = Record<string, RuntimeMetadata> & {
	"xiaofei-runtime": RuntimeMetadata;
};
type XiaofeiUIMessage = UIMessage<unknown, XiaofeiDataParts>;

const PROMPT_SUGGESTIONS = [
	{
		icon: BotIcon,
		text: "了解服务范围",
		prompt: "你们能处理哪些售后问题？",
	},
	{
		icon: PackageSearchIcon,
		text: "演示破损资料收集",
		prompt: "我收到的杯子碎了，想处理一下",
	},
	{
		icon: ShieldCheckIcon,
		text: "演示高风险退出",
		prompt: "我要投诉你们，马上给我退款",
	},
] as const;

export function AiChat({ conversationId }: { conversationId: string }) {
	const [input, setInput] = useState("");
	const messagesContainerRef = useRef<HTMLDivElement>(null);

	const { messages, status, sendMessage } = useChat<XiaofeiUIMessage>({
		id: conversationId,
		transport: {
			async sendMessages(options) {
				return eventIteratorToStream(
					await orpcClient.ai.stream(
						{
							conversationId,
							messages: options.messages,
						},
						{ signal: options.abortSignal },
					),
				);
			},
			reconnectToStream() {
				throw new Error("Unsupported");
			},
		},
	});

	const handleSubmit = async (
		event: React.FormEvent<HTMLFormElement> | React.KeyboardEvent<HTMLTextAreaElement>,
	) => {
		event.preventDefault();
		const text = input.trim();
		if (!text) return;
		setInput("");

		try {
			await sendMessage({ text });
		} catch {
			toastError("消息发送失败");
			setInput(text);
		}
	};

	useEffect(() => {
		if (messagesContainerRef.current) {
			messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
		}
	}, [messages.length, status]);

	return (
		<div className="flex min-h-[680px] flex-col">
			<div
				ref={messagesContainerRef}
				className="gap-4 px-5 py-5 flex flex-1 flex-col overflow-y-auto"
			>
				{messages.length === 0 && (
					<div className="gap-5 flex flex-1 flex-col items-center justify-center">
						<div className="max-w-md text-center">
							<p className="font-medium">验证 P0 运行闭环</p>
							<p className="mt-1 text-sm text-muted-foreground">
								尝试知识问答、跨轮资料收集或高风险人工转接。
							</p>
						</div>
						<div className="gap-3 grid w-full grid-cols-1">
							{PROMPT_SUGGESTIONS.map((suggestion) => {
								const Icon = suggestion.icon;
								return (
									<Button
										key={suggestion.prompt}
										type="button"
										variant="outline"
										onClick={async () => {
											try {
												await sendMessage({ text: suggestion.prompt });
											} catch {
												toastError("消息发送失败");
											}
										}}
										disabled={status === "streaming" || status === "submitted"}
										className="group gap-3 p-4 h-auto justify-start rounded-2xl bg-card text-left"
									>
										<Icon className="size-5 shrink-0 text-primary" />
										<span className="text-sm text-foreground">{suggestion.text}</span>
									</Button>
								);
							})}
						</div>
					</div>
				)}

				{messages.map((message) => (
					<div
						key={message.id}
						className={cn(
							"gap-2 flex flex-col",
							message.role === "user" ? "items-end" : "items-start",
						)}
					>
						{message.parts.map((part, index) => {
							if (part.type === "data-xiaofei-runtime") {
								return <RuntimeEvidence key={`${message.id}-runtime-${index}`} data={part.data} />;
							}
							if (part.type !== "text") return null;
							return (
								<div
									key={`${message.id}-text-${index}`}
									className={cn(
										"gap-2 px-4 py-2.5 max-w-[90%] rounded-xl text-foreground **:max-w-full",
										message.role === "user"
											? "bg-primary/10 whitespace-pre-wrap"
											: "prose prose-sm dark:prose-invert bg-muted",
									)}
								>
									{message.role === "user" ? (
										<span>{part.text}</span>
									) : (
										<Streamdown
											animated
											isAnimating={status === "streaming"}
											className="wrap-break-words"
										>
											{part.text}
										</Streamdown>
									)}
								</div>
							);
						})}
					</div>
				))}

				{(status === "streaming" || status === "submitted") && (
					<div className="flex justify-start">
						<div className="px-4 py-2 rounded-xl bg-muted text-foreground">
							<EllipsisIcon className="size-5 animate-pulse" />
						</div>
					</div>
				)}
			</div>

			<form
				onSubmit={handleSubmit}
				className="m-4 mt-0 text-lg relative shrink-0 rounded-2xl bg-card focus-within:ring focus-within:ring-primary focus-within:outline-none"
			>
				<Textarea
					value={input}
					onChange={(event) => setInput(event.target.value)}
					placeholder="输入客户消息，验证 KU、状态、Guardrail 和 Handoff…"
					className="min-h-8 p-5 pr-14 rounded-2xl border bg-card shadow-none focus:outline-hidden focus-visible:ring-0"
					onKeyDown={async (event) => {
						if (event.key === "Enter" && !event.shiftKey) {
							event.preventDefault();
							await handleSubmit(event);
						}
					}}
				/>
				<Button
					type="submit"
					size="icon"
					variant="primary"
					className="right-3 bottom-3 absolute"
					disabled={!input.trim() || status === "streaming" || status === "submitted"}
				>
					<ArrowUpIcon className="size-4" />
				</Button>
			</form>
		</div>
	);
}

function RuntimeEvidence({ data }: { data: RuntimeMetadata }) {
	const latestTraces = data.traces.slice(-3);
	return (
		<div className="p-3 text-xs w-full max-w-[94%] rounded-xl border bg-card">
			<div className="gap-2 flex flex-wrap items-center">
				<Badge>{data.runtime === "langgraph" ? "LangGraph" : "Mastra"}</Badge>
				<Badge status={data.ownerType === "ai" ? "success" : "warning"}>
					{data.ownerType === "ai" ? "AI 托管" : "人工接管"}
				</Badge>
				<Badge status={data.riskLevel === "high" ? "error" : "info"}>{data.nextAction}</Badge>
				{data.knowledgeTitle && (
					<span className="text-muted-foreground">KU · {data.knowledgeTitle}</span>
				)}
			</div>
			<div className="mt-3 gap-1.5 flex flex-col text-muted-foreground">
				{latestTraces.map((trace) => (
					<div key={trace.id} className="gap-2 flex items-start">
						<UserRoundCheckIcon className="mt-0.5 size-3.5 shrink-0" />
						<span>
							{trace.title}
							{trace.detail ? ` · ${trace.detail}` : ""}
						</span>
					</div>
				))}
			</div>
		</div>
	);
}
