import { expect, test } from "@playwright/test";

import { registerOrganizationAdmin } from "./xiaofei-test-utils";

test("submits two manual knowledge pairs and caps the form at twenty", async ({ page }) => {
	await registerOrganizationAdmin(page, "entries");
	await page.goto("/knowledge?stage=advanced");
	await expect(page.getByLabel("Organization required")).toHaveCount(0);
	await expect(page.getByRole("heading", { name: "知识与托管", level: 2 })).toBeVisible();
	await page.getByText("高级治理与诊断", { exact: true }).click();
	await page.getByText("完整资料与条目", { exact: true }).click();
	await expect(page.getByPlaceholder("问题").first()).toBeVisible();
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
	await expect(page.getByLabel("问题")).toHaveAttribute("required", "");
	await expect(page.getByLabel("答案")).toHaveAttribute("required", "");
	await expect(page.getByLabel("相似问法")).not.toHaveAttribute("required", "");
	await expect(page.getByLabel("标签")).not.toHaveAttribute("required", "");
	await page.getByRole("button", { name: "Second question" }).click();
	await expect(page.getByLabel("问题")).toHaveValue("Second question");
	await expect(page.getByLabel("答案")).toHaveValue("Second answer");
	for (let index = 0; index < 19; index += 1)
		await page.getByRole("button", { name: /添加问答\s*（\d+\/20）/u }).click();
	await expect(page.getByRole("button", { name: /添加问答\s*（最多 20 组）/u })).toBeDisabled();
});
