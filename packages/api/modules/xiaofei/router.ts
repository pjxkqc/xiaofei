import { getXiaofeiConfig } from "./procedures/get-config";
import { resetXiaofeiConversation } from "./procedures/reset-conversation";
import { reviewXiaofeiCapability } from "./procedures/review-capability";
import { runXiaofeiEval } from "./procedures/run-eval";
import { saveXiaofeiConfig } from "./procedures/save-config";
import {
	getAgentConversation,
	getPublicConversation,
	listAgentConversations,
	sendAgentMessage,
	sendPublicMessage,
	setAgentConversationOwner,
	startSupportConversation,
} from "./procedures/support-conversations";

export const xiaofeiRouter = {
	getConfig: getXiaofeiConfig,
	saveConfig: saveXiaofeiConfig,
	reviewCapability: reviewXiaofeiCapability,
	resetConversation: resetXiaofeiConversation,
	runEval: runXiaofeiEval,
	startSupportConversation,
	getPublicConversation,
	sendPublicMessage,
	listAgentConversations,
	getAgentConversation,
	setAgentConversationOwner,
	sendAgentMessage,
};
