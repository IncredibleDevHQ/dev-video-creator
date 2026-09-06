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

- `STUDIO_DATA_DIR` — overrides the data dir (default
  `~/Library/Application Support/studio-desktop/studio`); harness projects
  live in `<dataDir>/projects/<projectId>` unless `projectDir` is passed.
- `STUDIO_DIST_DIR` — overrides the studio-v2 `dist/` location.
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
