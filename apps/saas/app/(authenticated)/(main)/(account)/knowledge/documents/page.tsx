import { KnowledgeDocuments } from "@ai/components/KnowledgeDocuments";
import { isPreviewKnowledgeFixtureSelectorVisible } from "@ai/lib/preview-knowledge-fixtures";
import { OrganizationRequired } from "@organizations/components/OrganizationRequired";
import { PageHeader } from "@shared/components/PageHeader";

export default function KnowledgeDocumentsPage() {
	return (
		<>
			<PageHeader
				title="知识文档"
				subtitle="查看并管理当前 Organization 的 MD、TXT、PDF、DOCX 和 XLSX 源文档。"
				className="max-w-7xl mx-auto"
			/>
			<OrganizationRequired>
				<div className="max-w-7xl mx-auto">
					<KnowledgeDocuments
						previewFixtureSelectorVisible={isPreviewKnowledgeFixtureSelectorVisible()}
					/>
				</div>
			</OrganizationRequired>
		</>
	);
}
