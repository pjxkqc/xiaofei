import { expect, test } from "@playwright/test";

import { registerOrganizationAdmin } from "./xiaofei-test-utils";

const LEGACY_DESTINATIONS = [
	["/knowledge/entries", "/knowledge?stage=prepare"],
	["/knowledge/units", "/knowledge?stage=advanced"],
	["/knowledge/capabilities", "/knowledge?stage=advanced"],
	["/knowledge/documents", "/knowledge?stage=advanced"],
	["/chatbot", "/knowledge?stage=test"],
	["/agent-settings", "/knowledge?stage=advanced"],
	["/agent-settings/general", "/knowledge?stage=advanced"],
	["/agent-settings/fallback", "/knowledge?stage=advanced"],
	["/agent-settings/status", "/knowledge?stage=advanced"],
] as const;

test("legacy knowledge routes reach the workbench without a redirect loop", async ({ page }) => {
	await registerOrganizationAdmin(page, "legacy-routes");
	for (const [legacyPath, destination] of LEGACY_DESTINATIONS) {
		await page.goto(legacyPath);
		await expect(page).toHaveURL(new RegExp(`${destination.replace("?", "\\?")}$`));
		await expect(page.getByRole("heading", { name: "知识与托管", level: 2 })).toBeVisible();
	}
});
