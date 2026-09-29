# Checks

Three kinds, kept apart: **unit tests** (fast, no app), **desktop checks**
(the real app, with stub harnesses) and **live proofs** (real providers, paid,
run on purpose). A check with a stub proves the machinery — layout, state,
storage, the flow between notebooks — never the quality of what a model makes,
and is never presented as live generation.

## Unit tests

```bash
yarn studio:test                   # node-identifier + markdown-composition + the studio's typecheck
yarn workspace studio-v2 test      # the studio's Vitest suite (front end and worker)
```

## Desktop checks

`apps/studio-desktop/scripts/*-check.mjs`. Each builds nothing: build first.

```bash
yarn workspace studio-v2 build && yarn workspace studio-desktop build
node apps/studio-desktop/scripts/page-view-check.mjs
```

Each check starts its own app (`electron . --smoke --keep-running`) on a free
port with a temporary data folder and `STUDIO_ALLOW_MULTI_INSTANCE`, and the
battery's checks use the file store there (`STUDIO_PERSISTENCE=local`), so
none touches the creator's app, projects or PostgreSQL. A new check does the
same; one that needs PostgreSQL and MinIO points `STUDIO_DATABASE_URL` and
`STUDIO_MINIO_*` at a store of its own. Stub `claude` / `kimi` CLIs are put
first on `PATH`. The check drives the page through the `/__eval` hook, which exists
only with `STUDIO_ENABLE_TEST_HOOKS=1`, and prints a `PASS` or `FAIL` line
per assertion, then `… CHECK PASS` or `… CHECK FAIL (n)`; the exit code
follows. Most take an environment variable naming a folder for their
screenshots (`PAGE_VIEW_SHOTS`, `SOURCE_DESIGN_CAPTURE_DIR`, …: see the
top of each script).

### The battery

Run before a change to the studio is pushed; it takes about half an hour.

| Check | Covers |
| --- | --- |
| `project-switch-check` | A project's four notebooks, and the switch between them |
| `source-intake-check` | What the source dialog reads: refused links and their recovery, thin reads, colour provenance |
| `source-destination-check` | An import always lands in a project of its own |
| `source-theme-reuse-check` | The brand step's choice between a saved theme, the read directions and a custom palette |
| `source-delivery-check` | The delivery chosen in Create explainer travels with the project |
| `wording-preserve-check` | “Keep my wording” survives the whole journey |
| `source-design-check` | The wireframe made in the background; the presentation designed from it, slides landing as they are drawn; stopping and progress |
| `wireframe-retry-check` | A stopped or failed wireframe made again from the stored article |
| `page-view-check` | The page view: rail, stage, inspector, keys, a slide waiting for its design, the progress row |
| `presentation-export-check` | A presentation's PDF, by choice, saying which slides are drafts |
| `notebooks-hierarchy-check` | Derived notebooks, their breadcrumb and the library tree |
| `sample-check` | The bundled example, made once and found again |
| `create-explainer-check` | Create explainer's two delivery paths |
| `agent-picker-check` | AI settings: the harness and model per stage, kept across a restart |
| `planning-check` | Planning: the brief and a scene's plan |
| `planning-progress-check` | Progress as it happens, phase by phase |
| `plan-preview-check` | A plan's preview |
| `preview-handoff-check` | Previews finishing in any order |
| `preview-exhausted-check` | A preview whose every submission is refused |
| `scene-review-check` | The scene review inside the video notebook |
| `review-layout-check` | The review stays readable where it is used |
| `scene-workspace-check` | The video's scenes around one stage |
| `scene-flow-check` | A video's scene work in one place |
| `scene-recording-check` | Delivery: presented by the creator, or a generated voice |
| `scene-timeline-check` | Output parity, read in one place |
| `production-check` | A scene produced from its approved plan |
| `presented-production-check` | A scene the creator presents, produced and edited |
| `visual-cast-check` | The icons and objects lifted from a video's pages |
| `export-recovery-check` | An export found again after a reload |
| `restart-check` | What survives a real restart |
| `stage-panel-check` | A run's stage checkpoints, in plain language |
| `rehearsal-check` | Rehearsal in the camera dialog |

A check that fails once and passes on every rerun of the same build is a
flake to fix in the check (it read something before it arrived), not to
ignore.

### The release suite

`yarn studio:check` builds both apps, runs the unit tests, then
`scripts/release-check.mjs`: the journey, storage and lineage checks, with a
summary. Some of its checks need Docker's PostgreSQL and MinIO running;
`local-store-check` is meant to run with them stopped.

## Setup

`yarn studio:setup` twice in a row is itself a check: the second run must
finish without installing, starting or migrating anything new, and
`yarn studio:doctor` must then exit 0. The fresh-install workflow
(`.github/workflows/studio-fresh-install.yml`) does this on a clean runner.

## Live proofs

`live-*.mjs`, `kimi-e2e.mjs`, `story-live-check.mjs`, `scene-animate-check.mjs`
and `mcp-check.mjs` use real providers and cost money or subscription usage.
They run only when asked, and they are the only evidence of what a model
actually makes.
