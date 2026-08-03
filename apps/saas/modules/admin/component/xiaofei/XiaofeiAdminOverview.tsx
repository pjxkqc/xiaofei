"use client";

import { getAdminPath } from "@admin/lib/links";
import { Badge } from "@repo/ui/components/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card";
import { Input } from "@repo/ui/components/input";
import { Skeleton } from "@repo/ui/components/skeleton";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { parseAsString, useQueryState } from "nuqs";
import { useEffect } from "react";
import { useDebounceValue } from "usehooks-ts";

export function XiaofeiAdminOverview() {
	const [query, setQuery] = useQueryState("query", parseAsString.withDefault(""));
	const [enabled, setEnabled] = useQueryState("enabled", parseAsString);
	const [debouncedQuery, setDebouncedQuery] = useDebounceValue(query, 300, {
		leading: true,
		trailing: false,
	});
	useEffect(() => setDebouncedQuery(query), [query, setDebouncedQuery]);
	const overview = useQuery(orpc.admin.xiaofei.overview.queryOptions());
	const organizations = useQuery(
		orpc.admin.xiaofei.listOrganizations.queryOptions({
			input: {
				query: debouncedQuery || undefined,
				enabled: enabled === "true" ? true : enabled === "false" ? false : undefined,
				limit: 50,
				offset: 0,
			},
		}),
	);
	return (
		<div className="space-y-6">
			<div>
				<h2 className="font-semibold text-2xl">Xiaofei 总览</h2>
				<p className="text-muted-foreground">跨商户只读运营视图；不会切换当前活动 Organization。</p>
			</div>
			<div className="gap-3 md:grid-cols-3 xl:grid-cols-6 grid">
				<Metric label="Organizations" value={overview.data?.organizations} />
				<Metric label="已启用小飞" value={overview.data?.enabled} />
				<Metric label="客户" value={overview.data?.customers} />
				<Metric label="开放会话" value={overview.data?.openConversations} />
				<Metric label="待关注" value={overview.data?.attentionConversations} />
				<Metric label="失败事件" value={overview.data?.failedEvents} />
			</div>
			<Card>
				<CardHeader>
					<CardTitle>商户</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<Input
						type="search"
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						placeholder="按名称或 externalMerchantId 搜索"
					/>
					<select
						className="h-9 px-3 text-sm rounded-md border bg-background"
						value={enabled ?? ""}
						onChange={(event) => setEnabled(event.target.value || null)}
					>
						<option value="">全部启用状态</option>
						<option value="true">已启用</option>
						<option value="false">未启用（含未配置）</option>
					</select>
					{organizations.isLoading ? (
						<Skeleton className="h-36 w-full" />
					) : (
						<div className="divide-y rounded-md border">
							{organizations.data?.organizations.map((organization) => (
								<Link
									className="gap-4 p-4 flex items-center justify-between hover:bg-muted/50"
									href={getAdminPath(`/xiaofei/${organization.id}`)}
									key={organization.id}
								>
									<div>
										<p className="font-medium">{organization.name}</p>
										<p className="text-sm text-muted-foreground">
											{organization.xiaofeiConfig?.externalMerchantId ??
												"未配置 externalMerchantId"}{" "}
											· {organization.customersCount} 客户 · {organization.membersCount} 成员
										</p>
									</div>
									<Badge status={organization.xiaofeiConfig?.xiaofeiEnabled ? "success" : "info"}>
										{organization.xiaofeiConfig?.xiaofeiEnabled ? "已启用" : "未启用"}
									</Badge>
								</Link>
							))}
							{organizations.data?.organizations.length === 0 && (
								<p className="p-4 text-sm text-muted-foreground">没有匹配的商户。</p>
							)}
						</div>
					)}
				</CardContent>
			</Card>
			<Card>
				<CardHeader>
					<CardTitle>最近入站事件</CardTitle>
				</CardHeader>
				<CardContent className="space-y-2 text-sm">
					{overview.data?.recentEvents.length
						? overview.data.recentEvents.map((event) => (
								<div className="flex justify-between" key={event.id}>
									<span>{event.eventType}</span>
									<span className="text-muted-foreground">
										{event.status} · {new Date(event.createdAt).toLocaleString()}
									</span>
								</div>
							))
						: "暂无事件"}
				</CardContent>
			</Card>
		</div>
	);
}

function Metric({ label, value }: { label: string; value: number | undefined }) {
	return (
		<Card>
			<CardContent className="p-4">
				<p className="text-sm text-muted-foreground">{label}</p>
				<p className="font-semibold text-2xl">{value ?? "—"}</p>
			</CardContent>
		</Card>
	);
}
