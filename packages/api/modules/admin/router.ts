import { findOrganization } from "./procedures/find-organization";
import { listOrganizations } from "./procedures/list-organizations";
import { listUsers } from "./procedures/list-users";
import {
	getXiaofeiOrganization,
	getXiaofeiOverview,
	listXiaofeiOrganizations,
	updateXiaofeiOrganization,
} from "./procedures/xiaofei";

export const adminRouter = {
	users: {
		list: listUsers,
	},
	organizations: {
		list: listOrganizations,
		find: findOrganization,
	},
	xiaofei: {
		overview: getXiaofeiOverview,
		listOrganizations: listXiaofeiOrganizations,
		getOrganization: getXiaofeiOrganization,
		updateOrganization: updateXiaofeiOrganization,
	},
};
