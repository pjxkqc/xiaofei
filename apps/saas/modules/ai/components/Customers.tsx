"use client";

import { useActiveOrganization } from "@organizations/hooks/use-active-organization";
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
import { toastError, toastSuccess } from "@repo/ui/components/toast";
import type { Customer, SupportConversationSummary } from "@repo/xiaofei";
import { orpcClient } from "@shared/lib/orpc-client";
import { ArchiveIcon, PencilIcon, PlusIcon, SaveIcon, SearchIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

export function Customers() {
	const { activeOrganization, isOrganizationAdmin } = useActiveOrganization();
	const [customers, setCustomers] = useState<Customer[]>([]);
	const [query, setQuery] = useState("");
	const [notice, setNotice] = useState("正在读取客户…");
	const [creating, setCreating] = useState(false);
	const [externalCustomerId, setExternalCustomerId] = useState("");
	const [name, setName] = useState("");
	const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
	const [editName, setEditName] = useState("");
	const [editEmail, setEditEmail] = useState("");
	const [editWhatsappNumber, setEditWhatsappNumber] = useState("");
	const [saving, setSaving] = useState(false);

	async function load() {
		try {
			const items = await orpcClient.xiaofei.listCustomers();
			setCustomers(items);
			setNotice(items.length ? "" : "当前 Organization 暂无客户。可先创建客户，或等待渠道接入。 ");
		} catch {
			setNotice("无法读取当前 Organization 的客户。");
		}
	}
	useEffect(() => void load(), []);
	const visible = useMemo(() => {
		const needle = query.trim().toLowerCase();
		if (!needle) return customers;
		return customers.filter((customer) =>
			[customer.name, customer.email, customer.externalCustomerId]
				.filter(Boolean)
				.some((value) => value!.toLowerCase().includes(needle)),
		);
	}, [customers, query]);

	async function create(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!externalCustomerId.trim()) return;
		setCreating(true);
		try {
			await orpcClient.xiaofei.createCustomer({
				externalCustomerId: externalCustomerId.trim(),
				name: name.trim() || null,
			});
			setExternalCustomerId("");
			setName("");
			await load();
			toastSuccess("客户已创建");
		} catch {
			toastError("创建客户失败；请检查外部客户 ID 是否重复。");
		} finally {
			setCreating(false);
		}
	}

	async function archive(customer: Customer) {
		try {
			await orpcClient.xiaofei.archiveCustomer({ externalCustomerId: customer.externalCustomerId });
			await load();
			toastSuccess("客户已归档；会话审计记录仍被保留。");
		} catch {
			toastError("归档客户失败。");
		}
	}

	function startEditing(customer: Customer) {
		setEditingCustomer(customer);
		setEditName(customer.name ?? "");
		setEditEmail(customer.email ?? "");
		setEditWhatsappNumber(customer.whatsappNumber ?? "");
	}

	async function saveCustomer(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!editingCustomer) return;
		setSaving(true);
		try {
			await orpcClient.xiaofei.updateCustomer({
				externalCustomerId: editingCustomer.externalCustomerId,
				data: {
					name: editName.trim() || null,
					email: editEmail.trim() || null,
					whatsappNumber: editWhatsappNumber.trim() || null,
				},
			});
			setEditingCustomer(null);
			await load();
			toastSuccess("客户资料已更新");
		} catch {
			toastError("更新客户资料失败；请检查邮箱格式。");
		} finally {
			setSaving(false);
		}
	}

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle>当前 Organization：{activeOrganization?.name ?? "未选择"}</CardTitle>
					<CardDescription>客户归属于当前商户；成员只能浏览本商户资料与会话。</CardDescription>
				</CardHeader>
				{isOrganizationAdmin && (
					<CardContent>
						<form onSubmit={create} className="gap-3 md:grid-cols-[1fr_1fr_auto] grid">
							<Input
								aria-label="External customer ID"
								value={externalCustomerId}
								onChange={(e) => setExternalCustomerId(e.target.value)}
								placeholder="外部客户 ID"
								required
							/>
							<Input
								aria-label="Customer name"
								value={name}
								onChange={(e) => setName(e.target.value)}
								placeholder="客户名称（可选）"
							/>
							<Button type="submit" disabled={creating}>
								<PlusIcon className="mr-2 size-4" />
								创建客户
							</Button>
						</form>
					</CardContent>
				)}
			</Card>
			{isOrganizationAdmin && editingCustomer && (
				<Card>
					<CardHeader>
						<CardTitle>编辑客户：{editingCustomer.externalCustomerId}</CardTitle>
						<CardDescription>仅 Organization owner/admin 可保存这些资料。</CardDescription>
					</CardHeader>
					<CardContent>
						<form onSubmit={saveCustomer} className="gap-3 md:grid-cols-3 grid">
							<Input
								aria-label="Edit customer name"
								value={editName}
								onChange={(event) => setEditName(event.target.value)}
								placeholder="名称"
							/>
							<Input
								aria-label="Edit customer email"
								type="email"
								value={editEmail}
								onChange={(event) => setEditEmail(event.target.value)}
								placeholder="邮箱"
							/>
							<Input
								aria-label="Edit customer WhatsApp number"
								value={editWhatsappNumber}
								onChange={(event) => setEditWhatsappNumber(event.target.value)}
								placeholder="WhatsApp"
							/>
							<div className="gap-2 md:col-span-3 flex justify-end">
								<Button type="button" variant="outline" onClick={() => setEditingCustomer(null)}>
									<XIcon className="mr-2 size-4" />
									取消
								</Button>
								<Button type="submit" disabled={saving}>
									<SaveIcon className="mr-2 size-4" />
									保存
								</Button>
							</div>
						</form>
					</CardContent>
				</Card>
			)}
			<Card>
				<CardHeader>
					<CardTitle>客户</CardTitle>
					<div className="max-w-md relative">
						<SearchIcon className="top-3 left-3 size-4 absolute text-muted-foreground" />
						<Input
							aria-label="Search customers"
							className="pl-9"
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							placeholder="搜索名称、邮箱或外部 ID"
						/>
					</div>
				</CardHeader>
				<CardContent className="space-y-2">
					{notice && <p className="text-sm text-muted-foreground">{notice}</p>}
					{visible.map((customer) => (
						<div
							key={customer.id}
							className="gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] grid items-center rounded-lg border"
						>
							<div className="min-w-0">
								<Link
									className="font-medium hover:underline"
									href={`/customers/${encodeURIComponent(customer.externalCustomerId)}`}
								>
									{customer.name || customer.externalCustomerId}
								</Link>
								<p className="text-sm truncate text-muted-foreground">
									{customer.email || customer.externalCustomerId} · {customer.conversationCount}{" "}
									个会话
								</p>
							</div>
							<Badge status={customer.status === "active" ? "success" : "warning"}>
								{customer.status === "active" ? "活跃" : "已归档"}
							</Badge>
							{isOrganizationAdmin && (
								<div className="gap-2 flex">
									<Button variant="outline" size="sm" onClick={() => startEditing(customer)}>
										<PencilIcon className="mr-2 size-4" />
										编辑
									</Button>
									{customer.status === "active" && (
										<Button variant="outline" size="sm" onClick={() => void archive(customer)}>
											<ArchiveIcon className="mr-2 size-4" />
											归档
										</Button>
									)}
								</div>
							)}
						</div>
					))}
				</CardContent>
			</Card>
		</div>
	);
}

export function CustomerDetail({ externalCustomerId }: { externalCustomerId: string }) {
	const [customer, setCustomer] = useState<Customer | null>(null);
	const [conversations, setConversations] = useState<SupportConversationSummary[]>([]);
	const [notice, setNotice] = useState("正在读取客户资料…");
	useEffect(() => {
		void orpcClient.xiaofei
			.getCustomer({ externalCustomerId })
			.then((result) => {
				setCustomer(result.customer);
				setConversations(result.conversations);
				setNotice("");
			})
			.catch(() => setNotice("找不到此客户，或您无权访问。"));
	}, [externalCustomerId]);
	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle>{customer?.name || externalCustomerId}</CardTitle>
					<CardDescription>
						{customer?.email || "未提供邮箱"} · 外部 ID：{externalCustomerId}
					</CardDescription>
				</CardHeader>
				<CardContent className="gap-3 sm:grid-cols-3 text-sm grid">
					<div>
						<span className="block text-muted-foreground">状态</span>
						<Badge status={customer?.status === "archived" ? "warning" : "success"}>
							{customer?.status === "archived" ? "已归档" : "活跃"}
						</Badge>
					</div>
					<div>
						<span className="block text-muted-foreground">邮箱</span>
						{customer?.email || "未提供"}
					</div>
					<div>
						<span className="block text-muted-foreground">WhatsApp</span>
						{customer?.whatsappNumber || "未提供"}
					</div>
				</CardContent>
			</Card>
			<Card>
				<CardHeader>
					<CardTitle>历史会话</CardTitle>
					<CardDescription>归档客户的会话审计仍安全保留。</CardDescription>
				</CardHeader>
				<CardContent className="space-y-2">
					{notice && <p className="text-sm text-muted-foreground">{notice}</p>}
					{conversations.map((conversation) => (
						<Link
							key={conversation.id}
							href="/inbox"
							className="p-4 block rounded-lg border hover:bg-muted/50"
						>
							<div className="gap-3 flex justify-between">
								<span className="font-medium">{conversation.channel}</span>
								<Badge status={conversation.status === "open" ? "success" : "warning"}>
									{conversation.status}
								</Badge>
							</div>
							<p className="mt-1 text-sm truncate text-muted-foreground">
								{conversation.lastMessage || "暂无消息"}
							</p>
						</Link>
					))}
				</CardContent>
			</Card>
		</div>
	);
}
