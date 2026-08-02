import { AgentSettingsNav } from "@ai/components/AgentSettingsNav";
import { XiaofeiFallbackSettings } from "@ai/components/XiaofeiFallbackSettings";
import { OrganizationRequired } from "@organizations/components/OrganizationRequired";
import { PageHeader } from "@shared/components/PageHeader";

export default function XiaofeiFallbackSettingsPage() {
	return (
		<>
			<PageHeader
				title="兜底与转人工"
				subtitle="配置知识未命中后的澄清、客服关注和人工转接策略。"
				className="max-w-6xl mx-auto"
			/>
			<OrganizationRequired>
				<div className="max-w-6xl mx-auto">
					<AgentSettingsNav current="fallback" />
					<XiaofeiFallbackSettings />
				</div>
			</OrganizationRequired>
		</>
	);
}
