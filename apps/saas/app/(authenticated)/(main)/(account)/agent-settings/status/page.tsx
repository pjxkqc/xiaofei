import { AgentSettingsNav } from "@ai/components/AgentSettingsNav";
import { XiaofeiAgentStatus } from "@ai/components/XiaofeiAgentStatus";
import { PageHeader } from "@shared/components/PageHeader";

export default function XiaofeiAgentStatusPage() {
	return (
		<>
			<PageHeader
				title="Agent 运行状态"
				subtitle="查看知识、能力审核、Eval 和会话准入的当前状态。"
				className="max-w-6xl mx-auto"
			/>
			<div className="max-w-6xl mx-auto">
				<AgentSettingsNav current="status" />
				<XiaofeiAgentStatus />
			</div>
		</>
	);
}
