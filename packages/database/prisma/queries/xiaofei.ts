import { db } from "../client";
import type {
	Prisma,
	XiaofeiKnowledgeDocumentCategory,
	XiaofeiKnowledgeDocumentFileType,
} from "../generated/client";

export interface CreateXiaofeiKnowledgeDocumentInput {
	workspaceId: string;
	originalFileName: string;
	mimeType: string;
	fileType: XiaofeiKnowledgeDocumentFileType;
	category: XiaofeiKnowledgeDocumentCategory;
	bodyText: string;
	status?: string;
}

export interface UpdateXiaofeiKnowledgeDocumentInput {
	originalFileName?: string;
	category?: XiaofeiKnowledgeDocumentCategory;
	bodyText?: string;
	status?: string;
}

export interface ListXiaofeiKnowledgeDocumentsOptions {
	cursor?: string;
	limit?: number;
}

export interface XiaofeiKnowledgeDocumentListItem {
	id: string;
	workspaceId: string;
	originalFileName: string;
	mimeType: string;
	fileType: XiaofeiKnowledgeDocumentFileType;
	category: XiaofeiKnowledgeDocumentCategory;
	status: string;
	createdAt: Date;
	updatedAt: Date;
}

export interface XiaofeiKnowledgeDocumentPage {
	items: XiaofeiKnowledgeDocumentListItem[];
	nextCursor: string | null;
}

export const DEFAULT_XIAOFEI_KNOWLEDGE_DOCUMENT_PAGE_SIZE = 25;
export const MAX_XIAOFEI_KNOWLEDGE_DOCUMENT_PAGE_SIZE = 50;
export const MAX_XIAOFEI_KNOWLEDGE_DOCUMENTS_PER_WORKSPACE = 100;
export const MAX_XIAOFEI_KNOWLEDGE_DOCUMENT_BODY_BYTES_PER_WORKSPACE = 20 * 1024 * 1024;

export type XiaofeiKnowledgeDocumentQuota = "document_count" | "stored_body_bytes";

export class XiaofeiKnowledgeDocumentQuotaError extends Error {
	readonly quota: XiaofeiKnowledgeDocumentQuota;
	readonly limit: number;

	constructor(quota: XiaofeiKnowledgeDocumentQuota, limit: number) {
		super(
			quota === "document_count"
				? "Knowledge document count limit reached for this workspace."
				: "Knowledge document storage limit reached for this workspace.",
		);
		this.name = "XiaofeiKnowledgeDocumentQuotaError";
		this.quota = quota;
		this.limit = limit;
	}
}

interface XiaofeiKnowledgeDocumentUsage {
	documentCount: bigint;
	storedBodyBytes: bigint;
}

const KNOWLEDGE_DOCUMENT_METADATA_SELECT = {
	id: true,
	workspaceId: true,
	originalFileName: true,
	mimeType: true,
	fileType: true,
	category: true,
	status: true,
	createdAt: true,
	updatedAt: true,
} as const;

export function getXiaofeiWorkspace(tenantKey: string) {
	return db.xiaofeiWorkspace.findUnique({
		where: { tenantKey },
	});
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
		where: {
			workspaceId_externalId: {
				workspaceId,
				externalId,
			},
		},
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
			workspaceId_externalId: {
				workspaceId: input.workspaceId,
				externalId: input.externalId,
			},
		},
		create: input,
		update: {
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
		where: {
			workspaceId_externalId: {
				workspaceId,
				externalId,
			},
		},
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
			workspaceId_externalId: {
				workspaceId: input.workspaceId,
				externalId: input.externalId,
			},
		},
		create: input,
		update: {
			state: input.state,
			traceEvents: input.traceEvents,
		},
	});
}

export function deleteXiaofeiConversation(workspaceId: string, externalId: string) {
	return db.xiaofeiConversation.deleteMany({
		where: { workspaceId, externalId },
	});
}

export function createXiaofeiKnowledgeDocument(input: CreateXiaofeiKnowledgeDocumentInput) {
	return db.$transaction(async (transaction) => {
		await lockXiaofeiKnowledgeDocumentWorkspace(transaction, input.workspaceId);
		const usage = await getXiaofeiKnowledgeDocumentUsage(transaction, input.workspaceId);
		const bodyBytes = Buffer.byteLength(input.bodyText, "utf8");

		assertXiaofeiKnowledgeDocumentQuota(
			Number(usage.documentCount) + 1,
			Number(usage.storedBodyBytes) + bodyBytes,
		);

		return transaction.xiaofeiKnowledgeDocument.create({
			data: input,
		});
	});
}

export async function listXiaofeiKnowledgeDocuments(
	workspaceId: string,
	options: ListXiaofeiKnowledgeDocumentsOptions = {},
): Promise<XiaofeiKnowledgeDocumentPage> {
	const limit = options.limit ?? DEFAULT_XIAOFEI_KNOWLEDGE_DOCUMENT_PAGE_SIZE;
	if (!Number.isInteger(limit) || limit < 1 || limit > MAX_XIAOFEI_KNOWLEDGE_DOCUMENT_PAGE_SIZE) {
		throw new RangeError(
			`Knowledge document page limit must be between 1 and ${MAX_XIAOFEI_KNOWLEDGE_DOCUMENT_PAGE_SIZE}.`,
		);
	}

	const records = await db.xiaofeiKnowledgeDocument.findMany({
		where: { workspaceId },
		select: KNOWLEDGE_DOCUMENT_METADATA_SELECT,
		orderBy: [{ createdAt: "desc" }, { id: "desc" }],
		take: limit + 1,
		...(options.cursor
			? {
					cursor: {
						workspaceId_id: {
							workspaceId,
							id: options.cursor,
						},
					},
					skip: 1,
				}
			: {}),
	});
	const hasNextPage = records.length > limit;
	const items = hasNextPage ? records.slice(0, limit) : records;

	return {
		items,
		nextCursor: hasNextPage ? (items[items.length - 1]?.id ?? null) : null,
	};
}

export function getXiaofeiKnowledgeDocument(workspaceId: string, id: string) {
	return db.xiaofeiKnowledgeDocument.findUnique({
		where: {
			workspaceId_id: {
				workspaceId,
				id,
			},
		},
	});
}

export function updateXiaofeiKnowledgeDocument(
	workspaceId: string,
	id: string,
	data: UpdateXiaofeiKnowledgeDocumentInput,
) {
	if (data.bodyText === undefined) {
		return db.xiaofeiKnowledgeDocument.update({
			where: {
				workspaceId_id: {
					workspaceId,
					id,
				},
			},
			data,
		});
	}
	const bodyText = data.bodyText;

	return db.$transaction(async (transaction) => {
		await lockXiaofeiKnowledgeDocumentWorkspace(transaction, workspaceId);
		const existing = await transaction.xiaofeiKnowledgeDocument.findUnique({
			where: {
				workspaceId_id: {
					workspaceId,
					id,
				},
			},
			select: { bodyText: true },
		});

		if (!existing) {
			return transaction.xiaofeiKnowledgeDocument.update({
				where: {
					workspaceId_id: {
						workspaceId,
						id,
					},
				},
				data,
			});
		}

		const usage = await getXiaofeiKnowledgeDocumentUsage(transaction, workspaceId);
		const storedBodyBytes =
			Number(usage.storedBodyBytes) -
			Buffer.byteLength(existing.bodyText, "utf8") +
			Buffer.byteLength(bodyText, "utf8");
		assertXiaofeiKnowledgeDocumentQuota(Number(usage.documentCount), storedBodyBytes);

		return transaction.xiaofeiKnowledgeDocument.update({
			where: {
				workspaceId_id: {
					workspaceId,
					id,
				},
			},
			data,
		});
	});
}

export function deleteXiaofeiKnowledgeDocument(workspaceId: string, id: string) {
	return db.$transaction(async (transaction) => {
		await lockXiaofeiKnowledgeDocumentWorkspace(transaction, workspaceId);
		return transaction.xiaofeiKnowledgeDocument.deleteMany({
			where: { workspaceId, id },
		});
	});
}

async function lockXiaofeiKnowledgeDocumentWorkspace(
	transaction: Prisma.TransactionClient,
	workspaceId: string,
) {
	await transaction.$executeRaw`
		SELECT pg_advisory_xact_lock(hashtextextended(${workspaceId}, 0))
	`;
}

async function getXiaofeiKnowledgeDocumentUsage(
	transaction: Prisma.TransactionClient,
	workspaceId: string,
): Promise<XiaofeiKnowledgeDocumentUsage> {
	const [usage] = await transaction.$queryRaw<XiaofeiKnowledgeDocumentUsage[]>`
		SELECT
			COUNT(*)::bigint AS "documentCount",
			COALESCE(SUM(octet_length("bodyText")), 0)::bigint AS "storedBodyBytes"
		FROM "xiaofei_knowledge_document"
		WHERE "workspaceId" = ${workspaceId}
	`;

	return {
		documentCount: BigInt(usage?.documentCount ?? 0),
		storedBodyBytes: BigInt(usage?.storedBodyBytes ?? 0),
	};
}

function assertXiaofeiKnowledgeDocumentQuota(documentCount: number, storedBodyBytes: number) {
	if (documentCount > MAX_XIAOFEI_KNOWLEDGE_DOCUMENTS_PER_WORKSPACE) {
		throw new XiaofeiKnowledgeDocumentQuotaError(
			"document_count",
			MAX_XIAOFEI_KNOWLEDGE_DOCUMENTS_PER_WORKSPACE,
		);
	}
	if (storedBodyBytes > MAX_XIAOFEI_KNOWLEDGE_DOCUMENT_BODY_BYTES_PER_WORKSPACE) {
		throw new XiaofeiKnowledgeDocumentQuotaError(
			"stored_body_bytes",
			MAX_XIAOFEI_KNOWLEDGE_DOCUMENT_BODY_BYTES_PER_WORKSPACE,
		);
	}
}
