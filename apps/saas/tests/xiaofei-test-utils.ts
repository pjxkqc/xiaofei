import { expect, type Page } from "@playwright/test";

export async function registerOrganizationAdmin(page: Page, prefix: string) {
	const unique = `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

	await page.goto("/signup");
	await page.getByRole("textbox", { name: "Name" }).fill("Xiaofei Organization Tester");
	await page.getByRole("textbox", { name: "Email" }).fill(`${unique}@example.test`);
	await page.locator('input[autocomplete="new-password"]').fill("Knowledge-Test-2026!");
	await page.getByRole("button", { name: "Create account" }).click();
	await expect(page).toHaveURL(/\/onboarding(?:\?|$)/u, { timeout: 20_000 });
	await page.getByRole("button", { name: "Continue" }).click();
	await expect(page).toHaveURL("/");

	await page.goto("/new-organization");
	await page.getByRole("textbox", { name: "Organization name" }).fill(`${prefix} organization`);
	await page.getByRole("button", { name: "Create organization" }).click();
	await page.waitForURL(
		(url) => url.pathname !== "/new-organization" && /^\/[^/]+$/u.test(url.pathname),
	);
	await expect(page.getByRole("heading", { name: `${prefix} organization` })).toBeVisible();
}
