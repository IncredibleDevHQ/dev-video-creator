# P0–P3 live acceptance: evidence files

These files support [the evidence write-up](../2026-09-25-p0-p3-review-loop-evidence.md). Everything here came from the product: the desktop app on Claude Code 2.1.280 and Claude Opus 5.5, against a fresh local PostgreSQL + MinIO store. No page, plan, sketch or record was written by hand.

- `captures/` — unmodified window captures (`GET /__capture`).
  - 01–13 come from the live run on `764e79f1`, before the fixes. So 07 still shows the mode switch over the page, and 08–09 show the stage out of view.
  - 14–17 come from the follow-up pass on the fixed build.
- `live-run.json` — the driver's record of the live run: every check with its outcome, stage timings, the runs with the model each requested, the base's pages, the brief, the plans, the preview and the recording guide. The two failed checks are the driver races explained in the write-up.
- `follow-up.json` — the follow-up pass:
  - its 14 checks;
  - the comparison of r2 with r1;
  - the new sketch's packet cast (every reused key carried);
  - the new sketch's manifest layers.
- `records/` — the durable planning records as stored in PostgreSQL:
  - the brief (its source quotations shortened to their first words, so the article is not reproduced here);
  - the token bucket plan r1 and r2 (r2 approved, with its approval pin);
  - the title scene plan r1 (left a candidate);
  - both preview records, with the product's warnings as they were recorded. The placeholder warnings on the previews are the false ones fixed in `8c9f7dea`.
- `sketches/1-before-cast-fix` and `sketches/2-after-cast-fix` — the two sketches exactly as the harness wrote them: `index.html` (the composition), `manifest.json` and the cast SVGs it copied from its packet. The first copied 4, the second 7. They load only `/runtime/gsap.min.js` and `/runtime/hyperframes.iife.js`, which the Studio serves at the pinned Hyperframes 0.7.106. To play one, open it through the Studio's preview route rather than from disk.

Nothing here contains credentials, private model reasoning or Claude session files. The full run directories, including each run's packet, stay in the local acceptance data directory and are not copied here.
