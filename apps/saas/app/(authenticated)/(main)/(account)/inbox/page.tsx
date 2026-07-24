import { SupportInbox } from "@ai/components/SupportInbox";
import { PageHeader } from "@shared/components/PageHeader";

export default function SupportInboxPage() {
	return (
		<>
			<PageHeader
				title="客服工作台"
				subtitle="查看客户在线状态、小飞接管状态，并在需要时切换为真人回复。"
				className="max-w-7xl mx-auto"
			/>
			<div className="max-w-7xl mx-auto">
				<SupportInbox />
			</div>
		</>
	);
}
