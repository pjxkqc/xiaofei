import { EmailMirrorMock } from "@ai/components/EmailMirrorMock";
import { MockWorker } from "@ai/components/MockWorker";
import { OrganizationRequired } from "@organizations/components/OrganizationRequired";
import { PageHeader } from "@shared/components/PageHeader";

export default function MockWorkerPage() {
	return (
		<>
			<PageHeader
				title="Mock Worker"
				subtitle="Send organization-scoped Email or WhatsApp test traffic through the governed Xiaofei loop."
				className="max-w-6xl mx-auto"
			/>
			<OrganizationRequired>
				<div className="max-w-6xl mx-auto">
					<MockWorker />
					<div className="mt-6">
						<EmailMirrorMock />
					</div>
				</div>
			</OrganizationRequired>
		</>
	);
}
