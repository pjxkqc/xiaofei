# Multica project bootstrap

This directory is the repository-owned input for creating the Xiaofei project,
Agents, and squad in Multica.

For a second Codex conversation that will coordinate an independent Feature,
start with the canonical
[`cross-machine-feature-operations.md`](./cross-machine-feature-operations.md),
then use [`codex-parallel-handoff.md`](./codex-parallel-handoff.md) for the
current project snapshot and ready-to-paste starter prompt. Reuse the existing
`xiaofei-pr-delivery` Skill; do not create a duplicate delivery Skill for each
conversation.

It is intentionally **not** stored under `.multica/`. Multica does not document
a repository-native Agent manifest that it automatically applies. The
[`bootstrap.yaml`](./bootstrap.yaml) file is a Xiaofei import blueprint for a
human or bootstrap Agent to read; it is not a command that the Multica CLI
executes directly.

## Import contract

An importer must read these files before creating or updating anything:

1. [`../../AGENTS.md`](../../AGENTS.md) — global coding and safety rules;
2. [`../repository-structure.md`](../repository-structure.md) — code ownership
   and dependency direction;
3. [`bootstrap.yaml`](./bootstrap.yaml) — desired Multica objects and stable
   identifiers;
4. [`agents.md`](./agents.md) — exact role instructions;
5. [`collaboration.md`](./collaboration.md) — issue routing, handoff, PR, and
   Preview protocol;
6. [`cross-machine-feature-operations.md`](./cross-machine-feature-operations.md)
   — Mac/Windows startup, capability, conflict, and cross-host audit contract;
7. [`skills/xiaofei-pr-delivery/SKILL.md`](./skills/xiaofei-pr-delivery/SKILL.md)
   — reusable UAT branch, Draft PR, exact-head, Preview, cleanup, and promotion
   workflow.
8. [`skills/xiaofei-feature-orchestration/SKILL.md`](./skills/xiaofei-feature-orchestration/SKILL.md)
   — cross-machine Feature intake, ownership routing, one shared branch and
   one Draft PR to `uat`.

The importer should reconcile by project title, Agent slug, and squad name. It
must update matching objects instead of creating duplicates.

## Bootstrap sequence

### 1. Connect the repository

Authenticate the CLI and ensure a Codex-capable runtime and daemon are
available:

```bash
multica login
multica auth status
multica runtime list
multica daemon status
```

Create the project with this repository as its GitHub resource:

```bash
multica project create \
  --title "Xiaofei" \
  --repo https://github.com/pjxkqc/xiaofei
```

If the project already exists, attach or verify the same repository in its
Resources section instead of creating a second project.

### 2. Create the Agents

Create the five Agents declared in `bootstrap.yaml`. In the Web UI, use the
name, Codex runtime, visibility, concurrency, and instructions from
[`agents.md`](./agents.md). With the CLI, start with the interactive command
and use the installed version's help for optional flags:

```bash
multica agent create
multica agent create --help
```

Do not add model-provider, database, Vercel, Neon, or GitHub credentials as
Agent `custom_env` during import. Credential design is a separate,
least-privilege operation.

### 3. Create the delivery Skill

Create or reconcile `xiaofei-pr-delivery` from its versioned `SKILL.md`, then
assign it to all five Xiaofei Agents. Keep the live Skill content synchronized
with this repository copy:

```bash
multica skill create \
  --name xiaofei-pr-delivery \
  --description "Deliver Xiaofei changes safely through UAT" \
  --content-file docs/multica/skills/xiaofei-pr-delivery/SKILL.md
multica skill files upsert <skill-id> \
  --path agents/openai.yaml \
  --content-file docs/multica/skills/xiaofei-pr-delivery/agents/openai.yaml
multica agent skills add <agent-id> --skill-ids <skill-id>
```

Existing installations should use `multica skill update` rather than creating
a duplicate.

### 4. Create the squad

Create one stable routing target led by `xiaofei-lead`:

```bash
multica squad create \
  --name "Xiaofei Delivery" \
  --leader xiaofei-lead
```

Use `multica agent list` and `multica squad list` to resolve IDs, then add the
remaining Agents with the roles in `bootstrap.yaml`:

```bash
multica squad member add <squad-id> \
  --member-id <agent-id> \
  --type agent \
  --role "<role>"
```

Put the collaboration rules into the squad instructions. Assign ambiguous or
cross-boundary issues to the squad; assign already scoped issues directly to
the owning Agent.

### 5. Verify the import

- The project has exactly one `github_repo` resource:
  `https://github.com/pjxkqc/xiaofei`.
- All five Agent slugs exist once and use a Codex runtime.
- `xiaofei-lead` is the squad leader and the other four Agents are members.
- Every Agent instruction tells it to read root `AGENTS.md`.
- Every Agent has `xiaofei-pr-delivery`; ordinary repository checkout uses
  `--ref uat` and an ordinary Draft PR targets `uat`.
- Every active parent Feature Issue and its PR identify the immutable Origin
  Codex session and current Managing Codex session; child Issues inherit the
  controller identity from the parent.
- No secret was copied from the repository, browser, shell, or deployment
  provider into Multica.
- A dry-run issue can be routed without allowing two Agents to edit the same
  boundary.

## Runtime-owned state

When a Multica task runs with project resources, Multica may generate
`.multica/project/resources.json` and inject project context into the coding
runtime. That file is ignored by this repository because it describes one task
environment, not the desired project or Agent configuration.

Repository truth remains under `docs/multica/`. If Multica later publishes a
native versioned manifest, replace the custom blueprint in a focused PR and
record the migration here.
