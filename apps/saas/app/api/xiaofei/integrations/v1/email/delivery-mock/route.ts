import { EmailDeliveryAcceptanceV1Schema, EmailDeliveryV1Schema } from "@repo/xiaofei";
import { NextResponse } from "next/server";

const MAX_BODY_BYTES = 1024 * 1024;

export async function POST(request: Request) {
	if (!isMockEnabled()) return NextResponse.json({ error: "not_found" }, { status: 404 });
	if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))
		return NextResponse.json({ error: "content_type_must_be_application_json" }, { status: 415 });
	const text = await request.text();
	if (Buffer.byteLength(text, "utf8") > MAX_BODY_BYTES)
		return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
	let input: unknown;
	try {
		input = JSON.parse(text);
	} catch {
		return NextResponse.json({ error: "invalid_json" }, { status: 400 });
	}
	const parsed = EmailDeliveryV1Schema.safeParse(input);
	if (!parsed.success)
		return NextResponse.json({ error: "invalid_xiaofei_email_delivery_v1" }, { status: 422 });
	return NextResponse.json(
		EmailDeliveryAcceptanceV1Schema.parse({
			status: "accepted",
			deliveryId: parsed.data.deliveryId,
			receivedAt: new Date().toISOString(),
		}),
	);
}

function isMockEnabled() {
	return process.env.VERCEL_ENV === "preview" || process.env.NODE_ENV === "development";
}
