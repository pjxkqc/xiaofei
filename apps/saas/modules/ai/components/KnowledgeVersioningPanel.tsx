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
import { toastError, toastSuccess } from "@repo/ui/components/toast";
import { orpcClient } from "@shared/lib/orpc-client";
import { useCallback, useEffect, useState } from "react";

export function KnowledgeVersioningPanel() {
	const [overview, setOverview] = useState<Awaited<
		ReturnType<typeof orpcClient.xiaofei.getVersioningOverview>
	> | null>(null);
	const [busy, setBusy] = useState(false);
	const refresh = useCallback(
		async () => setOverview(await orpcClient.xiaofei.getVersioningOverview()),
		[],
	);
	useEffect(() => {
		void refresh().catch(() => toastError("无法读取知识版本状态"));
	}, [refresh]);
	async function initialize() {
		setBusy(true);
		try {
			await orpcClient.xiaofei.initializeVersioning();
			await refresh();
			toastSuccess("已生成测试版本", "平台兜底与当前商户 KU 已冻结为可追溯版本。");
		} catch (error) {
			toastError("无法生成版本", message(error));
		} finally {
			setBusy(false);
		}
	}
	async function activate() {
		const id = overview?.binding?.testCapabilityVersionId;
		if (!id) return;
		setBusy(true);
		try {
			await orpcClient.xiaofei.activateHostingVersion({ capabilityVersionId: id });
			await refresh();
			toastSuccess("已验收启用测试版本");
		} catch (error) {
			toastError("启用失败", message(error));
		} finally {
			setBusy(false);
		}
	}
	async function toggleEnabled() {
		setBusy(true);
		try {
			await orpcClient.xiaofei.setHostingEnabled({ enabled: !overview?.xiaofeiEnabled });
			await refresh();
			toastSuccess(overview?.xiaofeiEnabled ? "小飞托管已停用" : "小飞托管已启用");
		} catch (error) {
			toastError("托管设置失败", message(error));
		} finally {
			setBusy(false);
		}
	}
	const active = overview?.binding?.activeCapabilityVersion;
	const test = overview?.binding?.testCapabilityVersion;
	return (
		<Card>
			<CardHeader>
				<CardTitle>三步闭环：知识版本与托管</CardTitle>
				<CardDescription>
					平台兜底只读；商户 KU 以 revision 冻结，CA 版本通过 M:N 成员关系引用它们。
				</CardDescription>
			</CardHeader>
			<CardContent className="gap-3 text-sm flex flex-col">
				<div className="gap-2 flex flex-wrap">
					<Badge status={overview?.xiaofeiEnabled ? "success" : "warning"}>
						{overview?.xiaofeiEnabled ? "托管已启用" : "托管安全停用"}
					</Badge>
					<Badge>
						{overview?.revisions.filter((item) => item.origin === "platform").length ?? 0} 平台基线
						revision（只读）
					</Badge>
					<Badge>
						{overview?.revisions.filter((item) => item.origin === "merchant").length ?? 0} 商户 KU
						revision
					</Badge>
				</div>
				<p>
					Active CA：{active?.id ?? "尚未验收"}{" "}
					{active ? `· ${active.knowledgeUnits.length} 个 KU revision` : ""}
				</p>
				<p>
					Test CA：{test?.id ?? "尚未创建"}{" "}
					{test ? `· ${test.knowledgeUnits.length} 个 KU revision` : ""}
				</p>
				<div className="gap-2 flex flex-wrap">
					<Button onClick={() => void initialize()} disabled={busy}>
						从当前知识生成测试版本
					</Button>
					<Button variant="outline" onClick={() => void activate()} disabled={busy || !test}>
						验收并启用 Test CA
					</Button>
					<Button variant="outline" onClick={() => void toggleEnabled()} disabled={busy}>
						{overview?.xiaofeiEnabled ? "停用托管" : "启用托管"}
					</Button>
				</div>
				<p className="text-xs text-muted-foreground">
					修正只允许命中的商户 KU；每次修正都会新增 KU revision 与 Test CA，不会覆盖 Active CA。
				</p>
			</CardContent>
		</Card>
	);
}
function message(error: unknown) {
	return error instanceof Error ? error.message : "请稍后重试。";
}
