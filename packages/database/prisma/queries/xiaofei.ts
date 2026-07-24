import { db } from "../client";
import type { Prisma } from "../generated/client";

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
