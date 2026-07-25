import { KnowledgeDocuments } from "@ai/components/KnowledgeDocuments";
import { PageHeader } from "@shared/components/PageHeader";

export default function KnowledgeDocumentsPage() {
	return (
		<>
			<PageHeader
				title="知识文档"
				subtitle="上传、提取并管理当前租户的 Markdown、TXT 和 DOCX 源文档。"
				className="max-w-7xl mx-auto"
			/>
			<div className="max-w-7xl mx-auto">
				<KnowledgeDocuments />
			</div>
		</>
	);
}
