import { KnowledgeCapabilities } from "@ai/components/KnowledgeCapabilities";
import { KnowledgeFlowNav } from "@ai/components/KnowledgeFlowNav";
import { OrganizationRequired } from "@organizations/components/OrganizationRequired";
import { PageHeader } from "@shared/components/PageHeader";

export default function KnowledgeCapabilitiesPage() {
	return (
		<>
			<PageHeader
				title="能力控制面"
				subtitle="审核当前发布 KU 的能力边界，并保留 Eval 证据后才允许 Chatbot 使用。"
				className="max-w-7xl mx-auto"
			/>
			<OrganizationRequired>
				<div className="max-w-7xl mx-auto">
					<KnowledgeFlowNav current="capabilities" />
					<KnowledgeCapabilities />
				</div>
			</OrganizationRequired>
		</>
	);
}
