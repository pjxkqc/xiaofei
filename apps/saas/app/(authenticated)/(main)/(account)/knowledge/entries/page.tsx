import { KnowledgeEntries } from "@ai/components/KnowledgeEntries";
import { KnowledgeFlowNav } from "@ai/components/KnowledgeFlowNav";
import { isPreviewKnowledgeFixtureSelectorVisible } from "@ai/lib/preview-knowledge-fixtures";
import { PageHeader } from "@shared/components/PageHeader";

export default function KnowledgeEntriesPage() {
	return (
		<>
			<PageHeader
				title="知识条目"
				subtitle="通过文件、网页或手动问答添加并维护公共客服工作区的可用知识。"
				className="max-w-7xl mx-auto"
			/>
			<div className="max-w-7xl mx-auto">
				<KnowledgeFlowNav current="entries" />
				<KnowledgeEntries
					previewFixtureSelectorVisible={isPreviewKnowledgeFixtureSelectorVisible()}
				/>
			</div>
		</>
	);
}
