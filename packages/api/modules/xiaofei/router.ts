import { getXiaofeiConfig } from "./procedures/get-config";
import { resetXiaofeiConversation } from "./procedures/reset-conversation";
import { runXiaofeiEval } from "./procedures/run-eval";
import { saveXiaofeiConfig } from "./procedures/save-config";

export const xiaofeiRouter = {
	getConfig: getXiaofeiConfig,
	saveConfig: saveXiaofeiConfig,
	resetConversation: resetXiaofeiConversation,
	runEval: runXiaofeiEval,
};
