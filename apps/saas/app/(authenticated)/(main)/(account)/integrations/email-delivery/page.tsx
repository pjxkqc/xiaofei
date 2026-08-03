import { EmailDeliveryManager } from "@ai/components/EmailDeliveryManager";
import { EmailIntegrationNav } from "@ai/components/EmailIntegrationNav";
import { OrganizationRequired } from "@organizations/components/OrganizationRequired";
import { PageHeader } from "@shared/components/PageHeader";

export default function EmailDeliveryPage() {
	return (
		<>
			<PageHeader
				title="Email 回复回递"
				subtitle="配置 Worker Receiver、验证状态事件，并观测小飞回复 Outbox 的每次尝试。"
				className="max-w-6xl mx-auto"
			/>
			<OrganizationRequired>
				<div className="max-w-6xl mx-auto">
					<EmailIntegrationNav current="delivery" />
					<EmailDeliveryManager />
				</div>
			</OrganizationRequired>
		</>
	);
}
