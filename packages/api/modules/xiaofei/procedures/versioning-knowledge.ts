import { KnowledgeUnitSchema } from "@repo/xiaofei";

interface MerchantKnowledgeUnitRow {
	content: unknown;
	eligibility: string;
	id: string;
	staleReason: string | null;
	status: string;
}

/**
 * A generated KU payload is historical content. Lifecycle fields belong to the
 * current database row and must be frozen from that row when a CA revision is
 * created; otherwise a reviewed/published KU can retain its old draft payload.
 */
export function freezeMerchantKnowledgeUnitRevisionContent(unit: MerchantKnowledgeUnitRow) {
	const parsedContent = KnowledgeUnitSchema.parse(unit.content);
	const {
		eligibility: _contentEligibility,
		id: _contentId,
		staleReason: _contentStaleReason,
		status: _contentStatus,
		...content
	} = parsedContent;

	return KnowledgeUnitSchema.parse({
		...content,
		id: unit.id,
		status: unit.status,
		eligibility: unit.eligibility,
		...(unit.staleReason ? { staleReason: unit.staleReason } : {}),
	});
}
