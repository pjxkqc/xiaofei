import assert from "node:assert/strict";
import test from "node:test";

import {
	assertApprovedGitIdentity,
	parseGitIdentity,
	verifyEffectiveGitIdentities,
	verifyHeadGitIdentities,
} from "./verify-delivery-identity.mjs";

void test("parses a standard Git identity", () => {
	assert.deepEqual(
		parseGitIdentity(
			"pjxkqc <205917097+pjxkqc@users.noreply.github.com> 1785041640 +0800",
			"author",
		),
		{
			email: "205917097+pjxkqc@users.noreply.github.com",
			name: "pjxkqc",
		},
	);
});

void test("accepts each GitHub-associated project owner identity", () => {
	assert.doesNotThrow(() =>
		assertApprovedGitIdentity(
			{
				email: "205917097+pjxkqc@users.noreply.github.com",
				name: "pjxkqc",
			},
			"author",
		),
	);
	assert.doesNotThrow(() =>
		assertApprovedGitIdentity({ email: "pjx086921@outlook.com", name: "pjxkqc" }, "author"),
	);
});

void test("rejects a Multica runtime placeholder identity", () => {
	assert.throws(
		() => assertApprovedGitIdentity({ email: "Mona@Lisa", name: "Mona" }, "author"),
		/Unapproved Git author: Mona <Mona@Lisa>/,
	);
});

void test("checks both effective author and committer identities", () => {
	const values = new Map([
		["var GIT_AUTHOR_IDENT", "pjxkqc <205917097+pjxkqc@users.noreply.github.com> 1785041640 +0800"],
		["var GIT_COMMITTER_IDENT", "Mona <Mona@Lisa> 1785041640 +0800"],
	]);

	assert.throws(
		() => verifyEffectiveGitIdentities((arguments_) => values.get(arguments_.join(" "))),
		/Unapproved Git committer/,
	);
});

void test("checks both author and committer stored on HEAD", () => {
	assert.deepEqual(
		verifyHeadGitIdentities(() =>
			[
				"pjxkqc",
				"205917097+pjxkqc@users.noreply.github.com",
				"pjxkqc",
				"205917097+pjxkqc@users.noreply.github.com",
			].join("\u0000"),
		),
		{
			author: {
				email: "205917097+pjxkqc@users.noreply.github.com",
				name: "pjxkqc",
			},
			committer: {
				email: "205917097+pjxkqc@users.noreply.github.com",
				name: "pjxkqc",
			},
		},
	);
});
