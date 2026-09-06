# Stage Ownership

> Reference for the `stage-director` skill. Source: *The Motion Decision Core*, sections §16, §17. Read only when the routing table triggers it.

Ownership, planner and editor changes; phases 11–15.

## 16. Ownership, planner and editor changes

**Stage-specific ownership rows (extends §6.1; the core's "rules own every number" row applies unchanged).**

| Decision | Rule | Author | LLM |
|---|---|---|---|
| Base family per block | default from §8.3 | yes (layout picker) | no |
| Layout event at a step | proposed from density/intent | yes | proposes only on a cue phrase, accepted like the camera cue |
| Speaker side, treatment, chip size | tracks / canonical | yes | never |
| Slot kind for an overlay unit; lowerThird role | default per information kind | yes | may name the slot *kind* for a claim, definition or list |
| Overlay content | — | yes | yes (from narration, like swap/count values) |
| Cut-out on/off | matte + perf gate | yes | never |
| Gesture cue binding | — | yes (records it) | never |
| Device, durations, anchors, crop, rects | rule / measured | advanced only | never |

**Planner (§6.3 extended).** Inputs add the base family, the slot inventory as units, the speaker side and a per-sentence "may propose layout cue" flag. Output grows by three things: `stageCue: "show" | "back" | null` per sentence (a proposal), `reveal`/`connect`/`count` on slot ids, `pulse` targets as caption word indices. Errors: overlay outside the inventory, content over the slot's line budget, layout cue without an intent change, > 1 stage cue per beat. Warnings: events per minute, dwell, overlays per 3 s. Verbs: "let me show you / here's / look at this" → show; "back to me / so, in short" → back; "my name is / I'm X from Y" → identity strap; "on my left / right / this one" → gesture proposal.

**Editor affordances.** Layout picker (ten family tiles with the simulated camera; `PRESENTER_LAYOUT_PRESETS`, main.ts 390–409, become aliases; picking writes `stage.base` and the `config.camera` mirror); speaker-frame drag with snapping and the zones drawn; slot picker with the measured device read-only and a "move to calmer zone" suggestion; stage-event chips per step; gesture-cue arming and a planned-vs-recorded replay strip; coach (program view, ghost, countdown, open-side badge in the presenter's terms, "pointed before it was there"); validator panel.

**L10 stage classes.** Errors: hard-zone intrusion, caption-band intrusion by any overlay or chip, PiP over a text unit, hero under the matte, overlay outside its slot, speaker rect over the caption band. Warnings: hands-zone intrusion, glass intersecting the body, dwell < `layout.minDwell`, A→B→A, side flip > 1, events per minute > 4, overlay clearance, tail guard, contrast failure with the escalation path, face lost > 2 s, hard-cut luminance jump (publish/review only), lockstep/two-pulsers/support-amplitude checks.

---

## 17. Build plan addendum (phases 11–15)

| Phase | Deliverable | Files | Notes |
|---|---|---|---|
| 11 | **Stage model and geometry.** Stage types; the family table with fractional geometry, restacks, zones, canonical presenter; derivation from `config.camera` with `legacyGeometry`; write-back table; `stage.content` replaces `frame.slideRectPx`; `Stage.aspect` → project dimensions and the fraction-based scene stylesheet; §15 tokens in the resolver; theme values moved to `themes.ts` | `packages/markdown-composition/src/types.ts`, `presenter-layouts.ts` (family table is the single geometry source; `presenterLayoutGeometry` becomes a thin reader of it, and index.ts's `presenter-*` px CSS is generated from the same table so there is one source, not three), `index.ts`, `slide.ts`, `themes.ts` | No motion; every existing block renders identically |
| 12 | **Overlay/underlay roots, slot units, captions.** `clip` primitive; `space: frame` units with the HTML `xform`/`alpha` exception; slot carriers in the L4 table; `PulseValue.style ring`, `SwapValue.style strike`, `RevealValue.lines type`; the caption element and band; legibility measurement at compile (canonical in the studio), persisted per step; plate spawn | `slide.ts`, `index.ts`, `apps/studio-v2/src/main.ts` (slot picker, overlay inventory) | Needs phase 1 geometry and phase 7 word onsets |
| 13 | **Reframe, capture path, matte canvas.** Implicit `reframe` from `stage.timeline`; make-room and three-phase handoff; stage seams; raw camera + mic recording with the `mediaTime` reference clock; `getUserMedia` fps/resolution constraints; coach layer moved outside the cropped player; mirror preview-only; matte/bed canvas (one geometry writer in DOM); follow-crop; speaker-frame drag; layout picker | `main.ts` (`attachLiveCameraInsideComposition` 616 / `attachLiveCameraToPlayer` 646 become the capture path; recording flow 993–1090; presets 390–409), `slide.ts` (`stage(k,t)`), `index.ts` | Reframe endpoints are clean stills; publish reuses `stage(k,t)` on the raw track |
| 14 | **Takes with tracks, gesture cues, segmentation.** Offline landmark pass (MediaPipe Tasks wasm in Node, or an ffmpeg + python job) producing `Take.tracks`; matte confidence = per-frame mean of 2·|α−0.5| over the body box, rolled per beat; landmarks stored with the take, deleted with it, processed locally unless the project enables the server pass (consent surfaced); `Take.overlays`, `Take.deltas`; precedence; pointing → emphasize; coach ghost/countdown/badge; cut-out with the rehearsal gate; pinned callouts on tracks; alpha export via the frame-exact renderer | `main.ts`, `slide.ts` (anchor combinator), `apps/studio-v2/server/index.ts`, `packages/markdown-composition/src/explainer.ts` | Live segmentation best effort; publish offline |
| 15 | **Planner, validator, review.** Stage cues and slot ops in the planner; L10 stage classes; review frames at reframes ± 0.5 s; reduced-motion and comfort paths; a generated recipe page per slot carrier | `apps/studio-v2/server/index.ts`, `packages/markdown-composition/src/motion-validate.ts`, `main.ts` | Errors block present/publish, never save |

Dependencies: 11 ships alone; 12 needs 1 and 7; 13 needs 12 and the phase-8 frame-transition window; 14 needs the phase-7 take capture; 15 closes the loop with phase 9's harness.

