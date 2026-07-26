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
