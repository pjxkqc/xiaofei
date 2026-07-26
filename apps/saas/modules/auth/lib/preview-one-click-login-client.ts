export function requestPreviewOneClickLogin() {
	return fetch("/api/auth/preview-one-click-login", {
		method: "POST",
		credentials: "same-origin",
		headers: {
			"Content-Type": "application/json",
		},
		body: "{}",
	});
}

export async function completePreviewOneClickLogin({
	redirectPath,
	request = requestPreviewOneClickLogin,
	navigate = (path: string) => window.location.assign(path),
}: {
	redirectPath: string;
	request?: () => Promise<Response>;
	navigate?: (path: string) => void;
}) {
	const response = await request();

	if (!response.ok) {
		throw new Error("Preview sign-in failed");
	}

	// A document navigation makes the Better Auth Set-Cookie observable to the
	// authenticated server layout before it renders the destination.
	navigate(toSameOriginPath(redirectPath));
}

function toSameOriginPath(path: string) {
	return path.startsWith("/") && !path.startsWith("//") ? path : "/";
}
