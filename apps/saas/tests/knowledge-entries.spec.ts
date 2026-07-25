import { expect, test } from "@playwright/test";

test("submits two manual knowledge pairs and caps the form at twenty", async ({ page }) => {
	const email = `entries-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`;
	await page.goto("/signup");
	await page.getByRole("textbox", { name: "Name" }).fill("Knowledge Entry Tester");
	await page.getByRole("textbox", { name: "Email" }).fill(email);
	await page.locator('input[autocomplete="new-password"]').fill("Knowledge-Test-2026!");
	await page.getByRole("button", { name: "Create account" }).click();
	await expect(page).toHaveURL(/\/onboarding(?:\?|$)/u);
	await page.getByRole("button", { name: "Continue" }).click();
	await expect(page).toHaveURL("/");
	await page.goto("/knowledge/entries");
	await expect(page.getByRole("heading", { name: "知识条目", level: 2 })).toBeVisible();
	await page.getByPlaceholder("问题").fill("First question");
	await page.getByPlaceholder("答案").fill("First answer");
	await page.getByRole("button", { name: /添加问答\s*（1\/20）/u }).click();
	await page.getByPlaceholder("问题").nth(1).fill("Second question");
	await page.getByPlaceholder("答案").nth(1).fill("Second answer");
	await page.getByRole("button", { name: "添加问答" }).last().click();
	await expect(page.getByText("First question")).toBeVisible();
	await expect(page.getByText("Second question")).toBeVisible();
	await page.getByRole("button", { name: "First question" }).click();
	await expect(page.getByLabel("问题")).toHaveValue("First question");
	await expect(page.getByLabel("答案")).toHaveValue("First answer");
	await page.getByRole("button", { name: "Second question" }).click();
	await expect(page.getByLabel("问题")).toHaveValue("Second question");
	await expect(page.getByLabel("答案")).toHaveValue("Second answer");
	for (let index = 0; index < 19; index += 1)
		await page.getByRole("button", { name: /添加问答\s*（\d+\/20）/u }).click();
	await expect(page.getByRole("button", { name: /添加问答\s*（最多 20 组）/u })).toBeDisabled();
});
