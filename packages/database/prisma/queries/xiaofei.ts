import { createHash } from "node:crypto";

import {
	createConversationState,
	isCustomerInboundEmailJobEligible,
	type EmailMessageIngestV1,
} from "@repo/xiaofei";

import { db } from "../client";
import {
	XiaofeiKnowledgeDocumentFileType,
	XiaofeiKnowledgeDocumentSourceType,
	Prisma,
} from "../generated/client";
import type { XiaofeiInboundEvent, XiaofeiKnowledgeDocumentCategory } from "../generated/client";

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
	status:
		| "processing"
		| "processed"
		| "failed"
		| "organization_resolved"
		| "customer_upserted"
		| "conversation_updated"
		| "ai_replied"
		| "ai_disabled"
		| "mock_delivered"
		| "echo_ignored"
		| "merchant_unknown"
		| "conversation_conflict";
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

interface CreateXiaofeiChannelBindingInput {
	companyId: string;
	channelAccountId: string;
	address: string;
	status?: "active" | "disabled";
}

export class XiaofeiChannelBindingNotFoundError extends Error {
	readonly code = "CHANNEL_BINDING_NOT_FOUND";
	constructor(readonly companyId: string) {
		super("No active email channel binding exists for this company account.");
	}
}
export class XiaofeiChannelBindingDisabledError extends Error {
	readonly code = "CHANNEL_BINDING_DISABLED";
	constructor(readonly companyId: string) {
		super("The matching email channel binding is disabled.");
	}
}
export class XiaofeiChannelBindingConflictError extends Error {
	readonly code = "CHANNEL_BINDING_CONFLICT";
	constructor(readonly companyId: string) {
		super("The email account ID and address resolve to different active bindings.");
	}
}
export class XiaofeiChannelBindingWorkspaceMismatchError extends Error {
	readonly code = "CHANNEL_BINDING_WORKSPACE_MISMATCH";
	constructor(readonly organizationId: string) {
		super("The channel binding does not belong to this Organization workspace.");
	}
}
export class XiaofeiEmailConversationConflictError extends Error {
	readonly code = "EMAIL_CONVERSATION_CONFLICT";
	constructor(
		readonly workspaceId: string,
		readonly externalId: string,
	) {
		super("The existing email conversation has a different customer or channel.");
	}
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

export class XiaofeiEmailMirrorConflictError extends Error {
	readonly code = "EMAIL_MIRROR_PAYLOAD_CONFLICT";
	constructor(
		readonly workspaceId: string,
		readonly eventId: string,
	) {
		super("An email event ID already exists with different stable business facts.");
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
const EMAIL_MESSAGE_LIST_SELECT = {
	id: true,
	workspaceId: true,
	conversationId: true,
	inboundEventId: true,
	sourceMessageId: true,
	direction: true,
	senderType: true,
	fromAddress: true,
	subject: true,
	contentType: true,
	occurredAt: true,
	ingestedAt: true,
	createdAt: true,
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
/** Organization-scoped binding mutations never accept a workspace ID from callers. */
export async function createXiaofeiOrganizationEmailChannelBinding(
	organizationId: string,
	input: CreateXiaofeiChannelBindingInput,
) {
	const workspace = await getRequiredXiaofeiOrganizationWorkspace(organizationId);
	return db.xiaofeiChannelBinding.create({
		data: {
			...input,
			organizationId,
			workspaceId: workspace.id,
			channel: "email",
			address: normalizeEmailAddress(input.address),
		},
	});
}
export async function listXiaofeiOrganizationEmailChannelBindings(organizationId: string) {
	const workspace = await getRequiredXiaofeiOrganizationWorkspace(organizationId);
	return db.xiaofeiChannelBinding.findMany({
		where: { organizationId, workspaceId: workspace.id, channel: "email" },
		orderBy: [{ createdAt: "desc" }, { id: "desc" }],
	});
}
export async function updateXiaofeiOrganizationEmailChannelBinding(
	organizationId: string,
	id: string,
	data: Pick<
		Partial<CreateXiaofeiChannelBindingInput>,
		"companyId" | "channelAccountId" | "address" | "status"
	>,
) {
	const workspace = await getRequiredXiaofeiOrganizationWorkspace(organizationId);
	const binding = await db.xiaofeiChannelBinding.findUnique({ where: { id } });
	if (!binding || binding.organizationId !== organizationId || binding.workspaceId !== workspace.id)
		throw new XiaofeiChannelBindingWorkspaceMismatchError(organizationId);
	return db.xiaofeiChannelBinding.update({
		where: { id },
		data: {
			...data,
			...(data.address === undefined ? {} : { address: normalizeEmailAddress(data.address) }),
		},
	});
}
export function enableXiaofeiOrganizationEmailChannelBinding(organizationId: string, id: string) {
	return updateXiaofeiOrganizationEmailChannelBinding(organizationId, id, { status: "active" });
}
export function disableXiaofeiOrganizationEmailChannelBinding(organizationId: string, id: string) {
	return updateXiaofeiOrganizationEmailChannelBinding(organizationId, id, { status: "disabled" });
}

/** Resolve both account identifiers together; callers cannot supply a workspace. */
export async function resolveActiveXiaofeiEmailChannelBinding(input: {
	companyId: string;
	channelAccountId: string;
	address: string;
}) {
	return resolveActiveXiaofeiEmailChannelBindingInClient(db, input);
}
async function resolveActiveXiaofeiEmailChannelBindingInClient(
	client: Pick<typeof db, "xiaofeiChannelBinding">,
	input: { companyId: string; channelAccountId: string; address: string },
) {
	const address = normalizeEmailAddress(input.address);
	const bindings = await client.xiaofeiChannelBinding.findMany({
		where: {
			companyId: input.companyId,
			channel: "email",
			OR: [{ channelAccountId: input.channelAccountId }, { address }],
		},
	});
	const idMatches = bindings.filter(
		(binding) => binding.channelAccountId === input.channelAccountId,
	);
	const addressMatches = bindings.filter((binding) => binding.address === address);
	if (
		idMatches.some((idBinding) =>
			addressMatches.some((addressBinding) => idBinding.id !== addressBinding.id),
		)
	)
		throw new XiaofeiChannelBindingConflictError(input.companyId);
	const sameBinding = idMatches.find((idBinding) =>
		addressMatches.some((addressBinding) => addressBinding.id === idBinding.id),
	);
	if (!sameBinding && (idMatches.length || addressMatches.length))
		throw new XiaofeiChannelBindingConflictError(input.companyId);
	if (sameBinding?.status === "active") return sameBinding;
	if (sameBinding) throw new XiaofeiChannelBindingDisabledError(input.companyId);
	throw new XiaofeiChannelBindingNotFoundError(input.companyId);
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

const ORGANIZATION_TENANT_PREFIX = "organization:";

export interface ListAdminXiaofeiOrganizationsOptions {
	query?: string;
	enabled?: boolean;
	limit: number;
	offset: number;
}

/**
 * Bounded cross-organization read for the global Admin surface. This deliberately
 * does not use a caller-selected active Organization or iterate organization-by-
 * organization: all tenant keys are derived from the page of Organization rows.
 */
export async function listAdminXiaofeiOrganizations(options: ListAdminXiaofeiOrganizationsOptions) {
	const where = {
		...(options.enabled === undefined
			? {}
			: options.enabled
				? { xiaofeiConfig: { is: { xiaofeiEnabled: true } } }
				: {
						OR: [
							{ xiaofeiConfig: { is: null } },
							{ xiaofeiConfig: { is: { xiaofeiEnabled: false } } },
						],
					}),
		...(options.query
			? {
					AND: [
						{
							OR: [
								{ name: { contains: options.query, mode: "insensitive" as const } },
								{
									xiaofeiConfig: {
										is: {
											externalMerchantId: { contains: options.query, mode: "insensitive" as const },
										},
									},
								},
							],
						},
					],
				}
			: {}),
	};
	const [organizations, total] = await db.$transaction([
		db.organization.findMany({
			where,
			select: {
				id: true,
				name: true,
				slug: true,
				xiaofeiConfig: {
					select: { externalMerchantId: true, xiaofeiEnabled: true, updatedAt: true },
				},
				_count: { select: { members: true, xiaofeiCustomers: true } },
			},
			orderBy: { name: "asc" },
			take: options.limit,
			skip: options.offset,
		}),
		db.organization.count({ where }),
	]);
	return {
		total,
		organizations: organizations.map((organization) => ({
			...organization,
			membersCount: organization._count.members,
			customersCount: organization._count.xiaofeiCustomers,
		})),
	};
}

export async function getAdminXiaofeiOverview() {
	const organizationWorkspace = { tenantKey: { startsWith: ORGANIZATION_TENANT_PREFIX } };
	const [
		organizations,
		enabled,
		customers,
		openConversations,
		attentionConversations,
		failedEvents,
		recentEvents,
	] = await db.$transaction([
		db.organization.count(),
		db.xiaofeiOrganizationConfig.count({ where: { xiaofeiEnabled: true } }),
		db.xiaofeiCustomer.count(),
		db.xiaofeiConversation.count({ where: { workspace: organizationWorkspace, status: "open" } }),
		db.xiaofeiConversation.count({
			where: {
				workspace: organizationWorkspace,
				state: { path: ["operatorAttention"], not: Prisma.JsonNull },
			},
		}),
		db.xiaofeiInboundEvent.count({ where: { workspace: organizationWorkspace, status: "failed" } }),
		db.xiaofeiInboundEvent.findMany({
			where: { workspace: organizationWorkspace },
			select: {
				id: true,
				eventType: true,
				status: true,
				createdAt: true,
				workspace: { select: { tenantKey: true } },
			},
			orderBy: { createdAt: "desc" },
			take: 8,
		}),
	]);
	return {
		organizations,
		enabled,
		customers,
		openConversations,
		attentionConversations,
		failedEvents,
		recentEvents,
	};
}

export async function getAdminXiaofeiOrganizationDetail(organizationId: string) {
	const organization = await db.organization.findUnique({
		where: { id: organizationId },
		select: {
			id: true,
			name: true,
			slug: true,
			xiaofeiConfig: {
				select: { externalMerchantId: true, xiaofeiEnabled: true, updatedAt: true },
			},
			members: {
				select: { id: true, role: true, user: { select: { name: true, email: true } } },
				orderBy: { createdAt: "asc" },
				take: 50,
			},
			_count: { select: { xiaofeiCustomers: true } },
		},
	});
	if (!organization) return null;
	const workspace = await db.xiaofeiWorkspace.findUnique({
		where: { tenantKey: `${ORGANIZATION_TENANT_PREFIX}${organizationId}` },
		select: {
			id: true,
			snapshot: true,
			updatedAt: true,
			_count: {
				select: { knowledgeDocuments: true, knowledgeEntries: true, knowledgeUnits: true },
			},
		},
	});
	if (!workspace)
		return {
			organization,
			workspace: null,
			summary: {
				customers: organization._count.xiaofeiCustomers,
				openConversations: 0,
				attentionConversations: 0,
				failedEvents: 0,
				recentEvents: [],
			},
		};
	const [openConversations, attentionConversations, failedEvents, recentEvents] =
		await db.$transaction([
			db.xiaofeiConversation.count({ where: { workspaceId: workspace.id, status: "open" } }),
			db.xiaofeiConversation.count({
				where: {
					workspaceId: workspace.id,
					state: { path: ["operatorAttention"], not: Prisma.JsonNull },
				},
			}),
			db.xiaofeiInboundEvent.count({ where: { workspaceId: workspace.id, status: "failed" } }),
			db.xiaofeiInboundEvent.findMany({
				select: { id: true, eventType: true, status: true, createdAt: true },
				where: { workspaceId: workspace.id },
				orderBy: { createdAt: "desc" },
				take: 8,
			}),
		]);
	return {
		organization,
		workspace,
		summary: {
			customers: organization._count.xiaofeiCustomers,
			openConversations,
			attentionConversations,
			failedEvents,
			recentEvents,
		},
	};
}

export function getXiaofeiCustomer(organizationId: string, externalCustomerId: string) {
	return db.xiaofeiCustomer.findUnique({
		where: { organizationId_externalCustomerId: { organizationId, externalCustomerId } },
	});
}

/** Resolve channel credentials on the server; callers never choose a workspace. */
export function getXiaofeiOrganizationConfigByExternalMerchantId(externalMerchantId: string) {
	return db.xiaofeiOrganizationConfig.findUnique({
		where: { externalMerchantId },
		select: { organizationId: true, xiaofeiEnabled: true },
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
	customerId?: string | null;
	channel?: string;
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
		update: {
			customerId: input.customerId,
			channel: input.channel,
			customerName: input.customerName,
			lastCustomerSeenAt: input.lastCustomerSeenAt,
		},
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

export async function acceptMirroredEmailMessage(input: EmailMessageIngestV1): Promise<{
	status: "accepted" | "duplicate";
	conversationId: string;
	messageId: string;
	jobId: string | null;
}> {
	const businessHash = hashEmailBusinessFacts(input);
	const ingestedAt = new Date();
	try {
		return await db.$transaction(async (transaction) => {
			const binding = await resolveActiveXiaofeiEmailChannelBindingInClient(transaction, {
				companyId: input.tenant.companyId,
				channelAccountId: input.channelAccount.id,
				address: input.channelAccount.address,
			});
			const existing = await transaction.xiaofeiInboundEvent.findUnique({
				where: {
					workspaceId_source_eventId: {
						workspaceId: binding.workspaceId,
						source: "email",
						eventId: input.eventId,
					},
				},
				include: { conversationMessage: { include: { processingJob: true } } },
			});
			if (existing) {
				if (existing.payloadHash !== businessHash)
					throw new XiaofeiEmailMirrorConflictError(binding.workspaceId, input.eventId);
				const message = existing.conversationMessage;
				if (!message) throw new Error("Accepted email event is missing its message locator.");
				await transaction.xiaofeiInboundEvent.update({
					where: {
						workspaceId_source_eventId: {
							workspaceId: binding.workspaceId,
							source: "email",
							eventId: input.eventId,
						},
					},
					data: { deliveryCount: { increment: 1 }, lastReceivedAt: ingestedAt },
				});
				return {
					status: "duplicate" as const,
					conversationId: message.conversationId,
					messageId: message.id,
					jobId: message.processingJob?.id ?? null,
				};
			}
			const occurredAt = new Date(input.occurredAt);
			const isInbound = isCustomerInboundEmailJobEligible(input);
			const customerAddress = normalizeEmailAddress(
				isInbound ? input.message.from.address : input.message.to[0]!.address,
			);
			const customerName = isInbound ? input.message.from.name : input.message.to[0]!.name;
			const customer = await transaction.xiaofeiCustomer.upsert({
				where: {
					organizationId_externalCustomerId: {
						organizationId: binding.organizationId,
						externalCustomerId: customerAddress,
					},
				},
				create: {
					organizationId: binding.organizationId,
					externalCustomerId: customerAddress,
					name: customerName,
					email: customerAddress,
					...(isInbound ? { lastSeenAt: occurredAt } : {}),
				},
				update: { name: customerName, email: customerAddress },
			});
			const currentConversation = await transaction.xiaofeiConversation.findUnique({
				where: {
					workspaceId_externalId: {
						workspaceId: binding.workspaceId,
						externalId: input.conversation.externalId,
					},
				},
			});
			if (
				currentConversation &&
				(currentConversation.customerId !== customer.id || currentConversation.channel !== "email")
			)
				throw new XiaofeiEmailConversationConflictError(
					binding.workspaceId,
					input.conversation.externalId,
				);
			const conversation =
				currentConversation ??
				(await transaction.xiaofeiConversation.create({
					data: {
						workspaceId: binding.workspaceId,
						externalId: input.conversation.externalId,
						customerId: customer.id,
						channel: "email",
						customerName: customer.name,
						state: createConversationState({
							id: input.conversation.externalId,
							tenantId: `organization:${binding.organizationId}`,
							agentId: "email-mirror",
							maxFollowUps: 0,
						}),
						messages: [],
						traceEvents: [],
						lastCustomerSeenAt: isInbound ? occurredAt : null,
						lastMessageAt: occurredAt,
					},
				}));
			const event = await transaction.xiaofeiInboundEvent.create({
				data: {
					workspaceId: binding.workspaceId,
					source: "email",
					eventId: input.eventId,
					schemaVersion: input.schemaVersion,
					transportKind: "email_mirror",
					topic: input.source.topic,
					partition: input.source.partition,
					offset: String(input.source.offset),
					messageKey: input.message.sourceMessageId,
					eventType: input.schemaVersion,
					occurredAt,
					payload: input as Prisma.InputJsonValue,
					payloadHash: businessHash,
					safeHeaders: {},
					status: "accepted",
					firstReceivedAt: ingestedAt,
					lastReceivedAt: ingestedAt,
				},
			});
			const message = await transaction.xiaofeiConversationMessage.create({
				data: {
					workspaceId: binding.workspaceId,
					conversationId: conversation.id,
					inboundEventId: event.id,
					eventId: input.eventId,
					sourceMessageId: input.message.sourceMessageId,
					providerMessageId: input.message.providerMessageId,
					replyToSourceMessageId: input.message.replyToSourceMessageId,
					direction: input.message.direction,
					senderType: input.message.senderType,
					fromAddress: normalizeEmailAddress(input.message.from.address),
					fromName: input.message.from.name,
					toRecipients: input.message.to as Prisma.InputJsonValue,
					subject: input.message.subject,
					contentType: input.message.content.type,
					contentValue: input.message.content.value,
					attachments: input.message.attachments as Prisma.InputJsonValue,
					labels: input.message.labels as Prisma.InputJsonValue,
					sourceSendType: input.message.sourceSendType,
					occurredAt,
					ingestedAt,
				},
			});
			await transaction.xiaofeiConversation.updateMany({
				where: {
					id: conversation.id,
					OR: [{ lastMessageAt: null }, { lastMessageAt: { lte: occurredAt } }],
				},
				data: { lastMessageAt: occurredAt },
			});
			if (isInbound) {
				await transaction.xiaofeiConversation.updateMany({
					where: {
						id: conversation.id,
						OR: [{ lastCustomerSeenAt: null }, { lastCustomerSeenAt: { lte: occurredAt } }],
					},
					data: { lastCustomerSeenAt: occurredAt },
				});
				await transaction.xiaofeiCustomer.updateMany({
					where: {
						id: customer.id,
						OR: [{ lastSeenAt: null }, { lastSeenAt: { lte: occurredAt } }],
					},
					data: { lastSeenAt: occurredAt },
				});
			}
			const job = isInbound
				? await transaction.xiaofeiProcessingJob.create({
						data: {
							workspaceId: binding.workspaceId,
							inboundEventId: event.id,
							conversationId: conversation.id,
							conversationMessageId: message.id,
							kind: "mirrored",
							status: "mirrored",
						},
					})
				: null;
			return {
				status: "accepted" as const,
				conversationId: conversation.id,
				messageId: message.id,
				jobId: job?.id ?? null,
			};
		});
	} catch (error) {
		if (!isInboundEventUniqueViolation(error)) throw error;
		const binding = await resolveActiveXiaofeiEmailChannelBinding({
			companyId: input.tenant.companyId,
			channelAccountId: input.channelAccount.id,
			address: input.channelAccount.address,
		});
		const existing = await db.xiaofeiInboundEvent.findUnique({
			where: {
				workspaceId_source_eventId: {
					workspaceId: binding.workspaceId,
					source: "email",
					eventId: input.eventId,
				},
			},
			include: { conversationMessage: { include: { processingJob: true } } },
		});
		if (!existing) throw error;
		if (existing.payloadHash !== businessHash)
			throw new XiaofeiEmailMirrorConflictError(binding.workspaceId, input.eventId);
		if (!existing.conversationMessage) throw error;
		await db.xiaofeiInboundEvent.update({
			where: {
				workspaceId_source_eventId: {
					workspaceId: binding.workspaceId,
					source: "email",
					eventId: input.eventId,
				},
			},
			data: { deliveryCount: { increment: 1 }, lastReceivedAt: ingestedAt },
		});
		return {
			status: "duplicate",
			conversationId: existing.conversationMessage.conversationId,
			messageId: existing.conversationMessage.id,
			jobId: existing.conversationMessage.processingJob?.id ?? null,
		};
	}
}

export function listXiaofeiConversationMessages(workspaceId: string, conversationId: string) {
	return db.xiaofeiConversationMessage.findMany({
		where: { workspaceId, conversationId },
		select: EMAIL_MESSAGE_LIST_SELECT,
		orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
	});
}
export function getXiaofeiConversationMessage(workspaceId: string, id: string) {
	return db.xiaofeiConversationMessage.findUnique({
		where: { workspaceId_id: { workspaceId, id } },
	});
}
export async function listXiaofeiOrganizationConversationMessages(
	organizationId: string,
	conversationId: string,
) {
	const workspace = await getRequiredXiaofeiOrganizationWorkspace(organizationId);
	return listXiaofeiConversationMessages(workspace.id, conversationId);
}
export async function getXiaofeiOrganizationConversationMessage(
	organizationId: string,
	id: string,
) {
	const workspace = await getRequiredXiaofeiOrganizationWorkspace(organizationId);
	return getXiaofeiConversationMessage(workspace.id, id);
}
const PROCESSING_JOB_LIST_SELECT = {
	id: true,
	workspaceId: true,
	inboundEventId: true,
	conversationId: true,
	conversationMessageId: true,
	kind: true,
	status: true,
	attempts: true,
	ownerEpoch: true,
	nextRunAt: true,
	createdAt: true,
	updatedAt: true,
} as const;
export async function listXiaofeiOrganizationProcessingJobs(organizationId: string) {
	const workspace = await getRequiredXiaofeiOrganizationWorkspace(organizationId);
	return db.xiaofeiProcessingJob.findMany({
		where: { workspaceId: workspace.id },
		select: PROCESSING_JOB_LIST_SELECT,
		orderBy: [{ createdAt: "desc" }, { id: "desc" }],
	});
}
export async function getXiaofeiOrganizationProcessingJob(organizationId: string, id: string) {
	const workspace = await getRequiredXiaofeiOrganizationWorkspace(organizationId);
	return db.xiaofeiProcessingJob.findUnique({
		where: { workspaceId_id: { workspaceId: workspace.id, id } },
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

/** Email mirror list deliberately excludes payload, body, and attachment fields. */
export async function listXiaofeiOrganizationEmailMirrorMetadata(organizationId: string) {
	const workspace = await getRequiredXiaofeiOrganizationWorkspace(organizationId);
	return db.xiaofeiInboundEvent.findMany({
		where: { workspaceId: workspace.id, source: "email" },
		select: {
			id: true,
			eventId: true,
			status: true,
			occurredAt: true,
			firstReceivedAt: true,
			lastReceivedAt: true,
			deliveryCount: true,
			conversationMessage: {
				select: {
					id: true,
					conversationId: true,
					direction: true,
					senderType: true,
					fromAddress: true,
					subject: true,
					occurredAt: true,
					ingestedAt: true,
					processingJob: { select: { id: true, status: true } },
				},
			},
		},
		orderBy: [{ createdAt: "desc" }, { id: "desc" }],
	});
}
export async function getXiaofeiOrganizationEmailMirrorDetail(organizationId: string, id: string) {
	const workspace = await getRequiredXiaofeiOrganizationWorkspace(organizationId);
	return db.xiaofeiInboundEvent.findFirst({
		where: { id, workspaceId: workspace.id, source: "email" },
		select: {
			id: true,
			eventId: true,
			status: true,
			occurredAt: true,
			firstReceivedAt: true,
			lastReceivedAt: true,
			deliveryCount: true,
			conversationMessage: {
				select: {
					id: true,
					conversationId: true,
					direction: true,
					senderType: true,
					fromAddress: true,
					subject: true,
					contentType: true,
					contentValue: true,
					attachments: true,
					occurredAt: true,
					ingestedAt: true,
					processingJob: { select: { id: true, status: true } },
				},
			},
		},
	});
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

function normalizeEmailAddress(address: string) {
	return address.trim().toLowerCase();
}

/**
 * The mirror ledger hashes stable business facts only. Transport topic, partition,
 * offset, and workerVersion are deliberately excluded so Kafka replay metadata
 * cannot turn an otherwise identical email event into a payload conflict.
 */
function hashEmailBusinessFacts(input: EmailMessageIngestV1) {
	return hashJson({
		schemaVersion: input.schemaVersion,
		eventId: input.eventId,
		occurredAt: input.occurredAt,
		tenant: input.tenant,
		channel: input.channel,
		channelAccount: {
			id: input.channelAccount.id,
			address: normalizeEmailAddress(input.channelAccount.address),
		},
		conversation: input.conversation,
		message: {
			...input.message,
			from: { ...input.message.from, address: normalizeEmailAddress(input.message.from.address) },
			to: input.message.to.map((recipient) => ({
				...recipient,
				address: normalizeEmailAddress(recipient.address),
			})),
		},
	} as Prisma.InputJsonValue);
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
