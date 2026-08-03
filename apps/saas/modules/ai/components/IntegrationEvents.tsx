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
import { orpcClient } from "@shared/lib/orpc-client";
import { useEffect, useState } from "react";

interface EventSummary {
	id: string;
	source: string;
	eventId: string;
	topic: string | null;
	status: string;
	eventType: string;
	deliveryCount: number;
	occurredAt: Date | string;
	firstReceivedAt: Date | string;
	lastReceivedAt: Date | string;
	processedAt: Date | string | null;
	updatedAt: Date | string;
}

export function IntegrationEvents() {
	const [items, setItems] = useState<EventSummary[]>([]);
	const [source, setSource] = useState("");
	const [status, setStatus] = useState("");
	const [topic, setTopic] = useState("");
	const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
	const [notice, setNotice] = useState("Loading event metadata…");

	async function load() {
		setNotice("Loading event metadata…");
		try {
			const page = await orpcClient.xiaofei.listIntegrationEvents({
				source: source || undefined,
				status: status || undefined,
				topic: topic || undefined,
				limit: 25,
			});
			setItems(page.items as EventSummary[]);
			setNotice(page.items.length ? "" : "No events match these filters.");
		} catch {
			setNotice("Unable to load integration events.");
		}
	}
	useEffect(() => {
		void load();
	}, []);
	async function simulate() {
		setNotice("Creating a protected preview event…");
		try {
			await orpcClient.xiaofei.simulateIntegrationEvent();
			await load();
		} catch {
			setNotice("Simulator could not create an event.");
		}
	}
	async function showDetail(id: string) {
		try {
			setSelected(
				(await orpcClient.xiaofei.getIntegrationEvent({ id })) as Record<string, unknown>,
			);
		} catch {
			setNotice("Unable to load event details.");
		}
	}

	return (
		<div className="space-y-6">
			<div className="gap-4 lg:grid-cols-3 grid">
				<Card>
					<CardHeader>
						<CardTitle>Ingest endpoint</CardTitle>
						<CardDescription>POST /api/xiaofei/integrations/events</CardDescription>
					</CardHeader>
					<CardContent>
						<Badge status="info">Schema v1</Badge>
						<p className="mt-3 text-sm text-muted-foreground">
							Bearer authentication is configured only on the server.
						</p>
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<CardTitle>Delivery contract</CardTitle>
						<CardDescription>202 accepted · 200 replay · 409 conflict</CardDescription>
					</CardHeader>
					<CardContent className="text-sm text-muted-foreground">
						Kafka workers retain and retry while unavailable, then commit contiguous offsets only
						after a durable 200 or 202.
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<CardTitle>Preview simulator</CardTitle>
						<CardDescription>
							Uses the same application service, without exposing an S2S key.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Button onClick={() => void simulate()}>Create sample event</Button>
					</CardContent>
				</Card>
			</div>
			<Card>
				<CardHeader>
					<CardTitle>Inbound events</CardTitle>
					<CardDescription>
						Event, first-received, and latest-delivery times use your browser time zone. Raw payload
						is loaded on demand.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="gap-2 md:grid-cols-4 grid">
						<Input
							value={source}
							onChange={(e) => setSource(e.target.value)}
							placeholder="Source"
						/>
						<Input
							value={status}
							onChange={(e) => setStatus(e.target.value)}
							placeholder="Status"
						/>
						<Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Topic" />
						<Button variant="secondary" onClick={() => void load()}>
							Apply filters
						</Button>
					</div>
					{notice && <p className="text-sm text-muted-foreground">{notice}</p>}
					<div className="divide-y rounded-md border">
						{items.map((event) => (
							<button
								key={event.id}
								type="button"
								onClick={() => void showDetail(event.id)}
								className="space-y-3 p-4 w-full text-left hover:bg-muted/50"
							>
								<div className="gap-3 flex flex-wrap items-center justify-between">
									<div className="gap-2 flex flex-wrap items-center">
										<span className="font-medium">{event.source}</span>
										<Badge status={event.status === "accepted" ? "success" : "info"}>
											{event.status}
										</Badge>
										<span className="text-sm text-muted-foreground">{event.eventType}</span>
									</div>
									<span className="text-sm text-muted-foreground">
										{event.deliveryCount} {event.deliveryCount === 1 ? "delivery" : "deliveries"}
									</span>
								</div>
								<div className="gap-2 text-sm sm:grid-cols-2 grid">
									<span className="font-mono text-xs">{event.eventId}</span>
									<span className="sm:text-right text-muted-foreground">
										Topic: {event.topic ?? "—"}
									</span>
								</div>
								<div className="gap-3 pt-3 text-xs sm:grid-cols-5 grid border-t">
									<EventTime label="Event time" value={event.occurredAt} />
									<EventTime label="First received" value={event.firstReceivedAt} />
									<EventTime label="Latest delivery" value={event.lastReceivedAt} />
									<EventTime label="Completed" value={event.processedAt} />
									<EventTime label="Updated" value={event.updatedAt} />
								</div>
							</button>
						))}
					</div>
				</CardContent>
			</Card>
			{selected && (
				<Card>
					<CardHeader>
						<CardTitle>Event detail</CardTitle>
						<CardDescription>Raw JSON is bounded to this selected event.</CardDescription>
					</CardHeader>
					<CardContent>
						<pre className="max-h-96 rounded p-4 text-xs overflow-auto bg-muted">
							{JSON.stringify(selected, null, 2)}
						</pre>
					</CardContent>
				</Card>
			)}
		</div>
	);
}

function EventTime({ label, value }: { label: string; value: Date | string | null }) {
	return (
		<span className="space-y-1">
			<span className="block text-muted-foreground">{label}</span>
			<time className="font-medium block" dateTime={toIsoDateTime(value)}>
				{formatDateTime(value)}
			</time>
		</span>
	);
}

function formatDateTime(value: Date | string | null) {
	if (!value) return "—";
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) return "—";
	return new Intl.DateTimeFormat("zh-CN", {
		dateStyle: "medium",
		timeStyle: "medium",
	}).format(date);
}

function toIsoDateTime(value: Date | string | null) {
	if (!value) return undefined;
	const date = value instanceof Date ? value : new Date(value);
	return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}
