/**
 * Returns the base URL for the current app. Pass the env value directly so Next.js
 * can replace it at build time (e.g. process.env.NEXT_PUBLIC_SAAS_URL).
 *
 * @param envValue - The env value to use when defined (e.g. process.env.NEXT_PUBLIC_SAAS_URL)
 * @param defaultPort - Port for localhost fallback when no env is set (default: 3000)
 */
export function getBaseUrl(envValue?: string, defaultPort = 3000): string {
	if (envValue) {
		return envValue;
	}

	const vercelUrl =
		process.env.VERCEL_URL ?? process.env.VERCEL_BRANCH_URL ?? process.env.NEXT_PUBLIC_VERCEL_URL;

	if (vercelUrl) {
		return `https://${vercelUrl.replace(/^https?:\/\//u, "")}`;
	}

	return `http://localhost:${process.env.PORT ?? defaultPort}`;
}

/**
 * Returns the exact hosts that may serve the current application instance.
 *
 * Vercel gives every deployment its own URL, every Git branch an alias, and the
 * project a production URL. Keeping all three avoids a broad `*.vercel.app`
 * allowlist while still supporting every PR Preview automatically.
 */
export function getAllowedAppHosts(envValue?: string, defaultPort = 3000): string[] {
	const hosts = [
		envValue,
		process.env.VERCEL_PROJECT_PRODUCTION_URL,
		process.env.VERCEL_BRANCH_URL,
		process.env.VERCEL_URL,
		process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL,
		process.env.NEXT_PUBLIC_VERCEL_BRANCH_URL,
		process.env.NEXT_PUBLIC_VERCEL_URL,
	]
		.map(getHost)
		.filter((host): host is string => Boolean(host));

	if (process.env.NODE_ENV !== "production") {
		hosts.push(`localhost:${process.env.PORT ?? defaultPort}`);
	}

	return [...new Set(hosts)];
}

function getHost(value?: string): string | undefined {
	if (!value) {
		return undefined;
	}

	try {
		return new URL(value.includes("://") ? value : `https://${value}`).host;
	} catch {
		return undefined;
	}
}
