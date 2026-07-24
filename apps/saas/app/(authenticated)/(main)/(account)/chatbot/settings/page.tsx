import { XiaofeiAgentSettings } from "@ai/components/XiaofeiAgentSettings";
import { PageHeader } from "@shared/components/PageHeader";

export default async function XiaofeiAgentSettingsPage() {
	return (
		<>
			<PageHeader
				title="Xiaofei Agent 设置"
				subtitle="Configure the Agent, Knowledge Units, governance gates, and P0 evaluation."
				className="max-w-6xl mx-auto"
			/>

			<div className="max-w-6xl mx-auto">
				<XiaofeiAgentSettings />
			</div>
		</>
	);
}
