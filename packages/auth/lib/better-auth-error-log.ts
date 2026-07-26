const allowedErrorCodes = new Set([
	"BAD_REQUEST",
	"FORBIDDEN",
	"INTERNAL_SERVER_ERROR",
	"INVALID_ORIGIN",
	"MISSING_OR_NULL_ORIGIN",
	"NOT_FOUND",
	"PREVIEW_LOGIN_SESSION_FAILED",
	"UNAUTHORIZED",
]);

const allowedStatuses = new Set([400, 401, 403, 404, 409, 429, 500]);

function getStringProperty(value: unknown, key: string) {
	if (!value || typeof value !== "object" || !(key in value)) {
		return undefined;
	}

	const property = (value as Record<string, unknown>)[key];
	return typeof property === "string" ? property : undefined;
}

function getNumberProperty(value: unknown, key: string) {
	if (!value || typeof value !== "object" || !(key in value)) {
		return undefined;
	}

	const property = (value as Record<string, unknown>)[key];
	return typeof property === "number" ? property : undefined;
}

export function getBetterAuthErrorLogFields(error: unknown) {
	const code = getStringProperty(error, "code");
	const status = getNumberProperty(error, "status") ?? getNumberProperty(error, "statusCode");

	return {
		event: "better_auth_api_error",
		code: code && allowedErrorCodes.has(code) ? code : "UNKNOWN",
		status: status && allowedStatuses.has(status) ? status : 500,
	};
}
