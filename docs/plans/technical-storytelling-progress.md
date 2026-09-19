# Technical storytelling studio — implementation progress

Companion to [technical-storytelling-product-architecture.md](technical-storytelling-product-architecture.md). Newest first. Branch `feat/hyperframes-markdown-mvp`; commits as Karthic <Kartronics85@gmail.com>.

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
