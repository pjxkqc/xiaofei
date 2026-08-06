export function acceptanceGate({
	reviewed,
	evalPassed,
	evalVersion,
	planVersion,
	hasActive,
}: {
	reviewed: boolean;
	evalPassed: boolean;
	evalVersion: string | number | null;
	planVersion: string | number;
	hasActive: boolean;
}) {
	const admitted = reviewed && evalPassed && evalVersion === planVersion;
	return { admitted, canActivate: admitted && !hasActive, canCreate: admitted && hasActive };
}
