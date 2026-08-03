import { EmailIntegrationGuide } from "@ai/components/EmailIntegrationGuide";
import { EmailIntegrationNav } from "@ai/components/EmailIntegrationNav";
import { OrganizationRequired } from "@organizations/components/OrganizationRequired";
import { PageHeader } from "@shared/components/PageHeader";

export default function EmailIntegrationPage() {
	return (
		<>
			<PageHeader
				title="Email 双向联调"
				subtitle="给 Worker 同事的一站式接入指引：投递、会话消费、小飞处理与回复回递。"
				className="max-w-6xl mx-auto"
			/>
			<OrganizationRequired>
				<div className="max-w-6xl mx-auto">
					<EmailIntegrationNav current="guide" />
					<EmailIntegrationGuide />
				</div>
			</OrganizationRequired>
		</>
	);
}
