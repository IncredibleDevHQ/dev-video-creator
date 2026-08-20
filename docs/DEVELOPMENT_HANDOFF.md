# Incredible Studio v2 — Development Handoff

**Handoff date:** 2026-08-20  
**Repository:** `https://github.com/IncredibleDevHQ/Incredible.git`  
**Continue from:** `feat/hyperframes-markdown-mvp`  
**Handoff baseline before this document:** `38c79bf882f36d7401fbdeb73c66b17c2d983ca1`  
**Original base:** `origin/oss` at `a3a31e5c17d6d302f240c61e8a5cf9c23edb0ef0`

This is the working handoff for the human-first Incredible Studio rebuild. It is intended to be the next developer's starting point and distinguishes working behavior from product direction and future work.

## 1. Branch and Git instructions

Do **not** restart from `main` or `oss`. The implementation is 53 signed commits ahead of `origin/oss` at the handoff baseline.

```bash
git fetch origin
git switch feat/hyperframes-markdown-mvp
```

At handoff time, `feat/hyperframes-markdown-mvp` exists locally but has **not** been pushed to `origin` under its own branch name. Before changing machines or handing the repository to someone without this worktree, push it:

```bash
git push -u origin feat/hyperframes-markdown-mvp
```

If a new implementation branch is desired, create it **from this branch**, not from `oss`:

```bash
git switch feat/hyperframes-markdown-mvp
git switch -c codex/<next-scope>
```

All commits must remain signed as:

```text
Karthic Rao <kartronics85@gmail.com>
```

Repository-local Git configuration is already set, but verify it before committing:

```bash
git config user.name "Karthic Rao"
git config user.email "kartronics85@gmail.com"
git config commit.gpgsign true
git commit -S -m "..."
git log -1 --show-signature
```

All 53 implementation commits inspected at handoff had good signatures.

## 2. Product definition and non-negotiable principles

Incredible is a developer-video studio in which the notebook is the storyboard. A creator writes naturally in Markdown, focuses a block, directs its live visual treatment, appears in the frame, and records a finished block or project.

The product is deliberately **human-first**:

- A real person on camera remains the center of the experience.
- Generated or cloned voice removes the need for a microphone; it must not remove the person.
- Automation should reduce preparation and production friction while preserving authorship and human presence.
- The canvas is live while writing and directing. It is not treated as a video until the creator records it.

The design quality is the product's USP, not optional polish:

- Preserve the existing Incredible logo, wordmark, typography, green accent, and core visual language.
- Every exposed combination must be visually safe. Text must not clip, media must not show rough edges, and controls must not offer visibly broken or redundant outcomes.
- Prefer a smaller curated set of genuinely distinct, high-quality options over a large combinatorial set whose results are indistinguishable or ugly.
- Use presenter-safe areas and content-aware geometry. Camera, text, code, images, and screen recordings must not compete for the same space.

Core interaction rules:

1. Every top-level Tiptap/Markdown block is a stable scene.
2. Focusing an empty new block must preview that empty block, never the previously selected scene.
3. The notebook shows an inline live canvas beside the focused block.
4. The canvas can expand to a full recording/directing surface.
5. Layout, rendering, and animation choices are block-type-specific.
6. Presenter placement is independent from content treatment.
7. Recording captures the directed canvas, camera, optional microphone/generated audio, and animation steps.
8. A finished take is reviewed and only becomes the block's recorded take after explicit **Save block** confirmation.
9. The timeline must show every block, its type, duration, selection, and recorded state.

## 3. What is implemented

### Notebook and stable block identity

- A new Vite + Tiptap 3 Studio lives in `apps/studio-v2`.
- The custom `packages/node-identifier` extension supplies stable IDs because the original plugin was unavailable for the current Tiptap version.
- IDs live in `node.attrs.id` and are the join key across render configuration, presenter tracks, recorded takes, database rows, timeline items, and stored assets.
- Rich slash commands insert title/text, points, quote, code, image, video, and screen-recording blocks.
- Local image upload and browser screen capture create rich media blocks.

Stable block identity is an invariant. Do not replace IDs during routine edits, imports, or normalization. If a node is duplicated, the copy must receive a new ID.

### Live canvas and block director

- The focused block drives an inline live canvas and an expanded full-canvas director.
- The preview and render use the same `markdown-composition` compiler and Hyperframes composition HTML.
- Headings, paragraphs, lists, quotes, code, images, and screen recordings receive type-specific controls.
- Camera/content modes include content-only, circle, tile, portrait overlay, portrait rail, 50/50 split, camera with points on either side, and full camera.
- Layout and presenter geometry have received repeated clipping, spacing, smooth-edge, and mirror fixes.
- The expanded canvas has a rich story timeline containing all scenes.

### Block-specific design systems

- Title and text treatments, placements, surfaces, and entrances.
- Point/list layouts, rendering systems, and step animations.
- Code layouts, VS Code-inspired syntax themes, editor/terminal/panel treatments, line/token/focus animation concepts, and clipping safeguards.
- Image and screen-recording layouts, safe placements, rendering/frame treatments, border weights, corner shapes, shadows, and play affordances for recorded media.
- Background, presenter, logo, lower-third, and transition tabs.

The UI exposes many combinations. The compiler normalizes incompatible settings, and tests exercise all declared block kinds and configuration families. This is not a substitute for visual regression coverage; see the limitations section.

### Theme builder and branding

- `/themes` is a separate theme-building surface.
- A theme contains a brand palette rather than one color, optional logo, canvas treatment, typography/surfaces, human-video treatment, and per-block design/motion defaults.
- Theme directions can be generated through the server's OpenAI path when a key is available, with a deterministic local fallback.
- Saved theme choices can be selected in the Studio.
- The built-in Incredible brand and several sample presenters are included for trustworthy live previews.

Theme-library persistence is currently browser-local. The active project artifact, including its selected theme, is persisted to PostgreSQL.

### Human camera and recording loop

- The expanded canvas can request a live camera preview and render the real feed inside the selected presenter geometry.
- The local preview is mirrored where appropriate; the composition still uses the selected layout rather than placing a second floating camera outside the frame.
- Entering recording mode reduces design chrome and moves recording controls below/around the canvas in the direction of the referenced Figma flow.
- The creator can start/stop a directed block recording, use block-specific animation-step controls, review the take, download MP4, record again, or explicitly save it to the block.
- Browser display capture and `MediaRecorder` capture the directed canvas. Chromium's `CropTarget` is used when available to restrict capture to the canvas.
- The captured WebM is finalized to MP4 with FFmpeg.
- A finalized take is initially a draft. `Save block` commits it as the stable block's latest recorded take and marks the timeline item recorded.

This browser-capture implementation is a practical MVP divergence from the original strategy document, which proposed avoiding browser canvas recording. Treat the existing flow as working prototype behavior and revisit capture architecture before production hardening.

### Hyperframes integration

- `packages/markdown-composition` compiles the canonical project into composition HTML and scene metadata.
- `@hyperframes/player` provides live preview behavior.
- `@hyperframes/producer` produces rendered previews and whole-project MP4 output through the local server.
- Transient render work currently lives in ignored `.studio-data/` paths.

### Persistence

The implemented local architecture uses PostgreSQL plus MinIO:

- PostgreSQL stores versioned notebook artifacts, normalized block rows, asset metadata, and the latest recorded take for each stable block ID.
- MinIO stores uploaded images, captured screens, generated audio, and directed-block MP4s.
- `/objects/*` serves byte ranges so saved videos can seek and play.
- Browser local storage remains an offline fallback.
- On startup, the app hydrates the latest matching database artifact and debounces changes back to the server.

The database schema is in `apps/studio-v2/server/migrations/001_studio_artifacts.sql`:

- `studio_notebooks`
- `studio_blocks`
- `studio_assets`
- `studio_recorded_blocks`

The decision was PostgreSQL/Supabase-compatible persistence rather than Convex because notebook → block → configuration → assets/take is relational, requires transactions and migrations, and has a direct hosted-Supabase path. MinIO remains the explicit local S3-compatible asset layer. Convex is still a viable future realtime product choice, but its local deployment and native storage would overlap the selected local infrastructure.

## 4. Architecture and important files

```text
apps/studio-v2/
  src/main.ts                         Studio UI and current client orchestration
  src/media-nodes.ts                  Tiptap rich-media nodes
  src/styles.css                      Studio and director visual system
  server/index.ts                     HTTP API, Hyperframes producer, FFmpeg, voice/theme endpoints
  server/persistence.ts               PostgreSQL and MinIO persistence adapter
  server/migrations/001_studio_artifacts.sql
  README.md                           Current local run instructions

packages/node-identifier/
  src/index.ts                        Tiptap 3 stable node-ID extension
  src/index.test.ts

packages/markdown-composition/
  src/types.ts                        ProjectDocumentV1 and all render configuration contracts
  src/index.ts                        Project validation, normalization, compilation, composition HTML
  src/index.test.ts                   Cross-kind and configuration coverage

docs/plans/hyperframes-markdown-mvp.md
                                      Original product/architecture plan; partially aspirational
```

`apps/studio-v2/src/main.ts` is intentionally called out: it is now over 4,000 lines and should be split before more features are added.

### Canonical project document

`ProjectDocumentV1` contains:

- version, project ID, title, FPS, width, and height
- Tiptap notebook JSON
- per-node `BlockRenderConfigV1`
- per-node presenter tracks
- per-node recorded-block metadata
- brand template and selected Studio theme

The canonical project must continue to drive both preview and render. Do not create a separate visual renderer for the editor that can drift from Hyperframes output.

### Local server API

The current server exposes:

```text
GET  /api/health
GET  /api/projects/latest
GET  /api/projects/:id
PUT  /api/projects/:id
POST /api/assets
POST /api/recordings/finalize
POST /api/recordings/commit
POST /api/preview
POST /api/voice
POST /api/themes/generate
POST /api/render
GET  /objects/*
```

## 5. Local setup and operation

Requirements:

- Node.js 22+
- Yarn 1
- Docker
- FFmpeg on `PATH`
- Chromium/Chrome installed by the setup command

```bash
yarn studio:setup
yarn studio:infra
yarn studio
```

Open `http://127.0.0.1:4173` (Studio is `/studio`, themes are `/themes`).

Production-style local serving:

```bash
yarn studio:build
yarn studio:start
```

Open `http://127.0.0.1:4319`.

At handoff time, PostgreSQL and MinIO were running, but the application server itself was **not** responding on `4319`; start `yarn studio` or `yarn studio:start` before continuing browser work.

Local infrastructure ports:

```text
PostgreSQL     127.0.0.1:54329
MinIO S3      127.0.0.1:59000
MinIO console 127.0.0.1:59001
```

Stop only the Studio infrastructure with:

```bash
yarn studio:infra:stop
```

### Environment variables

Copy the Studio example environment and supply only the providers being tested:

```dotenv
FISH_AUDIO_API_KEY=
FISH_AUDIO_MODEL=s2.1-pro
VITE_RENDER_WORKER_URL=
STUDIO_DATABASE_URL=postgres://incredible:incredible@127.0.0.1:54329/incredible_studio
STUDIO_MINIO_ENDPOINT=127.0.0.1
STUDIO_MINIO_PORT=59000
STUDIO_MINIO_USE_SSL=false
STUDIO_MINIO_ACCESS_KEY=incredible
STUDIO_MINIO_SECRET_KEY=SuperSecretRootPwd
STUDIO_MINIO_BUCKET=incredible-studio
```

No API key is required for notebook editing, block direction, live camera, local recording, persistence, or Hyperframes rendering. On macOS, guide voice can use the local `say` command.

Optional provider status:

- OpenAI: used by theme direction generation when `OPENAI_API_KEY` is available; a local fallback works without it. A usable developer key was reported in `../agents/.env`. Never commit it.
- Fish Audio: optional generated voice from an owned/authorized reference ID.
- Gemini: not integrated yet.
- Research providers: not integrated yet.
- Avatar/lip-sync providers: not integrated yet.

Voice cloning must always require creator ownership/authorization and explicit consent.

## 6. Verification status at handoff

The following commands passed on 2026-08-20:

```bash
yarn studio:test
yarn studio:build
```

Results:

- `packages/node-identifier`: 3 tests passed.
- `packages/markdown-composition`: 23 tests passed.
- `apps/studio-v2`: TypeScript type-check passed.
- Vite production build passed.
- The build emitted a non-fatal large-chunk warning: the main JavaScript bundle is approximately 646 kB minified.

Previously exercised manually/integration-style during implementation:

- synthetic WebM → MP4 finalization
- draft take not marked recorded before confirmation
- explicit commit associates the take with the stable block ID
- persisted project rehydrates recorded metadata
- MinIO byte-range playback
- live browser recording and review flow
- local image and screen-recording blocks
- camera placement, mirroring, and canvas cropping paths

Important gap: `apps/studio-v2` does not yet contain a proper automated browser or server integration test suite. The passing test command mostly validates the ID extension, composition compiler, and Studio types.

## 7. Known limitations and technical debt

### Highest risk

1. **The implementation branch is local-only.** Push it immediately.
2. **No auth, tenancy, or row-level security.** The current stack is local-development infrastructure.
3. **Recording relies on browser display capture.** Permissions, `CropTarget`, codec support, and capture UI differ across browsers and operating systems.
4. **No automated visual regression matrix.** Many configuration combinations are compiler-tested but not screenshot-reviewed.
5. **The client is monolithic.** `src/main.ts` must be decomposed before scaling the feature set.

### Recording and persistence

- Abandoned draft recordings can leave orphaned MinIO objects.
- Replacing a saved take can leave the previous asset unreferenced; garbage collection is not implemented.
- The normalized recorded-take row and the embedded `recordedBlocks` artifact are updated through adjacent requests rather than one server transaction. Consolidate this into a single transactional command.
- Whole-project render artifacts still use `.studio-data/`, not MinIO, and there is no durable render-job queue.
- There is no production retry, progress, cancellation, or failure-recovery model for render jobs.
- No trim editor, timeline rearrangement, captions, or take version history exists yet.

### Camera, voice, and automation

- Generated voice exists as guide/final audio, but reliable alignment/lip sync to a real person's silent camera performance is not complete.
- Fish Audio is the only optional remote voice path currently wired.
- OpenAI-assisted theme directions are present, but Gemini generation is not.
- Automated research, cited script generation, avatars, and third-party lip sync remain future milestones.
- Cross-browser camera mirroring and capture output need an explicit test matrix. The preview may be mirrored for natural self-view, while the stored/exported result needs a documented policy.

### Themes and design

- The saved theme library is localStorage-based rather than a normalized database entity.
- There is no automated contrast, overflow, safe-area, or perceptual-quality gate for every selectable combination.
- Some historical UI options were repeatedly reported as visually indistinct or unattractive. Do not add more options until screenshot-based review can prove each is meaningfully different and aesthetically safe.
- The Figma references and screenshots are design guidance, but they are not a complete, production-ready token specification.

### Infrastructure and code quality

- The local server is a monolith containing API, persistence orchestration, producer work, FFmpeg, voice, and theme generation.
- The single SQL migration has no migration-version table/runner lifecycle suitable for production.
- Asset upload is server-proxied; there are no signed upload URLs or object authorization rules.
- No collaboration/Yjs, presence, or conflict resolution exists.
- No production deployment, observability, telemetry, backups, or disaster-recovery path is configured.
- The Vite main bundle needs code splitting.

## 8. Recommended continuation plan

### P0 — protect and harden the existing vertical slice

1. Push `feat/hyperframes-markdown-mvp` and protect the branch.
2. Add Playwright coverage for:
   - new empty block selection and live preview
   - image upload and all curated image layouts
   - camera activation and every presenter layout
   - points/code type-specific options
   - record → review → save block → reload → playback
3. Add server integration tests for asset upload, finalize, commit, range requests, hydration, and replacement takes.
4. Make finalize/commit/project-artifact persistence one transactionally consistent recording command.
5. Add draft expiration and orphan-asset garbage collection.
6. Split `src/main.ts` into editor, project store, live canvas, director controls, recording, timeline, themes, and API modules.

### P1 — production-grade persistence and export

1. Add authentication, workspace/project ownership, and PostgreSQL RLS for hosted Supabase.
2. Add signed object URLs or an authenticated asset proxy.
3. Store whole-project render outputs in MinIO/S3 and persist durable render jobs in PostgreSQL.
4. Add job progress, retry, cancellation, and error recovery.
5. Move saved theme definitions into the database and version their schema.
6. Add take history, trim points, captions, timeline rearrangement, and final-project assembly.

### P2 — human-first AI assistance

1. Build a consented generated-voice workflow around a real on-camera creator:
   - script approval
   - owned voice/reference consent
   - camera performance without microphone
   - timing/alignment assistance
   - replaceable audio without replacing the human image
2. Add Gemini as a validated theme-generation provider alongside OpenAI.
3. Add research and cited script drafting with explicit creator review.
4. Evaluate other voice providers only behind a provider interface and clear consent controls.
5. Evaluate lip sync only for authorized footage and never make avatar replacement the default product experience.

## 9. Visual quality acceptance gate

Before shipping any new selectable option, validate it at minimum with:

- landscape and portrait output sizes
- short and long heading/paragraph/list/code content
- presenter off, circle/tile, rail/split, and full-camera modes where compatible
- light and dark theme palettes
- uploaded media with landscape, portrait, transparent, and very high-resolution sources
- no overflow, clipping, unreadable contrast, rough corners, double borders, unintended stretching, or hidden controls
- clear visible difference from neighboring choices
- identical semantic layout in inline preview, expanded canvas, recorded take, and Hyperframes render

Prefer curated presets built from safe tokens over exposing arbitrary combinations. If an option cannot remain attractive across its supported matrix, constrain its compatibility or remove it.

## 10. Source-of-truth hierarchy

When documents disagree, use this order:

1. Working code and tests on `feat/hyperframes-markdown-mvp`
2. This handoff
3. `apps/studio-v2/README.md`
4. The supplied Figma nodes and screenshots for visual/product intent
5. `docs/plans/hyperframes-markdown-mvp.md` for the original strategy

The plan document contains important intent, but parts are aspirational or superseded by the working prototype—especially recording capture architecture and the amount of provider automation actually wired.

## 11. Handoff checklist

```bash
git switch feat/hyperframes-markdown-mvp
git log -1 --show-signature
git status --short
git push -u origin feat/hyperframes-markdown-mvp
yarn studio:setup
yarn studio:infra
yarn studio:test
yarn studio:build
yarn studio
```

Then open `/studio`, verify database hydration, create and focus a new empty block, upload an image, enable camera preview, record one directed block, explicitly save it, reload, and confirm the timeline still marks it recorded and plays the saved take.
