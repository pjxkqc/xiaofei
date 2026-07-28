const NEON_API_ORIGIN = "https://console.neon.tech/api/v2";

function requireValue(value, name) {
	const normalizedValue = value?.trim();
	if (!normalizedValue) {
		throw new Error(`${name} is required.`);
	}

	return normalizedValue;
}

export async function cleanupNeonPreview({
	apiKey,
	projectId,
	gitBranch,
	fetchImpl = fetch,
	logger = console,
}) {
	const normalizedGitBranch = requireValue(gitBranch, "GITHUB_HEAD_REF");
	const previewBranchName = `preview/${normalizedGitBranch}`;

	if (normalizedGitBranch === "uat") {
		logger.log(`Preserved durable Neon branch ${previewBranchName}.`);
		return { branchName: previewBranchName, status: "preserved" };
	}

	const normalizedApiKey = requireValue(apiKey, "NEON_API_KEY");
	const normalizedProjectId = requireValue(projectId, "NEON_PROJECT_ID");

	const branchesUrl = new URL(
		`${NEON_API_ORIGIN}/projects/${encodeURIComponent(normalizedProjectId)}/branches`,
	);
	branchesUrl.searchParams.set("search", previewBranchName);
	branchesUrl.searchParams.set("limit", "100");

	const headers = {
		accept: "application/json",
		authorization: `Bearer ${normalizedApiKey}`,
	};
	const listResponse = await fetchImpl(branchesUrl, { headers });

	if (!listResponse.ok) {
		throw new Error(`Neon branch lookup failed with HTTP ${listResponse.status}.`);
	}

	const payload = await listResponse.json();
	const previewBranch = payload.branches?.find((branch) => branch.name === previewBranchName);

	if (!previewBranch) {
		logger.log(`Neon branch ${previewBranchName} is already absent.`);
		return { branchName: previewBranchName, status: "absent" };
	}

	if (!previewBranch.id?.startsWith("br-")) {
		throw new Error(`Neon branch ${previewBranchName} returned an invalid branch id.`);
	}

	const deleteUrl = new URL(
		`${NEON_API_ORIGIN}/projects/${encodeURIComponent(normalizedProjectId)}/branches/${encodeURIComponent(previewBranch.id)}`,
	);
	deleteUrl.searchParams.set("hard_delete", "true");

	const deleteResponse = await fetchImpl(deleteUrl, {
		method: "DELETE",
		headers,
	});

	if (![200, 204, 404].includes(deleteResponse.status)) {
		throw new Error(`Neon branch deletion failed with HTTP ${deleteResponse.status}.`);
	}

	logger.log(`Deleted disposable Neon branch ${previewBranchName}.`);
	return { branchName: previewBranchName, status: "deleted" };
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
	await cleanupNeonPreview({
		apiKey: process.env.NEON_API_KEY,
		projectId: process.env.NEON_PROJECT_ID,
		gitBranch: process.env.GITHUB_HEAD_REF,
	});
}
