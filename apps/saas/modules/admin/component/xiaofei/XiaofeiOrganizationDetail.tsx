"use client";

import { getAdminPath } from "@admin/lib/links";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card";
import { Input } from "@repo/ui/components/input";
import { toastError, toastSuccess } from "@repo/ui/components/toast";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

export function XiaofeiOrganizationDetail({ organizationId }: { organizationId: string }) {
	const queryClient = useQueryClient();
	const detail = useQuery(
		orpc.admin.xiaofei.getOrganization.queryOptions({ input: { organizationId } }),
	);
	const [externalMerchantId, setExternalMerchantId] = useState("");
	const [xiaofeiEnabled, setXiaofeiEnabled] = useState(false);
	useEffect(() => {
		setExternalMerchantId(detail.data?.organization.xiaofeiConfig?.externalMerchantId ?? "");
		setXiaofeiEnabled(detail.data?.organization.xiaofeiConfig?.xiaofeiEnabled ?? false);
	}, [detail.data]);
	const update = useMutation(
		orpc.admin.xiaofei.updateOrganization.mutationOptions({
			onSuccess: async () => {
				await queryClient.invalidateQueries({ queryKey: orpc.admin.xiaofei.key() });
				toastSuccess("Xiaofei 配置已保存。");
			},
			onError: () => toastError("无法保存配置；externalMerchantId 必须唯一。"),
		}),
	);
	if (detail.isLoading)
		return (
			<Card>
				<CardContent className="p-6">正在加载…</CardContent>
			</Card>
		);
	if (detail.isError || !detail.data)
		return (
			<Card>
				<CardContent className="p-6">无法加载此商户的 Xiaofei 信息。请返回总览后重试。</CardContent>
			</Card>
		);
	const { organization, workspace, summary } = detail.data;
	return (
		<div className="space-y-6">
			<Button variant="link" asChild className="px-0">
				<Link href={getAdminPath("/xiaofei")}>
					<ArrowLeftIcon className="mr-1.5 size-4" />
					返回 Xiaofei 总览
				</Link>
			</Button>
			<div>
				<h2 className="font-semibold text-2xl">{organization.name}</h2>
				<p className="text-muted-foreground">{organization.slug ?? organization.id}</p>
			</div>
			<Card>
				<CardHeader>
					<CardTitle>小飞配置</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="gap-2 text-sm grid">
						<label htmlFor="external-merchant-id">externalMerchantId</label>
						<Input
							id="external-merchant-id"
							value={externalMerchantId}
							onChange={(event) => setExternalMerchantId(event.target.value)}
							placeholder="未配置"
						/>
					</div>
					<label className="gap-2 text-sm flex items-center">
						<input
							checked={xiaofeiEnabled}
							onChange={(event) => setXiaofeiEnabled(event.target.checked)}
							type="checkbox"
						/>
						启用小飞
					</label>
					<Button
						disabled={update.isPending}
						onClick={() =>
							update.mutate({
								organizationId,
								externalMerchantId: externalMerchantId || null,
								xiaofeiEnabled,
							})
						}
					>
						保存
					</Button>
				</CardContent>
			</Card>
			<div className="gap-3 md:grid-cols-4 grid">
				<Metric label="客户" value={summary.customers} />
				<Metric label="开放会话" value={summary.openConversations} />
				<Metric label="待关注" value={summary.attentionConversations} />
				<Metric label="失败事件" value={summary.failedEvents} />
			</div>
			<Card>
				<CardHeader>
					<CardTitle>成员摘要</CardTitle>
				</CardHeader>
				<CardContent className="space-y-2">
					{organization.members.map((member) => (
						<div className="text-sm flex justify-between" key={member.id}>
							<span>
								{member.user.name} · {member.user.email}
							</span>
							<Badge status="info">{member.role}</Badge>
						</div>
					))}
				</CardContent>
			</Card>
			<Card>
				<CardHeader>
					<CardTitle>Agent / Eval / 知识</CardTitle>
				</CardHeader>
				<CardContent className="text-sm">
					{workspace ? (
						<>
							工作区已建立 · 知识来源 {workspace._count.knowledgeDocuments} · 条目{" "}
							{workspace._count.knowledgeEntries} · KUs {workspace._count.knowledgeUnits}
						</>
					) : (
						"尚未建立 Xiaofei 工作区"
					)}
					<div className="mt-3 space-y-2">
						<p className="text-muted-foreground">
							客户、会话、事件和知识治理均为账户级商户操作页面。请仅在拥有该商户 membership
							且已实际选择该活动 Organization 后进入；此 Admin 页面不会切换 Organization 或代登录。
						</p>
						<Link className="underline" href={getAdminPath(`/organizations/${organization.id}`)}>
							Admin Organization 记录
						</Link>
					</div>
				</CardContent>
			</Card>
			<Card>
				<CardHeader>
					<CardTitle>最近入站事件</CardTitle>
				</CardHeader>
				<CardContent className="space-y-2 text-sm">
					{summary.recentEvents.length
						? summary.recentEvents.map((event) => (
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

function Metric({ label, value }: { label: string; value: number }) {
	return (
		<Card>
			<CardContent className="p-4">
				<p className="text-sm text-muted-foreground">{label}</p>
				<p className="font-semibold text-2xl">{value}</p>
			</CardContent>
		</Card>
	);
}
