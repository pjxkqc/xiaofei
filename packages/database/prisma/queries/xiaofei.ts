import { createHash } from "node:crypto";

import { db } from "../client";
import {
	XiaofeiKnowledgeDocumentFileType,
	XiaofeiKnowledgeDocumentSourceType,
} from "../generated/client";
import type {
	Prisma,
	XiaofeiInboundEvent,
	XiaofeiKnowledgeDocumentCategory,
} from "../generated/client";

export interface UpsertXiaofeiOrganizationConfigInput {
	externalMerchantId?: string | null;
	xiaofeiEnabled?: boolean;
}

export interface CreateXiaofeiCustomerInput {
	organizationId: string;
	externalCustomerId: string;
	name?: string | null;
	email?: string | null;
	whatsappNumber?: string | null;
	status?: string;
	lastSeenAt?: Date | null;
}

export interface UpdateXiaofeiCustomerInput {
	name?: string | null;
	email?: string | null;
	whatsappNumber?: string | null;
	status?: string;
	lastSeenAt?: Date | null;
}

export interface UpdateXiaofeiInboundEventStatusInput {
	status: "processing" | "processed" | "failed";
	processedAt?: Date | null;
	lastError?: string | null;
}

export interface AcceptInboundEventInput {
	source: string;
	eventId: string;
	schemaVersion: string;
	transportKind: string;
	topic?: string | null;
	partition?: number | null;
	offset?: string | null;
	messageKey?: string | null;
	eventType: string;
	occurredAt: Date;
	payload: Prisma.InputJsonValue;
	safeHeaders?: Prisma.InputJsonValue;
	status?: string;
}

export interface ListInboundEventsOptions {
	cursor?: string;
	limit?: number;
	source?: string;
	status?: string;
	topic?: string;
}

export class XiaofeiInboundEventConflictError extends Error {
	readonly code = "INBOUND_EVENT_PAYLOAD_CONFLICT";

	constructor(
		readonly workspaceId: string,
		readonly source: string,
		readonly eventId: string,
	) {
		super("An inbound event with this source and event ID has a different payload.");
		this.name = "XiaofeiInboundEventConflictError";
	}
}

export class XiaofeiOrganizationWorkspaceNotFoundError extends Error {
	constructor(readonly organizationId: string) {
		super("The Organization does not have a Xiaofei workspace.");
		this.name = "XiaofeiOrganizationWorkspaceNotFoundError";
	}
}

export class XiaofeiOrganizationCustomerNotFoundError extends Error {
	constructor(
		readonly organizationId: string,
		readonly customerId: string,
	) {
		super("The Xiaofei customer does not belong to this Organization.");
		this.name = "XiaofeiOrganizationCustomerNotFoundError";
	}
}

export interface CreateXiaofeiKnowledgeDocumentInput {
	workspaceId: string;
	originalFileName?: string;
	mimeType?: string;
	fileType?: XiaofeiKnowledgeDocumentFileType;
	sourceType?: XiaofeiKnowledgeDocumentSourceType;
	sourceUrl?: string;
	fileSizeBytes?: number;
	provider?: string;
	parserVersion?: string;
	category: XiaofeiKnowledgeDocumentCategory;
	bodyText: string;
	fetchedAt?: Date;
	parseStatus?: string;
	parseError?: string;
	status?: string;
}

export interface UpdateXiaofeiKnowledgeDocumentInput {
	originalFileName?: string | null;
	mimeType?: string | null;
	fileType?: XiaofeiKnowledgeDocumentFileType | null;
	sourceType?: XiaofeiKnowledgeDocumentSourceType;
	sourceUrl?: string | null;
	fileSizeBytes?: number | null;
	provider?: string | null;
	parserVersion?: string | null;
	category?: XiaofeiKnowledgeDocumentCategory;
	bodyText?: string;
	fetchedAt?: Date | null;
	parseStatus?: string;
	parseError?: string | null;
	status?: string;
}

export interface ListXiaofeiKnowledgeDocumentsOptions {
	cursor?: string;
	limit?: number;
}

export interface CreateXiaofeiKnowledgeEntryInput {
	workspaceId: string;
	sourceId: string;
	question: string;
	answer: string;
	similarQueries?: string[];
	category?: string;
	tags?: string[];
	status?: string;
}

export interface CreateXiaofeiKnowledgeDocumentWithEntriesInput {
	document: CreateXiaofeiKnowledgeDocumentInput;
	entries: Omit<CreateXiaofeiKnowledgeEntryInput, "workspaceId" | "sourceId">[];
}

export interface UpdateXiaofeiKnowledgeEntryInput {
	sourceId?: string;
	question?: string;
	answer?: string;
	similarQueries?: string[];
	category?: string | null;
	tags?: string[];
	status?: string;
}

export interface ListXiaofeiKnowledgeEntriesOptions {
	cursor?: string;
	limit?: number;
}

export interface CreateXiaofeiKnowledgeUnitInput {
	workspaceId: string;
	entryId: string;
	title: string;
	content: Prisma.InputJsonValue;
	status?: string;
	eligibility?: string;
	staleReason?: string | null;
}

export interface UpdateXiaofeiKnowledgeUnitInput {
	title?: string;
	content?: Prisma.InputJsonValue;
	status?: string;
	eligibility?: string;
	staleReason?: string | null;
}

export const DEFAULT_XIAOFEI_KNOWLEDGE_DOCUMENT_PAGE_SIZE = 25;
export const MAX_XIAOFEI_KNOWLEDGE_DOCUMENT_PAGE_SIZE = 50;
export const MAX_XIAOFEI_KNOWLEDGE_DOCUMENTS_PER_WORKSPACE = 100;
export const MAX_XIAOFEI_KNOWLEDGE_DOCUMENT_BODY_BYTES_PER_WORKSPACE = 20 * 1024 * 1024;
export const MAX_XIAOFEI_KNOWLEDGE_ENTRIES_PER_WORKSPACE = 500;
export const MAX_XIAOFEI_KNOWLEDGE_ENTRY_BODY_BYTES_PER_WORKSPACE = 4 * 1024 * 1024;

export type XiaofeiKnowledgeDocumentQuota = "document_count" | "stored_body_bytes";
export type XiaofeiKnowledgeEntryQuota = "entry_count" | "stored_entry_body_bytes";

export class XiaofeiKnowledgeDocumentQuotaError extends Error {
	constructor(
		readonly quota: XiaofeiKnowledgeDocumentQuota,
		readonly limit: number,
	) {
		super(
			quota === "document_count"
				? "Knowledge document count limit reached for this workspace."
				: "Knowledge document storage limit reached for this workspace.",
		);
		this.name = "XiaofeiKnowledgeDocumentQuotaError";
	}
}

export class XiaofeiKnowledgeEntryQuotaError extends Error {
	constructor(
		readonly quota: XiaofeiKnowledgeEntryQuota,
		readonly limit: number,
	) {
		super(
			quota === "entry_count"
				? "Knowledge entry count limit reached for this workspace."
				: "Knowledge entry storage limit reached for this workspace.",
		);
		this.name = "XiaofeiKnowledgeEntryQuotaError";
	}
}

export class XiaofeiKnowledgeEntryEligibilityError extends Error {
	constructor() {
		super("Only current draft knowledge entries can be activated.");
		this.name = "XiaofeiKnowledgeEntryEligibilityError";
	}
}

const DOCUMENT_METADATA_SELECT = {
	id: true,
	workspaceId: true,
	sourceType: true,
	originalFileName: true,
	mimeType: true,
	fileType: true,
	sourceUrl: true,
	fileSizeBytes: true,
	provider: true,
	parserVersion: true,
	category: true,
	contentHash: true,
	sourceVersion: true,
	fetchedAt: true,
	parseStatus: true,
	status: true,
	createdAt: true,
	updatedAt: true,
} as const;
const ENTRY_WITH_SOURCE_INCLUDE = {
	source: { select: { id: true, contentHash: true, sourceVersion: true } },
} as const;
const INBOUND_EVENT_LIST_SELECT = {
	id: true,
	workspaceId: true,
	source: true,
	eventId: true,
	schemaVersion: true,
	transportKind: true,
	topic: true,
	partition: true,
	offset: true,
	messageKey: true,
	eventType: true,
	occurredAt: true,
	payloadHash: true,
	status: true,
	deliveryCount: true,
	firstReceivedAt: true,
	lastReceivedAt: true,
	processedAt: true,
	createdAt: true,
	updatedAt: true,
} as const;

type LegacyKnowledgeDocumentFileType = "MARKDOWN" | "TEXT" | "DOCX";

interface KnowledgeDocumentSourceMetadata {
	id: string;
	sourceType: XiaofeiKnowledgeDocumentSourceType;
	originalFileName: string | null;
	mimeType: string | null;
	fileType: XiaofeiKnowledgeDocumentFileType | null;
	sourceUrl: string | null;
}

export function getXiaofeiWorkspace(tenantKey: string) {
	return db.xiaofeiWorkspace.findUnique({ where: { tenantKey } });
}
export function upsertXiaofeiWorkspace(tenantKey: string, snapshot: Prisma.InputJsonValue) {
	return db.xiaofeiWorkspace.upsert({
		where: { tenantKey },
		create: { tenantKey, snapshot },
		update: { snapshot },
	});
}

export function getXiaofeiOrganizationConfig(organizationId: string) {
	return db.xiaofeiOrganizationConfig.findUnique({ where: { organizationId } });
}

export function upsertXiaofeiOrganizationConfig(
	organizationId: string,
	input: UpsertXiaofeiOrganizationConfigInput,
) {
	return db.xiaofeiOrganizationConfig.upsert({
		where: { organizationId },
		create: { organizationId, ...input },
		update: input,
	});
}

export function getXiaofeiCustomer(organizationId: string, externalCustomerId: string) {
	return db.xiaofeiCustomer.findUnique({
		where: { organizationId_externalCustomerId: { organizationId, externalCustomerId } },
	});
}

export function listXiaofeiCustomers(organizationId: string) {
	return db.xiaofeiCustomer.findMany({
		where: { organizationId },
		include: { _count: { select: { conversations: true } } },
		orderBy: [{ lastSeenAt: "desc" }, { updatedAt: "desc" }],
		take: 50,
	});
}

export function getXiaofeiCustomerById(organizationId: string, id: string) {
	return db.xiaofeiCustomer.findUnique({
		where: { organizationId_id: { organizationId, id } },
		include: { _count: { select: { conversations: true } } },
	});
}

export function createXiaofeiCustomer(input: CreateXiaofeiCustomerInput) {
	return db.xiaofeiCustomer.create({ data: input });
}

export function updateXiaofeiCustomer(
	organizationId: string,
	externalCustomerId: string,
	data: UpdateXiaofeiCustomerInput,
) {
	return db.xiaofeiCustomer.update({
		where: { organizationId_externalCustomerId: { organizationId, externalCustomerId } },
		data,
	});
}

export function getXiaofeiOrganizationWorkspace(organizationId: string) {
	return getXiaofeiWorkspace(organizationTenantKey(organizationId));
}

export async function getXiaofeiOrganizationConversation(
	organizationId: string,
	externalId: string,
) {
	const workspace = await getRequiredXiaofeiOrganizationWorkspace(organizationId);
	return getXiaofeiConversation(workspace.id, externalId);
}

export async function listXiaofeiOrganizationConversations(organizationId: string) {
	const workspace = await getRequiredXiaofeiOrganizationWorkspace(organizationId);
	return listXiaofeiConversations(workspace.id);
}

export async function upsertXiaofeiOrganizationConversation(input: {
	organizationId: string;
	externalId: string;
	customerId?: string | null;
	channel?: string;
	state: Prisma.InputJsonValue;
	traceEvents: Prisma.InputJsonValue;
}) {
	return db.$transaction(async (transaction) => {
		const { organizationId, ...conversation } = input;
		const workspace = await transaction.xiaofeiWorkspace.findUnique({
			where: { tenantKey: organizationTenantKey(organizationId) },
		});
		if (!workspace) throw new XiaofeiOrganizationWorkspaceNotFoundError(organizationId);
		if (input.customerId) {
			const customer = await transaction.xiaofeiCustomer.findUnique({
				where: { organizationId_id: { organizationId, id: input.customerId } },
			});
			if (!customer)
				throw new XiaofeiOrganizationCustomerNotFoundError(organizationId, input.customerId);
		}
		return transaction.xiaofeiConversation.upsert({
			where: {
				workspaceId_externalId: { workspaceId: workspace.id, externalId: input.externalId },
			},
			create: { ...conversation, workspaceId: workspace.id },
			update: {
				customerId: conversation.customerId,
				channel: conversation.channel,
				state: conversation.state,
				traceEvents: conversation.traceEvents,
			},
		});
	});
}
export function getXiaofeiConversation(workspaceId: string, externalId: string) {
	return db.xiaofeiConversation.findUnique({
		where: { workspaceId_externalId: { workspaceId, externalId } },
		include: { customer: true },
	});
}
export function listXiaofeiConversations(workspaceId: string) {
	return db.xiaofeiConversation.findMany({
		where: { workspaceId },
		include: { customer: true },
		orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }],
		take: 50,
	});
}
export function listXiaofeiCustomerConversations(workspaceId: string, customerId: string) {
	return db.xiaofeiConversation.findMany({
		where: { workspaceId, customerId },
		include: { customer: true },
		orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }],
		take: 50,
	});
}
export function upsertXiaofeiSupportConversation(input: {
	workspaceId: string;
	externalId: string;
	customerName: string;
	state: Prisma.InputJsonValue;
	traceEvents: Prisma.InputJsonValue;
	messages: Prisma.InputJsonValue;
	lastCustomerSeenAt: Date;
	lastMessageAt: Date;
}) {
	return db.xiaofeiConversation.upsert({
		where: {
			workspaceId_externalId: { workspaceId: input.workspaceId, externalId: input.externalId },
		},
		create: input,
		update: { customerName: input.customerName, lastCustomerSeenAt: input.lastCustomerSeenAt },
	});
}
export function updateXiaofeiSupportConversation(
	workspaceId: string,
	externalId: string,
	data: {
		customerName?: string;
		status?: string;
		assignedUserId?: string | null;
		assignedUserName?: string | null;
		state?: Prisma.InputJsonValue;
		messages?: Prisma.InputJsonValue;
		traceEvents?: Prisma.InputJsonValue;
		lastCustomerSeenAt?: Date;
		lastMessageAt?: Date;
	},
) {
	return db.xiaofeiConversation.update({
		where: { workspaceId_externalId: { workspaceId, externalId } },
		data,
	});
}
export function upsertXiaofeiConversation(input: {
	workspaceId: string;
	externalId: string;
	state: Prisma.InputJsonValue;
	traceEvents: Prisma.InputJsonValue;
}) {
	return db.xiaofeiConversation.upsert({
		where: {
			workspaceId_externalId: { workspaceId: input.workspaceId, externalId: input.externalId },
		},
		create: input,
		update: { state: input.state, traceEvents: input.traceEvents },
	});
}
export function deleteXiaofeiConversation(workspaceId: string, externalId: string) {
	return db.xiaofeiConversation.deleteMany({ where: { workspaceId, externalId } });
}

/**
 * Records an event exactly once per workspace/source/event ID. Replays only increment
 * delivery metadata; a different canonical payload is a durable conflict, never an overwrite.
 */
export async function acceptInboundEvent(
	workspaceId: string,
	input: AcceptInboundEventInput,
): Promise<{ kind: "created" | "duplicate"; event: XiaofeiInboundEvent }> {
	const payloadHash = hashJson(input.payload);
	const receivedAt = new Date();
	try {
		const event = await db.$transaction((transaction) =>
			transaction.xiaofeiInboundEvent.create({
				data: {
					workspaceId,
					...input,
					payloadHash,
					safeHeaders: input.safeHeaders ?? {},
					firstReceivedAt: receivedAt,
					lastReceivedAt: receivedAt,
				},
			}),
		);
		return { kind: "created" as const, event };
	} catch (error) {
		if (!isInboundEventUniqueViolation(error)) throw error;
	}

	return db.$transaction(async (transaction) => {
		const existing = await transaction.xiaofeiInboundEvent.findUnique({
			where: {
				workspaceId_source_eventId: { workspaceId, source: input.source, eventId: input.eventId },
			},
		});
		if (!existing)
			throw new Error(
				"Inbound event duplicate could not be resolved after the unique constraint race.",
			);
		if (existing.payloadHash !== payloadHash) {
			throw new XiaofeiInboundEventConflictError(workspaceId, input.source, input.eventId);
		}
		const event = await transaction.xiaofeiInboundEvent.update({
			where: {
				workspaceId_source_eventId: { workspaceId, source: input.source, eventId: input.eventId },
			},
			data: { deliveryCount: { increment: 1 }, lastReceivedAt: new Date() },
		});
		return { kind: "duplicate" as const, event };
	});
}

export async function listInboundEvents(
	workspaceId: string,
	options: ListInboundEventsOptions = {},
) {
	const limit = assertPageLimit(options.limit);
	const records = await db.xiaofeiInboundEvent.findMany({
		where: {
			workspaceId,
			...(options.source === undefined ? {} : { source: options.source }),
			...(options.status === undefined ? {} : { status: options.status }),
			...(options.topic === undefined ? {} : { topic: options.topic }),
		},
		select: INBOUND_EVENT_LIST_SELECT,
		orderBy: [{ createdAt: "desc" }, { id: "desc" }],
		take: limit + 1,
		...(options.cursor
			? { cursor: { workspaceId_id: { workspaceId, id: options.cursor } }, skip: 1 }
			: {}),
	});
	return page(records, limit);
}

export function getInboundEvent(workspaceId: string, id: string) {
	return db.xiaofeiInboundEvent.findUnique({ where: { workspaceId_id: { workspaceId, id } } });
}

export function updateXiaofeiInboundEventStatus(
	workspaceId: string,
	id: string,
	data: UpdateXiaofeiInboundEventStatusInput,
) {
	return db.xiaofeiInboundEvent.update({
		where: { workspaceId_id: { workspaceId, id } },
		data,
	});
}

export async function listXiaofeiOrganizationInboundEvents(
	organizationId: string,
	options: ListInboundEventsOptions = {},
) {
	const workspace = await getRequiredXiaofeiOrganizationWorkspace(organizationId);
	return listInboundEvents(workspace.id, options);
}

export async function acceptXiaofeiOrganizationInboundEvent(
	organizationId: string,
	input: AcceptInboundEventInput,
) {
	const workspace = await getRequiredXiaofeiOrganizationWorkspace(organizationId);
	return acceptInboundEvent(workspace.id, input);
}

export async function getXiaofeiOrganizationInboundEvent(organizationId: string, id: string) {
	const workspace = await getRequiredXiaofeiOrganizationWorkspace(organizationId);
	return getInboundEvent(workspace.id, id);
}

export async function updateXiaofeiOrganizationInboundEventStatus(
	organizationId: string,
	id: string,
	data: UpdateXiaofeiInboundEventStatusInput,
) {
	const workspace = await getRequiredXiaofeiOrganizationWorkspace(organizationId);
	return updateXiaofeiInboundEventStatus(workspace.id, id, data);
}

export function createXiaofeiKnowledgeDocument(input: CreateXiaofeiKnowledgeDocumentInput) {
	return db.$transaction(async (transaction) => {
		await lockXiaofeiKnowledgeWorkspace(transaction, input.workspaceId);
		const usage = await getKnowledgeDocumentUsage(transaction, input.workspaceId);
		assertDocumentQuota(
			Number(usage.count) + 1,
			Number(usage.bodyBytes) + Buffer.byteLength(input.bodyText, "utf8"),
		);
		const document = await transaction.xiaofeiKnowledgeDocument.create({
			data: { ...input, contentHash: hashContent(input.bodyText) },
		});
		return withLegacyKnowledgeDocumentMetadata(document);
	});
}

export function createXiaofeiKnowledgeDocumentWithEntries(
	input: CreateXiaofeiKnowledgeDocumentWithEntriesInput,
) {
	return db.$transaction(async (transaction) => {
		await lockXiaofeiKnowledgeWorkspace(transaction, input.document.workspaceId);
		const [documentUsage, entryUsage] = await Promise.all([
			getKnowledgeDocumentUsage(transaction, input.document.workspaceId),
			getKnowledgeEntryUsage(transaction, input.document.workspaceId),
		]);
		assertDocumentQuota(
			Number(documentUsage.count) + 1,
			Number(documentUsage.bodyBytes) + Buffer.byteLength(input.document.bodyText, "utf8"),
		);
		assertEntryQuota(
			Number(entryUsage.count) + input.entries.length,
			Number(entryUsage.bodyBytes) +
				input.entries.reduce((total, entry) => total + entryBodyBytes(entry), 0),
		);
		const document = await transaction.xiaofeiKnowledgeDocument.create({
			data: { ...input.document, contentHash: hashContent(input.document.bodyText) },
		});
		const entries = input.entries.length
			? await transaction.xiaofeiKnowledgeEntry.createManyAndReturn({
					data: input.entries.map((entry) => ({
						...entry,
						workspaceId: input.document.workspaceId,
						sourceId: document.id,
						sourceContentHash: document.contentHash,
						sourceVersion: document.sourceVersion,
					})),
				})
			: [];
		return { document: withLegacyKnowledgeDocumentMetadata(document), entries };
	});
}

export async function listXiaofeiKnowledgeDocuments(
	workspaceId: string,
	options: ListXiaofeiKnowledgeDocumentsOptions = {},
) {
	const limit = assertPageLimit(options.limit);
	const records = await db.xiaofeiKnowledgeDocument.findMany({
		where: { workspaceId },
		select: DOCUMENT_METADATA_SELECT,
		orderBy: [{ createdAt: "desc" }, { id: "desc" }],
		take: limit + 1,
		...(options.cursor
			? { cursor: { workspaceId_id: { workspaceId, id: options.cursor } }, skip: 1 }
			: {}),
	});
	const result = page(records, limit);
	return { ...result, items: result.items.map(withLegacyKnowledgeDocumentMetadata) };
}

export async function getXiaofeiKnowledgeDocument(workspaceId: string, id: string) {
	const document = await db.xiaofeiKnowledgeDocument.findUnique({
		where: { workspaceId_id: { workspaceId, id } },
	});
	return document ? withLegacyKnowledgeDocumentMetadata(document) : null;
}

export function updateXiaofeiKnowledgeDocument(
	workspaceId: string,
	id: string,
	data: UpdateXiaofeiKnowledgeDocumentInput,
) {
	return db.$transaction(async (transaction) => {
		await lockXiaofeiKnowledgeWorkspace(transaction, workspaceId);
		if (data.bodyText !== undefined) {
			const existing = await transaction.xiaofeiKnowledgeDocument.findUnique({
				where: { workspaceId_id: { workspaceId, id } },
				select: { bodyText: true },
			});
			if (existing) {
				const usage = await getKnowledgeDocumentUsage(transaction, workspaceId);
				assertDocumentQuota(
					Number(usage.count),
					Number(usage.bodyBytes) -
						Buffer.byteLength(existing.bodyText, "utf8") +
						Buffer.byteLength(data.bodyText, "utf8"),
				);
			}
		}
		const document = await transaction.xiaofeiKnowledgeDocument.update({
			where: { workspaceId_id: { workspaceId, id } },
			data: {
				...data,
				...(data.bodyText === undefined ? {} : { contentHash: hashContent(data.bodyText) }),
				sourceVersion: { increment: 1 },
			},
		});
		await invalidateKnowledgeUnits(transaction, workspaceId, {
			sourceId: id,
			reason: "source_updated",
		});
		return withLegacyKnowledgeDocumentMetadata(document);
	});
}

export function deleteXiaofeiKnowledgeDocument(workspaceId: string, id: string) {
	return db.$transaction(async (transaction) => {
		await lockXiaofeiKnowledgeWorkspace(transaction, workspaceId);
		await invalidateKnowledgeUnits(transaction, workspaceId, {
			sourceId: id,
			reason: "source_deleted",
		});
		return transaction.xiaofeiKnowledgeDocument.deleteMany({ where: { workspaceId, id } });
	});
}

export function createXiaofeiKnowledgeEntry(input: CreateXiaofeiKnowledgeEntryInput) {
	return db.$transaction(async (transaction) => {
		await lockXiaofeiKnowledgeWorkspace(transaction, input.workspaceId);
		const source = await transaction.xiaofeiKnowledgeDocument.findUnique({
			where: { workspaceId_id: { workspaceId: input.workspaceId, id: input.sourceId } },
			select: { contentHash: true, sourceVersion: true },
		});
		if (!source) throw new Error("Knowledge source was not found in this workspace.");
		const usage = await getKnowledgeEntryUsage(transaction, input.workspaceId);
		assertEntryQuota(Number(usage.count) + 1, Number(usage.bodyBytes) + entryBodyBytes(input));
		return transaction.xiaofeiKnowledgeEntry.create({
			data: {
				...input,
				sourceContentHash: source.contentHash,
				sourceVersion: source.sourceVersion,
			},
		});
	});
}

export async function listXiaofeiKnowledgeEntries(
	workspaceId: string,
	options: ListXiaofeiKnowledgeEntriesOptions = {},
) {
	const limit = assertPageLimit(options.limit);
	const records = await db.xiaofeiKnowledgeEntry.findMany({
		where: { workspaceId },
		include: ENTRY_WITH_SOURCE_INCLUDE,
		orderBy: [{ createdAt: "desc" }, { id: "desc" }],
		take: limit + 1,
		...(options.cursor
			? { cursor: { workspaceId_id: { workspaceId, id: options.cursor } }, skip: 1 }
			: {}),
	});
	const result = page(records, limit);
	return { ...result, items: result.items.map(withEligibility) };
}

export async function getXiaofeiKnowledgeEntry(workspaceId: string, id: string) {
	const entry = await db.xiaofeiKnowledgeEntry.findUnique({
		where: { workspaceId_id: { workspaceId, id } },
		include: ENTRY_WITH_SOURCE_INCLUDE,
	});
	return entry ? withEligibility(entry) : null;
}

export function updateXiaofeiKnowledgeEntry(
	workspaceId: string,
	id: string,
	data: UpdateXiaofeiKnowledgeEntryInput,
) {
	return db.$transaction(async (transaction) => {
		await lockXiaofeiKnowledgeWorkspace(transaction, workspaceId);
		const existing = await transaction.xiaofeiKnowledgeEntry.findUnique({
			where: { workspaceId_id: { workspaceId, id } },
			select: {
				question: true,
				answer: true,
				similarQueries: true,
				sourceId: true,
				sourceContentHash: true,
				sourceVersion: true,
				status: true,
			},
		});
		if (!existing)
			return transaction.xiaofeiKnowledgeEntry.update({
				where: { workspaceId_id: { workspaceId, id } },
				data,
			});
		const sourceId = data.sourceId ?? existing.sourceId;
		let sourceSnapshot: { contentHash: string | null; sourceVersion: number } | undefined;
		if (data.sourceId !== undefined || data.status === "active") {
			sourceSnapshot =
				sourceId === null
					? undefined
					: ((await transaction.xiaofeiKnowledgeDocument.findUnique({
							where: { workspaceId_id: { workspaceId, id: sourceId } },
							select: { contentHash: true, sourceVersion: true },
						})) ?? undefined);
			if (data.sourceId !== undefined && !sourceSnapshot)
				throw new Error("Knowledge source was not found in this workspace.");
		}
		if (
			data.status === "active" &&
			(existing.status !== "draft" ||
				!sourceSnapshot ||
				sourceSnapshot.contentHash !== existing.sourceContentHash ||
				sourceSnapshot.sourceVersion !== existing.sourceVersion)
		) {
			throw new XiaofeiKnowledgeEntryEligibilityError();
		}
		const next = {
			question: data.question ?? existing.question,
			answer: data.answer ?? existing.answer,
			similarQueries: data.similarQueries ?? existing.similarQueries,
		};
		const usage = await getKnowledgeEntryUsage(transaction, workspaceId);
		assertEntryQuota(
			Number(usage.count),
			Number(usage.bodyBytes) - entryBodyBytes(existing) + entryBodyBytes(next),
		);
		const entry = await transaction.xiaofeiKnowledgeEntry.update({
			where: { workspaceId_id: { workspaceId, id } },
			data: {
				...data,
				entryVersion: { increment: 1 },
				...(sourceId === null
					? {}
					: data.sourceId !== undefined && sourceSnapshot
						? {
								sourceContentHash: sourceSnapshot.contentHash,
								sourceVersion: sourceSnapshot.sourceVersion,
							}
						: {}),
			},
		});
		await invalidateKnowledgeUnits(transaction, workspaceId, {
			entryId: id,
			reason: "entry_updated",
		});
		return entry;
	});
}

export function deleteXiaofeiKnowledgeEntry(workspaceId: string, id: string) {
	return db.$transaction(async (transaction) => {
		await lockXiaofeiKnowledgeWorkspace(transaction, workspaceId);
		await invalidateKnowledgeUnits(transaction, workspaceId, {
			entryId: id,
			reason: "entry_deleted",
		});
		return transaction.xiaofeiKnowledgeEntry.deleteMany({ where: { workspaceId, id } });
	});
}

export function createXiaofeiKnowledgeUnit(input: CreateXiaofeiKnowledgeUnitInput) {
	return db.$transaction(async (transaction) => {
		await lockXiaofeiKnowledgeWorkspace(transaction, input.workspaceId);
		const entry = await transaction.xiaofeiKnowledgeEntry.findUnique({
			where: { workspaceId_id: { workspaceId: input.workspaceId, id: input.entryId } },
			select: { sourceId: true, sourceContentHash: true, sourceVersion: true, entryVersion: true },
		});
		if (!entry?.sourceId) throw new Error("Knowledge entry was not eligible in this workspace.");
		const source = await transaction.xiaofeiKnowledgeDocument.findUnique({
			where: { workspaceId_id: { workspaceId: input.workspaceId, id: entry.sourceId } },
			select: { contentHash: true, sourceVersion: true },
		});
		if (
			!source ||
			source.contentHash !== entry.sourceContentHash ||
			source.sourceVersion !== entry.sourceVersion
		) {
			throw new Error("Knowledge entry was not eligible in this workspace.");
		}
		return transaction.xiaofeiKnowledgeUnit.create({
			data: {
				...input,
				sourceId: entry.sourceId,
				sourceContentHash: entry.sourceContentHash,
				sourceVersion: entry.sourceVersion,
				entryVersion: entry.entryVersion,
			},
		});
	});
}

export function listXiaofeiKnowledgeUnits(workspaceId: string) {
	return db.xiaofeiKnowledgeUnit.findMany({
		where: { workspaceId },
		orderBy: [{ createdAt: "desc" }, { id: "desc" }],
	});
}

export function getXiaofeiKnowledgeUnit(workspaceId: string, id: string) {
	return db.xiaofeiKnowledgeUnit.findUnique({ where: { workspaceId_id: { workspaceId, id } } });
}

export function updateXiaofeiKnowledgeUnit(
	workspaceId: string,
	id: string,
	data: UpdateXiaofeiKnowledgeUnitInput,
) {
	return db.xiaofeiKnowledgeUnit.update({
		where: { workspaceId_id: { workspaceId, id } },
		data,
	});
}

export function deleteXiaofeiKnowledgeUnit(workspaceId: string, id: string) {
	return db.xiaofeiKnowledgeUnit.deleteMany({ where: { workspaceId, id } });
}

async function invalidateKnowledgeUnits(
	transaction: Prisma.TransactionClient,
	workspaceId: string,
	input: {
		sourceId?: string;
		entryId?: string;
		reason: "source_updated" | "source_deleted" | "entry_deleted" | "entry_updated";
	},
) {
	await transaction.xiaofeiKnowledgeUnit.updateMany({
		where: {
			workspaceId,
			...(input.sourceId === undefined ? {} : { sourceId: input.sourceId }),
			...(input.entryId === undefined ? {} : { entryId: input.entryId }),
		},
		data: { status: "draft", eligibility: "stale", staleReason: input.reason },
	});
}

function withEligibility<
	T extends {
		sourceContentHash: string | null;
		sourceVersion: number | null;
		source: { contentHash: string | null; sourceVersion: number } | null;
	},
>(entry: T) {
	const { source, ...item } = entry;
	return {
		...item,
		eligible:
			source !== null &&
			source.contentHash === entry.sourceContentHash &&
			source.sourceVersion === entry.sourceVersion,
	};
}
function withLegacyKnowledgeDocumentMetadata<T extends KnowledgeDocumentSourceMetadata>(
	document: T,
) {
	return {
		...document,
		sourceFileType: document.fileType,
		originalFileName:
			document.originalFileName ??
			legacySourceDisplayName(document.sourceType, document.sourceUrl, document.id),
		mimeType: document.mimeType ?? legacySourceMimeType(document.sourceType),
		fileType: legacyFileType(document.fileType),
	};
}
function legacySourceDisplayName(
	sourceType: XiaofeiKnowledgeDocumentSourceType,
	sourceUrl: string | null,
	id: string,
) {
	if (sourceType === XiaofeiKnowledgeDocumentSourceType.WEB) return sourceUrl || `web-source-${id}`;
	if (sourceType === XiaofeiKnowledgeDocumentSourceType.MANUAL) return `manual-source-${id}`;
	return `file-source-${id}`;
}
function legacySourceMimeType(sourceType: XiaofeiKnowledgeDocumentSourceType) {
	return sourceType === XiaofeiKnowledgeDocumentSourceType.WEB ? "text/html" : "text/plain";
}
function legacyFileType(
	fileType: XiaofeiKnowledgeDocumentFileType | null,
): LegacyKnowledgeDocumentFileType {
	if (
		fileType === XiaofeiKnowledgeDocumentFileType.MARKDOWN ||
		fileType === XiaofeiKnowledgeDocumentFileType.DOCX
	)
		return fileType;
	return XiaofeiKnowledgeDocumentFileType.TEXT;
}
function page<T>(records: T[], limit: number) {
	const items = records.length > limit ? records.slice(0, limit) : records;
	return {
		items,
		nextCursor:
			records.length > limit
				? ((items[items.length - 1] as { id: string } | undefined)?.id ?? null)
				: null,
	};
}
function assertPageLimit(value: number | undefined) {
	const limit = value ?? DEFAULT_XIAOFEI_KNOWLEDGE_DOCUMENT_PAGE_SIZE;
	if (!Number.isInteger(limit) || limit < 1 || limit > MAX_XIAOFEI_KNOWLEDGE_DOCUMENT_PAGE_SIZE)
		throw new RangeError(
			`Knowledge page limit must be between 1 and ${MAX_XIAOFEI_KNOWLEDGE_DOCUMENT_PAGE_SIZE}.`,
		);
	return limit;
}
function hashContent(bodyText: string) {
	return createHash("sha256").update(bodyText, "utf8").digest("hex");
}
function organizationTenantKey(organizationId: string) {
	return `organization:${organizationId}`;
}
async function getRequiredXiaofeiOrganizationWorkspace(organizationId: string) {
	const workspace = await getXiaofeiOrganizationWorkspace(organizationId);
	if (!workspace) throw new XiaofeiOrganizationWorkspaceNotFoundError(organizationId);
	return workspace;
}
function hashJson(value: Prisma.InputJsonValue) {
	return createHash("sha256").update(stableJson(value), "utf8").digest("hex");
}
function stableJson(value: Prisma.InputJsonValue): string {
	if (value === null || typeof value !== "object") return JSON.stringify(value);
	if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
	const record = value as Record<string, Prisma.InputJsonValue>;
	return `{${Object.keys(record)
		.sort()
		.map((key) => `${JSON.stringify(key)}:${stableJson(record[key]!)}`)
		.join(",")}}`;
}
function isInboundEventUniqueViolation(error: unknown) {
	return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}
function entryBodyBytes(
	entry:
		| Pick<CreateXiaofeiKnowledgeEntryInput, "question" | "answer" | "similarQueries">
		| { question: string; answer: string; similarQueries?: string[] },
) {
	return (
		Buffer.byteLength(entry.question, "utf8") +
		Buffer.byteLength(entry.answer, "utf8") +
		(entry.similarQueries ?? []).reduce(
			(total, query) => total + Buffer.byteLength(query, "utf8"),
			0,
		)
	);
}
async function lockXiaofeiKnowledgeWorkspace(
	transaction: Prisma.TransactionClient,
	workspaceId: string,
) {
	await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${workspaceId}, 0))`;
}
async function getKnowledgeDocumentUsage(
	transaction: Prisma.TransactionClient,
	workspaceId: string,
): Promise<{ count: bigint; bodyBytes: bigint }> {
	const [usage] = await transaction.$queryRaw<
		{ count?: bigint; bodyBytes?: bigint; documentCount?: bigint; storedBodyBytes?: bigint }[]
	>`SELECT COUNT(*)::bigint AS "count", COALESCE(SUM(octet_length("bodyText")), 0)::bigint AS "bodyBytes" FROM "xiaofei_knowledge_document" WHERE "workspaceId" = ${workspaceId}`;
	return {
		count: BigInt(usage?.count ?? usage?.documentCount ?? 0),
		bodyBytes: BigInt(usage?.bodyBytes ?? usage?.storedBodyBytes ?? 0),
	};
}
async function getKnowledgeEntryUsage(
	transaction: Prisma.TransactionClient,
	workspaceId: string,
): Promise<{ count: bigint; bodyBytes: bigint }> {
	const [usage] = await transaction.$queryRaw<
		{ count: bigint; bodyBytes: bigint }[]
	>`SELECT COUNT(*)::bigint AS "count", COALESCE(SUM(octet_length("question") + octet_length("answer") + octet_length(array_to_string("similarQueries", ''))), 0)::bigint AS "bodyBytes" FROM "xiaofei_knowledge_entry" WHERE "workspaceId" = ${workspaceId}`;
	return { count: BigInt(usage?.count ?? 0), bodyBytes: BigInt(usage?.bodyBytes ?? 0) };
}
function assertDocumentQuota(count: number, bodyBytes: number) {
	if (count > MAX_XIAOFEI_KNOWLEDGE_DOCUMENTS_PER_WORKSPACE)
		throw new XiaofeiKnowledgeDocumentQuotaError(
			"document_count",
			MAX_XIAOFEI_KNOWLEDGE_DOCUMENTS_PER_WORKSPACE,
		);
	if (bodyBytes > MAX_XIAOFEI_KNOWLEDGE_DOCUMENT_BODY_BYTES_PER_WORKSPACE)
		throw new XiaofeiKnowledgeDocumentQuotaError(
			"stored_body_bytes",
			MAX_XIAOFEI_KNOWLEDGE_DOCUMENT_BODY_BYTES_PER_WORKSPACE,
		);
}
function assertEntryQuota(count: number, bodyBytes: number) {
	if (count > MAX_XIAOFEI_KNOWLEDGE_ENTRIES_PER_WORKSPACE)
		throw new XiaofeiKnowledgeEntryQuotaError(
			"entry_count",
			MAX_XIAOFEI_KNOWLEDGE_ENTRIES_PER_WORKSPACE,
		);
	if (bodyBytes > MAX_XIAOFEI_KNOWLEDGE_ENTRY_BODY_BYTES_PER_WORKSPACE)
		throw new XiaofeiKnowledgeEntryQuotaError(
			"stored_entry_body_bytes",
			MAX_XIAOFEI_KNOWLEDGE_ENTRY_BODY_BYTES_PER_WORKSPACE,
		);
}
