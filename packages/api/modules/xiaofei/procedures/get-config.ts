import { supportProcedure } from "../../../orpc/procedures";
import { getOrCreatePublicXiaofeiWorkspace } from "../service";

export const getXiaofeiConfig = supportProcedure
	.route({
		method: "GET",
		path: "/xiaofei/config",
		tags: ["Xiaofei"],
		summary: "Get Xiaofei Agent configuration",
	})
	.handler(async () => {
		const { snapshot } = await getOrCreatePublicXiaofeiWorkspace();
		return snapshot;
	});
