import { KnowledgeFlowNav } from "@ai/components/KnowledgeFlowNav";
import { XiaofeiChatConsole } from "@ai/components/XiaofeiChatConsole";
import { OrganizationRequired } from "@organizations/components/OrganizationRequired";
import { PageHeader } from "@shared/components/PageHeader";

export default async function AiDemoPage() {
	return (
		<>
			<PageHeader
				title="Xiaofei Chatbot"
				subtitle="Validate the governed P0 conversation flow with a unified Agent runtime."
				className="max-w-5xl mx-auto"
			/>

			<OrganizationRequired>
				<div className="max-w-5xl mx-auto">
					<KnowledgeFlowNav current="conversation" />
					<XiaofeiChatConsole />
				</div>
			</OrganizationRequired>
		</>
	);
}
