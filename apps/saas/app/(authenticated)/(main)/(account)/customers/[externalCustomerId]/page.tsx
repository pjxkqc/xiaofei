import { CustomerDetail } from "@ai/components/Customers";
import { OrganizationRequired } from "@organizations/components/OrganizationRequired";
import { PageHeader } from "@shared/components/PageHeader";

export default async function CustomerPage({
	params,
}: {
	params: Promise<{ externalCustomerId: string }>;
}) {
	const { externalCustomerId } = await params;
	return (
		<>
			<PageHeader
				title="客户详情"
				subtitle="查看客户资料及其当前 Organization 内的会话。"
				className="max-w-7xl mx-auto"
			/>
			<OrganizationRequired>
				<div className="max-w-7xl mx-auto">
					<CustomerDetail externalCustomerId={externalCustomerId} />
				</div>
			</OrganizationRequired>
		</>
	);
}
