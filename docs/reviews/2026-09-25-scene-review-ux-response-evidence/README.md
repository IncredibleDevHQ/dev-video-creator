# Live check of the review fixes: evidence files

These files support the "Live check on the real harness" section of [the response](../2026-09-25-scene-review-ux-response.md). Everything came from the product, on Claude Code 2.1.280 and Claude Opus 5.5, against the P0–P3 acceptance store (local PostgreSQL + MinIO). No plan, sketch or record was written by hand.

- `live-check.json` — both passes: every check the driver made, and each sketch submission with the product's answer.
  - The first pass prepared the brief again, planned the token-bucket scene (r5) and sketched it. It was accepted on the first submission. Its one failed check is the driver's own selector; the text it looked for is in `review-how-checked.png`.
  - The second pass sketched r5 again after the fix for earlier artwork keys (`c0a9980c`). The pinned lint refused the first submission, for a font with no `@font-face`; the second was accepted.
- `plan-r5.json` — the new plan, as stored: its moments and its ledger. The ledger declares the refill a steady rate (`drip`) and tags the four changes it makes.
- `sketch-1/`, `sketch-2/` — the two accepted sketches exactly as the harness wrote them (`index.html` and `manifest.json`). They load only `/runtime/gsap.min.js` and `/runtime/hyperframes.iife.js`, which the Studio serves, so play them through the Studio's preview route.
  - Sketch 1 drew the request rate limiter as a placeholder: its packet lacked the artwork, the bug fixed in `c0a9980c`.
  - Sketch 2 reuses the cast for all seven objects it takes from the base.
  - In both, the layers carry `data-sketch-layer`, the bucket's level keeps the rig's clip, and the manifest's `schedule` keeps the drip's beat: every 4.4 s from 6.8 s in sketch 1, every 4.5 s from 6 s in sketch 2.
- `proofs.json` — both preview records as stored, with each `verification` proof: the bundle's sha256, the player's length, tween count, frame hashes, re-seeks, where each layer showed, each planned change, and each counted change seen on screen.
- `cast-v2-insides.json` — the two buckets on the real base whose level the extractor now holds inside the shell. Each has its states and what the clip trimmed from the page: 496 pixels on "The token bucket", 186 on "Limit each user".
- `review-how-checked.png` — the scene review's Preview details for sketch 1: how it was checked, and its clock.
- `bucket-fill-inside.png` — sketch 1 at 20.1 s ("tokens: 2"), enlarged: the level follows the bucket's walls.
- `stage-moments.png` — sketch 2 on the Studio stage at the end of each of its seven moments.

The harness's run directories, packets and the app logs stay in the local acceptance data directory. Nothing here contains credentials, private model reasoning or Claude session files.
