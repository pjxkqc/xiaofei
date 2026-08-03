import { EmailBindings } from "@ai/components/EmailBindings";
import { OrganizationRequired } from "@organizations/components/OrganizationRequired";
import { PageHeader } from "@shared/components/PageHeader";

export default function EmailBindingsPage() {
	return (
		<>
			<PageHeader
				title="Email bindings"
				subtitle="Organization-scoped company mailbox bindings for the Email mirror."
				className="max-w-6xl mx-auto"
			/>
			<OrganizationRequired>
				<div className="max-w-6xl mx-auto">
					<EmailBindings />
				</div>
			</OrganizationRequired>
		</>
	);
}
