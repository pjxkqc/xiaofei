import { expect, test, type Page } from "@playwright/test";

import { registerOrganizationAdmin } from "./xiaofei-test-utils";

test.describe("knowledge document management", () => {
	test("uploads, edits, reloads, and deletes a Markdown document", async ({ page }) => {
		await registerOrganizationAdmin(page, "knowledge");

		await page.goto("/knowledge?stage=advanced");
		await openDocumentGovernance(page);
		await expect(page.getByLabel("Organization required")).toHaveCount(0);
		await expect(page.getByText("上传源文档", { exact: true })).toBeVisible();
		await expect(
			page.getByText(/PDF、DOCX、XLSX 通过服务端 Firecrawl 解析（最多 4 MB）/u),
		).toBeVisible();

		const fileInput = page.getByLabel("文档文件");
		await expect(fileInput).toBeVisible();
		await expect(fileInput).toHaveAttribute("accept", /\.pdf/u);
		await expect(fileInput).toHaveAttribute("accept", /\.xlsx/u);

		await fileInput.setInputFiles({
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
		await openDocumentGovernance(page);
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

async function openDocumentGovernance(page: Page) {
	await page.getByText("高级治理与诊断", { exact: true }).click();
	await page.getByText("完整资料与条目", { exact: true }).click();
}
