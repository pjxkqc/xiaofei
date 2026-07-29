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
import { Label } from "@repo/ui/components/label";
import { Textarea } from "@repo/ui/components/textarea";
import { toastError, toastSuccess } from "@repo/ui/components/toast";
import type { FallbackPolicy, XiaofeiWorkspaceSnapshot } from "@repo/xiaofei";
import { orpcClient } from "@shared/lib/orpc-client";
import {
	BellRingIcon,
	MessagesSquareIcon,
	SaveIcon,
	SparklesIcon,
	UserRoundIcon,
} from "lucide-react";
import { useEffect, useState } from "react";

export function XiaofeiFallbackSettings() {
	const [snapshot, setSnapshot] = useState<XiaofeiWorkspaceSnapshot | null>(null);
	const [draft, setDraft] = useState<FallbackPolicy | null>(null);
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		void orpcClient.xiaofei
			.getConfig()
			.then((configuration) => {
				setSnapshot(configuration);
				setDraft({ ...configuration.agent.fallbackPolicy });
			})
			.catch(() => toastError("无法读取兜底策略"));
	}, []);

	if (!snapshot || !draft) {
		return (
			<div className="py-24 text-sm flex items-center justify-center text-muted-foreground">
				<SparklesIcon className="mr-2 size-4 animate-pulse" />
				正在加载兜底策略…
			</div>
		);
	}

	const hasChanges =
		draft.maxClarifications !== snapshot.agent.fallbackPolicy.maxClarifications ||
		draft.clarificationReply !== snapshot.agent.fallbackPolicy.clarificationReply ||
		draft.attentionReply !== snapshot.agent.fallbackPolicy.attentionReply ||
		draft.handoffReply !== snapshot.agent.fallbackPolicy.handoffReply;
	const isValid =
		draft.maxClarifications >= 0 &&
		draft.maxClarifications <= 10 &&
		draft.clarificationReply.trim().length > 0 &&
		draft.attentionReply.trim().length > 0 &&
		draft.handoffReply.trim().length > 0;

	const save = async () => {
		setSaving(true);
		try {
			const updated = await orpcClient.xiaofei.saveAgentSettings({
				section: "fallback",
				fallbackPolicy: draft,
			});
			setSnapshot(updated);
			setDraft({ ...updated.agent.fallbackPolicy });
			toastSuccess("兜底策略已保存", "能力审核保持不变；请重新运行 Eval 验证新话术。");
		} catch {
			toastError("兜底策略保存失败", "请检查澄清轮数和必填话术。");
		} finally {
			setSaving(false);
		}
	};

	return (
		<div className="gap-6 lg:grid-cols-[minmax(0,1fr)_320px] grid">
			<Card>
				<CardHeader>
					<div className="gap-3 flex items-start justify-between">
						<div>
							<CardTitle>未命中与转人工策略</CardTitle>
							<CardDescription className="mt-1.5">
								未匹配知识时继续接待并提示客服关注；只有明确风险、人工请求或权限动作才转人工。
							</CardDescription>
						</div>
						<Badge status="success">继续接待优先</Badge>
					</div>
				</CardHeader>
				<CardContent className="gap-5 flex flex-col">
					<div className="gap-2 max-w-64 flex flex-col">
						<Label htmlFor="max-clarifications">未命中澄清轮数</Label>
						<Input
							id="max-clarifications"
							type="number"
							min={0}
							max={10}
							value={draft.maxClarifications}
							onChange={(event) =>
								setDraft({ ...draft, maxClarifications: Number(event.target.value) })
							}
						/>
						<p className="text-xs text-muted-foreground">
							达到轮数后转为“待人工关注”，但不会结束小飞接待；建议 3–5 轮。
						</p>
					</div>
					<ReplyField
						id="clarification-reply"
						label="澄清回复"
						description="首次或连续未命中尚未达到上限时使用。"
						value={draft.clarificationReply}
						onChange={(value) => setDraft({ ...draft, clarificationReply: value })}
					/>
					<ReplyField
						id="attention-reply"
						label="待人工关注回复"
						description="超过澄清轮数时使用；工作台标记待关注，小飞继续处理后续消息。"
						value={draft.attentionReply}
						onChange={(value) => setDraft({ ...draft, attentionReply: value })}
					/>
					<ReplyField
						id="handoff-reply"
						label="真正转人工回复"
						description="仅在人工请求、高风险、资料冲突或需要人工权限时使用。"
						value={draft.handoffReply}
						onChange={(value) => setDraft({ ...draft, handoffReply: value })}
					/>
					<Button
						onClick={() => void save()}
						disabled={saving || !hasChanges || !isValid}
						className="sm:w-fit"
					>
						<SaveIcon className="mr-2 size-4" />
						{saving ? "正在保存…" : "保存兜底策略"}
					</Button>
				</CardContent>
			</Card>

			<Card className="h-fit">
				<CardHeader>
					<CardTitle>处理顺序</CardTitle>
					<CardDescription>一条未命中消息不会直接让小飞退出。</CardDescription>
				</CardHeader>
				<CardContent className="gap-4 flex flex-col">
					<PolicyStep
						icon={MessagesSquareIcon}
						title="1. 澄清"
						detail="询问商品、订单状态或最想确认的问题。"
					/>
					<PolicyStep
						icon={BellRingIcon}
						title="2. 标记待关注"
						detail="通知客服查看，但 Owner 仍是小飞，后续消息继续匹配。"
					/>
					<PolicyStep
						icon={UserRoundIcon}
						title="3. 必要时转人工"
						detail="客户明确要求真人、出现风险或需要人工权限时才交接。"
					/>
					<p className="pt-3 text-xs border-t text-muted-foreground">
						保存后不会修改 KU，但会清除现有 Eval 证据。
					</p>
				</CardContent>
			</Card>
		</div>
	);
}

function ReplyField({
	id,
	label,
	description,
	value,
	onChange,
}: {
	id: string;
	label: string;
	description: string;
	value: string;
	onChange: (value: string) => void;
}) {
	return (
		<div className="gap-2 flex flex-col">
			<Label htmlFor={id}>{label}</Label>
			<Textarea
				id={id}
				value={value}
				onChange={(event) => onChange(event.target.value)}
				className="min-h-28"
			/>
			<p className="text-xs text-muted-foreground">{description}</p>
		</div>
	);
}

function PolicyStep({
	icon: Icon,
	title,
	detail,
}: {
	icon: React.ComponentType<{ className?: string }>;
	title: string;
	detail: string;
}) {
	return (
		<div className="gap-3 flex items-start">
			<span className="size-8 flex shrink-0 items-center justify-center rounded-full bg-muted">
				<Icon className="size-4 text-muted-foreground" />
			</span>
			<div>
				<p className="text-sm font-medium">{title}</p>
				<p className="text-xs text-muted-foreground">{detail}</p>
			</div>
		</div>
	);
}
