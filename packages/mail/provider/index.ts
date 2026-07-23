import type { SendEmailHandler } from "../types";
import { send as sendToConsole } from "./console";
import { send as sendWithPlunk } from "./plunk";

const providers = {
	console: sendToConsole,
	plunk: sendWithPlunk,
} as const satisfies Record<string, SendEmailHandler>;

export const send: SendEmailHandler = async (message) => {
	const providerName = process.env.MAIL_PROVIDER?.trim().toLowerCase() || "plunk";

	if (!(providerName in providers)) {
		throw new Error(`Unsupported MAIL_PROVIDER: ${providerName}`);
	}

	return await providers[providerName as keyof typeof providers](message);
};
