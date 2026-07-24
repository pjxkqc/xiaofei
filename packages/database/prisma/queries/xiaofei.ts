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
	return db.xiaofeiKnowledgeDocument.create({
		data: input,
	});
}

export function listXiaofeiKnowledgeDocuments(workspaceId: string) {
	return db.xiaofeiKnowledgeDocument.findMany({
		where: { workspaceId },
		orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
	});
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

export function deleteXiaofeiKnowledgeDocument(workspaceId: string, id: string) {
	return db.xiaofeiKnowledgeDocument.deleteMany({
		where: { workspaceId, id },
	});
}
