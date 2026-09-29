# Incredible Studio: developer guide

The [README](../../README.md) is how to set up and use the studio. This guide
is for changing it. Each topic has one page, and each command, schema and
rule has one home — linked from elsewhere, never restated.

| Page | Covers |
| --- | --- |
| [Front end](frontend.md) | `apps/studio-v2/src`: the notebooks, the page and scene workspaces, the shared components, routes, styles and unit tests |
| [Storage and engine](storage.md) | `apps/studio-v2/server`: the worker's API, PostgreSQL and MinIO, migrations, the file store for tests, backups, rendering, environment variables |
| [Harnesses and skills](harness.md) | `apps/studio-desktop`: how Claude Code, Codex and Kimi runs are started, what a skill may do, the MCP tools, run records and failures, which harness and model each stage uses |
| [Checks](checks.md) | The unit tests, the desktop checks and the battery run before a change is pushed, the release suite, and the live proofs kept apart from them |

## The shape of the repository

- `apps/studio-v2` — the studio: a Vite front end (`src/`, `index.html`) and a
  Node worker (`server/`) that serves the API, renders with Hyperframes and
  keeps projects in PostgreSQL and MinIO.
- `apps/studio-desktop` — the Electron app: hosts the worker in-process on a
  free local port, serves the built front end, drives the local harnesses,
  and serves the studio's MCP tools to them. Its `skills/` are the
  instructions the harnesses follow.
- `packages/markdown-composition` — the document model both share: notebook
  and project types, the four notebook formats and their summaries, JSON
  schemas for skill artefacts.
- `packages/node-identifier` — stable node IDs for the Tiptap editor.
- `scripts/studio` — `yarn studio:setup`, `studio:doctor` and `studio:app`.
- Everything else under `apps/` and `packages/` belongs to the legacy app
  ([docs/legacy.md](../legacy.md)) and is not built or run by the studio.

## Everyday commands

| Command | Does |
| --- | --- |
| `yarn studio:setup` | Everything from a fresh checkout; safe to repeat |
| `yarn studio:app` | The desktop app, rebuilt first when its sources changed |
| `yarn studio` | The studio in a browser with hot reload (4173, worker on 4319) |
| `yarn studio:doctor` | What this machine has, and what to do about any gap |
| `yarn studio:test` | Unit tests of the two packages and the studio's typecheck |
| `yarn workspace studio-v2 test` | The studio's unit tests (Vitest) |
| `yarn studio:check` | The release suite (see [Checks](checks.md)) |
| `yarn studio:infra` / `studio:infra:stop` | Start or stop only PostgreSQL and MinIO |
| `yarn studio:backup <dir>` / `studio:restore <dir>` | Back up or restore projects and their files |

## Worktrees

A git worktree may share another checkout's dependencies, its `node_modules`
a folder of links into that checkout's. `yarn studio:setup` recognises this
and leaves installing to the checkout that owns them: running `yarn install`
in such a worktree would replace the links with copies. The storage is
shared the same way. A studio's PostgreSQL and MinIO already running from
another checkout are used, not started twice.

## Conventions

- Commits are conventional (`feat(studio): …`, `fix(…)`, `docs(…)`,
  `test(…)`), subject at most 88 characters; the hook installed by `husky`
  enforces it.
- Credentials stay on the server: never in a Vite variable, a prompt, a log
  line, a saved notebook or a render. Keys are read from the environment or
  the repository's `.env` (git-ignored).
- A check with a stub harness proves the machinery, not the quality of what
  a model makes; it is never presented as live generation (see
  [Checks](checks.md)).
