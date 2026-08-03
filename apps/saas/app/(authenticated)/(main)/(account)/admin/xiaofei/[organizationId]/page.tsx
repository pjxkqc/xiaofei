import { XiaofeiOrganizationDetail } from "@admin/component/xiaofei/XiaofeiOrganizationDetail";

export default async function AdminXiaofeiOrganizationPage({
	params,
}: {
	params: Promise<{ organizationId: string }>;
}) {
	const { organizationId } = await params;
	return <XiaofeiOrganizationDetail organizationId={organizationId} />;
}
