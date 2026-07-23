import { protectedProcedure } from "../../../orpc/procedures";
import { getOrCreateXiaofeiWorkspace } from "../service";

export const getXiaofeiConfig = protectedProcedure
	.route({
		method: "GET",
		path: "/xiaofei/config",
		tags: ["Xiaofei"],
		summary: "Get Xiaofei Agent configuration",
	})
	.handler(async ({ context }) => {
		const { snapshot } = await getOrCreateXiaofeiWorkspace(context);
		return snapshot;
	});
