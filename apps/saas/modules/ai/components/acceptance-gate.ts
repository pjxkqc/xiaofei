export function acceptanceGate({
	reviewed,
	evalPassed,
	evalVersion,
	planVersion,
	isCurrentTestActive,
}: {
	reviewed: boolean;
	evalPassed: boolean;
	evalVersion: string | number | null;
	planVersion: string | number;
	isCurrentTestActive: boolean;
}) {
	const admitted = reviewed && evalPassed && evalVersion === planVersion;
	return {
		admitted,
		canActivate: admitted && !isCurrentTestActive,
		canCreate: admitted && isCurrentTestActive,
	};
}
