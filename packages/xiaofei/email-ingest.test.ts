import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { EmailMessageIngestV1Schema, isCustomerInboundEmailJobEligible } from "./index";

const validEmail = {
	schemaVersion: "email.message.v1",
	eventId: "email:realtime:42:987654321:1d56abc",
	occurredAt: "2026-08-03T03:20:00.000Z",
	tenant: { companyId: "42" },
	channel: "email",
	channelAccount: { id: "mailbox_123", address: "support@example.com" },
	conversation: { externalId: "email:42:1d56abc", loopdeskSessionId: null },
	message: {
		sourceMessageId: "email:987654321",
		providerMessageId: "<current@example.com>",
		replyToSourceMessageId: "email:987654000",
		direction: "inbound",
		senderType: "customer",
		from: { address: "customer@example.com", name: "Customer" },
		to: [{ address: "support@example.com", name: null }],
		subject: "Where is my order?",
		content: { type: "text/html", value: "<p>Where is my order?</p>" },
		attachments: [
			{
				url: "https://controlled.example.com/attachments/photo.png",
				contentType: "image/png",
				name: "photo.png",
				size: 12_345,
			},
		],
		sentAt: "2026-08-03T03:20:00.000Z",
		labels: [],
		sourceSendType: 10,
	},
	source: {
		system: "mail-service",
		topic: "UAT_RealTimeEmail",
		partition: 0,
		offset: 123_456,
		workerVersion: "git-sha-or-image-tag",
	},
};

describe("EmailMessageIngestV1", () => {
	it("keeps the committed Worker handoff fixture valid", () => {
		const fixture = JSON.parse(
			readFileSync(
				new URL("../../docs/acceptance/email-message.v1.example.json", import.meta.url),
				"utf8",
			),
		);
		expect(EmailMessageIngestV1Schema.parse(fixture).eventId).toBe(fixture.eventId);
	});

	it("accepts every required envelope and message fact field", () => {
		const message = EmailMessageIngestV1Schema.parse(validEmail);

		expect(message).toEqual(validEmail);
		expect(isCustomerInboundEmailJobEligible(message)).toBe(true);
	});

	it("requires every top-level envelope field", () => {
		for (const field of [
			"schemaVersion",
			"eventId",
			"occurredAt",
			"tenant",
			"channel",
			"channelAccount",
			"conversation",
			"message",
			"source",
		] as const) {
			const invalid = structuredClone(validEmail);
			delete invalid[field];
			expect(() => EmailMessageIngestV1Schema.parse(invalid), field).toThrow();
		}
	});

	it("requires the documented company, conversation, message, and source fields", () => {
		const missingFields = [
			() => ({ ...validEmail, tenant: {} }),
			() => ({ ...validEmail, channelAccount: { id: validEmail.channelAccount.id } }),
			() => ({ ...validEmail, conversation: { loopdeskSessionId: null } }),
			() => ({ ...validEmail, message: { ...validEmail.message, sourceMessageId: undefined } }),
			() => ({ ...validEmail, message: { ...validEmail.message, direction: undefined } }),
			() => ({ ...validEmail, message: { ...validEmail.message, senderType: undefined } }),
			() => ({ ...validEmail, message: { ...validEmail.message, from: undefined } }),
			() => ({ ...validEmail, message: { ...validEmail.message, to: [] } }),
			() => ({ ...validEmail, message: { ...validEmail.message, content: undefined } }),
			() => ({ ...validEmail, message: { ...validEmail.message, sentAt: undefined } }),
			() => ({ ...validEmail, source: { ...validEmail.source, topic: undefined } }),
			() => ({ ...validEmail, source: { ...validEmail.source, partition: -1 } }),
			() => ({ ...validEmail, source: { ...validEmail.source, offset: -1 } }),
			() => ({ ...validEmail, source: { ...validEmail.source, workerVersion: undefined } }),
		];

		for (const invalid of missingFields)
			expect(() => EmailMessageIngestV1Schema.parse(invalid())).toThrow();
	});

	it("rejects unknown and internal fields at every contract boundary", () => {
		for (const invalid of [
			{ ...validEmail, workspaceId: "workspace-1" },
			{ ...validEmail, ownerEpoch: 4 },
			{ ...validEmail, hostingVersion: "host-v1" },
			{ ...validEmail, triggerAi: true },
			{ ...validEmail, tenant: { ...validEmail.tenant, workspaceId: "workspace-1" } },
			{ ...validEmail, channelAccount: { ...validEmail.channelAccount, ownerEpoch: 4 } },
			{ ...validEmail, conversation: { ...validEmail.conversation, triggerAi: true } },
			{ ...validEmail, message: { ...validEmail.message, workspaceId: "workspace-1" } },
			{ ...validEmail, source: { ...validEmail.source, ownerEpoch: 4 } },
			{
				...validEmail,
				message: { ...validEmail.message, from: { ...validEmail.message.from, id: "x" } },
			},
		])
			expect(() => EmailMessageIngestV1Schema.parse(invalid)).toThrow();
	});

	it("enforces the version, date, stable IDs, and tenant-matched conversation prefix", () => {
		for (const invalid of [
			{ ...validEmail, schemaVersion: "email-message-ingest-v1" },
			{ ...validEmail, occurredAt: "not-a-date" },
			{ ...validEmail, eventId: "event with spaces" },
			{
				...validEmail,
				conversation: { ...validEmail.conversation, externalId: "company:42:pair" },
			},
			{ ...validEmail, conversation: { ...validEmail.conversation, externalId: "email:99:pair" } },
			{ ...validEmail, message: { ...validEmail.message, sentAt: "not-a-date" } },
			{
				...validEmail,
				message: { ...validEmail.message, from: { address: "invalid", name: null } },
			},
		])
			expect(() => EmailMessageIngestV1Schema.parse(invalid)).toThrow();
	});

	it("does not cap or truncate source content and controlled attachment metadata", () => {
		const contentValue = "x".repeat(1_200_000);
		const message = EmailMessageIngestV1Schema.parse({
			...validEmail,
			message: {
				...validEmail.message,
				content: { type: "text/plain", value: contentValue },
				attachments: [{ ...validEmail.message.attachments[0], size: 26 * 1024 * 1024 }],
			},
		});

		expect(message.message.content.value).toHaveLength(contentValue.length);
		expect(message.message.attachments?.[0]?.size).toBe(26 * 1024 * 1024);
	});

	it("accepts each valid direction and sender type combination", () => {
		for (const [direction, senderType, eligible] of [
			["inbound", "customer", true],
			["outbound", "loopdesk", false],
			["outbound", "xiaofei", false],
			["outbound", "system", false],
		] as const) {
			const message = EmailMessageIngestV1Schema.parse({
				...validEmail,
				message: { ...validEmail.message, direction, senderType },
			});
			expect(isCustomerInboundEmailJobEligible(message)).toBe(eligible);
		}
	});

	it("rejects each impossible direction and sender type combination", () => {
		for (const [direction, senderType] of [
			["inbound", "loopdesk"],
			["inbound", "xiaofei"],
			["inbound", "system"],
			["outbound", "customer"],
		] as const)
			expect(() =>
				EmailMessageIngestV1Schema.parse({
					...validEmail,
					message: { ...validEmail.message, direction, senderType },
				}),
			).toThrow();
	});
});
