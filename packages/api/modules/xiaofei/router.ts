import { getXiaofeiConfig } from "./procedures/get-config";
import { getXiaofeiStatus } from "./procedures/get-status";
import {
	createKnowledgeDocumentProcedure,
	createKnowledgeWebProcedure,
	createManualKnowledgeEntriesProcedure,
	deleteKnowledgeDocumentProcedure,
	deleteKnowledgeEntryProcedure,
	deleteKnowledgeUnitProcedure,
	generateKnowledgeUnitsProcedure,
	getKnowledgeDocumentProcedure,
	getKnowledgeEntryProcedure,
	listKnowledgeDocumentsProcedure,
	listKnowledgeEntriesProcedure,
	listKnowledgeUnitsProcedure,
	transitionKnowledgeUnitProcedure,
	updateKnowledgeDocumentProcedure,
	updateKnowledgeEntryProcedure,
	updateKnowledgeUnitProcedure,
} from "./procedures/knowledge-documents";
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
	status: getXiaofeiStatus,
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
	createKnowledgeDocument: createKnowledgeDocumentProcedure,
	createKnowledgeWeb: createKnowledgeWebProcedure,
	createManualKnowledgeEntries: createManualKnowledgeEntriesProcedure,
	listKnowledgeDocuments: listKnowledgeDocumentsProcedure,
	getKnowledgeDocument: getKnowledgeDocumentProcedure,
	updateKnowledgeDocument: updateKnowledgeDocumentProcedure,
	deleteKnowledgeDocument: deleteKnowledgeDocumentProcedure,
	listKnowledgeEntries: listKnowledgeEntriesProcedure,
	getKnowledgeEntry: getKnowledgeEntryProcedure,
	updateKnowledgeEntry: updateKnowledgeEntryProcedure,
	deleteKnowledgeEntry: deleteKnowledgeEntryProcedure,
	generateKnowledgeUnits: generateKnowledgeUnitsProcedure,
	listKnowledgeUnits: listKnowledgeUnitsProcedure,
	updateKnowledgeUnit: updateKnowledgeUnitProcedure,
	transitionKnowledgeUnit: transitionKnowledgeUnitProcedure,
	deleteKnowledgeUnit: deleteKnowledgeUnitProcedure,
};
