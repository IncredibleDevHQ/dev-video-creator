# Overlays

> Reference for the `stage-director` skill. Source: *The Motion Decision Core*, sections §9. Read only when the routing table triggers it.

Slots, legibility by measurement, carriers per slot, pinned callouts, the clip primitive.

## 9. Information over the camera stream: the overlay grammar

### 9.1 Overlay slots

A slot is a named rect with a default legibility device and a default carrier. Slots live in the **overlay layer** (an SVG root above the camera, §14) or the **underlay** root (below the camera, `behindSpeaker`); slot members are units of kind `overlay`, so the fold, `reveal`, `count`, `swap`, `exit` and `connect` apply unchanged. Beginners choose a slot kind; rects are advanced-tier.

| Slot | Rect (fractions) | Default device | Holds | Suits |
|---|---|---|---|---|
| `lowerThird` | x 0.05–0.60 (mirrored on a right strap), y 0.72–0.84 (above the caption band, chin gap respected); **identity → speaker side, topic/figure → open side**; text justified toward the strap side | solid card (news) or bottom gradient (documentary); never glass | ≤ 2 lines: name 0.040 H, second 0.028 H (theme) | identity, current step title, a counted figure |
| `sideRail` | open-side column 0.30–0.38 W inside title-safe, items start on the eye row | glass when energy < `legib.energyLow`, else solid | 3–5 items, or one figure + label | bullets, steps, key/value |
| `topBand` | y 0.05–0.16, full width inside title-safe | top gradient | one line, ≤ 14 CJK / 40 latin chars | chapter title, big word |
| `heroLine` | third-line or opposite-half centre per §8.4, ≤ 0.55 W | local flat scrim | one sentence, ≤ 2 lines | thesis, claim |
| `cornerCard` | open-side upper corner, ≤ 0.30 W × 0.28 H, top on the eye row | solid card + shadow | icon + term + 2 lines | definitions, figure + label |
| `pinnedCallout` | label ≤ 0.22 W by the 8-candidate rule; leader ≤ 0.15 W, never through the hard zone | outline text on a pill | dot + leader + ≤ 6 words | a held object, a detail, a port |
| `floatingStack` | open side, 2–4 cards on the reach rows (gesture) or a column | solid cards | 2–4 items | three things, checklist |
| `fullPlate` | (0,0,1,1) at `plate.cover` | opaque plate | 3–5 lines | quote, chapter slab |
| `bug` | action-safe corner **opposite the chip**, 0.05–0.07 W; persists across seams | none | brand mark or chapter signpost (progress) | persistent chrome |
| `ticker` | y 0.90–0.95 H full width (inside title-safe); stream use, off by default; captions move to the top third | solid | one running line | streams |
| `captionBand` | reserved, §8.1 | band 80 % black or outline | captions only | never used by overlays |

### 9.2 Legibility over moving video

Device by measurement: p95 luminance of the candidate rect over the beat (worst case, never the mean) and temporal energy (mean absolute frame difference, normalised). Measured from the take at compile; **canonical values in the studio** (the rehearsed plate may differ from the published one); the chosen device, p95 and energy are **written into the resolved step** so review and publish agree.

| Device | Numbers | When | Realised as |
|---|---|---|---|
| Flat scrim | `scrim.flat` 0.4–0.6 | calm regions | SVG rect in the overlay root |
| Gradient plate | bottom 0→`scrim.gradient` 0.7 over 0.30 H; edge gradient over `scrim.edgeW` 0.35 W (today's `person-background-*::after`); top 0.35→0 at 0.45 H | lower thirds, bands, big words | SVG rect |
| Solid card | opaque; radius/shadow from theme | energy > `legib.energyHigh`; OTS boxes; PiP tiles | SVG rect |
| Glass | backdrop blur 16–24 px @1080 + tint 0.35–0.5 + hairline | side rails and cards over calm backgrounds; **never over the person**; ≤ 1 glass panel ≤ 0.38 W × 0.60 H (its backdrop is live video and re-rasterises every frame); disabled in the studio when the frame budget is missed | HTML plate layer (`backdrop-filter` is unsupported on SVG) |
| Outline text | 2 px stroke + shadow | one or two words, energy < `legib.energyLow` | SVG |
| Bed | camera copy: brightness 0.35–0.50, saturate 0.5–0.7, blur ≥ 20 px; brightness 0.28 when a foreground plate enters | self-bed lists, vertical footage on landscape | HTML plate layer (second `<video>`) |

Rules: contrast ≥ `legib.contrastBody` 4.5:1 below `text.largeH` 0.033 H (36 px @1080), ≥ 3:1 at or above, against p95; on failure **move the slot to a calmer zone first**, then escalate scrim alpha in 0.1 steps to 0.75, then solid. Energy < 0.02 → any device; 0.02–0.06 → glass or scrim ≥ 0.5; > 0.06 (hands, hair) → solid only. Text over video ≥ `text.minOverVideo` 0.022 H, weight ≥ 500, ≥ 0.03 W from the silhouette; accent hue outside the skin band (theme). Dimmed text on a plate is a solid grey (theme), never alpha.

### 9.3 Entrance and exit carriers per slot (L4 appear-by-kind, kind `overlay:<slot>`)

No new operations: each row is a **carrier** the compiler applies to `reveal`/`exit` on an overlay unit.

| Slot | Enter | Exit | Notes |
|---|---|---|---|
| lowerThird | plate `clip` wipe from the speaker side toward the open side, `dur.lowerThirdIn` 300 → name `clip` reveal from 70 % (210 ms) → second line +`lag.label`; text never exists outside the plate | reverse (line → name → plate), `dur.lowerThirdOut` 250; **never a plain fade** | a second strap in the same slot within `lowerThird.refreshWindow` 2 s **refreshes** (text `swap` inside the standing plate); later, full exit → `gap.exitEnter` → enter |
| cornerCard / floatingStack | `alpha` ∥ `xform ty` 12–16 px→0, 350, `ease.enter`; stack members on word onsets | `alpha` ∥ `ty` 0→−12, `dur.exitRatio` | enters from the edge nearest its rest; hand-offs enter from the speaker |
| sideRail | panel `xform tx` **by its own width** from its edge, `dur.panelIn` 450, `ease.camera`; items rise per `stagger.unit` | items reverse, then panel `dur.panelOut` 300 | paired with make-room (§10.2); the panel group is overflow-hidden |
| topBand / heroLine | `alpha` + `ty` −16→0, 350 | previous lifts −14 px and fades 50 ms after the next starts | bg-swap grammar |
| pinnedCallout | `connect` in highlight mode with the `anchor` combinator: dot pop 120 → leader `dash` 250 (45° or horizontal bends) → label `clip` 200 | retract in reverse ≤ 400 | serial, never overlapping |
| count (any slot) | core number carrier (fade-then-count); the landing is the cue onset; unit caption fades 250 after landing | as host slot | tabular numerals; no extra pop (one flourish per beat) |
| fullPlate | `alpha` 0→`plate.cover` 250; lines rise 30 px, `stagger.line`; attribution +200 | plate `ty` +40 + fade 300 | covering the speaker *is* the yield |
| ticker | none; linear `tx` one frame width per 12 s | none | stream only |

### 9.4 Pinned callouts that follow a point

Anchor kinds: `unit` (a content port; moves with the SVG camera), `face` (chin, eye, forehead), `hand` (index tip, wrist, shoulder), `frame`. Tracks come from `Take.tracks`, smoothed offline (critically damped, `anchor.dampMs` 100); the driver never runs a tracker. Placement: 8 candidates around the anchor; first inside title-safe, outside the hard face zone, the hands zone and other overlays, leader ≤ 0.15 W not crossing the hard zone; re-evaluated per frame with hysteresis `anchor.hysteresisMs` 300; anchor off-frame → hold 1 s, then exit. **In the studio there are no tracks yet**: the callout pins to the canonical/static landmark; it follows the hand only in publish and review. Reduced motion pins once.

### 9.5 Primitives, combinators and folded operations

The overlay roots are SVG, so `alpha`, `xform`, `dash`, `content`, `spawn` apply unchanged; `view` never applies (overlays do not zoom). **One new primitive** under the §2.2 rule:

| Primitive | Channel | Arguments | Realisation |
|---|---|---|---|
| `clip` | visible region of a raster or overlay element | `{inset:[t,r,b,l], radius}` (fractions) | `clip-path: inset(… round r)` on the camera container (the one added CSS property; compositor-driven, never layout), `<clipPath>` on overlay groups |

`plate` is **not** a primitive: it is `spawn(kind: plate)` + `alpha` (blur/backdrop are set once at init; only opacity animates). `anchor` is a combinator like `env`/`stagger`: it resolves a moving pivot from `Take.tracks` and feeds `xform` and the leader's `content d`. Segmentation is a media-pipeline property of the speaker unit, never a plan field.

**Exception to N3 (declared, not silent).** `Geometry.units[]` gains `space: "page" | "frame"`. Frame-space units (speaker container, caption words, HTML plates) realise `xform` as `transform: matrix()` and `alpha` as `opacity` on an HTML element, written from the same `t` by the same driver; page-space units keep the SVG matrix on `<g data-motion-wrap>`. Frame-space units are outside `svgHash` invalidation and hash on `stage` instead.

**Operations folded into the core (no new `Action.op`):**

| Previously proposed | Now |
|---|---|
| `lowerThird`, `panelSlide`, `callout` | `reveal` (or `connect`) on an overlay unit; the slot supplies the carrier (§9.3) |
| `pipMove` | `move` with a stage slot as target; resolver rule: growing layer on top, shrinking one delayed 80 ms, paths never cross |
| `ripple` | `PulseValue.style: "ring"` (the L8 downgrade for packed nodes) |
| `strike` | `SwapValue.style: "strike"` |
| `type` | `RevealValue.lines: "type"` carrier for code-line units |
| `keywordPop` | `pulse` on a caption word (kind `caption`), budget `budget.keywordPops` |
| `cover` | a stage event to `takeover` with `plate.cover` |
| `reframe` | resolved-only implicit action (§10.2) |

The core template picker (intent + hero) gains overlay-hero variants: `introduce` with a lowerThird hero, `recap` with a sideRail hero, `three things` with a floatingStack, block kind `quote` → fullPlate, `handoff` → reframe ∥ content reveal from the far side +150 ms. These are not new templates.

---

