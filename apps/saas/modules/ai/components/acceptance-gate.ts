import type { XiaofeiWorkspaceSnapshot } from "@repo/xiaofei";

import { isAdmitted } from "./KnowledgeCapabilities";

export function acceptanceGate({
	capability,
	isCurrentTestActive,
}: {
	capability: XiaofeiWorkspaceSnapshot;
	isCurrentTestActive: boolean;
}) {
	const admitted = isAdmitted(capability);
	return {
		admitted,
		canActivate: admitted && !isCurrentTestActive,
		canCreate: admitted && isCurrentTestActive,
	};
}
