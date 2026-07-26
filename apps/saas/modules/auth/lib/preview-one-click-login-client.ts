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
	navigate(sanitizePreviewRedirectPath(redirectPath));
}

const previewNavigationOrigin = "https://preview-navigation.invalid";

export function getLoginRedirectPath({
	invitationId,
	redirectTo,
	fallbackPath,
}: {
	invitationId: string | null;
	redirectTo: string | null;
	fallbackPath: string;
}) {
	return sanitizePreviewRedirectPath(
		invitationId ? `/organization-invitation/${invitationId}` : (redirectTo ?? fallbackPath),
	);
}

export function sanitizePreviewRedirectPath(path: string) {
	if (!path.startsWith("/") || path.startsWith("//") || hasUnsafeNavigationCharacter(path)) {
		return "/";
	}

	try {
		const url = new URL(path, previewNavigationOrigin);

		return url.origin === previewNavigationOrigin ? `${url.pathname}${url.search}${url.hash}` : "/";
	} catch {
		return "/";
	}
}

function hasUnsafeNavigationCharacter(path: string) {
	for (const character of path) {
		const code = character.charCodeAt(0);

		if (character === "\\" || code <= 0x1f || code === 0x7f) {
			return true;
		}
	}

	return false;
}
