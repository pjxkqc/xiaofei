import { ORPCError } from "@orpc/server";
import { generateKnowledgeUnitDrafts, type StructuredKnowledgeUnitGenerator } from "@repo/ai";
import {
	createXiaofeiKnowledgeUnit,
	createOrReturnXiaofeiKnowledgeUnit,
	createXiaofeiTestSession,
	createXiaofeiKnowledgeDocument,
	createXiaofeiKnowledgeDocumentWithEntries,
	deleteXiaofeiKnowledgeDocument,
	deleteXiaofeiKnowledgeEntry,
	deleteXiaofeiKnowledgeUnit,
	getXiaofeiKnowledgeDocument,
	getXiaofeiKnowledgeEntry,
	getXiaofeiKnowledgeUnit,
	listXiaofeiKnowledgeDocuments,
	listXiaofeiKnowledgeEntries,
	listXiaofeiKnowledgeUnits,
	type ListXiaofeiKnowledgeDocumentsOptions,
	updateXiaofeiKnowledgeDocument,
	updateXiaofeiKnowledgeEntry,
	updateXiaofeiKnowledgeUnit,
	XiaofeiKnowledgeDocumentCategory,
	XiaofeiKnowledgeDocumentFileType,
	XiaofeiKnowledgeDocumentSourceType,
	XiaofeiKnowledgeEntryEligibilityError,
	XiaofeiKnowledgeEntryQuotaError,
	XiaofeiKnowledgeDocumentQuotaError,
} from "@repo/database";
import {
	KnowledgeUnitDraftCandidateSchema,
	KnowledgeUnitSchema,
	NormalizedKnowledgeEntrySchema,
	type NormalizedKnowledgeEntry,
} from "@repo/xiaofei";
import { strFromU8, unzipSync } from "fflate";

import {
	createKnowledgeContentParser,
	KnowledgeContentParserConfigurationError,
	KnowledgeContentParserError,
	validatePublicHttpUrl,
} from "./knowledge-content-parser";
import type { XiaofeiAuthContext } from "./service";
import {
	getOrCreateXiaofeiWorkspaceByTenantKey,
	getXiaofeiOrganizationId,
	clearKnowledgeWorkspaceAdmission,
	getXiaofeiTenantKey,
	requireXiaofeiOrganizationAdmin,
	synchronizeKnowledgeWorkspaceSnapshot,
} from "./service";
import { initializeXiaofeiTestHostingForTenant } from "./versioning-service";

export const MAX_KNOWLEDGE_FILE_BYTES = 4 * 1024 * 1024;
export const MAX_KNOWLEDGE_BODY_CHARACTERS = 500_000;
export const MAX_GENERATED_ENTRIES_PER_SOURCE = 20;
const MAX_DOCX_XML_BYTES = 4 * 1024 * 1024;
const MIN_GENERATED_ENTRY_CHARACTERS = 80;

const FILE_RULES = {
	".docx": {
		fileType: XiaofeiKnowledgeDocumentFileType.DOCX,
		mimeTypes: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
	},
	".md": {
		fileType: XiaofeiKnowledgeDocumentFileType.MARKDOWN,
		mimeTypes: ["text/markdown", "text/plain"],
	},
	".txt": {
		fileType: XiaofeiKnowledgeDocumentFileType.TEXT,
		mimeTypes: ["text/plain"],
	},
	".pdf": {
		fileType: XiaofeiKnowledgeDocumentFileType.PDF,
		mimeTypes: ["application/pdf"],
	},
	".xlsx": {
		fileType: XiaofeiKnowledgeDocumentFileType.XLSX,
		mimeTypes: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
	},
} as const;

interface CreateKnowledgeDocumentInput {
	originalFileName: string;
	mimeType: string;
	category: "PRESALES" | "POSTSALES";
	contentBase64: string;
}

interface UpdateKnowledgeDocumentInput {
	originalFileName?: string;
	category?: "PRESALES" | "POSTSALES";
	bodyText?: string;
	status?: "draft" | "active" | "archived";
}

interface CreateKnowledgeWebInput {
	url: string;
	category: "PRESALES" | "POSTSALES";
}
interface CreateKnowledgeManualInput {
	category: "PRESALES" | "POSTSALES";
	pairs: Array<{ question: string; answer: string; similarQueries?: string[]; tags?: string[] }>;
}
interface UpdateKnowledgeEntryInput {
	question?: string;
	answer?: string;
	similarQueries?: string[];
	category?: string | null;
	tags?: string[];
	status?: string;
}
interface UpdateKnowledgeUnitInput {
	title?: string;
	standardReplyPolicy?: string;
	fallbackReply?: string;
}

export async function getKnowledgeTenantKey(context: XiaofeiAuthContext): Promise<string> {
	return await getXiaofeiTenantKey(context);
}

export async function createKnowledgeDocument(
	context: XiaofeiAuthContext,
	input: CreateKnowledgeDocumentInput,
) {
	await requireXiaofeiOrganizationAdmin(context);
	const file = validateAndExtractFile(input);
	const { workspace } = await getKnowledgeWorkspace(context);

	try {
		return await createXiaofeiKnowledgeDocument({
			workspaceId: workspace.id,
			originalFileName: input.originalFileName,
			mimeType: input.mimeType,
			fileType: file.fileType,
			category: XiaofeiKnowledgeDocumentCategory[input.category],
			bodyText: file.bodyText,
		});
	} catch (error) {
		throwKnowledgeDocumentWriteError(error);
	}
}

export async function createKnowledgeFile(
	context: XiaofeiAuthContext,
	input: CreateKnowledgeDocumentInput,
) {
	await requireXiaofeiOrganizationAdmin(context);
	const file = validateFile(input);
	const { workspace } = await getKnowledgeWorkspace(context);
	const parsed = file.isLocal
		? { markdown: decodeLocalFile(file), provider: undefined, parserVersion: undefined }
		: await parseFile(file, input);
	try {
		const result = await createXiaofeiKnowledgeDocumentWithEntries({
			document: {
				workspaceId: workspace.id,
				sourceType: XiaofeiKnowledgeDocumentSourceType.FILE,
				originalFileName: input.originalFileName,
				mimeType: input.mimeType,
				fileType: file.fileType,
				fileSizeBytes: file.bytes.byteLength,
				provider: parsed.provider,
				parserVersion: parsed.parserVersion,
				category: XiaofeiKnowledgeDocumentCategory[input.category],
				bodyText: parsed.markdown,
				fetchedAt: parsed.provider ? new Date() : undefined,
			},
			entries: buildEntriesForSource(input.originalFileName, parsed.markdown, input.category),
		});
		return result.document;
	} catch (error) {
		throwKnowledgeWriteError(error);
	}
}

export async function createKnowledgeWeb(
	context: XiaofeiAuthContext,
	input: CreateKnowledgeWebInput,
) {
	await requireXiaofeiOrganizationAdmin(context);
	validatePublicHttpUrl(input.url);
	const { workspace } = await getKnowledgeWorkspace(context);
	let parsed;
	try {
		parsed = await createKnowledgeContentParser().scrapeUrl({ url: input.url });
	} catch (error) {
		throwKnowledgeParseError(error);
	}
	try {
		const result = await createXiaofeiKnowledgeDocumentWithEntries({
			document: {
				workspaceId: workspace.id,
				sourceType: XiaofeiKnowledgeDocumentSourceType.WEB,
				sourceUrl: input.url,
				provider: parsed.provider,
				parserVersion: parsed.parserVersion,
				fetchedAt: new Date(),
				category: XiaofeiKnowledgeDocumentCategory[input.category],
				bodyText: parsed.markdown,
			},
			entries: buildEntriesForSource(input.url, parsed.markdown, input.category),
		});
		return result.document;
	} catch (error) {
		throwKnowledgeWriteError(error);
	}
}

export async function createManualKnowledgeEntries(
	context: XiaofeiAuthContext,
	input: CreateKnowledgeManualInput,
) {
	await requireXiaofeiOrganizationAdmin(context);
	const { workspace } = await getKnowledgeWorkspace(context);
	const bodyText = input.pairs.map((pair) => `Q: ${pair.question}\nA: ${pair.answer}`).join("\n\n");
	try {
		const result = await createXiaofeiKnowledgeDocumentWithEntries({
			document: {
				workspaceId: workspace.id,
				sourceType: XiaofeiKnowledgeDocumentSourceType.MANUAL,
				category: XiaofeiKnowledgeDocumentCategory[input.category],
				bodyText,
			},
			entries: input.pairs.map((pair) => ({
				question: pair.question,
				answer: pair.answer,
				similarQueries: pair.similarQueries ?? [],
				tags: pair.tags ?? [],
				category: input.category,
			})),
		});
		return result.entries;
	} catch (error) {
		throwKnowledgeWriteError(error);
	}
}

export async function listKnowledgeEntries(
	context: XiaofeiAuthContext,
	options: { cursor?: string; limit?: number },
) {
	const { workspace } = await getKnowledgeWorkspace(context);
	return await listXiaofeiKnowledgeEntries(workspace.id, options);
}
export async function getKnowledgeEntry(context: XiaofeiAuthContext, id: string) {
	const { workspace } = await getKnowledgeWorkspace(context);
	const entry = await getXiaofeiKnowledgeEntry(workspace.id, id);
	if (!entry) throw new ORPCError("NOT_FOUND", { message: "Knowledge entry not found." });
	return entry;
}
export async function updateKnowledgeEntryForTenant(
	context: XiaofeiAuthContext,
	id: string,
	input: UpdateKnowledgeEntryInput,
) {
	await requireXiaofeiOrganizationAdmin(context);
	const { workspace } = await getKnowledgeWorkspace(context);
	const existing = await getXiaofeiKnowledgeEntry(workspace.id, id);
	if (!existing) throw new ORPCError("NOT_FOUND", { message: "Knowledge entry not found." });
	if (input.status === "active" && existing.eligible !== true) {
		throw new ORPCError("BAD_REQUEST", {
			message: "Only current knowledge entries can be activated.",
		});
	}
	try {
		await clearKnowledgeAdmission(context);
		await updateXiaofeiKnowledgeEntry(workspace.id, id, input);
		await synchronizeKnowledgeSnapshot(context, workspace.id);
		const entry = await getXiaofeiKnowledgeEntry(workspace.id, id);
		if (!entry) throw new ORPCError("NOT_FOUND", { message: "Knowledge entry not found." });
		return entry;
	} catch (error) {
		if (error instanceof ORPCError) throw error;
		throwKnowledgeWriteError(error);
	}
}
export async function deleteKnowledgeEntryForTenant(context: XiaofeiAuthContext, id: string) {
	await requireXiaofeiOrganizationAdmin(context);
	const { workspace } = await getKnowledgeWorkspace(context);
	await clearKnowledgeAdmission(context);
	if ((await deleteXiaofeiKnowledgeEntry(workspace.id, id)).count === 0)
		throw new ORPCError("NOT_FOUND", { message: "Knowledge entry not found." });
	await synchronizeKnowledgeSnapshot(context, workspace.id);
	return { deleted: true };
}

export async function generateKnowledgeUnitsForTenant(
	context: XiaofeiAuthContext,
	entryIds: string[],
	generateDrafts: typeof generateKnowledgeUnitDrafts = generateKnowledgeUnitDrafts,
	createOrReturnCurrent = false,
) {
	await requireXiaofeiOrganizationAdmin(context);
	const { workspace } = await getKnowledgeWorkspace(context);
	const entries = await Promise.all(
		entryIds.map((id) => getXiaofeiKnowledgeEntry(workspace.id, id)),
	);
	if (
		entries.some(
			(entry) => !entry || !entry.eligible || !entry.sourceId || entry.status !== "active",
		)
	) {
		throw new ORPCError("BAD_REQUEST", { message: "Select current, active knowledge entries." });
	}
	const normalizedEntries = entries.map((entry) =>
		NormalizedKnowledgeEntrySchema.parse({
			id: entry!.id,
			workspaceId: entry!.workspaceId,
			sourceId: entry!.sourceId,
			sourceContentHash: entry!.sourceContentHash,
			sourceVersion: entry!.sourceVersion,
			version: entry!.entryVersion,
			question: entry!.question,
			answer: entry!.answer,
			similarQueries: entry!.similarQueries,
			category: entry!.category,
			tags: entry!.tags,
			status: entry!.status,
		}),
	);
	const generationInput = { workspaceId: workspace.id, entries: normalizedEntries };
	let drafts;
	try {
		drafts = await generateDrafts(generationInput);
	} catch {
		try {
			drafts = await generateDrafts(generationInput, generateConservativeKnowledgeUnitCandidates);
		} catch {
			throw new ORPCError("BAD_REQUEST", {
				message: "Knowledge-unit generation is unavailable. Try again.",
			});
		}
	}
	try {
		const units = [];
		for (const draft of drafts) {
			const input = {
				workspaceId: workspace.id,
				entryId: draft.lineage.entryId,
				title: draft.title,
				content: draft,
				status: "draft",
				eligibility: "ineligible",
			};
			units.push(
				createOrReturnCurrent
					? await createOrReturnXiaofeiKnowledgeUnit(input)
					: await createXiaofeiKnowledgeUnit(input),
			);
		}
		return units;
	} catch (error) {
		if (error instanceof ORPCError) throw error;
		throw new ORPCError("BAD_REQUEST", {
			message: "Knowledge-unit generation is unavailable. Try again.",
		});
	}
}

/**
 * Retry-convergent preparation for the Test CA. Validation happens before any
 * mutation; a current KU for an entry is resumed through the permitted
 * lifecycle rather than regenerated. Each mutation is independently durable,
 * so a failed request can be retried without creating another current KU.
 */
export async function prepareKnowledgeForTenant(
	context: XiaofeiAuthContext,
	entryIds: string[],
	generateDrafts: typeof generateKnowledgeUnitDrafts = generateKnowledgeUnitDrafts,
) {
	await requireXiaofeiOrganizationAdmin(context);
	if (!hasUniqueKnowledgeEntryIds(entryIds))
		throw new ORPCError("BAD_REQUEST", { message: "Knowledge entries must be unique." });
	const { workspace } = await getKnowledgeWorkspace(context);
	const entries = await Promise.all(
		entryIds.map((id) => getXiaofeiKnowledgeEntry(workspace.id, id)),
	);
	if (entries.some((entry) => !entry || !entry.eligible || entry.status !== "active"))
		throw new ORPCError("BAD_REQUEST", { message: "Select current, active knowledge entries." });
	const existing = await listXiaofeiKnowledgeUnits(workspace.id);
	const resumable = existing.filter(
		(unit) =>
			entryIds.includes(unit.entryId) &&
			unit.eligibility !== "stale" &&
			["draft", "review_ready", "released"].includes(unit.status),
	);
	const covered = new Set(resumable.map((unit) => unit.entryId));
	const missingEntryIds = entryIds.filter((id) => !covered.has(id));
	const generatedStarted = Date.now();
	const generatedResults = missingEntryIds.length
		? await generateKnowledgeUnitsForTenant(context, missingEntryIds, generateDrafts, true)
		: [];
	const generated = generatedResults.map((result) =>
		"knowledgeUnit" in result ? result.knowledgeUnit : result,
	);
	const generatedCount = generatedResults.filter(
		(result) => !("created" in result) || result.created,
	).length;
	const reusedCount =
		resumable.length +
		generatedResults.filter((result) => "created" in result && !result.created).length;
	const generatedElapsedMs = Date.now() - generatedStarted;
	const lifecycleStarted = Date.now();
	const candidates = [...resumable, ...generated];
	const published: string[] = [];
	for (const candidate of candidates) {
		const unit = await advancePreparationKnowledgeUnit(context, candidate);
		published.push(unit.id);
	}
	const lifecycleElapsedMs = Date.now() - lifecycleStarted;
	const testCaStarted = Date.now();
	const testCa = await initializeXiaofeiTestHostingForTenant(context);
	const testCaElapsedMs = Date.now() - testCaStarted;
	const sessionStarted = Date.now();
	const testSessionId = globalThis.crypto.randomUUID();
	await createXiaofeiTestSession(await getXiaofeiOrganizationId(context), {
		id: testSessionId,
		capabilityVersionId: testCa.versionId,
	});
	const sessionElapsedMs = Date.now() - sessionStarted;
	return {
		stages: [
			{
				name: "generated",
				status: "completed",
				elapsedMs: generatedElapsedMs,
				count: generatedCount,
			},
			{
				name: "reused",
				status: "completed",
				elapsedMs: 0,
				count: reusedCount,
			},
			{
				name: "published",
				status: "completed",
				elapsedMs: lifecycleElapsedMs,
				count: published.length,
			},
			{
				name: "test_ca",
				status: "completed",
				elapsedMs: testCaElapsedMs,
				count: 1,
			},
			{
				name: "session",
				status: "completed",
				elapsedMs: sessionElapsedMs,
				count: 1,
			},
		],
		knowledgeUnitIds: published,
		testCapabilityVersionId: testCa.versionId,
		testSessionId,
	};
}

const MAX_PREPARATION_LIFECYCLE_ATTEMPTS = 4;

async function advancePreparationKnowledgeUnit(
	context: XiaofeiAuthContext,
	candidate: { id: string; entryId: string },
) {
	const { workspace } = await getKnowledgeWorkspace(context);
	for (let attempt = 0; attempt < MAX_PREPARATION_LIFECYCLE_ATTEMPTS; attempt += 1) {
		const unit = await requireKnowledgeUnit(workspace.id, candidate.id);
		if (unit.entryId !== candidate.entryId)
			throw new ORPCError("BAD_REQUEST", {
				message: "Knowledge unit lineage changed during preparation.",
			});
		if (unit.eligibility === "stale")
			throw new ORPCError("BAD_REQUEST", {
				message: "This knowledge unit is stale and must be regenerated.",
			});
		if (unit.status === "released" && unit.eligibility === "eligible") return unit;
		if (unit.status !== "draft" && unit.status !== "review_ready")
			throw new ORPCError("BAD_REQUEST", {
				message: `Cannot prepare a knowledge unit in ${unit.status}.`,
			});

		const action = unit.status === "draft" ? "review" : "publish";
		const observedStatus = unit.status;
		const observedEligibility = unit.eligibility;
		try {
			await transitionKnowledgeUnitForTenant(context, unit.id, action);
		} catch (error) {
			const refreshed = await requireKnowledgeUnit(workspace.id, candidate.id);
			if (refreshed.status === observedStatus && refreshed.eligibility === observedEligibility)
				throw error;
		}
	}
	throw new ORPCError("BAD_REQUEST", {
		message: "Knowledge unit lifecycle did not converge during preparation.",
	});
}

export function hasUniqueKnowledgeEntryIds(entryIds: string[]) {
	return new Set(entryIds).size === entryIds.length;
}

/**
 * Provider outage fallback: one review-required candidate per exact active
 * normalized entry. It intentionally adds only generic safety boundaries;
 * the domain generator remains responsible for validation and source lineage.
 */
export const generateConservativeKnowledgeUnitCandidates: StructuredKnowledgeUnitGenerator = async (
	entries,
) =>
	entries.map((entry) => ({
		entryId: entry.id,
		title: entry.question.trim().slice(0, 500),
		scenarioKeywords: [entry.question.trim()],
		applicableScenarios: [entry.question.trim()],
		inapplicableScenarios: ["来源未明确或需要个案核实的情况。"],
		requiredSlots: conservativeRequiredSlots(entry),
		forbiddenOutputs: ["不得承诺退款、补偿、时效或已执行的业务动作。"],
		handoffRules: ["来源事实不足、存在争议或需要个案处理时转人工。"],
		standardReplyPolicy: "仅复述已审核来源中的回答，不扩展任何业务事实或处理承诺。",
		fallbackReply: "该来源未明确的情况需要人工客服核实后处理。",
	}));

function conservativeRequiredSlots(_entry: NormalizedKnowledgeEntry) {
	// Normalized entries have no structured slot field. Never infer one from prose.
	return [];
}

export async function listKnowledgeUnitsForTenant(context: XiaofeiAuthContext) {
	const { workspace } = await getKnowledgeWorkspace(context);
	return await listXiaofeiKnowledgeUnits(workspace.id);
}

export async function updateKnowledgeUnitForTenant(
	context: XiaofeiAuthContext,
	id: string,
	input: UpdateKnowledgeUnitInput,
) {
	await requireXiaofeiOrganizationAdmin(context);
	const { workspace } = await getKnowledgeWorkspace(context);
	const unit = await requireKnowledgeUnit(workspace.id, id);
	await clearKnowledgeAdmission(context);
	if (unit.eligibility === "stale")
		throw new ORPCError("BAD_REQUEST", {
			message: "This knowledge unit is stale and must be regenerated.",
		});
	const content = KnowledgeUnitSchema.parse(unit.content);
	const candidate = KnowledgeUnitDraftCandidateSchema.parse({ ...content, ...input });
	const updated = await updateXiaofeiKnowledgeUnit(workspace.id, id, {
		title: candidate.title,
		content: { ...content, ...candidate, id: unit.id, title: candidate.title },
		status: "draft",
		eligibility: "ineligible",
		staleReason: null,
	});
	await synchronizeKnowledgeSnapshot(context, workspace.id);
	return updated;
}

export async function transitionKnowledgeUnitForTenant(
	context: XiaofeiAuthContext,
	id: string,
	action: "review" | "revokeReview" | "publish" | "revokePublish",
) {
	await requireXiaofeiOrganizationAdmin(context);
	const { workspace } = await getKnowledgeWorkspace(context);
	const unit = await requireKnowledgeUnit(workspace.id, id);
	await clearKnowledgeAdmission(context);
	if (unit.eligibility === "stale")
		throw new ORPCError("BAD_REQUEST", {
			message: "This knowledge unit is stale and must be regenerated.",
		});
	const transition = KNOWLEDGE_UNIT_TRANSITIONS[action];
	if (unit.status !== transition.from)
		throw new ORPCError("BAD_REQUEST", {
			message: `Cannot ${action} a knowledge unit in ${unit.status}.`,
		});
	const updated = await updateXiaofeiKnowledgeUnit(workspace.id, id, transition.to);
	await synchronizeKnowledgeSnapshot(context, workspace.id);
	return updated;
}

export async function deleteKnowledgeUnitForTenant(context: XiaofeiAuthContext, id: string) {
	await requireXiaofeiOrganizationAdmin(context);
	const { workspace } = await getKnowledgeWorkspace(context);
	await clearKnowledgeAdmission(context);
	if ((await deleteXiaofeiKnowledgeUnit(workspace.id, id)).count === 0)
		throw new ORPCError("NOT_FOUND", { message: "Knowledge unit not found." });
	await synchronizeKnowledgeSnapshot(context, workspace.id);
	return { deleted: true };
}

async function requireKnowledgeUnit(workspaceId: string, id: string) {
	const unit = await getXiaofeiKnowledgeUnit(workspaceId, id);
	if (!unit) throw new ORPCError("NOT_FOUND", { message: "Knowledge unit not found." });
	return unit;
}

const KNOWLEDGE_UNIT_TRANSITIONS = {
	review: { from: "draft", to: { status: "review_ready", eligibility: "ineligible" } },
	revokeReview: { from: "review_ready", to: { status: "draft", eligibility: "ineligible" } },
	publish: { from: "review_ready", to: { status: "released", eligibility: "eligible" } },
	revokePublish: { from: "released", to: { status: "draft", eligibility: "ineligible" } },
} as const;

export async function listKnowledgeDocuments(
	context: XiaofeiAuthContext,
	options: ListXiaofeiKnowledgeDocumentsOptions,
) {
	const { workspace } = await getKnowledgeWorkspace(context);
	return await listXiaofeiKnowledgeDocuments(workspace.id, options);
}

export async function getKnowledgeDocument(context: XiaofeiAuthContext, id: string) {
	const { workspace } = await getKnowledgeWorkspace(context);
	const document = await getXiaofeiKnowledgeDocument(workspace.id, id);
	if (!document) {
		throw new ORPCError("NOT_FOUND", { message: "Knowledge document not found." });
	}
	return document;
}

export async function updateKnowledgeDocumentForTenant(
	context: XiaofeiAuthContext,
	id: string,
	input: UpdateKnowledgeDocumentInput,
) {
	await requireXiaofeiOrganizationAdmin(context);
	const { workspace } = await getKnowledgeWorkspace(context);
	const existing = await getXiaofeiKnowledgeDocument(workspace.id, id);
	if (!existing) {
		throw new ORPCError("NOT_FOUND", { message: "Knowledge document not found." });
	}

	try {
		await clearKnowledgeAdmission(context);
		const updated = await updateXiaofeiKnowledgeDocument(workspace.id, id, {
			...input,
			category: input.category ? XiaofeiKnowledgeDocumentCategory[input.category] : undefined,
		});
		await synchronizeKnowledgeSnapshot(context, workspace.id);
		return updated;
	} catch (error) {
		throwKnowledgeDocumentWriteError(error);
	}
}

export async function deleteKnowledgeDocumentForTenant(context: XiaofeiAuthContext, id: string) {
	await requireXiaofeiOrganizationAdmin(context);
	const { workspace } = await getKnowledgeWorkspace(context);
	await clearKnowledgeAdmission(context);
	const result = await deleteXiaofeiKnowledgeDocument(workspace.id, id);
	if (result.count === 0) {
		throw new ORPCError("NOT_FOUND", { message: "Knowledge document not found." });
	}
	await synchronizeKnowledgeSnapshot(context, workspace.id);
	return { deleted: true };
}

async function getKnowledgeWorkspace(context: XiaofeiAuthContext) {
	return await getOrCreateXiaofeiWorkspaceByTenantKey(await getKnowledgeTenantKey(context));
}

async function synchronizeKnowledgeSnapshot(context: XiaofeiAuthContext, workspaceId: string) {
	await synchronizeKnowledgeWorkspaceSnapshot({
		tenantKey: await getKnowledgeTenantKey(context),
		units: await listXiaofeiKnowledgeUnits(workspaceId),
	});
}

async function clearKnowledgeAdmission(context: XiaofeiAuthContext) {
	await clearKnowledgeWorkspaceAdmission(await getKnowledgeTenantKey(context));
}

function validateAndExtractFile(input: CreateKnowledgeDocumentInput): {
	fileType: XiaofeiKnowledgeDocumentFileType;
	bodyText: string;
} {
	const file = validateFile(input);
	if (file.fileType === XiaofeiKnowledgeDocumentFileType.DOCX) {
		return { fileType: file.fileType, bodyText: extractDocxParagraphText(file.bytes) };
	}
	return { fileType: file.fileType, bodyText: decodeLocalFile(file) };
}

function validateFile(input: CreateKnowledgeDocumentInput): {
	fileType: XiaofeiKnowledgeDocumentFileType;
	bytes: Uint8Array;
	isLocal: boolean;
} {
	const extension = getFileExtension(input.originalFileName);
	const rule = FILE_RULES[extension as keyof typeof FILE_RULES];
	if (!rule || !rule.mimeTypes.includes(input.mimeType as never)) {
		throw new ORPCError("BAD_REQUEST", {
			message:
				"Upload a .md, .txt, or .docx file with a matching content type; PDF and XLSX are also supported.",
		});
	}

	const bytes = decodeBase64(input.contentBase64);
	if (bytes.byteLength === 0 || bytes.byteLength > MAX_KNOWLEDGE_FILE_BYTES) {
		throw new ORPCError("BAD_REQUEST", {
			message: `Files must be between 1 byte and ${MAX_KNOWLEDGE_FILE_BYTES / 1024 / 1024} MB.`,
		});
	}

	return {
		fileType: rule.fileType,
		bytes,
		isLocal:
			rule.fileType === XiaofeiKnowledgeDocumentFileType.MARKDOWN ||
			rule.fileType === XiaofeiKnowledgeDocumentFileType.TEXT,
	};
}

function decodeLocalFile(file: {
	fileType: XiaofeiKnowledgeDocumentFileType;
	bytes: Uint8Array;
}): string {
	const bodyText = decodeUtf8(file.bytes);
	const normalizedBody = bodyText.replaceAll("\u0000", "").trim();
	if (!normalizedBody) {
		throw new ORPCError("BAD_REQUEST", { message: "The uploaded document contains no text." });
	}
	if (normalizedBody.length > MAX_KNOWLEDGE_BODY_CHARACTERS) {
		throw new ORPCError("BAD_REQUEST", {
			message: "The extracted document text is too large.",
		});
	}

	return normalizedBody;
}

async function parseFile(
	file: { bytes: Uint8Array; fileType: XiaofeiKnowledgeDocumentFileType },
	input: Pick<CreateKnowledgeDocumentInput, "originalFileName" | "mimeType">,
) {
	try {
		return await createKnowledgeContentParser().parseFile({
			bytes: file.bytes,
			fileName: input.originalFileName,
			mimeType: input.mimeType,
		});
	} catch (error) {
		throwKnowledgeParseError(error);
	}
}

function buildEntriesForSource(
	title: string,
	bodyText: string,
	category: "PRESALES" | "POSTSALES",
) {
	return splitKnowledgeSource(title, bodyText).map((entry) => ({
		question: entry.question,
		answer: entry.answer,
		category,
		similarQueries: [],
		tags: ["source", entry.provenance],
	}));
}

interface SplitKnowledgeEntry {
	question: string;
	answer: string;
	provenance: string;
}

/** Deterministically creates bounded, reviewable slices without using a model. */
export function splitKnowledgeSource(title: string, bodyText: string): SplitKnowledgeEntry[] {
	const normalized = bodyText.replace(/\r\n?/g, "\n").trim();
	const candidates = splitMarkdownSections(normalized)
		.flatMap(splitFaqPairs)
		.flatMap(splitTableRows);
	const bounded = boundFragments(mergeTinyFragments(candidates));
	const entries = bounded.map((entry, index) => {
		const provenance = (entry.heading || `section ${index + 1}`).slice(0, 100);
		return {
			question: `${title} — ${provenance}`.slice(0, 10_000),
			answer: entry.body,
			provenance,
		};
	});
	return entries.length ? entries : [{ question: title, answer: normalized, provenance: "source" }];
}

interface SourceFragment {
	heading: string;
	body: string;
	atomic?: boolean;
}

function splitFaqPairs(section: SourceFragment): SourceFragment[] {
	const fragments: SourceFragment[] = [];
	const expression =
		/(?:^|\n)\s*(?:Q(?:uestion)?|问)\s*[:：]\s*(.+?)\s*\n\s*(?:A(?:nswer)?|答)\s*[:：]\s*([\s\S]*?)(?=\n\s*(?:Q(?:uestion)?|问)\s*[:：]|$)/giu;
	let cursor = 0;
	for (const match of section.body.matchAll(expression)) {
		const matchStart = match.index ?? 0;
		const prefix = section.body.slice(cursor, matchStart).trim();
		if (prefix) fragments.push({ heading: section.heading, body: prefix });
		const question = match[1].trim();
		const answer = match[2].trim();
		if (question && answer) {
			fragments.push({
				heading: question,
				body: `Q: ${question}\nA: ${answer}`,
				atomic: true,
			});
		}
		cursor = matchStart + match[0].length;
	}
	if (!fragments.length) return [section];
	const suffix = section.body.slice(cursor).trim();
	if (suffix) fragments.push({ heading: section.heading, body: suffix });
	return fragments;
}

function splitMarkdownSections(bodyText: string): SourceFragment[] {
	const lines = bodyText.split("\n");
	const sections: SourceFragment[] = [];
	let heading = "";
	let content: string[] = [];
	const push = () => {
		const body = content.join("\n").trim();
		if (body) sections.push({ heading, body });
		content = [];
	};
	for (const line of lines) {
		const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
		if (match) {
			push();
			heading = match[2].trim();
			continue;
		}
		content.push(line);
	}
	push();
	if (sections.length) return sections;
	const titleMatch = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(lines[0] ?? "");
	return [{ heading: titleMatch?.[2].trim() ?? "", body: bodyText }];
}

function splitTableRows(section: SourceFragment): SourceFragment[] {
	if (section.atomic) return [section];
	const lines = section.body.split("\n");
	const fragments: SourceFragment[] = [];
	let proseStart = 0;
	let lineIndex = 0;
	let tableIndex = 0;
	while (lineIndex + 1 < lines.length) {
		if (!isMarkdownTableRow(lines[lineIndex]) || !isMarkdownTableDivider(lines[lineIndex + 1])) {
			lineIndex += 1;
			continue;
		}
		let tableEnd = lineIndex + 2;
		while (tableEnd < lines.length && isMarkdownTableRow(lines[tableEnd])) tableEnd += 1;
		if (tableEnd === lineIndex + 2) {
			lineIndex += 2;
			continue;
		}
		pushProseFragment(fragments, section.heading, lines.slice(proseStart, lineIndex));
		tableIndex += 1;
		const tableLabel = `${section.heading || "table"}${tableIndex > 1 ? ` table ${tableIndex}` : ""}`;
		for (let rowIndex = lineIndex + 2; rowIndex < tableEnd; rowIndex += 1) {
			fragments.push({
				heading: `${tableLabel} row ${rowIndex - lineIndex - 1}`,
				body: `${section.heading ? `## ${section.heading}\n\n` : ""}${lines[lineIndex]}\n${lines[lineIndex + 1]}\n${lines[rowIndex]}`,
				atomic: true,
			});
		}
		proseStart = tableEnd;
		lineIndex = tableEnd;
	}
	pushProseFragment(fragments, section.heading, lines.slice(proseStart));
	return fragments.length ? fragments : [section];
}

function pushProseFragment(result: SourceFragment[], heading: string, lines: string[]) {
	const body = lines.join("\n").trim();
	if (body) result.push({ heading, body });
}

function isMarkdownTableRow(line: string) {
	return /^\s*\|.+\|\s*$/.test(line);
}
function isMarkdownTableDivider(line: string) {
	return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function mergeTinyFragments(fragments: SourceFragment[]): SourceFragment[] {
	return fragments.reduce<SourceFragment[]>((result, fragment) => {
		const previous = result[result.length - 1];
		if (
			previous &&
			!previous.atomic &&
			fragment.body.length < MIN_GENERATED_ENTRY_CHARACTERS &&
			!fragment.atomic &&
			!/\brow \d+$/u.test(fragment.heading)
		) {
			previous.body = `${previous.body}\n\n${fragment.heading ? `## ${fragment.heading}\n` : ""}${fragment.body}`;
			return result;
		}
		result.push({ ...fragment });
		return result;
	}, []);
}

function boundFragments(fragments: SourceFragment[]): SourceFragment[] {
	if (fragments.length <= MAX_GENERATED_ENTRIES_PER_SOURCE) return fragments;
	const retained = fragments.slice(0, MAX_GENERATED_ENTRIES_PER_SOURCE - 1);
	const overflow = fragments.slice(MAX_GENERATED_ENTRIES_PER_SOURCE - 1);
	const first = overflow[0];
	retained.push({
		heading: first.heading,
		body: overflow
			.map((fragment, index) =>
				index === 0
					? fragment.body
					: `${fragment.heading ? `## ${fragment.heading}\n\n` : ""}${fragment.body}`,
			)
			.join("\n\n"),
	});
	return retained;
}

function throwKnowledgeParseError(error: unknown): never {
	if (
		error instanceof KnowledgeContentParserConfigurationError ||
		error instanceof KnowledgeContentParserError
	) {
		throw new ORPCError("BAD_REQUEST", { message: error.message });
	}
	throw new ORPCError("INTERNAL_SERVER_ERROR", {
		message: "The knowledge source could not be processed.",
	});
}

function decodeBase64(value: string): Uint8Array {
	if (value.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) {
		throw new ORPCError("BAD_REQUEST", { message: "The uploaded file encoding is invalid." });
	}
	return Buffer.from(value, "base64");
}

function decodeUtf8(bytes: Uint8Array): string {
	try {
		return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
	} catch {
		throw new ORPCError("BAD_REQUEST", {
			message: "Markdown and TXT files must contain valid UTF-8 text.",
		});
	}
}

function extractDocxParagraphText(bytes: Uint8Array): string {
	let oversizedDocumentXml = false;
	let files: Record<string, Uint8Array>;
	try {
		files = unzipSync(bytes, {
			filter: (file) => {
				if (file.name !== "word/document.xml") return false;
				oversizedDocumentXml = file.originalSize > MAX_DOCX_XML_BYTES;
				return !oversizedDocumentXml;
			},
		});
	} catch {
		throw invalidDocxError();
	}

	const documentXml = files["word/document.xml"];
	if (oversizedDocumentXml || !documentXml) {
		throw invalidDocxError();
	}

	const xml = strFromU8(documentXml);
	const withoutTables = xml.replace(/<w:tbl(?:\s[^>]*)?>[\s\S]*?<\/w:tbl>/g, "");
	const paragraphs = withoutTables.match(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g) ?? [];
	const text = paragraphs.map(extractParagraphText).filter(Boolean).join("\n");

	if (!text) throw invalidDocxError();
	return text;
}

function extractParagraphText(paragraph: string): string {
	const tokens =
		paragraph.match(
			/<w:t(?:\s[^>]*)?>[\s\S]*?<\/w:t>|<w:tab(?:\s[^>]*)?\/>|<w:(?:br|cr)(?:\s[^>]*)?\/>/g,
		) ?? [];
	return tokens
		.map((token) => {
			if (token.startsWith("<w:tab")) return "\t";
			if (token.startsWith("<w:br") || token.startsWith("<w:cr")) return "\n";
			return decodeXmlEntities(token.replace(/<[^>]+>/g, ""));
		})
		.join("")
		.trimEnd();
}

function decodeXmlEntities(value: string): string {
	return value.replace(/&(amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);/gi, (entity, code: string) => {
		const named = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" } as const;
		if (code in named) return named[code as keyof typeof named];
		const radix = code.toLowerCase().startsWith("#x") ? 16 : 10;
		const digits = code.slice(radix === 16 ? 2 : 1);
		const point = Number.parseInt(digits, radix);
		if (!isValidXmlCodePoint(point)) throw invalidDocxError();
		return String.fromCodePoint(point);
	});
}

function isValidXmlCodePoint(point: number): boolean {
	return (
		Number.isSafeInteger(point) &&
		(point === 0x9 ||
			point === 0xa ||
			point === 0xd ||
			(point >= 0x20 && point <= 0xd7ff) ||
			(point >= 0xe000 && point <= 0xfffd) ||
			(point >= 0x10000 && point <= 0x10ffff))
	);
}

function getFileExtension(fileName: string): string {
	const dot = fileName.lastIndexOf(".");
	return dot >= 0 ? fileName.slice(dot).toLowerCase() : "";
}

function invalidDocxError(): ORPCError<"BAD_REQUEST", unknown> {
	return new ORPCError("BAD_REQUEST", {
		message: "The DOCX file is malformed or does not contain ordinary paragraph text.",
	});
}

function throwKnowledgeWriteError(error: unknown): never {
	if (error instanceof XiaofeiKnowledgeDocumentQuotaError) {
		const message =
			error.quota === "document_count"
				? `This workspace can store up to ${error.limit} knowledge documents. Delete one before uploading another.`
				: `This workspace has reached its ${formatMegabytes(error.limit)} MB knowledge document storage limit. Delete or shorten a document before trying again.`;
		throw new ORPCError("BAD_REQUEST", { message });
	}
	if (isPrismaNotFoundError(error)) {
		throw new ORPCError("NOT_FOUND", { message: "Knowledge document not found." });
	}
	if (error instanceof XiaofeiKnowledgeEntryQuotaError) {
		const message =
			error.quota === "entry_count"
				? `This workspace can store up to ${error.limit} knowledge entries. Delete one before adding another.`
				: `This workspace has reached its ${formatMegabytes(error.limit)} MB knowledge entry storage limit.`;
		throw new ORPCError("BAD_REQUEST", { message });
	}
	if (error instanceof XiaofeiKnowledgeEntryEligibilityError) {
		throw new ORPCError("BAD_REQUEST", {
			message: "Only current draft knowledge entries can be activated.",
		});
	}
	throw new ORPCError("INTERNAL_SERVER_ERROR", {
		message: "The knowledge document could not be saved.",
	});
}

const throwKnowledgeDocumentWriteError = throwKnowledgeWriteError;

function isPrismaNotFoundError(error: unknown): boolean {
	return (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		(error as { code?: unknown }).code === "P2025"
	);
}

function formatMegabytes(bytes: number): number {
	return bytes / 1024 / 1024;
}
