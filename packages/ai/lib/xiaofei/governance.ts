import { createStep, createWorkflow } from "@mastra/core/workflows";
import { XiaofeiWorkspaceSnapshotSchema, type XiaofeiWorkspaceSnapshot } from "@repo/xiaofei";
import { z } from "zod";

const GovernanceInputSchema = z.object({
	snapshot: XiaofeiWorkspaceSnapshotSchema,
});

const validateKnowledgeStep = createStep({
	id: "xiaofei.validate-knowledge",
	inputSchema: GovernanceInputSchema,
	outputSchema: GovernanceInputSchema,
	execute: async ({ inputData }) => {
		const hasReleasedKnowledge = inputData.snapshot.knowledgeUnits.some(
			(unit) => unit.status === "released",
		);
		if (!hasReleasedKnowledge) {
			return {
				snapshot: {
					...inputData.snapshot,
					agent: { ...inputData.snapshot.agent, status: "blocked" as const },
				},
			};
		}
		return inputData;
	},
});

const validatePolicyStep = createStep({
	id: "xiaofei.validate-policy",
	inputSchema: GovernanceInputSchema,
	outputSchema: XiaofeiWorkspaceSnapshotSchema,
	execute: async ({ inputData }) => {
		const guardrailsReady =
			inputData.snapshot.guardrails.forbiddenPhrases.length > 0 &&
			inputData.snapshot.guardrails.handoffKeywords.length > 0;
		return XiaofeiWorkspaceSnapshotSchema.parse({
			...inputData.snapshot,
			agent: {
				...inputData.snapshot.agent,
				status: guardrailsReady ? inputData.snapshot.agent.status : "blocked",
			},
		});
	},
});

const governanceWorkflow = createWorkflow({
	id: "xiaofei-p0-governance",
	inputSchema: GovernanceInputSchema,
	outputSchema: XiaofeiWorkspaceSnapshotSchema,
})
	.then(validateKnowledgeStep)
	.then(validatePolicyStep)
	.commit();

export async function runMastraGovernance(
	snapshot: XiaofeiWorkspaceSnapshot,
): Promise<XiaofeiWorkspaceSnapshot> {
	const run = await governanceWorkflow.createRun();
	const result = await run.start({ inputData: { snapshot } });
	if (result.status !== "success") {
		throw new Error(
			result.status === "failed"
				? result.error.message
				: `Mastra governance workflow ended with ${result.status}.`,
		);
	}
	return XiaofeiWorkspaceSnapshotSchema.parse(result.result);
}
