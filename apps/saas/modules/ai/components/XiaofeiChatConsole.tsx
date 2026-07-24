"use client";

import { Button } from "@repo/ui/components/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@repo/ui/components/card";
import { toastSuccess } from "@repo/ui/components/toast";
import { orpcClient } from "@shared/lib/orpc-client";
import {
	DatabaseIcon,
	NetworkIcon,
	RefreshCcwIcon,
	Settings2Icon,
	ShieldCheckIcon,
	SparklesIcon,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { AiChat } from "./AiChat";

export function XiaofeiChatConsole() {
	const [conversationId, setConversationId] = useState(() => globalThis.crypto.randomUUID());

	const resetChat = async () => {
		try {
			await orpcClient.xiaofei.resetConversation({ conversationId });
		} catch {
			// A missing persisted conversation is equivalent to a reset.
		}
		setConversationId(globalThis.crypto.randomUUID());
		toastSuccess("演示会话已重置");
	};

	return (
		<Card className="min-w-0 overflow-hidden">
			<CardHeader className="gap-4 border-b">
				<div className="gap-3 sm:flex-row sm:items-start sm:justify-between flex flex-col">
					<div>
						<CardTitle>P0 Chatbot 运行验证</CardTitle>
						<CardDescription className="mt-1.5">
							LangGraph 管理会话状态，Mastra Agent 按需生成；回复通过 Guardrail 后才展示。
						</CardDescription>
					</div>
					<div className="gap-2 flex shrink-0">
						<Button variant="outline" size="sm" asChild>
							<Link href="/agent-settings">
								<Settings2Icon className="mr-2 size-4" />
								Agent 设置
							</Link>
						</Button>
						<Button variant="outline" size="sm" onClick={resetChat}>
							<RefreshCcwIcon className="mr-2 size-4" />
							重置会话
						</Button>
					</div>
				</div>
				<div className="gap-2 flex flex-wrap">
					<Capability icon={NetworkIcon} label="LangGraph StateGraph" />
					<Capability icon={SparklesIcon} label="Mastra Agent" />
					<Capability icon={DatabaseIcon} label="Neon State" />
					<Capability icon={ShieldCheckIcon} label="Guardrail" />
				</div>
			</CardHeader>
			<AiChat key={conversationId} conversationId={conversationId} />
		</Card>
	);
}

function Capability({
	icon: Icon,
	label,
}: {
	icon: React.ComponentType<{ className?: string }>;
	label: string;
}) {
	return (
		<span className="gap-1.5 px-2.5 py-1.5 text-xs flex items-center rounded-full bg-muted">
			<Icon className="size-3.5" />
			{label}
		</span>
	);
}
