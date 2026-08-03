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
import { orpcClient } from "@shared/lib/orpc-client";
import { useEffect, useState } from "react";

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

export function EmailMirrorMock() {
	const [bindings, setBindings] = useState<Binding[]>([]);
	const [selected, setSelected] = useState("");
	const [scenario, setScenario] = useState<Scenario>("inbound_customer");
	const [notice, setNotice] = useState("");
	const [text, setText] = useState("Mock email body");
	const [running, setRunning] = useState(false);
	useEffect(() => {
		void (async () => {
			try {
				const result = (await orpcClient.xiaofei.listEmailBindings()) as { items: Binding[] };
				setBindings(result.items);
				setSelected(
					(result.items.find((item) => item.status === "active") ?? result.items[0])?.id ?? "",
				);
			} catch {
				setNotice("Unable to load Organization Email bindings.");
			}
		})();
	}, []);
	async function run() {
		const selectedBinding = bindings.find((item) => item.id === selected);
		const binding =
			scenario === "disabled_binding"
				? bindings.find((item) => item.status === "disabled")
				: selectedBinding?.status === "active"
					? selectedBinding
					: bindings.find((item) => item.status === "active");
		if (!binding) {
			setNotice(
				scenario === "disabled_binding"
					? "Create and disable an Organization binding before running this scenario."
					: "Create or select an active Organization binding first.",
			);
			return;
		}
		const eventId = `mock:email:${crypto.randomUUID()}`;
		const input = {
			companyId: scenario === "missing_binding" ? "missing-company" : binding.companyId,
			channelAccountId: binding.channelAccountId,
			address: binding.address,
			externalConversationId: `email:${binding.companyId}:mock-${crypto.randomUUID()}`,
			eventId,
			scenario:
				scenario === "outbound_loopdesk" || scenario === "outbound_xiaofei"
					? scenario
					: ("inbound_customer" as const),
			text,
		};
		setRunning(true);
		try {
			const first = await orpcClient.xiaofei.runMockEmailMirror(input);
			if (scenario === "duplicate") {
				const duplicate = await orpcClient.xiaofei.runMockEmailMirror(input);
				setNotice(
					`First: ${first.status}; replay: ${duplicate.status}; job: ${duplicate.jobId ?? "none"}.`,
				);
				return;
			}
			if (scenario === "payload_conflict")
				await orpcClient.xiaofei.runMockEmailMirror({ ...input, text: `${text} changed` });
			setNotice(`Mirror result: ${first.status}; job: ${first.jobId ?? "none"}.`);
		} catch {
			setNotice(`Expected observable ${scenario} outcome: request rejected safely.`);
		} finally {
			setRunning(false);
		}
	}
	return (
		<Card>
			<CardHeader>
				<CardTitle>Email mirror mock</CardTitle>
				<CardDescription>
					Uses the active Organization binding and the same persistence service—never an ingest
					token or HTTP loopback.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-3">
				<div className="gap-2 md:grid-cols-3 grid">
					<select
						className="px-3 rounded-md border bg-background"
						value={selected}
						onChange={(e) => setSelected(e.target.value)}
					>
						{bindings.map((binding) => (
							<option key={binding.id} value={binding.id}>
								{binding.companyId} · {binding.address} · {binding.status}
							</option>
						))}
					</select>
					<select
						className="px-3 rounded-md border bg-background"
						value={scenario}
						onChange={(e) => setScenario(e.target.value as Scenario)}
					>
						{[
							"inbound_customer",
							"outbound_loopdesk",
							"outbound_xiaofei",
							"duplicate",
							"payload_conflict",
							"missing_binding",
							"disabled_binding",
						].map((item) => (
							<option key={item} value={item}>
								{item}
							</option>
						))}
					</select>
					<Button onClick={() => void run()} disabled={!selected || running}>
						{running ? "Running…" : "Run email scenario"}
					</Button>
				</div>
				<Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Email text" />
				{notice ? (
					<p aria-live="polite" className="text-sm text-muted-foreground">
						{notice}
					</p>
				) : null}
			</CardContent>
		</Card>
	);
}
