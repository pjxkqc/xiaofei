import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string) {
	return readFileSync(path.resolve(import.meta.dirname, relativePath), "utf8");
}

const guide = read("EmailIntegrationGuide.tsx");
const inbound = read("EmailMirrorMock.tsx");
const delivery = read("EmailDeliveryManager.tsx");
const inbox = read("SupportInbox.tsx");
const guidePage = read("../../../app/(authenticated)/(main)/(account)/integrations/email/page.tsx");
const inboundPage = read(
	"../../../app/(authenticated)/(main)/(account)/integrations/email-inbound/page.tsx",
);
const deliveryPage = read(
	"../../../app/(authenticated)/(main)/(account)/integrations/email-delivery/page.tsx",
);

describe("Email integration UI contract", () => {
	it("publishes the exact two-way endpoints and Worker headers on the guide page", () => {
		expect(guide).toContain("/api/xiaofei/integrations/v1/email/messages");
		expect(guide).toContain("/api/xiaofei/integrations/v1/email/delivery-mock");
		expect(guide).toContain("Idempotency-Key = eventId");
		expect(guide).toContain("fly103-preview-company");
	});

	it("exposes labeled inbound parameters, the equivalent JSON, and an Inbox handoff", () => {
		expect(inbound).toContain("客户邮箱");
		expect(inbound).toContain("eventId（重复投递必须不变）");
		expect(inbound).toContain("同事实际要发送的 JSON");
		expect(inbound).toContain("去 Inbox 查看并处理");
	});

	it("makes Receiver configuration administrative while preserving observable retry", () => {
		expect(delivery).toContain("仅 Owner / Admin 可修改");
		expect(delivery).toContain("disabled={busy || !settings?.canManage}");
		expect(delivery).toContain("retryEmailOutboundDelivery");
		expect(delivery).toContain("回递 payload");
	});

	it("shows the Email processing action in Inbox and guards every setup page by Organization", () => {
		expect(inbox).toContain("让小飞处理并回递");
		expect(inbox).toContain("已接收，待小飞处理");
		expect(inbox).toContain("loaded: activeOrganizationLoaded");
		expect(inbox).toContain("if (!activeOrganizationLoaded) return");
		expect(inbox).toContain("conversationListOrganizationId !== activeOrganization?.id");
		expect(inbox).toContain("正在加载会话…");
		for (const page of [guidePage, inboundPage, deliveryPage])
			expect(page).toContain("OrganizationRequired");
	});

	it("shows action-specific pending feedback for Inbox mutations", () => {
		for (const value of [
			'setBusyAction("owner")',
			'setBusyAction("reply")',
			'setBusyAction("email")',
			"正在接管会话并刷新 Owner 状态…",
			"正在交还小飞并刷新 Owner 状态…",
			"真人回复已提交，正在持久化并刷新会话…",
			"正在让小飞处理并刷新 Email 回递状态…",
			"正在发送客服回复…",
		])
			expect(inbox).toContain(value);
	});
});
