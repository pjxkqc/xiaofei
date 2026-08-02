import { Customers } from "@ai/components/Customers";
import { OrganizationRequired } from "@organizations/components/OrganizationRequired";
import { PageHeader } from "@shared/components/PageHeader";

export default function CustomersPage() {
	return (
		<>
			<PageHeader
				title="客户"
				subtitle="管理当前 Organization 的客户和历史会话。"
				className="max-w-7xl mx-auto"
			/>
			<OrganizationRequired>
				<div className="max-w-7xl mx-auto">
					<Customers />
				</div>
			</OrganizationRequired>
		</>
	);
}
