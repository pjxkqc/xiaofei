import { z } from "zod";

import { supportProcedure } from "../../../orpc/procedures";
import { prepareKnowledgeForTenant } from "../knowledge-documents";

export const prepareKnowledgeProcedure = supportProcedure
	.input(z.object({ entryIds: z.array(z.string().cuid()).min(1).max(20) }))
	.handler(async ({ context, input }) => prepareKnowledgeForTenant(context, input.entryIds));
