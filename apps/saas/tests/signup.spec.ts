import { expect, test } from "@playwright/test";

test.describe("signup without email verification", () => {
	test("creates a session and continues to onboarding", async ({ page }) => {
		const uniqueEmail = `preview-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`;

		await page.goto("/signup");
		await page.getByRole("textbox", { name: "Name" }).fill("Preview Tester");
		await page.getByRole("textbox", { name: "Email" }).fill(uniqueEmail);
		await page.locator('input[autocomplete="new-password"]').fill("Preview-Test-2026!");
		await page.getByRole("button", { name: "Create account" }).click();

		await expect(page).toHaveURL(/\/onboarding(?:\?|$)/u);
		await expect(page.getByText("Please check your inbox.")).toHaveCount(0);
	});
});
