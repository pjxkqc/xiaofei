import { expect, test } from "@playwright/test";

test.describe("knowledge document management", () => {
	test("uploads, edits, reloads, and deletes a Markdown document", async ({ page }) => {
		const uniqueEmail = `knowledge-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`;

		await page.goto("/signup");
		await page.getByRole("textbox", { name: "Name" }).fill("Knowledge Tester");
		await page.getByRole("textbox", { name: "Email" }).fill(uniqueEmail);
		await page.locator('input[autocomplete="new-password"]').fill("Knowledge-Test-2026!");
		await page.getByRole("button", { name: "Create account" }).click();

		await expect(page).toHaveURL(/\/onboarding(?:\?|$)/u);
		await page.getByRole("button", { name: "Continue" }).click();
		await expect(page).toHaveURL("/");

		await page.goto("/knowledge/documents");
		await expect(page.getByRole("heading", { name: "知识文档" })).toBeVisible();

		await page.getByLabel("文档文件").setInputFiles({
			name: "acceptance.md",
			mimeType: "text/markdown",
			buffer: Buffer.from("# Xiaofei\n\nInitial acceptance content.", "utf8"),
		});
		await page.getByRole("button", { name: "上传并提取" }).click();

		await expect(page.getByLabel("文件名")).toHaveValue("acceptance.md");
		await expect(page.getByLabel("提取文本")).toHaveValue(
			"# Xiaofei\n\nInitial acceptance content.",
		);

		await page.getByLabel("文件名").fill("acceptance-renamed.md");
		await page.locator("#document-category").selectOption("POSTSALES");
		await page.locator("#document-status").selectOption("active");
		await page.getByLabel("提取文本").fill("# Xiaofei\n\nUpdated acceptance content.");
		await page.getByRole("button", { name: "保存" }).click();

		await page.reload();
		await page.getByRole("button", { name: /acceptance-renamed\.md/u }).click();
		await expect(page.locator("#document-category")).toHaveValue("POSTSALES");
		await expect(page.locator("#document-status")).toHaveValue("active");
		await expect(page.getByLabel("提取文本")).toHaveValue(
			"# Xiaofei\n\nUpdated acceptance content.",
		);

		page.once("dialog", async (dialog) => await dialog.accept());
		await page.getByRole("button", { name: "删除" }).click();
		await expect(page.getByText("还没有知识文档")).toBeVisible();
	});
});
