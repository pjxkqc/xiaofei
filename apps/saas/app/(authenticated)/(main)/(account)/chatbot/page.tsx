import { XiaofeiAgentConsole } from "@ai/components/XiaofeiAgentConsole";
import { PageHeader } from "@shared/components/PageHeader";

export default async function AiDemoPage() {
	return (
		<>
			<PageHeader
				title="Xiaofei Agent"
				subtitle="Configure Knowledge Units and validate the governed P0 runtime in one place."
				className="max-w-7xl mx-auto"
			/>

			<div className="max-w-7xl mx-auto">
				<XiaofeiAgentConsole />
			</div>
		</>
	);
}
