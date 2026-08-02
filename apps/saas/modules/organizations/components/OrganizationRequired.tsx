"use client";

import { useActiveOrganization } from "@organizations/hooks/use-active-organization";
import { Button } from "@repo/ui/components/button";
import Link from "next/link";
import type { ReactNode } from "react";

export function OrganizationRequired({ children }: { children: ReactNode }) {
	const { activeOrganization, loaded } = useActiveOrganization();

	if (!loaded) return null;
	if (activeOrganization) return children;

	return (
		<section
			className="p-8 rounded-lg border border-dashed text-center"
			aria-label="Organization required"
		>
			<h2 className="text-lg font-semibold">选择一个 Organization 后继续</h2>
			<p className="mt-2 text-muted-foreground">
				Xiaofei 的 Agent、知识、Chatbot、客服 Inbox 和事件仅在当前 Organization 中可用。
			</p>
			<div className="mt-4 gap-3 flex justify-center">
				<Button asChild variant="secondary">
					<Link href="/">选择 Organization</Link>
				</Button>
				<Button asChild>
					<Link href="/new-organization">创建 Organization</Link>
				</Button>
			</div>
		</section>
	);
}
