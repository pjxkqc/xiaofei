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
import { Label } from "@repo/ui/components/label";
import { orpcClient } from "@shared/lib/orpc-client";
import { useEffect, useState } from "react";

interface Binding {
	id: string;
	companyId: string;
	channelAccountId: string;
	address: string;
	status: "active" | "disabled";
}
const PREVIEW_BINDING = {
	companyId: "fly103-preview-company",
	accountId: "fly103-preview-mailbox-v2",
	address: "support.fly103@example.com",
};

export function EmailBindings({ isPreview = false }: { isPreview?: boolean }) {
	const [items, setItems] = useState<Binding[]>([]);
	const [canManage, setCanManage] = useState(false);
	const [companyId, setCompanyId] = useState(isPreview ? PREVIEW_BINDING.companyId : "");
	const [accountId, setAccountId] = useState(isPreview ? PREVIEW_BINDING.accountId : "");
	const [address, setAddress] = useState(isPreview ? PREVIEW_BINDING.address : "");
	const [editingId, setEditingId] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	const [notice, setNotice] = useState("");
	async function load() {
		try {
			const result = (await orpcClient.xiaofei.listEmailBindings()) as {
				items: Binding[];
				canManage: boolean;
			};
			setItems(result.items);
			setCanManage(result.canManage);
		} catch {
			setNotice("Unable to load Email bindings.");
		}
	}
	useEffect(() => {
		void load();
	}, []);
	function resetForm() {
		setCompanyId(isPreview ? PREVIEW_BINDING.companyId : "");
		setAccountId(isPreview ? PREVIEW_BINDING.accountId : "");
		setAddress(isPreview ? PREVIEW_BINDING.address : "");
		setEditingId(null);
	}
	function edit(item: Binding) {
		setCompanyId(item.companyId);
		setAccountId(item.channelAccountId);
		setAddress(item.address);
		setEditingId(item.id);
		setNotice(`Editing ${item.address}.`);
	}
	async function save() {
		setSaving(true);
		try {
			if (editingId) {
				await orpcClient.xiaofei.updateEmailBinding({
					id: editingId,
					data: { companyId, channelAccountId: accountId, address },
				});
			} else {
				await orpcClient.xiaofei.createEmailBinding({
					companyId,
					channelAccountId: accountId,
					address,
				});
			}
			setNotice(editingId ? "Binding updated." : "Binding created.");
			resetForm();
			await load();
		} catch {
			setNotice("Unable to save binding. Check role access and unique mailbox values.");
		} finally {
			setSaving(false);
		}
	}
	async function toggle(item: Binding) {
		try {
			await (item.status === "active"
				? orpcClient.xiaofei.disableEmailBinding({ id: item.id })
				: orpcClient.xiaofei.enableEmailBinding({ id: item.id }));
			await load();
		} catch {
			setNotice("Only Organization owners and admins can change bindings.");
		}
	}
	return (
		<Card>
			<CardHeader>
				<CardTitle>Email channel bindings</CardTitle>
				<CardDescription>
					Members can inspect bindings. Owners and admins can create, enable, or disable them;
					workspace selection remains server-side. Select Edit to load a binding into the form.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				{canManage ? (
					<div className="space-y-3 p-4 rounded-lg border">
						<div className="gap-2 flex flex-wrap items-center justify-between">
							<div>
								<p className="text-sm font-medium">{editingId ? "编辑邮箱绑定" : "新增邮箱绑定"}</p>
								<p className="text-xs text-muted-foreground">3 个值必须与 Worker 请求完全一致。</p>
							</div>
							{isPreview ? (
								<Button
									variant="outline"
									size="sm"
									onClick={() => {
										setCompanyId(PREVIEW_BINDING.companyId);
										setAccountId(PREVIEW_BINDING.accountId);
										setAddress(PREVIEW_BINDING.address);
									}}
								>
									填入 Preview 示例
								</Button>
							) : null}
						</div>
						<div className="gap-3 md:grid-cols-3 grid">
							<div className="space-y-1.5">
								<Label htmlFor="email-company-id">商户 companyId</Label>
								<Input
									id="email-company-id"
									value={companyId}
									onChange={(e) => setCompanyId(e.target.value)}
									placeholder="例如 fly103-preview-company"
								/>
							</div>
							<div className="space-y-1.5">
								<Label htmlFor="email-account-id">邮箱账号 channelAccount.id</Label>
								<Input
									id="email-account-id"
									value={accountId}
									onChange={(e) => setAccountId(e.target.value)}
									placeholder="例如 mailbox_123"
								/>
							</div>
							<div className="space-y-1.5">
								<Label htmlFor="email-account-address">商户客服邮箱</Label>
								<Input
									id="email-account-address"
									value={address}
									onChange={(e) => setAddress(e.target.value)}
									placeholder="support@example.com"
								/>
							</div>
						</div>
						<div className="gap-2 flex">
							<Button
								disabled={!companyId || !accountId || !address || saving}
								onClick={() => void save()}
							>
								{saving ? "Saving…" : editingId ? "Save changes" : "Create binding"}
							</Button>
							{editingId ? (
								<Button variant="secondary" disabled={saving} onClick={resetForm}>
									Cancel
								</Button>
							) : null}
						</div>
					</div>
				) : null}
				{notice && (
					<p aria-live="polite" className="text-sm text-muted-foreground">
						{notice}
					</p>
				)}
				<div className="divide-y rounded-md border">
					{items.map((item) => (
						<div key={item.id} className="gap-3 p-3 md:grid-cols-5 grid">
							<span>{item.companyId}</span>
							<span>{item.channelAccountId}</span>
							<span>{item.address}</span>
							<span>{item.status}</span>
							{canManage ? (
								<div className="gap-2 flex">
									<Button variant="secondary" onClick={() => void toggle(item)}>
										{item.status === "active" ? "Disable" : "Enable"}
									</Button>
									<Button variant="secondary" onClick={() => edit(item)}>
										Edit
									</Button>
								</div>
							) : (
								<span className="text-sm text-muted-foreground">Read-only</span>
							)}
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
}
