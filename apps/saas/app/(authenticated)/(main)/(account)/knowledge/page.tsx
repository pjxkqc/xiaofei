import { KnowledgeWorkspace } from "@ai/components/KnowledgeWorkspace";
import { OrganizationRequired } from "@organizations/components/OrganizationRequired";
import { PageHeader } from "@shared/components/PageHeader";

const STAGES = new Set(["prepare", "test", "hosting", "advanced"]);

export default async function KnowledgePage({
	searchParams,
}: {
	searchParams: Promise<{ stage?: string }>;
}) {
	const { stage } = await searchParams;
	const currentStage = STAGES.has(stage ?? "")
		? (stage as "prepare" | "test" | "hosting" | "advanced")
		: "prepare";
	return (
		<>
			<PageHeader
				title="知识与托管"
				subtitle="从商户资料到 Test CA、人工验收与托管的一条清晰路径。"
				className="max-w-7xl mx-auto"
			/>
			<OrganizationRequired>
				<div className="max-w-7xl mx-auto">
					<KnowledgeWorkspace stage={currentStage} />
				</div>
			</OrganizationRequired>
		</>
	);
}
