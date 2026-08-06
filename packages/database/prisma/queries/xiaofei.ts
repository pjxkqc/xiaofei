import { createHash } from "node:crypto";

import {
	KnowledgeUnitSchema,
	RuntimeMetadataSchema,
	ConversationStateSchema,
	EmailDeliveryV1Schema,
	SupportMessageSchema,
	createCapabilityVersionManifest,
	createConversationState,
	createKnowledgeUnitRevision,
	isCustomerInboundEmailJobEligible,
	type ConversationState,
	type CapabilityVersionManifest,
	type EmailDeliveryV1,
	type EmailMessageIngestV1,
	type KnowledgeUnitRevision,
	type RuntimeMetadata,
	type SupportMessage,
} from "@repo/xiaofei";
import { z } from "zod";

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
	emailDeliveryMode?: "mock" | "webhook";
	emailCallbackUrl?: string | null;
}

export interface CreateXiaofeiOutboundDeliveryInput {
	id: string;
	workspaceId: string;
	conversationId: string;
	processingJobId?: string | null;
	eventType: EmailDeliveryV1["event"]["type"];
	senderType: "xiaofei" | "loopdesk" | "system";
	destinationMode: "mock" | "webhook";
	destinationUrl?: string | null;
	payload: EmailDeliveryV1;
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
export class XiaofeiEmailProcessingLeaseConflictError extends Error {
	readonly code = "EMAIL_PROCESSING_LEASE_CONFLICT";
	constructor(readonly conversationId: string) {
		super("The Email conversation owner changed while Xiaofei was processing.");
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

export interface CreateXiaofeiKnowledgeUnitRevisionInput {
	organizationId: string | null;
	logicalKnowledgeUnitId: string;
	knowledgeUnitId?: string | null;
	origin: "platform" | "merchant";
	content: Prisma.InputJsonValue;
}

export interface CreateXiaofeiCapabilityVersionInput {
	organizationId: string;
	capabilityKey: "platform-fallback" | "merchant-knowledge" | "xiaofei-hosting";
	knowledgeUnits: Array<{
		knowledgeUnitRevisionId: string;
		role?: string;
		priority?: number;
	}>;
}

export interface ApplyXiaofeiResponseInterventionInput {
	organizationId: string;
	capabilityKey: "platform-fallback" | "merchant-knowledge" | "xiaofei-hosting";
	beforeCapabilityVersionId: string;
	beforeKnowledgeRevisionId: string;
	correction: string;
	correctedContent: Prisma.InputJsonValue;
	beforeResponse?: Prisma.InputJsonValue;
	afterResponse?: Prisma.InputJsonValue;
}

export interface CreateXiaofeiTestTurnInput {
	testSessionId: string;
	expectedPreviousTestTurnId: string | null;
	question: string;
	answer: string;
	capabilityVersionId: string;
	conversationState: ConversationState;
	runtimeMetadata: RuntimeMetadata;
	requestedAt: Date;
	completedAt: Date;
}

export interface CreateXiaofeiTestSessionInput {
	id: string;
	capabilityVersionId: string;
}

export interface ApplyXiaofeiTestTurnFeedbackInput {
	organizationId: string;
	sourceTestTurnId: string;
	correction: string;
}

export interface CreateXiaofeiTestTurnRerunInput {
	interventionId: string;
	testSessionId: string;
	expectedPreviousTestTurnId: string | null;
	answer: string;
	capabilityVersionId: string;
	conversationState: ConversationState;
	runtimeMetadata: RuntimeMetadata;
	requestedAt: Date;
	completedAt: Date;
}

export interface ListXiaofeiTestSessionsOptions {
	cursor?: string;
	limit?: number;
}

/** A bounded, safe-to-list Test CA session projection; turn bodies stay in the detail DTO. */
export interface XiaofeiTestSessionSummaryDto {
	id: string;
	capabilityVersionId: string;
	firstQuestion: string;
	latestAt: Date;
	turnCount: number;
	beforeInterventionCount: number;
	afterInterventionCount: number;
	isCurrent: boolean;
	writable: boolean;
}

export interface XiaofeiTestSessionDetailDto extends XiaofeiTestSessionSummaryDto {
	turns: Array<{
		id: string;
		question: string;
		answer: string;
		capabilityVersionId: string;
		conversationState: ConversationState | null;
		runtimeMetadata: RuntimeMetadata;
		evidenceRevisionId: string | null;
		sourceTestTurnId: string | null;
		interventionId: string | null;
		requestedAt: Date;
		completedAt: Date;
		createdAt: Date;
	}>;
}

export interface UpsertXiaofeiSyntheticSupportConversationInput {
	organizationId: string;
	externalId: string;
	customerName?: string | null;
	/** Serialized API state is validated at this persistence boundary. */
	state: Prisma.InputJsonValue;
	messages: Prisma.InputJsonValue;
	traceEvents: Prisma.InputJsonValue;
	lastCustomerSeenAt?: Date | null;
	lastMessageAt?: Date | null;
}

export interface CommitXiaofeiSyntheticSupportConversationInput {
	organizationId: string;
	externalId: string;
	expectedRevision: number;
	expectedOwnerType: string | null;
	expectedOwnerEpoch: number | null;
	/** Serialized API state is validated at this persistence boundary. */
	state: Prisma.InputJsonValue;
	messages: Prisma.InputJsonValue;
	traceEvents: Prisma.InputJsonValue;
	lastCustomerSeenAt?: Date | null;
	lastMessageAt?: Date | null;
}

export interface CreateOrReturnXiaofeiKnowledgeUnitInput extends CreateXiaofeiKnowledgeUnitInput {}

export interface XiaofeiRuntimeCapabilityDto {
	manifest: CapabilityVersionManifest;
	revisions: KnowledgeUnitRevision[];
}

export class XiaofeiVersioningNotFoundError extends Error {
	constructor(
		readonly organizationId: string,
		readonly id: string,
	) {
		super("The requested versioned knowledge record was not found in this Organization.");
		this.name = "XiaofeiVersioningNotFoundError";
	}
}

export class XiaofeiTestTurnFeedbackConflictError extends Error {
	constructor(readonly sourceTestTurnId: string) {
		super("This TestTurn already has a different applied correction.");
		this.name = "XiaofeiTestTurnFeedbackConflictError";
	}
}

/** A session is pinned to its first Test CA so evidence cannot span a CA switch. */
export class XiaofeiTestSessionCapabilityConflictError extends Error {
	constructor(
		readonly organizationId: string,
		readonly testSessionId: string,
	) {
		super("This test session belongs to a different Test capability version.");
		this.name = "XiaofeiTestSessionCapabilityConflictError";
	}
}

/** A concurrent turn changed the session after the caller loaded its snapshot. */
export class XiaofeiTestSessionConflictError extends Error {
	constructor(
		readonly organizationId: string,
		readonly testSessionId: string,
	) {
		super("This test session changed; reload its latest state before trying again.");
		this.name = "XiaofeiTestSessionConflictError";
	}
}

/** A synthetic acceptance ID must not claim an existing customer channel. */
export class XiaofeiSyntheticSupportConversationConflictError extends Error {
	constructor(
		readonly organizationId: string,
		readonly externalId: string,
	) {
		super("The synthetic support conversation ID is already owned by another channel.");
		this.name = "XiaofeiSyntheticSupportConversationConflictError";
	}
}

/** A lease, Inbox takeover, or another AI turn invalidated a synthetic commit. */
export class XiaofeiSyntheticSupportCommitConflictError extends Error {
	readonly code = "SYNTHETIC_SUPPORT_COMMIT_CONFLICT";
	constructor(
		readonly organizationId: string,
		readonly externalId: string,
	) {
		super("The synthetic support conversation changed; reload before committing AI state.");
	}
}

export class XiaofeiVersioningCrossOrganizationError extends Error {
	constructor(
		readonly organizationId: string,
		readonly id: string,
	) {
		super("A versioned knowledge record belongs to another Organization.");
		this.name = "XiaofeiVersioningCrossOrganizationError";
	}
}

export class XiaofeiPlatformKnowledgeInterventionError extends Error {
	constructor(readonly id: string) {
		super("Platform baseline knowledge cannot be corrected by an Organization.");
		this.name = "XiaofeiPlatformKnowledgeInterventionError";
	}
}

export class XiaofeiCapabilityPartitionError extends Error {
	constructor(readonly capabilityKey: string) {
		super("The selected knowledge origins are not allowed for this capability.");
		this.name = "XiaofeiCapabilityPartitionError";
	}
}

export class XiaofeiDuplicateLogicalKnowledgeUnitError extends Error {
	constructor(readonly logicalKnowledgeUnitId: string) {
		super("A capability version may select only one revision for each logical knowledge unit.");
		this.name = "XiaofeiDuplicateLogicalKnowledgeUnitError";
	}
}

export const DEFAULT_XIAOFEI_KNOWLEDGE_DOCUMENT_PAGE_SIZE = 25;
export const MAX_XIAOFEI_KNOWLEDGE_DOCUMENT_PAGE_SIZE = 50;
export const DEFAULT_XIAOFEI_TEST_SESSION_PAGE_SIZE = 20;
export const MAX_XIAOFEI_TEST_SESSION_PAGE_SIZE = 50;
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

export async function getXiaofeiOrganizationEmailDeliveryConfig(organizationId: string) {
	const config = await getXiaofeiOrganizationConfig(organizationId);
	return {
		mode: config?.emailDeliveryMode === "webhook" ? ("webhook" as const) : ("mock" as const),
		callbackUrl: config?.emailCallbackUrl ?? null,
	};
}

export async function saveXiaofeiOrganizationEmailDeliveryConfig(
	organizationId: string,
	input: { mode: "mock" | "webhook"; callbackUrl: string | null },
) {
	const config = await upsertXiaofeiOrganizationConfig(organizationId, {
		emailDeliveryMode: input.mode,
		emailCallbackUrl: input.callbackUrl,
	});
	return {
		mode: config.emailDeliveryMode === "webhook" ? ("webhook" as const) : ("mock" as const),
		callbackUrl: config.emailCallbackUrl,
	};
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

/**
 * Projects a synthetic acceptance conversation into the Organization workspace.
 * This deliberately does not create an inbound event, processing job, channel
 * binding, or outbound delivery: it is not an Email transport operation.
 */
export function upsertXiaofeiSyntheticSupportConversation(
	input: UpsertXiaofeiSyntheticSupportConversationInput,
) {
	return db.$transaction(async (transaction) => {
		const state = ConversationStateSchema.parse(input.state);
		const workspace = await transaction.xiaofeiWorkspace.findUnique({
			where: { tenantKey: organizationTenantKey(input.organizationId) },
		});
		if (!workspace) throw new XiaofeiOrganizationWorkspaceNotFoundError(input.organizationId);
		await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${workspace.id}:${input.externalId}`}, 0))`;
		const existing = await transaction.xiaofeiConversation.findUnique({
			where: {
				workspaceId_externalId: { workspaceId: workspace.id, externalId: input.externalId },
			},
		});
		if (existing) {
			if (existing.channel !== "synthetic_support")
				throw new XiaofeiSyntheticSupportConversationConflictError(
					input.organizationId,
					input.externalId,
				);
			return existing;
		}
		return transaction.xiaofeiConversation.create({
			data: {
				workspaceId: workspace.id,
				externalId: input.externalId,
				channel: "synthetic_support",
				customerName: input.customerName ?? "Synthetic support acceptance",
				state: JSON.parse(JSON.stringify(state)) as Prisma.InputJsonValue,
				ownerType: state.ownerType,
				ownerEpoch: state.ownerEpoch,
				messages: input.messages,
				traceEvents: input.traceEvents,
				lastCustomerSeenAt: input.lastCustomerSeenAt ?? null,
				lastMessageAt: input.lastMessageAt ?? null,
			},
		});
	});
}

/**
 * Commits an AI result only when both the row revision and the captured owner
 * lease still match. This intentionally touches no transport or Email tables.
 */
export function commitXiaofeiSyntheticSupportConversation(
	input: CommitXiaofeiSyntheticSupportConversationInput,
) {
	return db.$transaction(async (transaction) => {
		const state = ConversationStateSchema.parse(input.state);
		const workspace = await transaction.xiaofeiWorkspace.findUnique({
			where: { tenantKey: organizationTenantKey(input.organizationId) },
		});
		if (!workspace) throw new XiaofeiOrganizationWorkspaceNotFoundError(input.organizationId);
		await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${workspace.id}:${input.externalId}`}, 0))`;
		const conversation = await transaction.xiaofeiConversation.findUnique({
			where: {
				workspaceId_externalId: { workspaceId: workspace.id, externalId: input.externalId },
			},
			select: { id: true, channel: true, revision: true, ownerType: true, ownerEpoch: true },
		});
		if (!conversation || conversation.channel !== "synthetic_support")
			throw new XiaofeiSyntheticSupportConversationConflictError(
				input.organizationId,
				input.externalId,
			);
		if (
			conversation.revision !== input.expectedRevision ||
			conversation.ownerType !== input.expectedOwnerType ||
			conversation.ownerEpoch !== input.expectedOwnerEpoch
		)
			throw new XiaofeiSyntheticSupportCommitConflictError(input.organizationId, input.externalId);
		const updated = await transaction.xiaofeiConversation.updateMany({
			where: {
				id: conversation.id,
				revision: input.expectedRevision,
				ownerType: input.expectedOwnerType,
				ownerEpoch: input.expectedOwnerEpoch,
			},
			data: {
				state: JSON.parse(JSON.stringify(state)) as Prisma.InputJsonValue,
				ownerType: state.ownerType,
				ownerEpoch: state.ownerEpoch,
				messages: input.messages,
				traceEvents: input.traceEvents,
				lastCustomerSeenAt: input.lastCustomerSeenAt ?? null,
				lastMessageAt: input.lastMessageAt ?? null,
				revision: { increment: 1 },
			},
		});
		if (updated.count !== 1)
			throw new XiaofeiSyntheticSupportCommitConflictError(input.organizationId, input.externalId);
		return transaction.xiaofeiConversation.findUniqueOrThrow({ where: { id: conversation.id } });
	});
}
export function getXiaofeiConversation(workspaceId: string, externalId: string) {
	return db.xiaofeiConversation.findUnique({
		where: { workspaceId_externalId: { workspaceId, externalId } },
		include: {
			customer: true,
			processingJobs: {
				select: { id: true, status: true },
				orderBy: { createdAt: "desc" },
				take: 1,
			},
			outboundDeliveries: { select: { status: true }, orderBy: { createdAt: "desc" }, take: 1 },
		},
	});
}
export function listXiaofeiConversations(workspaceId: string) {
	return db.xiaofeiConversation.findMany({
		where: { workspaceId },
		include: {
			customer: true,
			processingJobs: {
				select: { id: true, status: true },
				orderBy: { createdAt: "desc" },
				take: 1,
			},
			outboundDeliveries: { select: { status: true }, orderBy: { createdAt: "desc" }, take: 1 },
		},
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
	return db.$transaction(async (transaction) => {
		// Keep the CAS columns as a durable projection of the validated state. Every
		// Inbox mutation also advances revision, invalidating any in-flight AI lease.
		const current = await transaction.xiaofeiConversation.findUniqueOrThrow({
			where: { workspaceId_externalId: { workspaceId, externalId } },
			select: { state: true },
		});
		const nextState = data.state === undefined ? current.state : data.state;
		const parsed = ConversationStateSchema.parse(nextState);
		return transaction.xiaofeiConversation.update({
			where: { workspaceId_externalId: { workspaceId, externalId } },
			data: {
				...data,
				ownerType: parsed.ownerType,
				ownerEpoch: parsed.ownerEpoch,
				revision: { increment: 1 },
			},
		});
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
			await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${binding.workspaceId}:${input.conversation.externalId}`}, 0))`;
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
						messages: toEmailSupportMessages([], input),
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
			if (currentConversation)
				await transaction.xiaofeiConversation.update({
					where: { id: conversation.id },
					data: {
						customerName: customer.name,
						messages: toEmailSupportMessages(currentConversation.messages, input),
					},
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
	lastError: true,
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

export async function getXiaofeiOrganizationEmailProcessingContext(
	organizationId: string,
	id: string,
) {
	const workspace = await getRequiredXiaofeiOrganizationWorkspace(organizationId);
	return db.xiaofeiProcessingJob.findUnique({
		where: { workspaceId_id: { workspaceId: workspace.id, id } },
		include: {
			inboundEvent: true,
			conversationMessage: true,
			conversation: { include: { customer: true } },
		},
	});
}

export async function claimXiaofeiOrganizationEmailProcessingJob(
	organizationId: string,
	id: string,
) {
	const workspace = await getRequiredXiaofeiOrganizationWorkspace(organizationId);
	const result = await db.xiaofeiProcessingJob.updateMany({
		where: { workspaceId: workspace.id, id, status: { in: ["mirrored", "failed"] } },
		data: {
			status: "processing",
			attempts: { increment: 1 },
			lastError: null,
			nextRunAt: null,
		},
	});
	return result.count === 1;
}

export async function failXiaofeiOrganizationEmailProcessingJob(
	organizationId: string,
	id: string,
	lastError: string,
) {
	const workspace = await getRequiredXiaofeiOrganizationWorkspace(organizationId);
	return db.xiaofeiProcessingJob.updateMany({
		where: { workspaceId: workspace.id, id, status: "processing" },
		data: { status: "failed", lastError },
	});
}

export async function completeXiaofeiEmailReplyProcessing(input: {
	workspaceId: string;
	jobId: string;
	conversationId: string;
	expectedOwnerEpoch: number;
	state: Prisma.InputJsonValue;
	messages: Prisma.InputJsonValue;
	traceEvents: Prisma.InputJsonValue;
	lastMessageAt: Date;
	delivery: CreateXiaofeiOutboundDeliveryInput;
}) {
	return db.$transaction(async (transaction) => {
		const job = await transaction.xiaofeiProcessingJob.findFirst({
			where: {
				workspaceId: input.workspaceId,
				id: input.jobId,
				conversationId: input.conversationId,
				status: "processing",
			},
		});
		if (!job) throw new Error("Email processing job is not claimed.");
		const conversation = await transaction.xiaofeiConversation.findUnique({
			where: {
				workspaceId_id: { workspaceId: input.workspaceId, id: input.conversationId },
			},
			select: { state: true },
		});
		if (!conversation) throw new Error("Email conversation not found.");
		const currentState = ConversationStateSchema.parse(conversation.state);
		if (currentState.ownerType !== "ai" || currentState.ownerEpoch !== input.expectedOwnerEpoch)
			throw new XiaofeiEmailProcessingLeaseConflictError(input.conversationId);
		await transaction.xiaofeiConversation.update({
			where: {
				workspaceId_id: { workspaceId: input.workspaceId, id: input.conversationId },
			},
			data: {
				state: input.state,
				messages: input.messages,
				traceEvents: input.traceEvents,
				lastMessageAt: input.lastMessageAt,
			},
		});
		const payload = EmailDeliveryV1Schema.parse(input.delivery.payload);
		const delivery = await transaction.xiaofeiOutboundDelivery.create({
			data: {
				...input.delivery,
				payload: payload as Prisma.InputJsonValue,
				status: "pending",
			},
		});
		await transaction.xiaofeiProcessingJob.update({
			where: { workspaceId_id: { workspaceId: input.workspaceId, id: input.jobId } },
			data: { status: "delivery_pending", lastError: null },
		});
		return delivery;
	});
}

export async function createXiaofeiOutboundDelivery(input: CreateXiaofeiOutboundDeliveryInput) {
	const payload = EmailDeliveryV1Schema.parse(input.payload);
	return db.xiaofeiOutboundDelivery.create({
		data: {
			...input,
			payload: payload as Prisma.InputJsonValue,
			status: "pending",
		},
	});
}

export async function retargetXiaofeiOrganizationOutboundDelivery(
	organizationId: string,
	id: string,
	input: { destinationMode: "mock" | "webhook"; destinationUrl: string | null },
) {
	const workspace = await getRequiredXiaofeiOrganizationWorkspace(organizationId);
	return db.xiaofeiOutboundDelivery.update({
		where: { workspaceId_id: { workspaceId: workspace.id, id } },
		data: {
			destinationMode: input.destinationMode,
			destinationUrl: input.destinationUrl,
			status: "pending",
			responseStatus: null,
			lastError: null,
		},
	});
}

export async function recordXiaofeiOutboundDeliveryAttempt(input: {
	workspaceId: string;
	id: string;
	status: "delivered" | "failed";
	responseStatus: number | null;
	lastError: string | null;
}) {
	const now = new Date();
	return db.$transaction(async (transaction) => {
		const current = await transaction.xiaofeiOutboundDelivery.findUnique({
			where: { workspaceId_id: { workspaceId: input.workspaceId, id: input.id } },
			select: { firstAttemptAt: true },
		});
		if (!current) throw new Error("Outbound delivery not found.");
		const delivery = await transaction.xiaofeiOutboundDelivery.update({
			where: { workspaceId_id: { workspaceId: input.workspaceId, id: input.id } },
			data: {
				status: input.status,
				attempts: { increment: 1 },
				responseStatus: input.responseStatus,
				lastError: input.lastError,
				firstAttemptAt: current.firstAttemptAt ?? now,
				...(input.status === "delivered" ? { deliveredAt: now } : {}),
			},
		});
		if (delivery.processingJobId)
			await transaction.xiaofeiProcessingJob.updateMany({
				where: { workspaceId: input.workspaceId, id: delivery.processingJobId },
				data: {
					status: input.status === "delivered" ? "delivered" : "delivery_failed",
					lastError: input.lastError,
				},
			});
		return delivery;
	});
}

export async function listXiaofeiOrganizationOutboundDeliveries(organizationId: string) {
	const workspace = await getRequiredXiaofeiOrganizationWorkspace(organizationId);
	return db.xiaofeiOutboundDelivery.findMany({
		where: { workspaceId: workspace.id },
		select: {
			id: true,
			conversationId: true,
			processingJobId: true,
			eventType: true,
			senderType: true,
			destinationMode: true,
			destinationUrl: true,
			status: true,
			attempts: true,
			responseStatus: true,
			lastError: true,
			firstAttemptAt: true,
			deliveredAt: true,
			createdAt: true,
			updatedAt: true,
		},
		orderBy: [{ createdAt: "desc" }, { id: "desc" }],
		take: 50,
	});
}

export async function getXiaofeiOrganizationOutboundDelivery(organizationId: string, id: string) {
	const workspace = await getRequiredXiaofeiOrganizationWorkspace(organizationId);
	return db.xiaofeiOutboundDelivery.findUnique({
		where: { workspaceId_id: { workspaceId: workspace.id, id } },
	});
}

export async function getLatestXiaofeiOrganizationEmailMirrorContext(organizationId: string) {
	const workspace = await getRequiredXiaofeiOrganizationWorkspace(organizationId);
	return db.xiaofeiInboundEvent.findFirst({
		where: { workspaceId: workspace.id, source: "email", conversationMessage: { isNot: null } },
		include: { conversationMessage: { include: { conversation: true } } },
		orderBy: [{ createdAt: "desc" }, { id: "desc" }],
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
		take: 50,
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

/**
 * Retry-safe current KU materialization. The workspace lock and exact entry /
 * source lineage mean concurrent callers reuse one current row, while stale
 * and historical rows are never rewritten.
 */
export function createOrReturnXiaofeiKnowledgeUnit(input: CreateOrReturnXiaofeiKnowledgeUnitInput) {
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
		)
			throw new Error("Knowledge entry was not eligible in this workspace.");
		const existing = await transaction.xiaofeiKnowledgeUnit.findFirst({
			where: {
				workspaceId: input.workspaceId,
				entryId: input.entryId,
				sourceId: entry.sourceId,
				sourceContentHash: entry.sourceContentHash,
				sourceVersion: entry.sourceVersion,
				entryVersion: entry.entryVersion,
				eligibility: { not: "stale" },
			},
			orderBy: [{ createdAt: "desc" }, { id: "desc" }],
		});
		if (existing) return { knowledgeUnit: existing, created: false };
		const knowledgeUnit = await transaction.xiaofeiKnowledgeUnit.create({
			data: {
				...input,
				sourceId: entry.sourceId,
				sourceContentHash: entry.sourceContentHash,
				sourceVersion: entry.sourceVersion,
				entryVersion: entry.entryVersion,
			},
		});
		return { knowledgeUnit, created: true };
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

/**
 * Creates one immutable, content-addressed KU revision. Repeating the same
 * logical KU content returns its existing snapshot instead of mutating it.
 */
export function createXiaofeiKnowledgeUnitRevision(input: CreateXiaofeiKnowledgeUnitRevisionInput) {
	if ((input.origin === "platform") !== (input.organizationId === null)) {
		throw new Error(
			"Platform revisions must be global and merchant revisions must be Organization-scoped.",
		);
	}
	return db.$transaction(async (transaction) =>
		createXiaofeiKnowledgeUnitRevisionInTransaction(transaction, input),
	);
}

/** Lists global platform snapshots and only this Organization's merchant snapshots. */
export function listXiaofeiKnowledgeUnitRevisions(organizationId: string) {
	return db.xiaofeiKnowledgeUnitRevision.findMany({
		where: { OR: [{ organizationId }, { organizationId: null }] },
		orderBy: [{ logicalKnowledgeUnitId: "asc" }, { revision: "desc" }],
	});
}

/** Creates a frozen CA manifest and its real M:N KU-revision memberships. */
export function createXiaofeiCapabilityVersion(input: CreateXiaofeiCapabilityVersionInput) {
	if (input.knowledgeUnits.length === 0)
		throw new Error("A capability version requires knowledge.");
	return db.$transaction(async (transaction) =>
		createXiaofeiCapabilityVersionInTransaction(transaction, input),
	);
}

export function getXiaofeiCapabilityVersion(organizationId: string, id: string) {
	return db.xiaofeiCapabilityVersion.findUnique({
		where: { organizationId_id: { organizationId, id } },
		include: {
			knowledgeUnits: {
				include: { knowledgeUnitRevision: true },
				orderBy: [{ priority: "desc" }, { id: "asc" }],
			},
		},
	});
}

/**
 * Applies one merchant correction without touching the active pointer: it
 * creates/reuses an immutable KU successor, creates a test CA manifest, and
 * stores the before/after audit record in one transaction.
 */
export function applyXiaofeiResponseIntervention(input: ApplyXiaofeiResponseInterventionInput) {
	return db.$transaction((transaction) =>
		applyXiaofeiResponseInterventionInTransaction(transaction, input),
	);
}

async function applyXiaofeiResponseInterventionInTransaction(
	transaction: Prisma.TransactionClient,
	input: ApplyXiaofeiResponseInterventionInput,
) {
	const beforeRevision = await transaction.xiaofeiKnowledgeUnitRevision.findUnique({
		where: {
			scopeKey_id: {
				scopeKey: xiaofeiKnowledgeRevisionScopeKey(input.organizationId),
				id: input.beforeKnowledgeRevisionId,
			},
		},
	});
	if (!beforeRevision) {
		const platformRevision = await transaction.xiaofeiKnowledgeUnitRevision.findFirst({
			where: {
				scopeKey: xiaofeiKnowledgeRevisionScopeKey(null),
				id: input.beforeKnowledgeRevisionId,
			},
		});
		if (platformRevision) throw new XiaofeiPlatformKnowledgeInterventionError(platformRevision.id);
		throw new XiaofeiVersioningNotFoundError(input.organizationId, input.beforeKnowledgeRevisionId);
	}
	if (beforeRevision.origin !== "merchant")
		throw new XiaofeiPlatformKnowledgeInterventionError(beforeRevision.id);
	const beforeVersion = await transaction.xiaofeiCapabilityVersion.findUnique({
		where: {
			organizationId_id: {
				organizationId: input.organizationId,
				id: input.beforeCapabilityVersionId,
			},
		},
		include: { knowledgeUnits: { include: { knowledgeUnitRevision: true } } },
	});
	if (!beforeVersion)
		throw new XiaofeiVersioningNotFoundError(input.organizationId, input.beforeCapabilityVersionId);
	if (beforeVersion.capabilityKey !== input.capabilityKey)
		throw new XiaofeiVersioningNotFoundError(input.organizationId, input.beforeCapabilityVersionId);
	if (
		!beforeVersion.knowledgeUnits.some((unit) => unit.knowledgeUnitRevisionId === beforeRevision.id)
	)
		throw new XiaofeiVersioningNotFoundError(input.organizationId, input.beforeKnowledgeRevisionId);

	const resultRevision = await createXiaofeiKnowledgeUnitRevisionInTransaction(transaction, {
		organizationId: input.organizationId,
		logicalKnowledgeUnitId: beforeRevision.logicalKnowledgeUnitId,
		knowledgeUnitId: beforeRevision.knowledgeUnitId,
		origin: "merchant",
		content: input.correctedContent,
	});
	const resultVersion = await createXiaofeiCapabilityVersionInTransaction(transaction, {
		organizationId: input.organizationId,
		capabilityKey: input.capabilityKey,
		knowledgeUnits: beforeVersion.knowledgeUnits.map((unit) => ({
			knowledgeUnitRevisionId:
				unit.knowledgeUnitRevisionId === beforeRevision.id
					? resultRevision.id
					: unit.knowledgeUnitRevisionId,
			role: unit.role,
			priority: unit.priority,
		})),
	});
	const intervention = await transaction.xiaofeiResponseIntervention.create({
		data: {
			organizationId: input.organizationId,
			correction: input.correction,
			beforeResponse: input.beforeResponse,
			afterResponse: input.afterResponse,
			beforeCapabilityVersionId: beforeVersion.id,
			resultCapabilityVersionId: resultVersion.id,
			beforeKnowledgeRevisionScopeKey: beforeRevision.scopeKey,
			beforeKnowledgeRevisionId: beforeRevision.id,
			resultKnowledgeRevisionScopeKey: resultRevision.scopeKey,
			resultKnowledgeRevisionId: resultRevision.id,
		},
	});
	await transaction.xiaofeiCapabilityBinding.upsert({
		where: {
			organizationId_capabilityKey: {
				organizationId: input.organizationId,
				capabilityKey: input.capabilityKey,
			},
		},
		create: {
			organizationId: input.organizationId,
			capabilityKey: input.capabilityKey,
			testCapabilityVersionId: resultVersion.id,
		},
		update: { testCapabilityVersionId: resultVersion.id },
	});
	return { intervention, resultRevision, resultVersion };
}

/** Atomically switches only an Organization-local active pointer. */
export function activateXiaofeiCapabilityVersion(
	organizationId: string,
	capabilityKey: string,
	capabilityVersionId: string,
) {
	return db.$transaction(async (transaction) => {
		const version = await transaction.xiaofeiCapabilityVersion.findUnique({
			where: { organizationId_id: { organizationId, id: capabilityVersionId } },
			select: { id: true, capabilityKey: true },
		});
		if (!version || version.capabilityKey !== capabilityKey || capabilityKey !== "xiaofei-hosting")
			throw new XiaofeiVersioningNotFoundError(organizationId, capabilityVersionId);
		return transaction.xiaofeiCapabilityBinding.upsert({
			where: { organizationId_capabilityKey: { organizationId, capabilityKey } },
			create: { organizationId, capabilityKey, activeCapabilityVersionId: capabilityVersionId },
			update: { activeCapabilityVersionId: capabilityVersionId },
		});
	});
}

/** Returns both Organization-local hosting pointers with their exact ordered memberships. */
export function getXiaofeiOrganizationHostingBinding(organizationId: string) {
	return db.xiaofeiCapabilityBinding.findUnique({
		where: { organizationId_capabilityKey: { organizationId, capabilityKey: "xiaofei-hosting" } },
		include: {
			activeCapabilityVersion: {
				include: {
					knowledgeUnits: {
						include: { knowledgeUnitRevision: true },
						orderBy: [{ priority: "desc" }, { id: "asc" }],
					},
				},
			},
			testCapabilityVersion: {
				include: {
					knowledgeUnits: {
						include: { knowledgeUnitRevision: true },
						orderBy: [{ priority: "desc" }, { id: "asc" }],
					},
				},
			},
		},
	});
}

/** Replaces only the Organization's hosting Test pointer after exact local verification. */
export function setXiaofeiOrganizationTestHostingVersion(
	organizationId: string,
	capabilityVersionId: string,
) {
	return db.$transaction(async (transaction) => {
		const version = await transaction.xiaofeiCapabilityVersion.findUnique({
			where: { organizationId_id: { organizationId, id: capabilityVersionId } },
			select: { id: true, capabilityKey: true },
		});
		if (!version || version.capabilityKey !== "xiaofei-hosting")
			throw new XiaofeiVersioningNotFoundError(organizationId, capabilityVersionId);
		return transaction.xiaofeiCapabilityBinding.upsert({
			where: { organizationId_capabilityKey: { organizationId, capabilityKey: "xiaofei-hosting" } },
			create: {
				organizationId,
				capabilityKey: "xiaofei-hosting",
				testCapabilityVersionId: version.id,
			},
			update: { testCapabilityVersionId: version.id },
		});
	});
}

/** Rejects global platform and foreign snapshots at the correction boundary. */
export async function getXiaofeiMerchantRevisionForCorrection(organizationId: string, id: string) {
	const revision = await db.xiaofeiKnowledgeUnitRevision.findUnique({
		where: { scopeKey_id: { scopeKey: xiaofeiKnowledgeRevisionScopeKey(organizationId), id } },
	});
	if (!revision || revision.origin !== "merchant")
		throw new XiaofeiVersioningNotFoundError(organizationId, id);
	return revision;
}

/** Builds domain-hashed, exact persisted hosting data for Runtime's active/test materializers. */
export async function loadXiaofeiRuntimeHostingCapability(
	organizationId: string,
	mode: "active" | "test",
): Promise<XiaofeiRuntimeCapabilityDto> {
	const binding = await getXiaofeiOrganizationHostingBinding(organizationId);
	const version =
		mode === "active" ? binding?.activeCapabilityVersion : binding?.testCapabilityVersion;
	if (!version || version.capabilityKey !== "xiaofei-hosting")
		throw new XiaofeiVersioningNotFoundError(organizationId, `${mode}:xiaofei-hosting`);
	const revisions = version.knowledgeUnits.map((member) =>
		createKnowledgeUnitRevision({
			id: member.knowledgeUnitRevision.id,
			logicalKnowledgeUnitId: member.knowledgeUnitRevision.logicalKnowledgeUnitId,
			organizationId: member.knowledgeUnitRevision.organizationId,
			revision: member.knowledgeUnitRevision.revision,
			origin: member.knowledgeUnitRevision.origin as "platform" | "merchant",
			knowledgeUnit: KnowledgeUnitSchema.parse(member.knowledgeUnitRevision.content),
			createdAt: member.knowledgeUnitRevision.createdAt.toISOString(),
		}),
	);
	return {
		manifest: createCapabilityVersionManifest({
			id: version.id,
			organizationId,
			capabilityKey: "xiaofei-hosting",
			status: mode,
			knowledgeUnitRevisionIds: version.knowledgeUnits.map(
				(member) => member.knowledgeUnitRevisionId,
			),
			createdAt: version.createdAt.toISOString(),
		}),
		revisions,
	};
}

/** Stores one real answer only after validating the currently selected Active/Test hosting CA. */
export function createXiaofeiTestTurn(organizationId: string, input: CreateXiaofeiTestTurnInput) {
	return db.$transaction((transaction) =>
		createXiaofeiTestTurnInTransaction(transaction, organizationId, input),
	);
}

/** Creates a visible zero-turn session pinned to the current Test hosting CA. */
export function createXiaofeiTestSession(
	organizationId: string,
	input: CreateXiaofeiTestSessionInput,
) {
	return db.$transaction(async (transaction) => {
		await lockXiaofeiVersioningScope(transaction, `test-session:${organizationId}:${input.id}`);
		const binding = await transaction.xiaofeiCapabilityBinding.findUnique({
			where: { organizationId_capabilityKey: { organizationId, capabilityKey: "xiaofei-hosting" } },
			select: { testCapabilityVersionId: true },
		});
		if (binding?.testCapabilityVersionId !== input.capabilityVersionId)
			throw new XiaofeiVersioningNotFoundError(organizationId, input.capabilityVersionId);
		const existing = await transaction.xiaofeiTestSession.findUnique({
			where: { organizationId_id: { organizationId, id: input.id } },
		});
		if (existing) {
			if (existing.capabilityVersionId !== input.capabilityVersionId)
				throw new XiaofeiTestSessionCapabilityConflictError(organizationId, input.id);
			return existing;
		}
		return transaction.xiaofeiTestSession.create({
			data: { id: input.id, organizationId, capabilityVersionId: input.capabilityVersionId },
		});
	});
}

async function createXiaofeiTestTurnInTransaction(
	transaction: Prisma.TransactionClient,
	organizationId: string,
	input: CreateXiaofeiTestTurnInput,
	lineage?: { sourceTestTurnId: string; rerunOfTestTurnId: string; interventionId: string },
) {
	const metadata = RuntimeMetadataSchema.parse(input.runtimeMetadata);
	const conversationState = ConversationStateSchema.parse(input.conversationState);
	await lockXiaofeiVersioningScope(
		transaction,
		`test-session:${organizationId}:${input.testSessionId}`,
	);
	const previousTurn = await transaction.xiaofeiTestTurn.findFirst({
		where: { organizationId, testSessionId: input.testSessionId },
		orderBy: [{ createdAt: "desc" }, { id: "desc" }],
		select: { id: true, capabilityVersionId: true },
	});
	if ((previousTurn?.id ?? null) !== input.expectedPreviousTestTurnId)
		throw new XiaofeiTestSessionConflictError(organizationId, input.testSessionId);
	if (previousTurn && previousTurn.capabilityVersionId !== input.capabilityVersionId)
		throw new XiaofeiTestSessionCapabilityConflictError(organizationId, input.testSessionId);
	const session = await transaction.xiaofeiTestSession.findUnique({
		where: { organizationId_id: { organizationId, id: input.testSessionId } },
		select: { capabilityVersionId: true },
	});
	// A turn must always belong to a durable, CA-pinned session. In particular,
	// do not allow the first turn to create an unpinned implicit session.
	if (!session || session.capabilityVersionId !== input.capabilityVersionId)
		throw new XiaofeiTestSessionCapabilityConflictError(organizationId, input.testSessionId);
	const binding = await transaction.xiaofeiCapabilityBinding.findUnique({
		where: { organizationId_capabilityKey: { organizationId, capabilityKey: "xiaofei-hosting" } },
		include: {
			activeCapabilityVersion: {
				include: { knowledgeUnits: { include: { knowledgeUnitRevision: true } } },
			},
			testCapabilityVersion: {
				include: { knowledgeUnits: { include: { knowledgeUnitRevision: true } } },
			},
		},
	});
	const version = [binding?.activeCapabilityVersion, binding?.testCapabilityVersion].find(
		(candidate) =>
			candidate?.id === input.capabilityVersionId && candidate.capabilityKey === "xiaofei-hosting",
	);
	if (!version) throw new XiaofeiVersioningNotFoundError(organizationId, input.capabilityVersionId);
	const evidence = metadata.knowledgeEvidence;
	const member = evidence
		? version.knowledgeUnits.find(
				(candidate) =>
					candidate.knowledgeUnitRevisionId === evidence.knowledgeUnitRevisionId &&
					evidence.capabilityVersionId === version.id &&
					evidence.capabilityKey === version.capabilityKey &&
					candidate.knowledgeUnitRevision.logicalKnowledgeUnitId ===
						evidence.logicalKnowledgeUnitId &&
					candidate.knowledgeUnitRevision.origin === evidence.knowledgeUnitOrigin,
			)
		: null;
	if (evidence && !member)
		throw new XiaofeiVersioningNotFoundError(organizationId, evidence.knowledgeUnitRevisionId);
	return transaction.xiaofeiTestTurn.create({
		data: {
			organizationId,
			testSessionId: input.testSessionId,
			question: input.question,
			answer: input.answer,
			capabilityVersionId: version.id,
			conversationState: JSON.parse(JSON.stringify(conversationState)) as Prisma.InputJsonValue,
			runtimeMetadata: JSON.parse(JSON.stringify(metadata)) as Prisma.InputJsonValue,
			evidenceRevisionScopeKey: member?.knowledgeUnitRevision.scopeKey ?? null,
			evidenceRevisionId: member?.knowledgeUnitRevisionId ?? null,
			sourceTestTurnId: lineage?.sourceTestTurnId ?? null,
			rerunOfTestTurnId: lineage?.rerunOfTestTurnId ?? null,
			interventionId: lineage?.interventionId ?? null,
			requestedAt: input.requestedAt,
			completedAt: input.completedAt,
		},
	});
}

/** Returns only the newest immutable state snapshot within one Organization. */
export async function getXiaofeiTestSession(organizationId: string, testSessionId: string) {
	const turn = await db.xiaofeiTestTurn.findFirst({
		where: {
			organizationId,
			testSessionId,
			conversationState: { not: Prisma.DbNull },
		},
		orderBy: [{ createdAt: "desc" }, { id: "desc" }],
		select: { id: true, capabilityVersionId: true, conversationState: true },
	});
	if (!turn) return null;
	return {
		id: turn.id,
		capabilityVersionId: turn.capabilityVersionId,
		conversationState: ConversationStateSchema.parse(turn.conversationState),
	};
}

/** Lists at most 50 Organization-local sessions; a session from another tenant cannot be a cursor. */
export async function listXiaofeiTestSessions(
	organizationId: string,
	options: ListXiaofeiTestSessionsOptions = {},
) {
	const limit = assertXiaofeiTestSessionPageLimit(options.limit);
	const binding = await db.xiaofeiCapabilityBinding.findUnique({
		where: { organizationId_capabilityKey: { organizationId, capabilityKey: "xiaofei-hosting" } },
		select: { activeCapabilityVersionId: true, testCapabilityVersionId: true },
	});
	// Prisma Client `distinct` is in-memory. Keep pagination in PostgreSQL:
	// choose one latest turn/session before global ordering, cursoring, and limiting.
	const latestTurns = await db.$queryRaw<
		Array<{
			id: string;
			testSessionId: string;
			capabilityVersionId: string;
			completedAt: Date;
			firstQuestion: string;
		}>
	>`
		WITH "latest" AS (
			(SELECT DISTINCT ON (t."testSessionId")
				t.id, t."testSessionId", t."capabilityVersionId", t."completedAt", t."createdAt"
			FROM "xiaofei_test_turn" t
			WHERE t."organizationId" = ${organizationId}
			ORDER BY t."testSessionId", t."createdAt" DESC, t.id DESC)
			UNION ALL
			SELECT s.id, s.id AS "testSessionId", s."capabilityVersionId", s."createdAt" AS "completedAt", s."createdAt"
			FROM "xiaofei_test_session" s
			WHERE s."organizationId" = ${organizationId}
				AND NOT EXISTS (SELECT 1 FROM "xiaofei_test_turn" t WHERE t."organizationId" = s."organizationId" AND t."testSessionId" = s.id)
		), "selected" AS (
			SELECT * FROM "latest"
			WHERE ${options.cursor ?? null}::text IS NULL OR ("createdAt", id) < (
				SELECT "createdAt", id FROM "latest" WHERE id = ${options.cursor ?? null}
			)
			ORDER BY "createdAt" DESC, id DESC
			LIMIT ${limit + 1}
		), "first" AS (
			SELECT DISTINCT ON (t."testSessionId") t."testSessionId", t.question
			FROM "xiaofei_test_turn" t
			INNER JOIN "selected" s ON s."testSessionId" = t."testSessionId"
			WHERE t."organizationId" = ${organizationId}
			ORDER BY t."testSessionId", t."createdAt" ASC, t.id ASC
		)
		SELECT s.id, s."testSessionId", s."capabilityVersionId", s."completedAt",
			COALESCE(f.question, '') AS "firstQuestion"
		FROM "selected" s
		LEFT JOIN "first" f ON f."testSessionId" = s."testSessionId"
		ORDER BY s."createdAt" DESC, s.id DESC
	`;
	const result = page(latestTurns, limit);
	const sessionIds = result.items.map((turn) => turn.testSessionId);
	if (!sessionIds.length) return { items: [], nextCursor: result.nextCursor };
	const [turnCounts, interventionCounts] = await Promise.all([
		db.xiaofeiTestTurn.groupBy({
			by: ["testSessionId"],
			where: { organizationId, testSessionId: { in: sessionIds } },
			_count: { _all: true },
		}),
		db.$queryRaw<Array<{ testSessionId: string; beforeCount: bigint; afterCount: bigint }>>`
			SELECT t."testSessionId",
				COUNT(i.id) FILTER (WHERE i."beforeResponse" IS NOT NULL) AS "beforeCount",
				COUNT(i.id) FILTER (WHERE i."afterResponse" IS NOT NULL) AS "afterCount"
			FROM "xiaofei_test_turn" t
			LEFT JOIN "xiaofei_response_intervention" i
				ON i."organizationId" = t."organizationId" AND i."sourceTestTurnId" = t.id
			WHERE t."organizationId" = ${organizationId}
				AND t."testSessionId" IN (${Prisma.join(sessionIds)})
			GROUP BY t."testSessionId"
		`,
	]);
	const countBySession = new Map(
		turnCounts.map((count) => [count.testSessionId, count._count._all]),
	);
	const interventionsBySession = new Map(
		interventionCounts.map((count) => [count.testSessionId, count]),
	);
	const items = result.items.map((latest) => {
		const interventions = interventionsBySession.get(latest.testSessionId);
		const isCurrent = latest.capabilityVersionId === binding?.testCapabilityVersionId;
		return {
			id: latest.testSessionId,
			capabilityVersionId: latest.capabilityVersionId,
			firstQuestion: latest.firstQuestion,
			latestAt: latest.completedAt,
			turnCount: countBySession.get(latest.testSessionId) ?? 0,
			beforeInterventionCount: Number(interventions?.beforeCount ?? 0),
			afterInterventionCount: Number(interventions?.afterCount ?? 0),
			isCurrent,
			writable: isCurrent,
		} satisfies XiaofeiTestSessionSummaryDto;
	});
	return { items, nextCursor: result.nextCursor };
}

/** Returns a bounded immutable history and reports whether that session may receive another turn. */
export async function getXiaofeiTestSessionDetail(
	organizationId: string,
	testSessionId: string,
): Promise<XiaofeiTestSessionDetailDto | null> {
	const [binding, session, turns, first, latest, turnCount, interventionCounts] = await Promise.all(
		[
			db.xiaofeiCapabilityBinding.findUnique({
				where: {
					organizationId_capabilityKey: { organizationId, capabilityKey: "xiaofei-hosting" },
				},
				select: { activeCapabilityVersionId: true, testCapabilityVersionId: true },
			}),
			db.xiaofeiTestSession.findUnique({
				where: { organizationId_id: { organizationId, id: testSessionId } },
				select: { capabilityVersionId: true, createdAt: true },
			}),
			db.xiaofeiTestTurn.findMany({
				where: { organizationId, testSessionId },
				orderBy: [{ createdAt: "desc" }, { id: "desc" }],
				take: 100,
				select: {
					id: true,
					question: true,
					answer: true,
					capabilityVersionId: true,
					conversationState: true,
					runtimeMetadata: true,
					evidenceRevisionId: true,
					sourceTestTurnId: true,
					interventionId: true,
					requestedAt: true,
					completedAt: true,
					createdAt: true,
				},
			}),
			db.xiaofeiTestTurn.findFirst({
				where: { organizationId, testSessionId },
				select: { question: true },
				orderBy: [{ createdAt: "asc" }, { id: "asc" }],
			}),
			db.xiaofeiTestTurn.findFirst({
				where: { organizationId, testSessionId },
				select: { capabilityVersionId: true, completedAt: true },
				orderBy: [{ createdAt: "desc" }, { id: "desc" }],
			}),
			db.xiaofeiTestTurn.count({ where: { organizationId, testSessionId } }),
			db.$queryRaw<Array<{ beforeCount: bigint; afterCount: bigint }>>`
			SELECT
				COUNT(i.id) FILTER (WHERE i."beforeResponse" IS NOT NULL) AS "beforeCount",
				COUNT(i.id) FILTER (WHERE i."afterResponse" IS NOT NULL) AS "afterCount"
			FROM "xiaofei_test_turn" t
			LEFT JOIN "xiaofei_response_intervention" i
				ON i."organizationId" = t."organizationId" AND i."sourceTestTurnId" = t.id
			WHERE t."organizationId" = ${organizationId} AND t."testSessionId" = ${testSessionId}
		`,
		],
	);
	if (!session && (!turns.length || !first || !latest)) return null;
	const capabilityVersionId = session?.capabilityVersionId ?? latest!.capabilityVersionId;
	const isCurrent = capabilityVersionId === binding?.testCapabilityVersionId;
	return {
		id: testSessionId,
		capabilityVersionId,
		firstQuestion: first?.question ?? "",
		latestAt: latest?.completedAt ?? session!.createdAt,
		turnCount,
		beforeInterventionCount: Number(interventionCounts[0]?.beforeCount ?? 0),
		afterInterventionCount: Number(interventionCounts[0]?.afterCount ?? 0),
		isCurrent,
		writable: isCurrent,
		turns: [...turns].reverse().map((turn) => ({
			...turn,
			conversationState: turn.conversationState
				? ConversationStateSchema.parse(turn.conversationState)
				: null,
			runtimeMetadata: RuntimeMetadataSchema.parse(turn.runtimeMetadata),
		})),
	};
}

/**
 * Feedback derives before facts exclusively from the persisted source turn.
 * Merchant-grounded answers revise their selected KU. Platform/no-hit answers
 * create a new Organization-owned KU so the global baseline stays read-only.
 */
export function applyXiaofeiTestTurnFeedback(input: ApplyXiaofeiTestTurnFeedbackInput) {
	return db.$transaction(
		async (transaction) => {
			const correction = normalizeXiaofeiTestTurnCorrection(input.correction);
			if (!correction) throw new TypeError("TestTurn correction cannot be empty.");
			await lockXiaofeiVersioningScope(
				transaction,
				`test-turn-feedback:${input.organizationId}:${input.sourceTestTurnId}`,
			);
			const source = await transaction.xiaofeiTestTurn.findUnique({
				where: {
					organizationId_id: { organizationId: input.organizationId, id: input.sourceTestTurnId },
				},
				include: {
					evidenceRevision: true,
					capabilityVersion: { include: { knowledgeUnits: true } },
				},
			});
			if (!source)
				throw new XiaofeiVersioningNotFoundError(input.organizationId, input.sourceTestTurnId);
			if (
				source.capabilityVersion.capabilityKey !== "xiaofei-hosting" ||
				(source.evidenceRevisionId !== null &&
					!source.capabilityVersion.knowledgeUnits.some(
						(member) => member.knowledgeUnitRevisionId === source.evidenceRevisionId,
					))
			)
				throw new XiaofeiVersioningNotFoundError(
					input.organizationId,
					source.evidenceRevisionId ?? source.id,
				);
			const existing = await transaction.xiaofeiResponseIntervention.findUnique({
				where: {
					organizationId_sourceTestTurnId: {
						organizationId: input.organizationId,
						sourceTestTurnId: source.id,
					},
				},
				include: { resultKnowledgeRevision: true, resultCapabilityVersion: true },
			});
			if (existing) {
				if (normalizeXiaofeiTestTurnCorrection(existing.correction) !== correction)
					throw new XiaofeiTestTurnFeedbackConflictError(source.id);
				return {
					intervention: existing,
					resultRevision: existing.resultKnowledgeRevision,
					resultVersion: existing.resultCapabilityVersion,
					sourceTestTurn: source,
				};
			}
			const applied =
				source.evidenceRevision?.origin === "merchant" && source.evidenceRevisionId
					? await applyXiaofeiResponseInterventionInTransaction(transaction, {
							organizationId: input.organizationId,
							capabilityKey: "xiaofei-hosting",
							beforeCapabilityVersionId: source.capabilityVersionId,
							beforeKnowledgeRevisionId: source.evidenceRevisionId,
							correction,
							correctedContent: KnowledgeUnitSchema.parse({
								...KnowledgeUnitSchema.parse(source.evidenceRevision.content),
								standardReplyPolicy: correction,
							}),
							beforeResponse: testTurnBeforeResponse(source),
						})
					: await createXiaofeiTestTurnSupplementInTransaction(transaction, {
							organizationId: input.organizationId,
							correction,
							source,
						});
			await transaction.xiaofeiResponseIntervention.update({
				where: {
					organizationId_id: { organizationId: input.organizationId, id: applied.intervention.id },
				},
				data: { sourceTestTurnId: source.id },
			});
			await transaction.xiaofeiTestTurn.update({
				where: { organizationId_id: { organizationId: input.organizationId, id: source.id } },
				data: { interventionId: applied.intervention.id },
			});
			return { ...applied, sourceTestTurn: source };
		},
		{
			// A cold Neon Preview can exceed Prisma's five-second default while this
			// atomic write acquires advisory locks and creates its immutable records.
			// Keep the bound local to feedback so other transactions retain defaults.
			maxWait: 5_000,
			timeout: 15_000,
		},
	);
}

async function createXiaofeiTestTurnSupplementInTransaction(
	transaction: Prisma.TransactionClient,
	input: {
		organizationId: string;
		correction: string;
		source: {
			id: string;
			question: string;
			answer: string;
			capabilityVersionId: string;
			runtimeMetadata: Prisma.JsonValue;
			capabilityVersion: {
				knowledgeUnits: Array<{ knowledgeUnitRevisionId: string; role: string; priority: number }>;
			};
		};
	},
) {
	const logicalKnowledgeUnitId = `merchant:test-turn:${input.source.id}`;
	const resultRevision = await createXiaofeiKnowledgeUnitRevisionInTransaction(transaction, {
		organizationId: input.organizationId,
		logicalKnowledgeUnitId,
		origin: "merchant",
		content: testTurnSupplementKnowledge(input.source, input.correction),
	});
	const nextPriority =
		Math.max(-1, ...input.source.capabilityVersion.knowledgeUnits.map((unit) => unit.priority)) + 1;
	const resultVersion = await createXiaofeiCapabilityVersionInTransaction(transaction, {
		organizationId: input.organizationId,
		capabilityKey: "xiaofei-hosting",
		knowledgeUnits: [
			...input.source.capabilityVersion.knowledgeUnits.map((unit) => ({
				knowledgeUnitRevisionId: unit.knowledgeUnitRevisionId,
				role: unit.role,
				priority: unit.priority,
			})),
			{
				knowledgeUnitRevisionId: resultRevision.id,
				role: "primary",
				priority: nextPriority,
			},
		],
	});
	const intervention = await transaction.xiaofeiResponseIntervention.create({
		data: {
			organizationId: input.organizationId,
			correction: input.correction,
			beforeResponse: testTurnBeforeResponse(input.source),
			beforeCapabilityVersionId: input.source.capabilityVersionId,
			resultCapabilityVersionId: resultVersion.id,
			beforeKnowledgeRevisionScopeKey: null,
			beforeKnowledgeRevisionId: null,
			resultKnowledgeRevisionScopeKey: resultRevision.scopeKey,
			resultKnowledgeRevisionId: resultRevision.id,
		},
	});
	await transaction.xiaofeiCapabilityBinding.upsert({
		where: {
			organizationId_capabilityKey: {
				organizationId: input.organizationId,
				capabilityKey: "xiaofei-hosting",
			},
		},
		create: {
			organizationId: input.organizationId,
			capabilityKey: "xiaofei-hosting",
			testCapabilityVersionId: resultVersion.id,
		},
		update: { testCapabilityVersionId: resultVersion.id },
	});
	return { intervention, resultRevision, resultVersion };
}

function testTurnSupplementKnowledge(
	source: { id: string; question: string },
	standardReplyPolicy: string,
) {
	return KnowledgeUnitSchema.parse({
		id: `test-turn:${source.id}`,
		title: source.question.trim().slice(0, 500),
		status: "released",
		scenarioKeywords: [source.question.trim()],
		applicableScenarios: [source.question.trim()],
		inapplicableScenarios: ["问题语义不一致或需要个案核实的情况。"],
		requiredSlots: [],
		forbiddenOutputs: ["不得扩展修正口径之外的业务事实或处理承诺。"],
		handoffRules: ["修正口径不足以回答或需要个案处理时转人工。"],
		standardReplyPolicy,
		fallbackReply: "该问题超出已审核口径时，请转人工客服核实。",
		sourceSection: `测试会话反馈：${source.question.trim().slice(0, 500)}`,
		quality: { status: "passed", blockers: [], warnings: [] },
		eligibility: "eligible",
	});
}

function testTurnBeforeResponse(source: {
	question: string;
	answer: string;
	runtimeMetadata: Prisma.JsonValue;
}): Prisma.InputJsonValue {
	return {
		question: source.question,
		answer: source.answer,
		runtimeMetadata: source.runtimeMetadata,
	};
}

/** Persists a real rerun before filling the intervention's previously-null after response. */
export async function createXiaofeiTestTurnRerun(
	organizationId: string,
	input: CreateXiaofeiTestTurnRerunInput,
) {
	return db.$transaction(async (transaction) => {
		const intervention = await transaction.xiaofeiResponseIntervention.findUnique({
			where: { organizationId_id: { organizationId, id: input.interventionId } },
			include: { sourceTestTurn: true },
		});
		if (
			!intervention?.sourceTestTurn ||
			intervention.resultCapabilityVersionId !== input.capabilityVersionId
		)
			throw new XiaofeiVersioningNotFoundError(organizationId, input.interventionId);
		const existing = await transaction.xiaofeiTestTurn.findUnique({
			where: {
				organizationId_rerunOfTestTurnId_interventionId: {
					organizationId,
					rerunOfTestTurnId: intervention.sourceTestTurn.id,
					interventionId: intervention.id,
				},
			},
		});
		const turn =
			existing ??
			(await createXiaofeiTestTurnInTransaction(
				transaction,
				organizationId,
				{
					...input,
					question: intervention.sourceTestTurn.question,
				},
				{
					sourceTestTurnId: intervention.sourceTestTurn.id,
					rerunOfTestTurnId: intervention.sourceTestTurn.id,
					interventionId: intervention.id,
				},
			));
		const afterResponse = JSON.parse(
			JSON.stringify({ answer: turn.answer, runtimeMetadata: turn.runtimeMetadata }),
		) as Prisma.InputJsonValue;
		const updated = await transaction.xiaofeiResponseIntervention.updateMany({
			where: {
				organizationId,
				id: intervention.id,
				resultCapabilityVersionId: input.capabilityVersionId,
				afterResponse: { equals: Prisma.DbNull },
			},
			data: { afterResponse },
		});
		if (updated.count === 0 && intervention.afterResponse === null)
			throw new XiaofeiVersioningNotFoundError(organizationId, intervention.id);
		return turn;
	});
}

async function createXiaofeiKnowledgeUnitRevisionInTransaction(
	transaction: Prisma.TransactionClient,
	input: CreateXiaofeiKnowledgeUnitRevisionInput,
) {
	const scopeKey = xiaofeiKnowledgeRevisionScopeKey(input.organizationId);
	await lockXiaofeiVersioningScope(transaction, `${scopeKey}:${input.logicalKnowledgeUnitId}`);
	const contentHash = stableXiaofeiVersioningHash(input.content);
	const existing = await transaction.xiaofeiKnowledgeUnitRevision.findFirst({
		where: {
			scopeKey,
			logicalKnowledgeUnitId: input.logicalKnowledgeUnitId,
			contentHash,
		},
	});
	if (existing) return existing;
	const latest = await transaction.xiaofeiKnowledgeUnitRevision.findFirst({
		where: {
			scopeKey,
			logicalKnowledgeUnitId: input.logicalKnowledgeUnitId,
		},
		orderBy: { revision: "desc" },
		select: { revision: true },
	});
	return transaction.xiaofeiKnowledgeUnitRevision.create({
		data: {
			organizationId: input.organizationId,
			scopeKey,
			logicalKnowledgeUnitId: input.logicalKnowledgeUnitId,
			knowledgeUnitId: input.knowledgeUnitId ?? null,
			origin: input.origin,
			revision: (latest?.revision ?? 0) + 1,
			content: input.content,
			contentHash,
		},
	});
}

async function createXiaofeiCapabilityVersionInTransaction(
	transaction: Prisma.TransactionClient,
	input: CreateXiaofeiCapabilityVersionInput,
) {
	await lockXiaofeiVersioningScope(
		transaction,
		`capability:${input.organizationId}:${input.capabilityKey}`,
	);
	const revisionIds = input.knowledgeUnits.map((unit) => unit.knowledgeUnitRevisionId);
	const revisions = await transaction.xiaofeiKnowledgeUnitRevision.findMany({
		where: {
			id: { in: revisionIds },
			OR: [
				{ scopeKey: xiaofeiKnowledgeRevisionScopeKey(null) },
				{ scopeKey: xiaofeiKnowledgeRevisionScopeKey(input.organizationId) },
			],
		},
		select: { id: true, scopeKey: true, origin: true, logicalKnowledgeUnitId: true },
	});
	const revisionsById = new Map(revisions.map((revision) => [revision.id, revision]));
	if (revisionsById.size !== new Set(revisionIds).size)
		throw new XiaofeiVersioningCrossOrganizationError(input.organizationId, revisionIds.join(","));
	const selectedRevisions = input.knowledgeUnits.map(
		(unit) => revisionsById.get(unit.knowledgeUnitRevisionId)!,
	);
	const duplicate = firstDuplicateLogicalKnowledgeUnit(selectedRevisions);
	if (duplicate) throw new XiaofeiDuplicateLogicalKnowledgeUnitError(duplicate);
	if (
		(input.capabilityKey === "platform-fallback" &&
			selectedRevisions.some((revision) => revision.origin !== "platform")) ||
		(input.capabilityKey === "merchant-knowledge" &&
			selectedRevisions.some((revision) => revision.origin !== "merchant"))
	)
		throw new XiaofeiCapabilityPartitionError(input.capabilityKey);
	const knowledgeUnits = input.knowledgeUnits
		.map((unit) => ({
			knowledgeUnitRevisionId: unit.knowledgeUnitRevisionId,
			knowledgeUnitRevisionScopeKey: revisionsById.get(unit.knowledgeUnitRevisionId)!.scopeKey,
			role: unit.role ?? "primary",
			priority: unit.priority ?? 0,
		}))
		.sort((left, right) =>
			left.knowledgeUnitRevisionId.localeCompare(right.knowledgeUnitRevisionId),
		);
	const manifestHash = stableXiaofeiVersioningHash({
		organizationId: input.organizationId,
		capabilityKey: input.capabilityKey,
		knowledgeUnits,
	});
	const existing = await transaction.xiaofeiCapabilityVersion.findUnique({
		where: {
			organizationId_capabilityKey_manifestHash: {
				organizationId: input.organizationId,
				capabilityKey: input.capabilityKey,
				manifestHash,
			},
		},
	});
	if (existing) return existing;
	const version = await transaction.xiaofeiCapabilityVersion.create({
		data: {
			organizationId: input.organizationId,
			capabilityKey: input.capabilityKey,
			manifestHash,
		},
	});
	await transaction.xiaofeiCapabilityVersionKnowledgeUnit.createMany({
		data: knowledgeUnits.map((unit) => ({
			organizationId: input.organizationId,
			capabilityVersionId: version.id,
			...unit,
		})),
	});
	return version;
}

function xiaofeiKnowledgeRevisionScopeKey(organizationId: string | null): string {
	return organizationId === null ? "platform" : `organization:${organizationId}`;
}

function firstDuplicateLogicalKnowledgeUnit(
	knowledgeUnits: Array<{ logicalKnowledgeUnitId: string }>,
): string | null {
	const logicalKnowledgeUnitIds = new Set<string>();
	for (const unit of knowledgeUnits) {
		if (logicalKnowledgeUnitIds.has(unit.logicalKnowledgeUnitId))
			return unit.logicalKnowledgeUnitId;
		logicalKnowledgeUnitIds.add(unit.logicalKnowledgeUnitId);
	}
	return null;
}

async function lockXiaofeiVersioningScope(transaction: Prisma.TransactionClient, scope: string) {
	await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${scope}, 0))`;
}

function stableXiaofeiVersioningHash(value: unknown): string {
	return createHash("sha256").update(stableXiaofeiVersioningJson(value)).digest("hex");
}

function stableXiaofeiVersioningJson(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map(stableXiaofeiVersioningJson).join(",")}]`;
	if (value && typeof value === "object") {
		const record = value as Record<string, unknown>;
		return `{${Object.keys(record)
			.sort()
			.map((key) => `${JSON.stringify(key)}:${stableXiaofeiVersioningJson(record[key])}`)
			.join(",")}}`;
	}
	return JSON.stringify(value);
}

function normalizeXiaofeiTestTurnCorrection(correction: string): string {
	return correction.trim().replace(/\r\n/g, "\n");
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
function assertXiaofeiTestSessionPageLimit(value: number | undefined) {
	const limit = value ?? DEFAULT_XIAOFEI_TEST_SESSION_PAGE_SIZE;
	if (!Number.isInteger(limit) || limit < 1 || limit > MAX_XIAOFEI_TEST_SESSION_PAGE_SIZE)
		throw new RangeError(
			`Test session page limit must be between 1 and ${MAX_XIAOFEI_TEST_SESSION_PAGE_SIZE}.`,
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

function toEmailSupportMessages(
	existing: unknown,
	input: EmailMessageIngestV1,
): Prisma.InputJsonValue {
	const current = z.array(SupportMessageSchema).catch([]).parse(existing);
	const role: SupportMessage["role"] =
		input.message.senderType === "customer"
			? "customer"
			: input.message.senderType === "xiaofei"
				? "ai"
				: "human";
	const next = SupportMessageSchema.parse({
		id: `email-source:${input.message.sourceMessageId}`,
		role,
		authorName:
			input.message.from.name?.trim() || normalizeEmailAddress(input.message.from.address),
		text: readableEmailContent(input.message.content.type, input.message.content.value),
		createdAt: input.occurredAt,
	});
	const byId = new Map(current.map((message) => [message.id, message]));
	if (!byId.has(next.id)) byId.set(next.id, next);
	const messages = [...byId.values()]
		.sort((left, right) =>
			left.createdAt === right.createdAt
				? left.id.localeCompare(right.id)
				: left.createdAt.localeCompare(right.createdAt),
		)
		.slice(-160);
	return JSON.parse(JSON.stringify(messages)) as Prisma.InputJsonValue;
}

function readableEmailContent(
	type: EmailMessageIngestV1["message"]["content"]["type"],
	value: string,
) {
	if (type === "text/plain") return value.trim() || "（空白邮件）";
	return (
		value
			.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/giu, " ")
			.replace(/<br\s*\/?>/giu, "\n")
			.replace(/<\/p\s*>/giu, "\n")
			.replace(/<[^>]+>/gu, " ")
			.replace(/&nbsp;/giu, " ")
			.replace(/&amp;/giu, "&")
			.replace(/&lt;/giu, "<")
			.replace(/&gt;/giu, ">")
			.replace(/&quot;/giu, '"')
			.replace(/&#39;/giu, "'")
			.replace(/[ \t]+/gu, " ")
			.replace(/\n\s*\n\s*\n+/gu, "\n\n")
			.trim() || "（空白 HTML 邮件）"
	);
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
