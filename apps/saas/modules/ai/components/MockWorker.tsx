"use client";

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
import { orpcClient } from "@shared/lib/orpc-client";
import { useState } from "react";

export function MockWorker() {
	const [merchant, setMerchant] = useState("");
	const [customer, setCustomer] = useState("mock-customer-1");
	const [channel, setChannel] = useState<"email" | "whatsapp">("email");
	const [conversation, setConversation] = useState("mock-conversation-1");
	const [message, setMessage] = useState(crypto.randomUUID());
	const [title, setTitle] = useState("Mock inbound message");
	const [text, setText] = useState("您好，我需要帮助。 ");
	const [notice, setNotice] = useState("");
	const [isPending, setIsPending] = useState(false);
	async function submit() {
		if (isPending) return;
		setIsPending(true);
		setNotice("Sending mock inbound message…");
		try {
			const result = await orpcClient.xiaofei.runMockWorker({
				externalMerchantId: merchant,
				externalCustomerId: customer,
				channel,
				externalConversationId: conversation,
				externalMessageId: message,
				title: title || undefined,
				text,
			});
			setNotice(`Worker completed: ${result.outcome}. Check Events, Customers, and Inbox.`);
		} catch {
			setNotice(
				"Worker could not accept this message. Verify the active Organization merchant ID.",
			);
		} finally {
			setIsPending(false);
		}
	}
	return (
		<Card>
			<CardHeader>
				<CardTitle>Organization Mock Worker</CardTitle>
				<CardDescription>
					Runs an Email or WhatsApp inbound loop using the active Organization. The server resolves
					the merchant and workspace.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-3">
				<div className="gap-3 md:grid-cols-2 grid">
					<Input
						disabled={isPending}
						value={merchant}
						onChange={(event) => setMerchant(event.target.value)}
						placeholder="externalMerchantId"
					/>
					<Input
						disabled={isPending}
						value={customer}
						onChange={(event) => setCustomer(event.target.value)}
						placeholder="externalCustomerId"
					/>
					<select
						className="px-3 rounded-md border bg-background"
						disabled={isPending}
						value={channel}
						onChange={(event) => setChannel(event.target.value as "email" | "whatsapp")}
					>
						<option value="email">Email</option>
						<option value="whatsapp">WhatsApp</option>
					</select>
					<Input
						disabled={isPending}
						value={conversation}
						onChange={(event) => setConversation(event.target.value)}
						placeholder="externalConversationId"
					/>
					<Input
						disabled={isPending}
						value={message}
						onChange={(event) => setMessage(event.target.value)}
						placeholder="externalMessageId"
					/>
					<Input
						disabled={isPending}
						value={title}
						onChange={(event) => setTitle(event.target.value)}
						placeholder="Title (Email)"
					/>
				</div>
				<Textarea
					value={text}
					disabled={isPending}
					onChange={(event) => setText(event.target.value)}
					placeholder="Message text"
				/>
				<Button
					disabled={isPending || !merchant || !customer || !conversation || !message || !text}
					onClick={() => void submit()}
				>
					{isPending ? "Sending…" : "Run mock inbound"}
				</Button>
				{notice ? (
					<p aria-live="polite" className="text-sm text-muted-foreground">
						{notice}
					</p>
				) : null}
			</CardContent>
		</Card>
	);
}
