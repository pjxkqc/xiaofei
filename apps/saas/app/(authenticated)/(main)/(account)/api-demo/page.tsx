import { ApiStatusDemo } from "@shared/components/ApiStatusDemo";
import { PageHeader } from "@shared/components/PageHeader";

export default function ApiDemoPage() {
	return (
		<>
			<PageHeader
				title="API communication demo"
				subtitle="Compare the public OpenAPI route with the typed browser RPC client."
				className="max-w-6xl mx-auto"
			/>
			<div className="max-w-6xl mx-auto">
				<ApiStatusDemo />
			</div>
		</>
	);
}
