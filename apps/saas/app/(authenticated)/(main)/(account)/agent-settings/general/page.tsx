import { AgentSettingsNav } from "@ai/components/AgentSettingsNav";
import { XiaofeiAgentGeneralSettings } from "@ai/components/XiaofeiAgentGeneralSettings";
import { OrganizationRequired } from "@organizations/components/OrganizationRequired";
import { PageHeader } from "@shared/components/PageHeader";

export default function XiaofeiAgentGeneralSettingsPage() {
	return (
		<>
			<PageHeader
				title="Agent 基础设置"
				subtitle="配置小飞的角色指令和资料收集追问边界。"
				className="max-w-6xl mx-auto"
			/>
			<OrganizationRequired>
				<div className="max-w-6xl mx-auto">
					<AgentSettingsNav current="general" />
					<XiaofeiAgentGeneralSettings />
				</div>
			</OrganizationRequired>
		</>
	);
}
