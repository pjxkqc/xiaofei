import { KnowledgeDocuments } from "@ai/components/KnowledgeDocuments";
import { isPreviewKnowledgeFixtureSelectorVisible } from "@ai/lib/preview-knowledge-fixtures";
import { PageHeader } from "@shared/components/PageHeader";

export default function KnowledgeDocumentsPage() {
	return (
		<>
			<PageHeader
				title="知识文档"
				subtitle="查看并管理公共客服工作区的 MD、TXT、PDF、DOCX 和 XLSX 源文档。"
				className="max-w-7xl mx-auto"
			/>
			<div className="max-w-7xl mx-auto">
				<KnowledgeDocuments
					previewFixtureSelectorVisible={isPreviewKnowledgeFixtureSelectorVisible()}
				/>
			</div>
		</>
	);
}
