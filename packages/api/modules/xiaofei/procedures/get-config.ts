import { supportProcedure } from "../../../orpc/procedures";
import { getXiaofeiTestAdmissionSnapshot } from "../versioning-service";

export const getXiaofeiConfig = supportProcedure
	.route({
		method: "GET",
		path: "/xiaofei/config",
		tags: ["Xiaofei"],
		summary: "Get Xiaofei Agent configuration",
	})
	.handler(async ({ context }) => {
		return await getXiaofeiTestAdmissionSnapshot(context);
	});
