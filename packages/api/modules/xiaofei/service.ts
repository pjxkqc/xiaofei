import {
	deleteXiaofeiConversation,
	getXiaofeiConversation,
	getXiaofeiWorkspace,
	type Prisma,
	upsertXiaofeiConversation,
	upsertXiaofeiWorkspace,
} from "@repo/database";
import {
	ConversationStateSchema,
	TraceEventSchema,
	XiaofeiWorkspaceSnapshotSchema,
	createConversationState,
	createDefaultWorkspaceSnapshot,
	deriveCapabilityPlan,
	deriveReleaseGates,
	type ConversationState,
	type TraceEvent,
	type XiaofeiWorkspaceSnapshot,
} from "@repo/xiaofei";
import { z } from "zod";

export interface XiaofeiAuthContext {
	session: {
		activeOrganizationId?: string | null;
	};
	user: {
		id: string;
	};
}

export const PUBLIC_SUPPORT_TENANT_KEY = "channel:public-support";

export async function getXiaofeiTenantKey(_context: XiaofeiAuthContext): Promise<string> {
	return PUBLIC_SUPPORT_TENANT_KEY;
}

export async function getOrCreateXiaofeiWorkspace(context: XiaofeiAuthContext) {
	const tenantKey = await getXiaofeiTenantKey(context);
	return await getOrCreateXiaofeiWorkspaceByTenantKey(tenantKey);
}

export async function getOrCreatePublicXiaofeiWorkspace() {
	return await getOrCreateXiaofeiWorkspaceByTenantKey(PUBLIC_SUPPORT_TENANT_KEY);
}

async function getOrCreateXiaofeiWorkspaceByTenantKey(tenantKey: string) {
	const existing = await getXiaofeiWorkspace(tenantKey);
	if (existing) {
		const parsed = XiaofeiWorkspaceSnapshotSchema.parse(existing.snapshot);
		const capabilityPlan =
			parsed.capabilityPlan.knowledgeUnitIds.length > 0
				? parsed.capabilityPlan
				: deriveCapabilityPlan(parsed.knowledgeUnits, parsed.updatedAt);
		return {
			workspace: existing,
			snapshot: XiaofeiWorkspaceSnapshotSchema.parse({
				...parsed,
				capabilityPlan,
				gates: deriveReleaseGates(
					parsed.knowledgeUnits,
					capabilityPlan,
					parsed.evalSuite.status,
					parsed.tools,
				),
			}),
		};
	}

	const snapshot = createDefaultWorkspaceSnapshot(tenantKey);
	const workspace = await upsertXiaofeiWorkspace(tenantKey, toJson(snapshot));
	return { workspace, snapshot };
}

export async function saveXiaofeiSnapshot(
	context: XiaofeiAuthContext,
	snapshot: XiaofeiWorkspaceSnapshot,
) {
	const tenantKey = await getXiaofeiTenantKey(context);
	const parsed = XiaofeiWorkspaceSnapshotSchema.parse(snapshot);
	await upsertXiaofeiWorkspace(tenantKey, toJson(parsed));
	return parsed;
}

export async function getOrCreateConversation(input: {
	workspaceId: string;
	externalId: string;
	snapshot: XiaofeiWorkspaceSnapshot;
}): Promise<{ state: ConversationState; traces: TraceEvent[] }> {
	const existing = await getXiaofeiConversation(input.workspaceId, input.externalId);
	if (existing) {
		return {
			state: ConversationStateSchema.parse(existing.state),
			traces: z.array(TraceEventSchema).parse(existing.traceEvents),
		};
	}

	return {
		state: createConversationState({
			id: input.externalId,
			tenantId: input.snapshot.agent.tenantId,
			agentId: input.snapshot.agent.id,
			maxFollowUps: input.snapshot.agent.maxFollowUps,
		}),
		traces: [],
	};
}

export async function saveConversation(input: {
	workspaceId: string;
	externalId: string;
	state: ConversationState;
	traces: TraceEvent[];
}) {
	await upsertXiaofeiConversation({
		workspaceId: input.workspaceId,
		externalId: input.externalId,
		state: toJson(ConversationStateSchema.parse(input.state)),
		traceEvents: toJson(z.array(TraceEventSchema).parse(input.traces)),
	});
}

export async function resetConversation(context: XiaofeiAuthContext, externalId: string) {
	const { workspace } = await getOrCreateXiaofeiWorkspace(context);
	await deleteXiaofeiConversation(workspace.id, externalId);
}

function toJson(value: unknown): Prisma.InputJsonValue {
	return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
