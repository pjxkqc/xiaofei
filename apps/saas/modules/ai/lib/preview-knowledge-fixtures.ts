export interface PreviewKnowledgeFileFixture {
	id: "faq" | "campaign-notes" | "aftersales-manual" | "presales-guide" | "product-service-matrix";
	label: string;
	path: string;
	fileName: string;
	mimeType: string;
}

export const previewKnowledgeFileFixtures: readonly PreviewKnowledgeFileFixture[] = [
	{
		id: "faq",
		label: "青枫常见问题（MD）",
		path: "/knowledge-test/qingfeng-faq.md",
		fileName: "qingfeng-faq.md",
		mimeType: "text/markdown",
	},
	{
		id: "campaign-notes",
		label: "青桔计划说明（TXT）",
		path: "/knowledge-test/qingfeng-campaign-notes.txt",
		fileName: "qingfeng-campaign-notes.txt",
		mimeType: "text/plain",
	},
	{
		id: "aftersales-manual",
		label: "售后手册（PDF）",
		path: "/knowledge-test/qingfeng-aftersales-manual.pdf",
		fileName: "qingfeng-aftersales-manual.pdf",
		mimeType: "application/pdf",
	},
	{
		id: "presales-guide",
		label: "售前指南（DOCX）",
		path: "/knowledge-test/qingfeng-presales-guide.docx",
		fileName: "qingfeng-presales-guide.docx",
		mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	},
	{
		id: "product-service-matrix",
		label: "产品服务矩阵（XLSX）",
		path: "/knowledge-test/qingfeng-product-service-matrix.xlsx",
		fileName: "qingfeng-product-service-matrix.xlsx",
		mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	},
];

export const previewKnowledgeWebFixture = {
	label: "青枫订阅说明网页（HTML）",
	path: "/knowledge-test/qingfeng-subscription.html",
} as const;

interface PreviewEnvironment {
	VERCEL_ENV?: string;
}

export function isPreviewKnowledgeFixtureSelectorVisible(
	environment: PreviewEnvironment = { VERCEL_ENV: process.env["VERCEL_ENV"] },
) {
	return environment.VERCEL_ENV === "preview";
}

export function getPreviewKnowledgeFileFixture(id: string) {
	return previewKnowledgeFileFixtures.find((fixture) => fixture.id === id);
}

export function getPreviewKnowledgeWebFixtureUrl(path: string, origin: string) {
	return path === previewKnowledgeWebFixture.path ? new URL(path, origin).toString() : "";
}

export async function loadPreviewKnowledgeFixtureFile(id: string, request: typeof fetch = fetch) {
	const fixture = getPreviewKnowledgeFileFixture(id);
	if (!fixture) throw new Error("Unknown Preview knowledge fixture.");
	const response = await request(fixture.path);
	if (!response.ok) throw new Error("Preview knowledge fixture is unavailable.");
	return new File([await response.blob()], fixture.fileName, { type: fixture.mimeType });
}
