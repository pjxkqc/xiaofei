import { EmailBindings } from "@ai/components/EmailBindings";
import { EmailIntegrationNav } from "@ai/components/EmailIntegrationNav";
import { OrganizationRequired } from "@organizations/components/OrganizationRequired";
import { PageHeader } from "@shared/components/PageHeader";

export default function EmailBindingsPage() {
	return (
		<>
			<PageHeader
				title="Email 邮箱绑定"
				subtitle="把 Worker 的 companyId 与邮箱账号安全映射到当前 Organization。"
				className="max-w-6xl mx-auto"
			/>
			<OrganizationRequired>
				<div className="max-w-6xl mx-auto">
					<EmailIntegrationNav current="guide" />
					<EmailBindings isPreview={process.env.VERCEL_ENV === "preview"} />
				</div>
			</OrganizationRequired>
		</>
	);
}
