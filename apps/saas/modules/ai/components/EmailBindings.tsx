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
export function EmailBindings() {
	const [items, setItems] = useState<Binding[]>([]);
	const [canManage, setCanManage] = useState(false);
	const [companyId, setCompanyId] = useState("");
	const [accountId, setAccountId] = useState("");
	const [address, setAddress] = useState("");
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
	async function create() {
		try {
			await orpcClient.xiaofei.createEmailBinding({
				companyId,
				channelAccountId: accountId,
				address,
			});
			setNotice("Binding saved.");
			await load();
		} catch {
			setNotice("Only Organization owners and admins can change bindings.");
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
	async function update(item: Binding) {
		try {
			await orpcClient.xiaofei.updateEmailBinding({
				id: item.id,
				data: { companyId, channelAccountId: accountId, address },
			});
			setNotice("Binding updated.");
			await load();
		} catch {
			setNotice("Unable to update binding.");
		}
	}
	return (
		<Card>
			<CardHeader>
				<CardTitle>Email channel bindings</CardTitle>
				<CardDescription>
					Members can inspect bindings. Owners and admins can create, enable, or disable them;
					workspace selection remains server-side.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				{canManage ? (
					<div className="gap-2 md:grid-cols-4 grid">
						<Input
							value={companyId}
							onChange={(e) => setCompanyId(e.target.value)}
							placeholder="companyId"
						/>
						<Input
							value={accountId}
							onChange={(e) => setAccountId(e.target.value)}
							placeholder="accountId"
						/>
						<Input
							value={address}
							onChange={(e) => setAddress(e.target.value)}
							placeholder="address"
						/>
						<Button disabled={!companyId || !accountId || !address} onClick={() => void create()}>
							Create binding
						</Button>
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
									<Button variant="secondary" onClick={() => void update(item)}>
										Update
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
