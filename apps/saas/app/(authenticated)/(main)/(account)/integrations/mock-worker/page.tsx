import { MockWorker } from "@ai/components/MockWorker";
import { OrganizationRequired } from "@organizations/components/OrganizationRequired";
import { PageHeader } from "@shared/components/PageHeader";

export default function MockWorkerPage() {
	return (
		<>
			<PageHeader
				title="通用消息 Mock"
				subtitle="验证旧版 Email / WhatsApp 通用消息闭环；Email Kafka 双向联调请使用专用向导。"
				className="max-w-6xl mx-auto"
			/>
			<OrganizationRequired>
				<div className="max-w-6xl mx-auto">
					<MockWorker />
				</div>
			</OrganizationRequired>
		</>
	);
}
