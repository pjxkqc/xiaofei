# Multica project bootstrap

This directory is the repository-owned input for creating the Xiaofei project,
Agents, and squad in Multica.

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
   Preview protocol.

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

### 3. Create the squad

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

### 4. Verify the import

- The project has exactly one `github_repo` resource:
  `https://github.com/pjxkqc/xiaofei`.
- All five Agent slugs exist once and use a Codex runtime.
- `xiaofei-lead` is the squad leader and the other four Agents are members.
- Every Agent instruction tells it to read root `AGENTS.md`.
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
