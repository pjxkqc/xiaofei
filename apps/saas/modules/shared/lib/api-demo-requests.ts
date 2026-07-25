export const EXTERNAL_STATUS_URL = "/api/xiaofei/status";
export const TYPED_RPC_STATUS_URL = "/api/rpc/xiaofei/status";

const SAFE_ERROR_BODY = {
	error: "The status request failed. Please try again.",
};

export interface ApiDemoResult {
	method: "GET" | "POST";
	url: string;
	httpStatus: number | null;
	durationMs: number;
	state: "success" | "error";
	body: unknown;
}

type Clock = () => number;
type StatusCaller = () => Promise<unknown>;

function getDuration(startedAt: number, clock: Clock): number {
	return Math.max(0, Math.round(clock() - startedAt));
}

export async function runExternalStatusRequest(
	fetcher: typeof fetch = fetch,
	clock: Clock = () => performance.now(),
): Promise<ApiDemoResult> {
	const startedAt = clock();

	try {
		const response = await fetcher(EXTERNAL_STATUS_URL, {
			method: "GET",
			headers: { Accept: "application/json" },
		});

		if (!response.ok) {
			return {
				method: "GET",
				url: EXTERNAL_STATUS_URL,
				httpStatus: response.status,
				durationMs: getDuration(startedAt, clock),
				state: "error",
				body: SAFE_ERROR_BODY,
			};
		}

		return {
			method: "GET",
			url: EXTERNAL_STATUS_URL,
			httpStatus: response.status,
			durationMs: getDuration(startedAt, clock),
			state: "success",
			body: await response.json(),
		};
	} catch {
		return {
			method: "GET",
			url: EXTERNAL_STATUS_URL,
			httpStatus: null,
			durationMs: getDuration(startedAt, clock),
			state: "error",
			body: SAFE_ERROR_BODY,
		};
	}
}

export async function runTypedStatusRequest(
	callStatus: StatusCaller,
	clock: Clock = () => performance.now(),
): Promise<ApiDemoResult> {
	const startedAt = clock();

	try {
		const body = await callStatus();

		return {
			method: "POST",
			url: TYPED_RPC_STATUS_URL,
			httpStatus: null,
			durationMs: getDuration(startedAt, clock),
			state: "success",
			body,
		};
	} catch {
		return {
			method: "POST",
			url: TYPED_RPC_STATUS_URL,
			httpStatus: null,
			durationMs: getDuration(startedAt, clock),
			state: "error",
			body: SAFE_ERROR_BODY,
		};
	}
}
