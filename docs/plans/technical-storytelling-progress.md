# Technical storytelling studio — implementation progress

Companion to [technical-storytelling-product-architecture.md](technical-storytelling-product-architecture.md). Newest first. Branch `feat/hyperframes-markdown-mvp`; commits as Karthic <Kartronics85@gmail.com>.

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
