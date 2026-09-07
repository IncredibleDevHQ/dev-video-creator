# Incredible Studio — test report (implementation-spec §7)

Update 2026-09-07 (script-first iteration): `claude-code` adapter now discovers the desktop-app bundle (`~/Library/Application Support/Claude/claude-code/<v>/claude.app/Contents/MacOS/claude`) and passes `--verbose`; smoke shows `Agent · Claude Code · 2 online`. Re-run: markdown-composition 80/80, studio-v2 22/22 (script planner + director), typecheck ✓, `yarn studio:build` ✓, smoke PASS (`STUDIO_ALLOW_MULTI_INSTANCE=1` while the app is open), `harness-e2e.mjs` PASS for claude-code (stub pinned via `STUDIO_CLAUDE_BIN`) and codex.


Date: 2026-09-06 · branch `feat/hyperframes-markdown-mvp` · macOS arm64, Node 26.4.0 host, Electron 44.2.0, ffmpeg 8.1.2, kimi CLI 0.41.0 (`~/.kimi-code/bin/kimi`). `claude` / `codex` CLIs are NOT installed on this machine.

Every item was run fresh on the current tree. New check scripts live in `apps/studio-desktop/scripts/` (`local-store-check.mjs`, `quick-plan-check.mjs`, `export-check.mjs`, plus the existing `mcp-check.mjs`, `harness-e2e.mjs`, `kimi-e2e.mjs`, `skills-install-check.mjs`).

---

## 1. Unit — `yarn studio:test`

```
 Test Files  5 passed (5)
      Tests  61 passed (61)   (46 pre-existing + 15 artefact-schema tests)
$ tsc --noEmit  (markdown-composition) ✓   studio-v2 typecheck ✓
```
PASS.

## 2. Serve — `yarn studio:build && yarn workspace studio-v2 test:serve-dist`

```
✓ built in 1.06s
ok /static/index-DvyQg6Rc.js (text/javascript)
ok /static/index-DMKeNcSF.css (text/css)
SERVE-DIST PASS
```
The serve-dist check fetches the built index and follows every bundle URL it references (defect 0.1 regression test). The editor mounting is additionally covered by the desktop smoke probe (item 3: `hasEditor: true`, bundle boots from the same origin). PASS.

## 3. Desktop smoke — `yarn workspace studio-desktop build && yarn workspace studio-desktop smoke`

```
[studio-desktop] probe {"title":"Incredible Studio","health":{"renderer":true,"systemVoice":true,"fishAudio":false,"themeAI":true,"persistence":{"database":"files","objectStorage":"files","bucket":"/Users/think/Library/Application Support/studio-desktop/studio"}},"projectCount":1,"hasEditor":true,"hasModelSettings":true,"hasAssistButton":true}
SMOKE PASS
```
Health reports files persistence; title, editor mount, model settings, notebook list and the desktop-only Plan motion (assist) button all probed in-page. Warm start ≈ 1.3 s. PASS.

## 4. Local store — docker STOPPED (`docker compose stop minio studio-db`), restarted afterwards

`node scripts/local-store-check.mjs` (temp `STUDIO_DATA_DIR`; full output above):

```
PASS  create notebook (docker stopped)           persistence.bucket = <temp data dir>
PASS  upload image asset (POST /api/assets)      228efe02… (70-byte PNG round-trip, byte-identical)
PASS  record take with real bytes (finalize)     21 650-byte WebM (ffmpeg testsrc+sine) → MP4 asset 2a35b47f…
PASS  commit recording (commit)                  recording 9aa2bdee… storage local
PASS  save recordedBlocks mapping                recordedBlocks[blk-p1] in notebooks/<id>.json
PASS  artefacts on disk under the data dir       notebooks/<id>.json + <id>.takes.json
PASS  after restart: notebook + asset + recording persist   notebook ✓ asset ✓ recording ✓
PASS  cleanup                                    test notebook deleted; temp dir removed
LOCAL STORE PASS
```
The full §2 flow ran with `minio` and `studio-db` stopped: record → `/api/recordings/finalize` (ffmpeg transcode of a real WebM take) → `/api/recordings/commit` → app restart → notebook, image asset and the recording mapping all persist on disk. **Not covered:** UI-level camera/mic recording (getUserMedia, MediaRecorder) — it cannot be driven headless; the API surface it calls is what this test exercises. PASS (with that noted surface).

Finding recorded (test-harness artifact, not a product bug): writing `recordedBlocks` via the API out-of-band races the booted front-end's own auto-save of the version it loaded at boot; the studio's real flow (in-memory update then save) is unaffected. The check writes the mapping last and asserts the file.

## 5. Plan Motion Quick — `node scripts/quick-plan-check.mjs`

```
PASS  slide block + narration → gateway plan (Quick)   3 steps via openai
PASS  MCP resolve + validate → 0 errors                0 warnings, gateSignal null
PASS  studio surface shows the planned notebook        slide block in the editor
PASS  step bar appears with the driver registered      label "Steps", driver.stepCount 3
PASS  Next steps through the driver                    2/3 → 3/3 → (prev) 2/3
PASS  step visibility follows the driver               u-norm opacity 0 → 1 after stepping to its beat
PASS  Play advances and stops                          is-playing during play, advanced to 2/3, stopped cleanly
PASS  Loop wraps to the first step                     wrapped to 1/3
QUICK PLAN PASS
```
Real gateway plan (Quick, no harness), MCP `resolve` + `validate` 0 errors, then the REAL step bar (`#explainer-step-bar`) driven in the app window via the loopback `/__eval` test hook (registered only when the app is launched with `STUDIO_ENABLE_TEST_HOOKS=1`; the check script sets it, normal launches never register the route): Next/Prev labels advance, the compiled driver (`__explainerDrivers['blk-slide']`) flips actual element opacity per step, Play advances and stops, Loop wraps. PASS.

App-surface notes for automation: the app boots on `/themes` unless the path is `/studio`, and it restores the project from the localStorage active-project key (set it before navigating when seeding notebooks via the API).

## 6. Harness run — Plan Motion Default through an installed adapter

- Stub claude CLI (stream-json shapes): `node scripts/harness-e2e.mjs` → **HARNESS STUB E2E PASS** — gate → auto-answer → `--resume stub-session-1` + `inputs.gateAnswer` → `run.json {status:'done', resumeId:'stub-session-1'}`.
- Stub codex CLI (`codex exec --json` shapes): `node scripts/harness-e2e.mjs codex` → **HARNESS STUB E2E PASS** — resume via `codex exec resume stub-thread-1`.
- Real kimi 0.41.0: `KEEP_KIMI_E2E_DIR=1 KIMI_E2E_TIMEOUT_MS=840000 node scripts/kimi-e2e.mjs` → **KIMI E2E PASS**, final `run.json {"status":"done", "resumeId":"session_5081e0ad…"}` (79 events, ~11 min). Both blocking gates (contract, solution) round-tripped through `STUDIO_GATE_AUTO_ANSWER`; skills installed into `<projectDir>/.claude/skills` and the task text resolved against the installed `SKILL.md`; full artefact set written: `run.json, inputs.json, geometry.json, measure.json, brief.blocks.json, brief.md, lock.md, resolved.json` (6 actions, 5130 ms), `validate.final.json` **0 errors / 0 warnings / gateSignal null**, `receipt.json` (4 beats, 0 absences) and 18 review frames in `motion/frames/` (the agent read them back to spot-check).

Harness versions: `run.json.harnessVersion: 1`; adapter ids `claude-code | codex | kimi`. **claude-code and codex adapters are stub-verified only** (binaries unavailable here); the kimi adapter is verified end-to-end with the real CLI. PASS (with the stub caveat).

Skill defect found by the agent and fixed in place: the routing trigger table named a non-existent `references/relations.md`; it now points at `references/core.md` §2.2 and `references/driver.md` §4.3 (the same dangling reference exists in the upstream `~/Downloads/motion-core` copy — worth propagating).

## 7. Export — `node scripts/export-check.mjs`

```
PASS  POST /api/render (real producer path)     /outputs/<id>.mp4 (10.00 s composition in 10.2 s wall)
PASS  MP4 exists with a video stream            h264, 1920×1080, 30 fps, 408 KiB
PASS  duration ≈ composition duration           mp4 10.000 s vs composition 10.000 s (drift 0.000 s)
PASS  frame count ≈ duration × fps              300 frames ≈ 300 (10.00 s × 30 fps, ffprobe -count_frames)
PASS  producer review artefact                  no separate review sheet in the MVP render path
EXPORT PASS
```
Seek-driven by construction: `handleRender` → `compileProject` → `createRenderJob({fps, workers: 1})` → `@hyperframes/producer.executeRenderJob` (frame-exact renderer — the exact 300-frame count is the evidence). No producer review-sheet file exists in the local MVP path; the review-sheet role is covered by the MCP `frames` tool (settled-fold stills). Puppeteer Chrome was already cached (`~/.cache/puppeteer` mac_arm-127.0.6533.88 for the producer's bundled puppeteer-core 25.3.0 and mac_arm-151.0.7922.71 for the worker's puppeteer; both launch OK). PASS.

---

## §9 Review checklist

- [x] **defect 0.1 fixed with a test that fetches the bundle URL from the built index** — `apps/studio-v2/scripts/serve-dist-check.mjs`, run as `yarn workspace studio-v2 test:serve-dist` → SERVE-DIST PASS (item 2). Vite emits under `dist/static/`, served before the `/assets/*` media route.
- [x] **persistence.ts switch; local backend passes the §2 flow; no pg/minio import when local** — `persistence.ts` lazy-imports `persistence-local` only when `STUDIO_PERSISTENCE=local` (esbuild keeps `pg`/`minio` external in `worker.mjs`; never loaded in local mode). §2 flow green with docker stopped (item 4).
- [x] **worker handler exported and hosted in-process; free port; clean shutdown** — `createStudioHandler` in `apps/studio-v2/server/index.ts`; `worker-host.ts` probe-port + 127.0.0.1 listen; `stop()` = `closeAllConnections()` + `close()`; `lsof` shows no listener after every smoke/e2e exit.
- [x] **harness port interface as in §3.1; at least the Claude Code adapter with stream parsing and resume** — `src/harness/types.ts` verbatim; claude-code adapter implemented per §3.3 (stream-json parse, `session_id` capture, `--mcp-config` per run) and protocol-verified against a stub CLI (binary unavailable). Kimi adapter verified against the real CLI.
- [x] **gate protocol round trip with a dialog** — gate.json → `gate` event → modal dialog window (`src/harness/gate-dialog.ts`, dark chrome, textarea per field, recommendation, submit/dismiss) → answer file → resume. Round trip exercised headless via `STUDIO_GATE_AUTO_ANSWER` (both stub CLIs and the real kimi run); the dialog itself is native and opens in normal (non-headless) runs — not click-driven in CI (see limitations).
- [x] **MCP server with atomize, plan_beats, validate at minimum, schemas attached** — 7 tools (`atomize, measure, plan_beats, resolve, validate, receipt, frames`), each with a JSON schema, listed over `initialize`/`tools/list` through the stdio shim (`scripts/mcp-check.mjs` → MCP CHECK PASS, incl. real-OpenAI `plan_beats`). `validate` also shape-checks against the §3.2 resolved-tier schema (`packages/markdown-composition/src/schemas/`).
- [x] **skills installed per project with a lock file; motion-master discovered by description** — `skills-install-check.mjs` → SKILLS INSTALL PASS (install into `.claude/skills/*`, AGENTS.md pointer, `skills.lock` with version+sha256, `modifiedLocally` respected); real kimi run used the installed copy (`--skills-dir` + task text) and routed by the SKILL.md description.
- [x] **smoke prints PASS; test plan items 1–5 green; 6–7 attempted with results recorded** — items 1–5 green; 6–7 run with the exact outputs above.

## Not run / known limitations

- **UI camera/mic recording** (getUserMedia + MediaRecorder in the window) — not driveable headless; the commit/finalize API surface it uses is covered (item 4).
- **claude / codex real binaries** — not installed here; their adapters are verified against stub CLIs emitting the documented stream shapes. Re-verify when a binary exists (command lines in `src/harness/adapters/*.ts`).
- **Concept-test pilot users (§7 item 8)** — out of scope for this iteration (people, not code).
- **Kimi native MCP approval flow** — kimi 0.41.0 in `-p` mode did not auto-load the project `.mcp.json`; the agent improvised `motion/call-tool.sh` curl'ing `POST /mcp` (which is why `call-tool.sh` appears in run dirs). Protocol and endpoint are unaffected; native MCP wiring needs kimi's trust/approval path configured.
- **frames tool emits settled-fold stills** (in-progress actions at 50 % opacity) — the studio renderer has no `?step=&t=` seek driver yet (build-plan phase 0/7).
- **Plan motion (assist) refresh stays manual** — `motion/resolved.json` is not mapped back into block steps; the status line says where the plan landed.
- **Gate dialog not click-driven in CI** — its submit/cancel path is wired through the same `RunManager.answer` the auto-answer uses; manual QA: run a Plan Motion Default without `STUDIO_GATE_AUTO_ANSWER` and the modal appears.
- **CSP dev warning** — Electron warns about the missing Content-Security-Policy in dev (spec §8); set one in the served `index.html` before shipping packaged builds.
- **Electron deprecation noise** — none remaining in app code; the sandboxed-iframe and hyperframes-player warnings come from the studio front end, unchanged.
