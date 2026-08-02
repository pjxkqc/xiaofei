import { KnowledgeFlowNav } from "@ai/components/KnowledgeFlowNav";
import { KnowledgeUnits } from "@ai/components/KnowledgeUnits";
import { OrganizationRequired } from "@organizations/components/OrganizationRequired";
import { PageHeader } from "@shared/components/PageHeader";

export default function KnowledgeUnitsPage() {
	return (
		<>
			<PageHeader
				title="知识单元"
				subtitle="从已审核的标准化条目生成、编辑并人工发布知识单元。"
				className="max-w-7xl mx-auto"
			/>
			<OrganizationRequired>
				<div className="max-w-7xl mx-auto">
					<KnowledgeFlowNav current="units" />
					<KnowledgeUnits />
				</div>
			</OrganizationRequired>
		</>
	);
}
