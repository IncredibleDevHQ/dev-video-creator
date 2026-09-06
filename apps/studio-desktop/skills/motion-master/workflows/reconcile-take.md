---
description: Make a recorded take the clock of an existing plan — steps, overlays, layout events, tracks, sync.
---

# Reconcile Take

🚧 GATE: `motion/resolved.json` exists and a take folder exists (`takes/<id>/` with camera, mic, `steps[]`).

1. Run `take_tracks` (offline): word onsets from the transcript, face/hand tracks, per-speaker turns, feed offsets against the host camera's first frame (`sync.tolerance` 40 ms; re-sync by cross-correlation).
2. Precedence: recorded Next / trigger > pointing excursion > head-yaw excursion > word onset > formula. Apply per beat; write `Take.steps`, `Take.overlays`, `Take.layout`, `Take.turns`, `Take.deltas`.
3. Re-run `resolve --take <id>`: landing-aligned cues, holds absorb the difference, layout events from the take win over the track.
4. `validate --stage final`; errors for a duty before its unit entered, a hidden speaking person > 8 s, a feed out of tolerance.
5. `frames` for review at every reframe ± 0.5 s; hand the take-bound resolved plan to publish.
