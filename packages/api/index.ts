import { auth } from "@repo/auth";
import { logger } from "@repo/logs";
import { webhookHandler as paymentsWebhookHandler } from "@repo/payments";
import { getBaseUrl } from "@repo/utils";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger as honoLogger } from "hono/logger";

import {
	MAX_INBOUND_EVENT_BYTES,
	ingestChannelEnvelope,
	isValidIngestApiKey,
	publicIngestResponse,
	XiaofeiInboundEventConflictError,
} from "./modules/xiaofei/integration-events";
import { openApiHandler, rpcHandler } from "./orpc/handler";

export { router } from "./orpc/router";

export const app = new Hono()
	.basePath("/api")
	// Logger middleware
	.use(honoLogger((message, ...rest) => logger.log(message, ...rest)))
	// Cors middleware
	.use(
		cors({
			origin: getBaseUrl(process.env.NEXT_PUBLIC_SAAS_URL, 3000),
			allowHeaders: ["Content-Type", "Authorization"],
			allowMethods: ["POST", "GET", "OPTIONS"],
			exposeHeaders: ["Content-Length"],
			maxAge: 600,
			credentials: true,
		}),
	)
	// Auth handler
	.on(["POST", "GET"], "/auth/**", (c) => auth.handler(c.req.raw))
	// Payments webhook handler
	.post("/webhooks/payments", (c) => paymentsWebhookHandler(c.req.raw))
	// Health check
	.get("/health", (c) => c.text("OK"))
	.post("/xiaofei/integrations/events", async (c) => {
		if (!isValidIngestApiKey(c.req.header("Authorization")))
			return c.json({ error: "unauthorized" }, 401);
		const contentLength = Number(c.req.header("Content-Length"));
		if (Number.isFinite(contentLength) && contentLength > MAX_INBOUND_EVENT_BYTES)
			return c.json({ error: "payload_too_large" }, 413);
		const body = await c.req.raw.arrayBuffer();
		if (body.byteLength > MAX_INBOUND_EVENT_BYTES)
			return c.json({ error: "payload_too_large" }, 413);
		let input: unknown;
		try {
			input = JSON.parse(new TextDecoder().decode(body));
		} catch {
			return c.json({ error: "invalid_request" }, 400);
		}
		try {
			const result = await ingestChannelEnvelope(input);
			return c.json(publicIngestResponse(result), result.kind === "created" ? 202 : 200);
		} catch (error) {
			if (error instanceof XiaofeiInboundEventConflictError)
				return c.json({ error: "event_conflict" }, 409);
			if (error instanceof Error && error.name === "ZodError")
				return c.json({ error: "invalid_request" }, 400);
			throw error;
		}
	})
	// oRPC handlers (for RPC and OpenAPI)
	.use("*", async (c, next) => {
		const context = {
			headers: c.req.raw.headers,
		};

		const isRpc = c.req.path.includes("/rpc/");

		const handler = isRpc ? rpcHandler : openApiHandler;

		const prefix = isRpc ? "/api/rpc" : "/api";

		const { matched, response } = await handler.handle(c.req.raw, {
			prefix,
			context,
		});

		if (matched) {
			return c.newResponse(response.body, response);
		}

		await next();
	});
