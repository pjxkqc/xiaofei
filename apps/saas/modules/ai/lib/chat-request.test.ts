import { describe, expect, it } from "vitest";

import { createAiStreamRequest } from "./chat-request";

describe("createAiStreamRequest", () => {
	it("keeps workspace and knowledge binding resolution on the server", () => {
		const request = createAiStreamRequest({
			conversationId: "conversation-1",
			messages: [{ id: "message-1", role: "user" }],
		});

		expect(request).toEqual({
			conversationId: "conversation-1",
			messages: [{ id: "message-1", role: "user" }],
		});
		expect(request).not.toHaveProperty("knowledgeWorkspaceBinding");
	});
});
