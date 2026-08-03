import { EmailIntegrationNav } from "@ai/components/EmailIntegrationNav";
import { EmailMirrorMock } from "@ai/components/EmailMirrorMock";
import { OrganizationRequired } from "@organizations/components/OrganizationRequired";
import { PageHeader } from "@shared/components/PageHeader";

export default function EmailInboundPage() {
	return (
		<>
			<PageHeader
				title="Email 入站验证"
				subtitle="用可读表单生成 Worker 请求，并确认客户、会话、消息和处理任务已经落库。"
				className="max-w-6xl mx-auto"
			/>
			<OrganizationRequired>
				<div className="max-w-6xl mx-auto">
					<EmailIntegrationNav current="inbound" />
					<EmailMirrorMock />
				</div>
			</OrganizationRequired>
		</>
	);
}
