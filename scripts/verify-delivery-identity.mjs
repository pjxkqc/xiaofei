import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export const APPROVED_GIT_IDENTITIES = [
	{
		email: "205917097+pjxkqc@users.noreply.github.com",
		name: "pjxkqc",
	},
	{
		email: "pjx086921@outlook.com",
		name: "pjxkqc",
	},
];

export function parseGitIdentity(value, role) {
	const match = value.trim().match(/^(.*) <([^<>]+)> \d+ [+-]\d{4}$/);

	if (!match) {
		throw new Error(`Unable to parse the effective Git ${role} identity.`);
	}

	return {
		email: match[2],
		name: match[1],
	};
}

export function assertApprovedGitIdentity(identity, role) {
	const isApproved = APPROVED_GIT_IDENTITIES.some(
		(approvedIdentity) =>
			approvedIdentity.email.toLowerCase() === identity.email.toLowerCase() &&
			approvedIdentity.name === identity.name,
	);

	if (isApproved) {
		return;
	}

	const expected = APPROVED_GIT_IDENTITIES.map(
		(identity) => `${identity.name} <${identity.email}>`,
	).join(" or ");

	throw new Error(
		[
			`Unapproved Git ${role}: ${identity.name} <${identity.email}>.`,
			`Expected ${expected}.`,
			"Fix the effective Git identity before committing; do not add an empty repair commit.",
		].join("\n"),
	);
}

export function verifyEffectiveGitIdentities(runGit = runGitCommand) {
	const author = parseGitIdentity(runGit(["var", "GIT_AUTHOR_IDENT"]), "author");
	const committer = parseGitIdentity(runGit(["var", "GIT_COMMITTER_IDENT"]), "committer");

	assertApprovedGitIdentity(author, "author");
	assertApprovedGitIdentity(committer, "committer");

	return { author, committer };
}

export function verifyHeadGitIdentities(runGit = runGitCommand) {
	const fields = runGit(["show", "--no-patch", "--format=%an%x00%ae%x00%cn%x00%ce", "HEAD"])
		.trim()
		.split("\u0000");

	if (fields.length !== 4) {
		throw new Error("Unable to read the Git identities from HEAD.");
	}

	const [authorName, authorEmail, committerName, committerEmail] = fields;
	const author = { email: authorEmail, name: authorName };
	const committer = { email: committerEmail, name: committerName };

	assertApprovedGitIdentity(author, "HEAD author");
	assertApprovedGitIdentity(committer, "HEAD committer");

	return { author, committer };
}

function runGitCommand(arguments_) {
	return execFileSync("git", arguments_, {
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
	});
}

function formatIdentity(identity) {
	return `${identity.name} <${identity.email}>`;
}

function main() {
	const isHeadCheck = process.argv.slice(2).includes("--head");
	const identities = isHeadCheck ? verifyHeadGitIdentities() : verifyEffectiveGitIdentities();

	console.log(
		`Delivery Git identity is approved: author ${formatIdentity(identities.author)}; committer ${formatIdentity(identities.committer)}.`,
	);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	try {
		main();
	} catch (error) {
		console.error(error instanceof Error ? error.message : error);
		process.exitCode = 1;
	}
}
