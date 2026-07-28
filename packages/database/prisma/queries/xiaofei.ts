import { createHash } from "node:crypto";

import { db } from "../client";
import {
	XiaofeiKnowledgeDocumentFileType,
	XiaofeiKnowledgeDocumentSourceType,
} from "../generated/client";
import type { Prisma, XiaofeiKnowledgeDocumentCategory } from "../generated/client";

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
export function getXiaofeiConversation(workspaceId: string, externalId: string) {
	return db.xiaofeiConversation.findUnique({
		where: { workspaceId_externalId: { workspaceId, externalId } },
	});
}
export function listXiaofeiConversations(workspaceId: string) {
	return db.xiaofeiConversation.findMany({
		where: { workspaceId },
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
			select: { question: true, answer: true, similarQueries: true, sourceId: true },
		});
		if (!existing)
			return transaction.xiaofeiKnowledgeEntry.update({
				where: { workspaceId_id: { workspaceId, id } },
				data,
			});
		const sourceId = data.sourceId ?? existing.sourceId;
		let sourceSnapshot: { contentHash: string | null; sourceVersion: number } | undefined;
		if (data.sourceId !== undefined) {
			sourceSnapshot =
				(await transaction.xiaofeiKnowledgeDocument.findUnique({
					where: { workspaceId_id: { workspaceId, id: data.sourceId } },
					select: { contentHash: true, sourceVersion: true },
				})) ?? undefined;
			if (!sourceSnapshot) throw new Error("Knowledge source was not found in this workspace.");
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
					: sourceSnapshot
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
