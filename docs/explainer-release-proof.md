# Explainer release proof

What was built for `docs/plans/explainer-improvement-first.md`, and how each
gate was checked. Everything here was produced by the studio itself, driven
through its own controls; the harness only clicked them and read the results
back.

## The two explanations

| | Rate limiter | Concurrency limit |
| --- | --- | --- |
| Base notebook | `Scaling Your API with Rate Limiters` | `Concurrency Limits: How a Service Protects Itself…` |
| Video notebook | `… · video` (derived, `Create video`) | `… · video` (derived, `Create video`) |
| Pages and programs | drawn by Kimi K3 through the page-master skill | drawn by Kimi K3 through the page-master skill |
| Objects | `token-bucket`, `server`, `request` | `slot-pool`, `waiting-line` (+ the reference family reused) |
| Artwork | Quiver `arrow-2`, accepted and rigged | Quiver `arrow-2`, accepted and rigged |

The mechanism of the second explanation is the one the plan named: work in
progress occupies a fixed number of slots, work beyond that waits its turn,
and a completion frees a slot for whoever has waited longest.

## What each gate asked, and what answered it

**E1 — a video is a separate notebook.** `Create video` on the base card
writes a derived notebook: `derivedFrom` carries the base's revision and a
snapshot, every scene carries an `origin` naming the base scene it came from,
and the library shows the derivative under its base with `Open base` and a
`base has changed` badge when the base moves on.

**E2/E3 — real artwork, from a brief.** Each object is generated from a
written brief (what it is, the states the scene puts it in, the pieces the
scene moves, where things enter and leave). What comes back is inspected
against that brief: one root, nothing external, the named parts present. A
drawing whose parts are missing gets one bounded repair; a repair that does
not help is discarded rather than accepted quietly. Accepted drawings are
filed under the brief's key, so the same object named twice is drawn once.

**E4/E5/E6 — the drawing takes part in the story.** Parts survive import and
id-prefixing; a quantity is shown the way the artwork can show it (a count, a
level, or pieces that leave one at a time); artwork that animates itself is
seeked from the scene's clock rather than played, so a frame is the same
however it was reached.

**E7 — the presenter stays legible.** Face-safe framing, a caption band that
the page's ink avoids, and a hard fail when a composition would bury the
speaker's face.

**E8 — routine editing preserves the result.** Verified in the app on the
rate-limiter video: an event nudged half a second later in the window drawer,
the presenter layout changed on another line, the pace moved from 150 to 175
wpm, saved, the app restarted cold, reopened — the event ids and the nudge,
the drawn artwork, the authored layouts and the source lineage all came back,
and the exported frames land the nudged event within one frame of where it was
asked for. Changing a line after a take was recorded marks the scene's timing
as needing a look, keeps the take, survives save and reopen, and clears when
the author says so.

**E9 — the second mechanism needed content, not code.** The concurrency
explanation is new source text, a new outline, new pages and programs, and two
new object briefs. It uses the same compiler, the same driver, the same
renderer and the same controls. The one list of drawable objects is shared by
the studio and the drawing agent, and the page checker refuses an object
nothing can draw or a piece an object does not have.

## Known gaps

- **Narration.** A scene's voice comes from a recorded take or the studio's
  own guide-voice route. The videos rendered for this proof carry burned-in
  captions; a take needs a person at a microphone.
- **Nodes drawn before the object rule.** Pages drawn before the contract
  asked for a real column give a drawn object too little room. The studio now
  refuses to wear a drawing that would come out under 48 px a side and says
  which node to widen, and the checker asks for 120 px before the words.
