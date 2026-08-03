import {
	archiveCustomer,
	createCustomer,
	getCustomer,
	listCustomers,
	updateCustomer,
} from "./procedures/customers";
import {
	createEmailBindingProcedure,
	disableEmailBindingProcedure,
	enableEmailBindingProcedure,
	listEmailBindingsProcedure,
	updateEmailBindingProcedure,
} from "./procedures/email-bindings";
import { getXiaofeiConfig } from "./procedures/get-config";
import { getXiaofeiStatus } from "./procedures/get-status";
import {
	getIntegrationEventProcedure,
	listIntegrationEventsProcedure,
	simulateIntegrationEventProcedure,
	runMockWorkerProcedure,
	runMockEmailMirrorProcedure,
} from "./procedures/integration-events";
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
import { saveXiaofeiAgentSettings } from "./procedures/save-agent-settings";
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
	listCustomers,
	getCustomer,
	createCustomer,
	updateCustomer,
	archiveCustomer,
	status: getXiaofeiStatus,
	listIntegrationEvents: listIntegrationEventsProcedure,
	getIntegrationEvent: getIntegrationEventProcedure,
	simulateIntegrationEvent: simulateIntegrationEventProcedure,
	runMockWorker: runMockWorkerProcedure,
	runMockEmailMirror: runMockEmailMirrorProcedure,
	listEmailBindings: listEmailBindingsProcedure,
	createEmailBinding: createEmailBindingProcedure,
	updateEmailBinding: updateEmailBindingProcedure,
	enableEmailBinding: enableEmailBindingProcedure,
	disableEmailBinding: disableEmailBindingProcedure,
	getConfig: getXiaofeiConfig,
	saveAgentSettings: saveXiaofeiAgentSettings,
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
