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
import { Loader2Icon } from "lucide-react";
import { useState } from "react";

import {
	type ApiDemoResult,
	EXTERNAL_STATUS_URL,
	runExternalStatusRequest,
	runTypedStatusRequest,
	TYPED_RPC_STATUS_URL,
} from "../lib/api-demo-requests";
import { orpcClient } from "../lib/orpc-client";

type RequestState = ApiDemoResult | "idle" | "loading";

interface RequestCardProps {
	title: string;
	description: string;
	method: "GET" | "POST";
	url: string;
	state: RequestState;
	onRun: () => void;
}

function RequestCard({ title, description, method, url, state, onRun }: RequestCardProps) {
	const isLoading = state === "loading";
	const result = typeof state === "object" ? state : null;

	return (
		<Card>
			<CardHeader className="gap-3 border-b">
				<div className="gap-3 flex flex-wrap items-start justify-between">
					<div className="space-y-1">
						<CardTitle>{title}</CardTitle>
						<CardDescription>{description}</CardDescription>
					</div>
					<Button onClick={onRun} disabled={isLoading}>
						{isLoading && <Loader2Icon className="animate-spin" />}
						{isLoading ? "Running…" : "Run request"}
					</Button>
				</div>
			</CardHeader>
			<CardContent className="space-y-4 pt-6">
				<dl className="gap-3 text-sm sm:grid-cols-2 grid">
					<div>
						<dt className="text-muted-foreground">Method</dt>
						<dd className="font-mono">{result?.method ?? method}</dd>
					</div>
					<div>
						<dt className="text-muted-foreground">URL</dt>
						<dd className="font-mono break-all">{result?.url ?? url}</dd>
					</div>
					<div>
						<dt className="text-muted-foreground">HTTP status</dt>
						<dd>
							{result?.httpStatus ??
								(result
									? method === "POST"
										? "Unavailable from typed client"
										: "Unavailable"
									: "—")}
						</dd>
					</div>
					<div>
						<dt className="text-muted-foreground">Duration</dt>
						<dd>{result ? `${result.durationMs} ms` : "—"}</dd>
					</div>
				</dl>

				<div className="gap-2 flex items-center">
					<span className="text-sm text-muted-foreground">State</span>
					<Badge
						status={
							result?.state === "error" ? "error" : result?.state === "success" ? "success" : "info"
						}
					>
						{isLoading ? "Loading" : (result?.state ?? "Idle")}
					</Badge>
				</div>

				<pre
					className="min-h-36 p-4 text-xs overflow-x-auto rounded-lg bg-muted"
					aria-live="polite"
				>
					{result ? JSON.stringify(result.body, null, 2) : "Run the request to inspect its JSON."}
				</pre>
			</CardContent>
		</Card>
	);
}

export function ApiStatusDemo() {
	const [externalState, setExternalState] = useState<RequestState>("idle");
	const [typedState, setTypedState] = useState<RequestState>("idle");

	async function handleExternalRequest() {
		setExternalState("loading");
		setExternalState(await runExternalStatusRequest());
	}

	async function handleTypedRequest() {
		setTypedState("loading");
		setTypedState(await runTypedStatusRequest(() => orpcClient.xiaofei.status()));
	}

	return (
		<div className="gap-6 lg:grid-cols-2 grid">
			<RequestCard
				title="External HTTP"
				description="Calls the public OpenAPI route with a browser fetch."
				method="GET"
				url={EXTERNAL_STATUS_URL}
				state={externalState}
				onRun={() => void handleExternalRequest()}
			/>
			<RequestCard
				title="Typed RPC"
				description="Calls the same procedure through the generated oRPC client."
				method="POST"
				url={TYPED_RPC_STATUS_URL}
				state={typedState}
				onRun={() => void handleTypedRequest()}
			/>
		</div>
	);
}
