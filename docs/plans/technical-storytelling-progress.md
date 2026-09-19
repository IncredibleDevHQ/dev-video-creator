# Technical storytelling studio — implementation progress

Companion to [technical-storytelling-product-architecture.md](technical-storytelling-product-architecture.md). Newest first. Branch `feat/hyperframes-markdown-mvp`; commits as Karthic <Kartronics85@gmail.com>.

## 2026-09-19 — D2 slice 1: story records

**Commits**

- `11d3e4f1` — narrative revisions + explanation models. `studio_narrative_revisions` / `studio_explanation_models` (migration 005, content-addressed, immutable; KV variant on the file backend). Narrative reads persist the author's text under the chosen wording policy (policy is part of the record's identity). New `/api/story/model` turns an outline into claims/objects/relations with stable positional scene ids, cross-scene object identity, object-id relations, and illustrative flags — persisted and returned. Wording policy threads into the outline prompt. Notebooks pin `project.story = { wordingPolicy, narrativeId, modelId }`. UI: wording segment in the source dialog (narrative → "Keep my wording" default, link → draft, always changeable).

**Checks:** 6 new unit tests (studio-v2 suite now 95); `story-records-check.mjs` 10/10 (policy-as-identity, duplicate-title uniqueness, shared object identity, idempotent model, UI defaults).

**D2 remaining:** page-master explanation-form selection + varied constructions; moving outline assistance into the self-contained local harness workflow (the server model-gateway path is still in use today); base draft/revision persistence beyond the notebook row.

## 2026-09-19 — D1: durable theme library + source capture

**Commits**

- `12a55cc7` — theme library in the durable store: `studio_themes` + `studio_theme_revisions` (migration 003), content-hash idempotence, revision badges, one-time browser-cache import, failed durable saves say so. File backend keeps the same contract over its settings KV.
- theme→wireframes/briefs — `sourceMakePages`/`sourceDrawPages` derive palette + light/dark mode from the chosen direction instead of forcing `mode: 'dark'`; `/api/appearance/*` accepts a validated palette override that lands in the brief (and its cache key); burned captions use theme CSS vars.
- source revisions — `studio_source_revisions` (migration 004), content-addressed immutable snapshots captured in `/api/source/read`, optional **Brand website** for pasted narratives (kept separate from content; fails soft), `project.source.snapshotId`, revision id shown in the brand step; `GET /api/source/revisions/:id`.

**Acceptance checks (D1)**

- Theme survives an app restart on a different port; palette edit creates rev 2 with rev 1 retained — `theme-library-check.mjs` 8/8. ✔
- Light palette reaches wireframe SVG unforced; dark still darkens — `source-capture-check.mjs` 8/8. ✔
- Every read captured immutably; identical re-read is a no-op; creator's words verifiable from the stored revision; unreadable brand URL warns without touching the narrative. ✔
- Quiver palette threading is typechecked and brief-key covered; a live provider run is pending Quiver key availability (none exercised here).

**Not done / notes**

- Saved-theme → brand/site association and the three explicit brand choices (saved / from website / from colors) beyond the current directions UI remain open; the store has `site` for it.
- `pageBrandFrom`'s `auto` mode still always darkens; all product callers now pass an explicit mode.

## 2026-09-19 — D0a: PostgreSQL and MinIO are authoritative

**Commits**

- `4d9ac770` — desktop worker selects postgres unless `STUDIO_PERSISTENCE=local` is explicit; smoke requires the postgres/minio health report; storage warning banner with retry; build copies SQL migrations for the bundled worker.
- `5f0a7a91` — tracked ordered migrations (`studio_schema_migrations` ledger, `002_asset_lifecycle.sql`); asset upload lifecycle pending → byte-verified → ready with startup reconciliation; global library assets (no notebook owner) get first-class rows.
- `d3e995eb` — exported MP4s registered in MinIO with verified asset rows; render response carries the durable reference.
- importer — `inspectLocalStore`/`importLocalStore` in `persistence-pg.ts`, `GET|POST /api/migrate/local`, UI banner driven by *pending* notebooks (idempotent, non-destructive; ids and object keys preserved so takes keep resolving).
- backup/restore — `apps/studio-v2/scripts/studio-backup.mjs` + root `studio:backup`/`studio:restore`; manifest with per-object sha256; restore replays migrations onto fresh volumes.

**Acceptance checks (D0a)**

- Desktop smoke + product test 7/7 with health `postgres`/`minio` (`bash-mqzda2lf`). ✔
- Existing work imports with a report; re-import is idempotent; source files untouched — `migration-check.mjs` 10/10. ✔
- Verified backup restores into a fresh database + bucket: row counts and object checksums match — `backup-restore-check.mjs` PASS. ✔
- No silent file fallback (banner + smoke), global asset rows always written, pending uploads reconciled at startup. ✔
- `local-store-check.mjs` keeps the file backend green as an explicit opt-out. ✔

**Not done / notes**

- Harness run directories are still the working copy; durable per-stage checkpointing of accepted harness artifacts is D3's workflow coordinator (exports and library artwork are durable today).
- Browser `localStorage` custom themes move to PostgreSQL in D1 (the importer covers notebooks/objects/takes/settings, not browser state).
- `docs/DEVELOPMENT_HANDOFF.md` and earlier sections of `TEST-REPORT.md` describe the pre-switch file store; the 2026-09-19 addendum marks them.

## 2026-09-19 — D0: wrong-path trap removed, baseline established

**Commits**

- `9ddab44f` — legacy diagram tool renamed **Basic diagram** (slash menu, block chrome, wizard, shape collection, timeline meta, director note, toasts). Block type ids and `/api/explainer/*` endpoints unchanged.
- `e2ede25e` — **Create explainer** entry (commandbar + empty state) with two equally prominent paths, *Present it myself* and *Generate automatically*, and independent material selection (link, own narrative, this notebook's base). The choice is recorded as `project.explainerDelivery` (`human | generated`), remembered per notebook, never assumed.
- `ffb4b87d` — `harness:artefacts` also reads an explainer run's `receipt.json`/`export.json`; the build panel renders them after a verified run (scenes applied, export duration vs reviewed scene hashes, reviewed-MP4 link). Page-draw receipts surfaced in the source flow.
- `09f3f309` — Publish labels its result: *reviewed explainer export* only when every video scene carries the rich build's `explainer.reviewed` stamp, otherwise a visible *draft export*. Library badges: **Base** on roots, **Draft/Reviewed** on derived videos next to the lineage badge.

**Acceptance checks (D0)**

- Both delivery paths discoverable without a blog or a pre-existing automatic video — Create explainer dialog, two path cards, "My own narrative" material. ✔
- The rectangle-producing action is now visibly a basic diagram; it cannot report a completed rich explainer (no path to `explainer_finish`). ✔
- An MP4 render alone cannot advance rich-build status — Publish labels derive only from the reviewed stamps the rich build applies. ✔
- Rich completion still routes through `reviewExplainer` proofs + `verifyExplainerExport` in `run-manager` (unchanged); its receipts now reach the UI. ✔
- Tests: `yarn studio:test` (94 unit tests + studio-v2 typecheck) green; `studio-desktop` build + smoke + product test 7/7; new `scripts/create-explainer-check.mjs` journey check.

**Not done / notes**

- The human path records the choice and routes into the shared rich build; scene-by-scene recording, takes and coaching are D3/D6.
- Draft/Reviewed badge state is computed per card from saved scene stamps; fine at library scale, revisit if the listing grows.
- Pre-existing: `markdown-composition` `tsc --noEmit` fails on `derive.test.ts` (`BlockRenderConfigV1.blockId`) on the base commit; not part of `studio:test`, left as-is.

## Next up

- **D0a** — PostgreSQL/MinIO authoritative: `worker-host.ts` still forces the file backend (`persistence: 'local'`; smoke probe reports `database: "files"`). Tracked migrations, global asset rows, upload reconciliation, importer, backup/restore.
