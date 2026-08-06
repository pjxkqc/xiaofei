import { ORPCError } from "@orpc/server";
import { runXiaofeiTurn } from "@repo/ai";
import {
	getXiaofeiConversation,
	listXiaofeiConversations,
	type Prisma,
	touchXiaofeiSupportConversation,
	type XiaofeiSupportConversationExpectation,
	XiaofeiSupportConversationConflictError,
	updateXiaofeiSupportConversation,
	upsertXiaofeiSupportConversation,
} from "@repo/database";
import {
	ConversationStateSchema,
	SupportConversationSchema,
	SupportConversationSummarySchema,
	SupportMessageSchema,
	SyntheticAcceptanceMetadataSchema,
	TraceEventSchema,
	createConversationState,
	transferConversationOwner,
	type SupportConversation,
	type SupportConversationSummary,
	type SupportMessage,
} from "@repo/xiaofei";
import { z } from "zod";

import {
	createKnowledgeWorkspaceBinding,
	getOrCreatePublicXiaofeiWorkspace,
	getOrCreateXiaofeiWorkspace,
	type XiaofeiAuthContext,
} from "./service";

const ONLINE_WINDOW_MS = 30_000;
const MAX_MESSAGES = 160;

type SupportConversationRecord = Omit<
	NonNullable<Awaited<ReturnType<typeof getXiaofeiConversation>>>,
	"customer" | "processingJobs" | "outboundDeliveries"
> & {
	// Writes return the base record; list/get queries include this relation for display.
	customer?: { name: string | null } | null;
	processingJobs?: Array<{ id: string; status: string }>;
	outboundDeliveries?: Array<{ status: string }>;
};

export async function startPublicSupportConversation(customerName: string) {
	const { workspace, snapshot } = await getOrCreatePublicXiaofeiWorkspace();
	const now = new Date();
	const externalId = globalThis.crypto.randomUUID();
	const messages = [
		createMessage(
			"ai",
			snapshot.agent.name,
			"您好，我是小飞。请告诉我您遇到的问题；需要人工处理时，我会及时转交真人客服。",
			now,
		),
	];
	const state = createConversationState({
		id: externalId,
		tenantId: snapshot.agent.tenantId,
		agentId: snapshot.agent.id,
		maxFollowUps: snapshot.agent.maxFollowUps,
		now: () => now.toISOString(),
	});

	const conversation = await upsertXiaofeiSupportConversation({
		workspaceId: workspace.id,
		externalId,
		customerName: normalizeCustomerName(customerName),
		state: toJson(state),
		traceEvents: [],
		messages: toJson(messages),
		lastCustomerSeenAt: now,
		lastMessageAt: now,
	});

	return toConversation(conversation);
}

export async function getPublicSupportConversation(externalId: string) {
	const { workspace } = await getOrCreatePublicXiaofeiWorkspace();
	const existing = await getRequiredConversation(workspace.id, externalId);
	if (existing.status === "closed") return toConversation(existing);

	const touched = await touchXiaofeiSupportConversation(workspace.id, externalId, new Date());
	return toConversation(touched);
}

export async function sendPublicSupportMessage(
	externalId: string,
	text: string,
	expectation: XiaofeiSupportConversationExpectation,
) {
	const { workspace, snapshot } = await getOrCreatePublicXiaofeiWorkspace();
	const existing = await getRequiredConversation(workspace.id, externalId);
	assertSupportExpectation(existing, expectation);
	if (existing.status === "closed") {
		throw new ORPCError("BAD_REQUEST", { message: "This conversation is closed." });
	}

	const now = new Date();
	const state = ConversationStateSchema.parse(existing.state);
	const currentMessages = parseMessages(existing);
	const customerMessage = createMessage("customer", existing.customerName ?? "访客", text, now);
	let messages = [...currentMessages, customerMessage];
	let nextState = state;
	let traces = z.array(TraceEventSchema).parse(existing.traceEvents);

	if (state.ownerType === "ai") {
		const result = await runXiaofeiTurn({
			message: text,
			state,
			snapshot,
			knowledgeWorkspaceBinding: createKnowledgeWorkspaceBinding({
				workspace,
				snapshot,
				conversationId: state.id,
				channelId: "public:support",
			}),
		});
		nextState = result.state;
		traces = [...traces, ...result.metadata.traces].slice(-80);
		messages.push(createMessage("ai", snapshot.agent.name, result.reply));
	}

	messages = messages.slice(-MAX_MESSAGES);
	const updated = await commitSupportConversation(
		workspace.id,
		externalId,
		persistenceExpectation(existing),
		{
			state: toJson(nextState),
			traceEvents: toJson(traces),
			messages: toJson(messages),
			lastCustomerSeenAt: now,
			lastMessageAt: now,
		},
	);

	return toConversation(updated);
}

export async function listSupportConversations(
	context: XiaofeiAuthContext,
): Promise<SupportConversationSummary[]> {
	const { workspace } = await getOrCreateXiaofeiWorkspace(context);
	const conversations = await listXiaofeiConversations(workspace.id);
	return conversations
		.map(toSummary)
		.sort((left, right) => Number(right.attentionRequired) - Number(left.attentionRequired));
}

export async function getSupportConversation(context: XiaofeiAuthContext, externalId: string) {
	const { workspace } = await getOrCreateXiaofeiWorkspace(context);
	return toConversation(await getRequiredConversation(workspace.id, externalId));
}

export async function setSupportConversationOwner(input: {
	context: XiaofeiAuthContext;
	externalId: string;
	owner: "ai" | "human";
	user: { id: string; name: string };
	expectation: XiaofeiSupportConversationExpectation;
}) {
	const { workspace } = await getOrCreateXiaofeiWorkspace(input.context);
	const existing = await getRequiredConversation(workspace.id, input.externalId);
	assertSupportExpectation(existing, input.expectation);
	if (existing.status === "closed") {
		throw new ORPCError("BAD_REQUEST", { message: "This conversation is closed." });
	}

	const state = ConversationStateSchema.parse(existing.state);
	const nextState = transferConversationOwner(state, state.ownerEpoch, input.owner);
	const updated = await commitSupportConversation(
		workspace.id,
		input.externalId,
		persistenceExpectation(existing),
		{
			state: toJson(nextState),
			assignedUserId: input.owner === "human" ? input.user.id : null,
			assignedUserName: input.owner === "human" ? input.user.name : null,
		},
	);
	return toConversation(updated);
}

export async function sendHumanSupportMessage(input: {
	context: XiaofeiAuthContext;
	externalId: string;
	text: string;
	user: { id: string; name: string };
	expectation: XiaofeiSupportConversationExpectation;
}) {
	const { workspace } = await getOrCreateXiaofeiWorkspace(input.context);
	const existing = await getRequiredConversation(workspace.id, input.externalId);
	assertSupportExpectation(existing, input.expectation);
	const state = ConversationStateSchema.parse(existing.state);
	if (existing.status === "closed" || state.ownerType !== "human") {
		throw new ORPCError("BAD_REQUEST", {
			message: "Take over the conversation before sending a human reply.",
		});
	}

	const now = new Date();
	const messages = [
		...parseMessages(existing),
		createMessage("human", input.user.name, input.text, now),
	].slice(-MAX_MESSAGES);
	const updated = await commitSupportConversation(
		workspace.id,
		input.externalId,
		persistenceExpectation(existing),
		{
			state: toJson(state),
			assignedUserId: input.user.id,
			assignedUserName: input.user.name,
			messages: toJson(messages),
			lastMessageAt: now,
		},
	);
	return toConversation(updated);
}

async function getRequiredConversation(workspaceId: string, externalId: string) {
	const conversation = await getXiaofeiConversation(workspaceId, externalId);
	if (!conversation) throw new ORPCError("NOT_FOUND");
	return conversation;
}

function toConversation(record: SupportConversationRecord): SupportConversation {
	const state = ConversationStateSchema.parse(record.state);
	return SupportConversationSchema.parse({
		...toSummary(record),
		messages: parseMessages(record),
		handoffReason: state.handoffPackage?.reason ?? state.handoffReason ?? null,
	});
}

function toSummary(record: SupportConversationRecord): SupportConversationSummary {
	const state = ConversationStateSchema.parse(record.state);
	const messages = parseMessages(record);
	const lastMessage = messages[messages.length - 1];
	return SupportConversationSummarySchema.parse({
		id: record.externalId,
		customerId: record.customerId,
		customerName: record.customer?.name ?? record.customerName ?? "访客",
		channel: record.channel,
		status: record.status,
		ownerType: state.ownerType,
		ownerEpoch: record.ownerEpoch ?? state.ownerEpoch,
		revision: record.revision,
		stage: state.stage,
		attentionRequired: state.operatorAttention !== null,
		attentionReason: state.operatorAttention?.reason ?? null,
		attentionSince: state.operatorAttention?.since ?? null,
		online:
			record.lastCustomerSeenAt !== null &&
			Date.now() - record.lastCustomerSeenAt.getTime() <= ONLINE_WINDOW_MS,
		assignedUserName: record.assignedUserName,
		processingJobId: record.processingJobs?.[0]?.status
			? (record.processingJobs[0].id ?? null)
			: null,
		processingStatus: record.processingJobs?.[0]?.status ?? null,
		deliveryStatus: record.outboundDeliveries?.[0]?.status ?? null,
		syntheticAcceptance:
			record.syntheticAcceptance === null
				? null
				: SyntheticAcceptanceMetadataSchema.parse(record.syntheticAcceptance),
		lastMessage: lastMessage?.text ?? "",
		lastMessageAt: record.lastMessageAt?.toISOString() ?? null,
		updatedAt: record.updatedAt.toISOString(),
	});
}

function parseMessages(record: SupportConversationRecord): SupportMessage[] {
	return z.array(SupportMessageSchema).parse(record.messages);
}

function createMessage(
	role: SupportMessage["role"],
	authorName: string,
	text: string,
	now: Date = new Date(),
): SupportMessage {
	return SupportMessageSchema.parse({
		id: globalThis.crypto.randomUUID(),
		role,
		authorName,
		text: text.trim(),
		createdAt: now.toISOString(),
	});
}

function normalizeCustomerName(value: string): string {
	return value.trim() || "访客";
}

function assertSupportExpectation(
	record: Pick<SupportConversationRecord, "revision" | "state">,
	expectation: XiaofeiSupportConversationExpectation,
) {
	const state = ConversationStateSchema.parse(record.state);
	if (
		record.revision !== expectation.expectedRevision ||
		state.ownerType !== expectation.expectedOwnerType ||
		state.ownerEpoch !== expectation.expectedOwnerEpoch
	)
		throw new ORPCError("CONFLICT", {
			message: "This support conversation changed; the latest state has been preserved.",
		});
}

function persistenceExpectation(
	record: Pick<SupportConversationRecord, "revision" | "ownerType" | "ownerEpoch">,
): XiaofeiSupportConversationExpectation {
	return {
		expectedRevision: record.revision,
		expectedOwnerType: record.ownerType,
		expectedOwnerEpoch: record.ownerEpoch,
	};
}

async function commitSupportConversation(
	workspaceId: string,
	externalId: string,
	expectation: XiaofeiSupportConversationExpectation,
	data: Parameters<typeof updateXiaofeiSupportConversation>[3],
) {
	try {
		return await updateXiaofeiSupportConversation(workspaceId, externalId, expectation, data);
	} catch (error) {
		if (error instanceof XiaofeiSupportConversationConflictError)
			throw new ORPCError("CONFLICT", {
				message: "This support conversation changed; the latest state has been preserved.",
			});
		throw error;
	}
}

function toJson(value: unknown): Prisma.InputJsonValue {
	return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
