export function createAiStreamRequest<TMessage>(input: {
	conversationId: string;
	messages: TMessage[];
}) {
	return {
		conversationId: input.conversationId,
		messages: input.messages,
	};
}
