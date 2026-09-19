# studio-desktop

Electron shell for Incredible Studio: hosts the studio-v2 worker in-process on
a free 127.0.0.1 port, serves the built front end from the same origin, and
adds the harness port (spec §3) and the studio MCP server (spec §4).

## Scripts

- `yarn workspace studio-desktop build` — esbuild `src/` → `dist-electron/`
  (`main.js`, `preload.cjs`, `worker.mjs`, `atomizer.js`, `mcp-stdio.mjs`).
- `yarn workspace studio-desktop start` — run the app.
- `yarn workspace studio-desktop smoke` — launch, probe, quit (`SMOKE PASS`).
- `yarn workspace studio-desktop test` — build + smoke + product test (7 checks).
- `node scripts/mcp-check.mjs` — JSON-RPC over stdio through the MCP shim;
  exercises all seven tools (needs the OpenAI key for `plan_beats`).
- `node scripts/harness-e2e.mjs [claude-code|codex]` — gate-protocol e2e with
  a stub CLI on PATH (stream-json shapes, gate write, resume).
- `node scripts/kimi-e2e.mjs` — real-Kimi gate round trip (Plan Motion —
  Default; `KIMI_E2E_TIMEOUT_MS`, `KEEP_KIMI_E2E_DIR` optional).
- `node scripts/skills-install-check.mjs` — per-project skill install and
  `skills.lock` behaviour (no Electron needed).
- `node scripts/local-store-check.mjs` — §7 item 4: recording flow with real
  bytes + app restart against a temp data dir (run with docker stopped).
- `node scripts/quick-plan-check.mjs` — §7 item 5: Quick plan + MCP validate +
  real step-bar driving via the `/__eval` loopback test hook.
- `node scripts/export-check.mjs` — §7 item 7: `/api/render` → ffprobe checks
  (`KEEP_EXPORT_MP4=1` keeps the file).
- `node scripts/import-check.mjs` — SVG page import (real ppt-master example
  pages) through `window.importSvgPages`.
- `node scripts/approval-check.mjs` — Plan motion (assist) approval gate
  (stub kimi on PATH; no agent spawned).
- `node scripts/animate-check.mjs` — the money test: import → approve → real
  Plan motion (assist) run → apply → save → step bar (`ANIMATE_TIMEOUT_MS`,
  `KEEP_ANIMATE_DIR` optional).
- `node scripts/create-explainer-check.mjs` — D0 journey: Create explainer's
  two delivery paths, recorded choice, draft-vs-reviewed Publish labels,
  library Base/Draft badges, Basic diagram rename.
- `node scripts/migration-check.mjs` — D0a: legacy file store → PostgreSQL +
  MinIO import through the UI banner; idempotent, non-destructive.
- Full §7 results: `TEST-REPORT.md`.

## Durable storage: local PostgreSQL + MinIO

The desktop's production store is the repo's local stack, not files:

- **PostgreSQL** (`studio-db` service, `postgres:17-alpine`) owns notebooks,
  blocks, assets metadata, recorded takes, settings and the migration ledger.
  Named volume `studio-db`; port `54329`.
- **MinIO** (`minio` service) owns every binary object (recordings, artwork,
  exported MP4s). Named volume `minio_storage`; API `59000`, console `59001`.
- Lifecycle: `yarn studio:infra` / `yarn studio:infra:stop` (docker compose).
- The smoke requires the `postgres`/`minio` health report; when the services
  are down the app shows a storage warning instead of pretending work is
  saved. `STUDIO_PERSISTENCE=local` is an explicit isolated-test mode (plain
  files), never a silent fallback.
- First run with existing file-backed work: the studio offers a
  non-destructive import (`/api/migrate/local`); files stay put.
- Backup/restore: `yarn studio:backup <dir>` and `yarn studio:restore <dir>`
  (overrides: `--database-url`, `--bucket`). Proof:
  `node apps/studio-v2/scripts/backup-restore-check.mjs` restores into a
  fresh database + bucket and verifies row counts and object checksums.
  Named volumes survive restarts but are not backups.
- Schema changes ship as ordered, recorded files in
  `apps/studio-v2/server/migrations/` (ledger: `studio_schema_migrations`).

## Skills install (spec §5)

Every harness run first installs the vendored `skills/` into
`<projectDir>/.claude/skills/*` and appends the `AGENTS.md` pointer (once;
existing files are never clobbered). `<projectDir>/skills.lock` records
{version, sha256, installedAt} per skill; re-installs happen only when the
vendored hash differs, and a locally edited skill is kept and marked
`modifiedLocally: true`. The run's `SKILL_DIR` resolves to the installed
copy when present. Artefact JSON Schemas (Core §3.2/§13.1/§25.1/§28.9) live
in `packages/markdown-composition/src/schemas/` with a `validateArtefact`
helper; the MCP `validate` tool shape-checks `resolved` against them.

## Environment

- `STUDIO_PERSISTENCE` — `local` selects the plain-file store for isolated
  tests; anything else (the desktop default) is local PostgreSQL + MinIO.
- `STUDIO_DATABASE_URL`, `STUDIO_MINIO_ENDPOINT`, `STUDIO_MINIO_PORT`,
  `STUDIO_MINIO_USE_SSL`, `STUDIO_MINIO_ACCESS_KEY`, `STUDIO_MINIO_SECRET_KEY`,
  `STUDIO_MINIO_BUCKET` — durable-store connection, defaulting to the
  docker-compose services. Credentials stay server-side.
- `STUDIO_DATA_DIR` — overrides the data dir (default
  `~/Library/Application Support/studio-desktop/studio`); harness projects
  live in `<dataDir>/projects/<projectId>` unless `projectDir` is passed. In
  `STUDIO_PERSISTENCE=local` this is also the file store.
- `STUDIO_DIST_DIR` — overrides the studio-v2 `dist/` location.
- `STUDIO_OUTPUTS_DIR` — overrides where published MP4s are written (default
  `~/Downloads/Incredible Studio/`); the dev worker (`server/bin.ts`) honours
  it too, defaulting to `<dataDir>/outputs/`.
- `STUDIO_GATE_AUTO_ANSWER` — JSON string; when set, gate dialogs are answered
  programmatically with this object (headless runs and the e2e scripts; the
  dialog never auto-answers in normal use).
- `STUDIO_HARNESS_E2E` — path to a JSON config; runs the headless harness
  scenario instead of opening a window (used by the e2e scripts).

## MCP transport

Harness CLIs can't reach Electron internals, so tools live in the desktop
main behind `POST /mcp` on the app's origin; `dist-electron/mcp-stdio.mjs` is
a newline-JSON-RPC stdio↔HTTP bridge that harnesses spawn with plain `node`
(adapters write per-run MCP configs pointing at it, with `STUDIO_MCP_URL` in
env). Tools: `atomize`, `measure`, `plan_beats`, `resolve`, `validate`,
`receipt`, `frames` — contracts in `skills/motion-master/scripts/README.md`.
