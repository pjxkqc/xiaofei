import { IntegrationEvents } from "@ai/components/IntegrationEvents";
import { PageHeader } from "@shared/components/PageHeader";

export default function IntegrationEventsPage() {
	return (
		<>
			<PageHeader
				title="Integration events"
				subtitle="Monitor durable S2S ingress without exposing credentials or loading payloads by default."
				className="max-w-6xl mx-auto"
			/>
			<div className="max-w-6xl mx-auto">
				<IntegrationEvents />
			</div>
		</>
	);
}
