import { KnowledgeEntries } from "@ai/components/KnowledgeEntries";
import { PageHeader } from "@shared/components/PageHeader";

export default function KnowledgeEntriesPage() {
	return (
		<>
			<PageHeader
				title="知识条目"
				subtitle="通过文件、网页或手动问答添加并维护当前租户的可用知识。"
				className="max-w-7xl mx-auto"
			/>
			<div className="max-w-7xl mx-auto">
				<KnowledgeEntries />
			</div>
		</>
	);
}
