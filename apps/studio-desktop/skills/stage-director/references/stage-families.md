# Stage Families

> Reference for the `stage-director` skill. Source: *The Motion Decision Core*, sections §8. Read only when the routing table triggers it.

L0: frame contract, the ten families, restacks, the default selection rule, zones and eye-line.

## 8. Stage layout: the presenter as a first-class layer (L0)

§1–§7 assume the frame is the SVG page. This section adds one decision level **above L1**, **L0 — Stage layout**: how the camera stream, the content layer (the SVG page or a block render) and an overlay layer share the frame. Four rules follow from the preamble facts and are not re-litigated below:

- L0 is a **stage state**, not an operation, and not a clock. Like `frame.slideRectPx` it is a compile input the plan never edits; a layout change is *scheduled* on the same cues the steps already use (Step.id, take `atMs`, word onsets). **No authorable `Action` carries stage state**: `reframe` exists only as a resolved, implicit action materialised from `stage.timeline` (like the camera release), never written by an author or the planner.
- The speaker is **chrome** for L8: never dimmed, never in "others", never the hero of a content action; it is a unit of kind `speaker` so the validator can reason about its rect and zones.
- Motion is downstream of the still (fact 1): each family is a static contract; `reframe` animates between two settled layouts and every endpoint is a clean still.
- Numbers live in §15 (motion and geometry) or in the theme (static design: radii, shadows, colours, type sizes). Where this section quotes a number it cites §15.

**Scope.** Single presenter. A two-shot (`dual-box`: two 0.47 W 4:5 tiles, eye rows aligned, a name under each, one face zone per tile, identity straps under their own tile) is named here as the next family and is **out of scope** for phases 11–15; nothing below assumes two faces.

### 8.1 Frame contract and safe areas (inputs L0 reads)

| Input | Value (fractions of the frame) | Source |
|---|---|---|
| Action-safe / title-safe insets | `safe.action` 0.035 / `safe.title` 0.05 each edge; all text inside title-safe | SMPTE ST 2046-1 / EBU R95 |
| Caption band | `caption.band` y 0.85–0.95 H (ends on the title-safe line), x inside title-safe; glyph `caption.fontH` 0.036 H, leading 1.2, band pad 0.01 H ⇒ exactly two lines fit; reserved in every family; only a ticker displaces captions (to the top third) | BBC/Ofcom, Netflix; talkcraft y ≥ 900 @1080 |
| 9:16 reservations | `safe.vertical` top 0.09, bottom 0.22, right 0.13 (reaction column). Bottom-left is the platform's username/caption zone, i.e. the *busiest* zone: persistent items sit just **above** 0.78 H on the left. Overlays and captions subtract the reservations; the speaker video may run under platform UI | platform templates; talkcraft host-footage §5 |
| Speaker frame source | capture fps an **integer multiple** of project fps (60→30 by decimation is fine; 30→24/25 never); geometry as fractions of the capture frame; visible video inset ≥ `capture.edgeInset` 0.032 of source W when a matte is used; supported project rates 24 / 25 / 30 / 50 / 60 | talkcraft host-footage §1, §4; EBU |
| Face and hand zones | §8.4 | talkcraft face_bbox.py; broadcast |
| Reading direction | LTR: default speaker side viewer-left for new stage blocks (reading runs speaker → information); RTL projects flip the default; strap text is justified toward the strap's own side (left-justified on a left strap, right-justified on a right strap) | typographic practice |

Today's `presenterLayoutGeometry` (packages/markdown-composition/src/presenter-layouts.ts) already expresses camera and content rects as percentages; L0 keeps that shape and adds slots, zones and treatment. (The 12-column grid is dropped: no family geometry falls on its spans.)

### 8.2 The layout families (ten families, two aspect restacks, one slot)

Geometry is (x, y, w, h) as fractions of the frame; "open side" is defined in 8.4. `today` names the existing `PresenterLayoutMode` a family absorbs. All 16:9 unless stated.

| # | Family id | Geometry | Speaker treatment | Suits | talkcraft / today |
|---|---|---|---|---|---|
| 1 | `speaker-full` | camera (0,0,1,1); speaker occupies one vertical third; overlays only in the other two thirds, inside title-safe | video; bed darkening under overlays only | 0–2 small units per beat (term, figure, name, one-line claim); a deck's first and last sentence | FULL/HALF host, nameplates, keyword-pop / `person-only`, `person-background-*` |
| 2 | `speaker-panel` | camera column `panel.speakerW` 0.56 W full height (crop ≈ 1:1, chest-up) or `panel.tallSpeakerW` 0.42 W (crop exactly 3:4); panel x ∈ [col + `gap.gutter`, 0.95], **top-aligned on the eye row** | video in its column; 0.06 W edge scrim toward the panel | 3–5 bullets, one figure + label, a three-step list, a small chart | half split, split-60-40-story / — (new for legacy blocks; see §13.2) |
| 3 | `split` | two 0.5 W columns, gutter 0.02 W; camera cropped 8:9 | video in a rounded card | contrast beats, code beside the person, a screenshot | split-60-40 vertical / `split` |
| 4 | `content-pip` | content full or the page rect; chip Ø `chip.diameter` S/M/L 0.14/0.18/0.22 W, side inset 0.042 W, **bottom ≤ 0.84 H** (`chip.bottom` 0.16 H, clear of the caption band; today's circle bottom is 0.843 H); or a 16:9 tile `pip.tile` ≥ 0.26 W head-and-shoulders (0.20 W only with a head-only crop); corner inside action-safe, centre in the lower third, opposite to the hero and to the brand bug | card with radius 0.5 (circle, hairline ring on light pages) or rounded tile | everything the page core does: diagrams, traces, camera pushes, code | host-shrink-to-chip / `information-circle`, `information-tile` |
| 5 | `content-card` | content left `(0.07,0.16,0.60,0.68)`; portrait card right, `card.w` 0.245 W × 0.60 H (overlay) or 0.31 W × 0.90 H (rail), top on the eye row | video in a rounded card | dense content that must stay legible beside a persistent, larger presenter | — / `portrait-overlay`, `portrait-rail` |
| 6 | `content-cutout` | content full; segmented presenter 0.55–0.70 H tall at a bottom corner; footprint ≤ 0.30 W; pad 0.04–0.06 W | cut-out (per-beat matte minimum ≥ `cutout.minMatte`); falls back to 4 at compile | gesture-heavy explanation over a diagram; "standing in front of the material" | segmented cut-out (route B), behind-text-title / — |
| 7 | `ots-box` | speaker left 0.55 W (head in the left third); box `ots.box` x 0.57–0.93 W, **0.36 W × 16:9** (y 0.10–0.46 H), aspect may follow the content; top aligned with the head top | video | one evidence item: screenshot, small chart, magnified page detail | pip-zoom-box, media-pop-in / — |
| 8 | `takeover` | content (0,0,1,1); camera hidden or under an opaque plate (`plate.cover` ≥ 0.9) | none (voice continues; return within `layout.returnCutAfter` 8 s is a reframe, later a cut) | dense diagram or code; quote card; chapter slab | quote-card, chapter-title-card / `position: hidden` |
| 9 | `gesture` (weatherman) | camera full; cards inside the reach envelope: y ∈ shoulder ± 0.25 H, x within 0.35 W of the near shoulder, open side; head row above the head with ≥ 0.033 H clearance | video or cut-out; program (un-mirrored) self-view forced | 2–4 parallel items the presenter points at; three cards; three strips; bg-swap big word | parallel-items ①②⑤⑦ / — |
| 10 | `speaker-card-board` | 9:16 speaker card 0.26 W × 0.82 H at the left third; board right 0.59 W; dark stage | rounded card, video 106 % height (viewfinder crop); never perspective-transformed | workflows and toolchains; vertical-original footage on a landscape frame | host-card-glass-board (layout only) / — |

**Aspect restacks** (`Stage.aspect`, not families): `9:16` — usable band y 0.09–0.78 after reservations; content top 0.09–0.40 H, speaker 0.40–0.78 H (video may bleed to the bottom edge), captions over the chest at y 0.68–0.76 H, chip bottom-left just above 0.78 H; split → media top / chips bottom; board → card top 40 % / board bottom 60 %. `1:1` — speaker top 0.5 H (crop 2:1, eyes at 0.38 of the crop), content bottom 0.5 H, captions at y 0.86–0.94; or family 4 with a 0.22 W chip. Talkcraft has no 1:1 guidance; it is derived from 9:16 by rule.

**The lower third (and ticker) is a slot**, §9.1, composable with 1, 2, 5, 7, 9.

### 8.3 Default selection rule (rule; author override; planner only on cue)

Inputs: block kind, information density of the step (units the beat names), intent (L2), the take's gesture state (`Take.tracks.hands`, or the canonical presenter), aspect, and the **matte/perf gate** (a cut-out is allowed only when the per-beat matte minimum and the rehearsal frame budget both pass).

1. **Density first.** Hero absent or 1–2 small units → `speaker-full` + a §9 slot. Hero is a structure or ≥ 3 units → `content-pip`. Trace or camera beats → `content-pip` with the chip one size class smaller, or `takeover` when the camera rect would cover the hero.
2. **Intent second.** `contrast` → `split`; `introduce` on the first beat and `recap` on the last → `speaker-full` or `speaker-panel`; `quantify` with one figure → `speaker-full` + lower third count; `locate` → `content-pip`.
3. **Block kind third.** title / quote → `speaker-full` (+ heroLine or fullPlate); list ≤ 5 items → `speaker-panel`; list ≥ 6 → `content-pip`; code → `split` or `content-pip` (never 1); image / screen → `ots-box` for a glance, `content-pip` to keep it; slide → `content-pip` unless rule 1 says otherwise.
4. **Gesture fourth.** A pointing excursion ≥ `gesture.dwell` in the beat → prefer `gesture` or `content-cutout` (gate permitting); with no take the planner may *propose* `gesture` only on "this one / here / on my left".
5. **Rhythm caps** (L1 deck rhythm): dwell ≥ `layout.minDwell` 4 s; ≤ 1 change per beat; no A→B→A within `layout.abaWindow` 10 s unless B is a takeover; 2–4 layout events per minute; ≤ `layout.sideFlipsPerPage` 1; the first ~8 s of a deck are spoken on the person before any shrink.

The rule picks; the author overrides in the layout picker; the model may only propose on a cue phrase (§16).

### 8.4 Eye-line, open side and zones

- **Canonical presenter** (used when no take exists), per crop tier, as fractions of the frame: *chest-up* (families 1, 2, 5, 7, 9): face box centre (x on the speaker-side third, 0.44 H), width 0.14 W, height 0.19 H, eyes at 0.38 H, head top at 0.30 H; *waist-up*: face width 0.10 W, eyes at 0.34 H; *head-and-shoulders* (chip): face ≥ 35 % of the chip height, eyes at 0.38 of the crop. **One anchor definition**: the face-box centre; the eye row is derived (centre − 0.06 H at chest-up). The webcam presenter sits in the middle of the source; in `speaker-full` the app applies a source crop of ≤ 0.15 W only when the measured face is inside the middle band and the source has the resolution; otherwise the coach instructs "sit toward your own right so you land on the viewer's left".
- **Face zone, hard.** Face box × `nogo.faceScale.w` 1.5 wide, × `nogo.faceScale.h` 2.0 tall upward (hair), plus neck (down to 1.4 × face height below the centre), plus `nogo.margin` 0.05 W; union over a rolling window of the beat, never the whole take. Nothing enters it at any instant — text, plate, chip, caption, leader: an L10 **error**.
- **Face zone, soft (torso).** From the hard zone's bottom to the frame edge, the torso width. Plates and identity straps **may** sit here (broadcast lower thirds are over the torso); text avoids the hands zone.
- **Hands zone** (when `Take.tracks.hands` exist): wrist-to-fingertip box + 0.03 W margin, rolling window; slots must avoid it independently of the energy meter; an L10 warning.
- **Face lost.** No face for ≤ `face.holdMs` 2000 → zones freeze at the last rolling value; longer → canonical presenter; the validator emits "face not found > 2 s" as a warning and never shrinks a zone to nothing. Two faces → the larger box is the speaker; a warning names the scope limit.
- **Speaker occupies one vertical third**; the **open side** has more free width after the hard zone. Override when the median head yaw over the page exceeds ± `gaze.yawSide` 10° toward the other side, or the dominant gesturing hand is on the other side. Legacy blocks keep their camera-right presets (§13.2).
- **Lead room.** With the head turned, ~1/3 of the frame stays in the nose direction; the panel goes there.
- **Eye-line.** The **top** of an information block sits on the eye row (`crop.eyeLine` 0.38 of the crop). Lower thirds clear the chin by `lowerThird.chinGap` 0.05 H. OTS boxes align their top to the head top. A **heroLine** is centred on whichever third-line (0.33 / 0.67 H) is free of the face; if the face fills the middle band it goes to the opposite-half centre (x 0.25 / 0.75 W) on a local plate — never a corner pill.
- **Head room** 8–12 % of the crop height; the face is never cropped by a form's edge (shoulders may be); a person is never scaled down to fit a column.
- **Gaze mode.** Direct address: overlays anywhere on the open side. Referential (yaw excursion > `gaze.yawCue` 20°): the overlay lands on the gaze side within `gaze.window` 300 ms; the side never flips within a page to chase one glance.

---

