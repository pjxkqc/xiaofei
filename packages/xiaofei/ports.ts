export interface CustomerMessage {
	conversationId: string;
	text: string;
}

export interface PrivateNote {
	conversationId: string;
	text: string;
}

/**
 * Product-owned channel boundary. LookDesk, Chatwoot or another customer-service
 * system implements this interface; runtimes never call vendor SDKs directly.
 */
export interface XiaofeiChannelAdapter {
	sendCustomerMessage(message: CustomerMessage): Promise<{ externalMessageId: string }>;
	addPrivateNote(note: PrivateNote): Promise<{ externalNoteId: string }>;
	requestHumanHandoff(input: {
		conversationId: string;
		reason: string;
	}): Promise<{ externalHandoffId: string }>;
}
