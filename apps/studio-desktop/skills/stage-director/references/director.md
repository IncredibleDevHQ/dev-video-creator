# Director

> Reference for the `stage-director` skill. Source: *The Motion Decision Core*, sections §28. Read only when the routing table triggers it.

The director: fit measure, scorer, layout track, runtime offers, treatments, rater, guidance, data model, tokens, phases 20–22.

## 28. The director: layout suggestions at runtime, ratings and speaker guidance

Parts II and III fix *what* each layout is and *how* the stage moves between them. This section adds the layer that decides **which view is best for this information right now**, offers the speaker a small set of legal switches while they talk, picks the treatment (information over the camera or beside it), rates any layout with reasons, and guides people who have never thought about what makes a video look good. Everything here is computed from the beat plan, the page geometry and the roster; the speaker only ever chooses among options the director has already checked.

### 28.1 Three functions, one artefact

| Function | When | Output |
|---|---|---|
| **Layout track** | at compile, from the beat plan | per beat: a primary family, up to two alternates with a score and a one-line reason, the switch cost, and the cue at which the change should land |
| **Runtime offers** | while recording, `dir.offerLeadMs` 2000 ms before each planned change and at any time on request | at most `dir.maxOffers` 3 one-tap options: the planned change, its alternates, and the standing escape hatches (speaker full, both full, back to composite, content full), each shown only when legal |
| **Guidance** | before, during and after a take | framing check, per-beat cues in the presenter's own terms, and a post-take report on layout use |

The track is stage state like everything in Part II: it never enters a step, it is materialised as stage events, and the take records what the speaker actually chose (`Take.layout[]`), which then drives publish with precedence over the plan.

### 28.2 What the information needs: the fit measure

For every beat the director measures the information the beat makes visible, using the geometry the atomiser already persists.

| Measure | How | Feeds |
|---|---|---|
| **extent** | union bbox of the beat's visible units (hero, supporting, everything entered so far on this page), as fractions of the page | required area |
| **smallest text** | the smallest font on those units, rendered at each candidate layout's scale (`frame.renderScale` × the layout's content rect) | legibility gate: ≥ `camera.textMin` 18 px at 1080p |
| **density** | units visible after the beat, and new units in the beat | class and hold |
| **structure** | figure / term / list / diagram / code / table / quote (from unit kinds and edges) | candidate families |
| **attention** | camera beat, trace beat, or a hero smaller than 25 % of the page | whether the page must own the frame |

From these, a **required-area class** per beat:

| Class | Condition | Layout candidates (ordered) |
|---|---|---|
| `none` | the beat names nothing (intro, aside, recap of a person) | speaker-full; dual-box / trio-row |
| `slot` | one figure, term, name or a one-line claim; extent ≤ 0.30 W × 0.30 H at legible size | speaker-full + slot (lower third, corner card, hero line); shared card for two speakers |
| `beside` | a list ≤ 5, a small diagram or chart whose smallest text stays ≥ 18 px inside a 0.37 W column | speaker-panel; split; host-guest; split-duo |
| `frame` | a diagram, code, table or list ≥ 6 that needs more than `info.fullThreshold` 0.55 of the frame to stay legible, or any camera/trace beat | content-pip; content-multi; content-cutout when the matte gate passes |
| `takeover` | dense code or a full-bleed figure whose legibility fails with any chip present, or a quote card | takeover |

The class is the first cut. It is never allowed to shrink the person below the presence floor (`dir.presenceMin`: face ≥ 35 % of a chip, or the person deliberately covered by a takeover for ≤ `layout.returnCutAfter` 8 s).

### 28.3 Scoring a layout for a beat

Each candidate layout gets a score from 0 to 100, kept as sub-scores so the reason can be stated:

| Sub-score | Weight | What it measures |
|---|---|---|
| information fit | 0.35 | smallest text ≥ 18 px (hard gate), extent fits the content rect, nothing clipped, no unit under a tile or the caption band |
| presence | 0.20 | face size relative to the frame for this beat class; a person speaking a `none` beat wants full presence, a `frame` beat needs only the chip |
| continuity | 0.20 | dwell since the last change ≥ 4 s, changes per minute within 2–4, no A→B→A within 10 s, side flips ≤ 1 per page, no switch on an interjection |
| legibility over video | 0.15 | for overlays: measured p95 and energy behind the slot (Part II §9.2); for tiles: nothing to measure, full marks |
| composition | 0.10 | free region used before the lower third, eye-line held, open side respected, one hero visible, the taste rules of §15 not broken |

Score = weighted sum, with any failed hard gate (text too small, hard-zone intrusion, presence below the floor) forcing 0. The primary is the highest score; alternates are the next two within `dir.alternateBand` 15 points. Ties go to continuity (stay where you are). Weights are in the lock; an author may shift them (a data-heavy course raises information fit, a talk-show raises presence).

### 28.4 The layout track and its smoothing

After scoring every beat independently the director smooths the sequence like a film editor, not like a thermostat:

1. **Open on the person.** The first `hook.seconds` ≈ 8 s of a scene stay on the speaker family unless the first beat is `frame` and the author insisted.
2. **Merge short stays.** A primary that would hold less than `layout.minDwell` 4 s takes its neighbour's family unless it is a takeover.
3. **Cap the rate.** More than 4 changes per minute → the lowest-gain changes are dropped (the gain is the score difference between the primary and staying put).
4. **Prefer the escape hatch that returns.** A `frame` stretch inside a speaker scene should be entered by a reframe and left by a reframe back to the same family, so the viewer keeps the map.
5. **Close on the person.** The last beat of a page or scene returns to the speaker family (or to the equal family for several speakers) unless the page ends on a takeover on purpose.

The result is the **layout track**: one row per beat with `primary`, `alternates[]`, `switchCost` (the reframe or cut the change implies), and `cueMs` (the onset the change should land on, `ant.reframeLead` 400 ms before the cue word in publish).

### 28.5 Runtime offers: what the speaker sees and may do

While recording, the coach shows two things: the **current** family, and the **next planned change** two seconds ahead as an offer with a countdown ring. At any moment the speaker may also request a change. Offers are keyed 1 · 2 · 3 (hotkey, pedal, or the raised-hand gesture cycling through them), and each offer is shown only when it is **legal**:

| Legality check | Rule |
|---|---|
| dwell | ≥ `layout.minDwell` 4 s since the last change |
| not mid-word, not mid-reframe | a change starts on the next pause or the current reframe's settle |
| presence floor | never a layout that hides a speaking person except a takeover ≤ 8 s |
| speaker count | "both full" exists only with two or three speakers (`dual-box` / `trio-row` from any content family); "you full" for the active speaker means `speaker-full` for one, `dominant` for several |
| information safety | "back to composite" is offered only if the beat's required area is ≤ `beside`; otherwise the offer is "content full" |

The standing escape hatches, always evaluated:

- **you full** — `speaker-full` (one speaker) or `dominant` on the active speaker (several); the page's overlays fold to a slot if the beat is `slot`, otherwise they clear;
- **both full / all full** — the equal family for the roster;
- **back to composite** — the page-plus-speaker family the track had before the last escape;
- **content full** — `content-pip` (or `content-multi`), the chips one size class smaller.

A choice becomes a stage event through the ordinary reframe (Part II §10), is recorded in `Take.layout[{atMs, family, source: hotkey | pedal | gesture | auto | plan}]`, and wins over the plan at publish exactly as a recorded Next wins over a word onset. In **auto** mode the director executes the primary track itself (self-running or unattended recording); in **assist** mode it only offers; **off** keeps Part II behaviour.

### 28.6 Overlay or separate canvas: choosing the treatment

When the class is `slot` or `beside`, the information can go **over** the camera or **beside** it. The director decides from the free region (Part II §8.4, Part III §20.3) and the measured legibility:

| Condition | Treatment |
|---|---|
| free region ≥ the information's extent at legible size, energy < `legib.energyLow`, one speaker | **overlay**: information in the free region on a scrim or glass; the person stays full frame |
| the same with energy ≥ 0.06 (hands, hair, moving background) | **bed**: the camera becomes a blurred, darkened bed behind the information (Part II `bed`), with the person still visible at 0.28–0.5 brightness |
| free region too small, or the information has structure (diagram, chart) | **separate canvas**: speaker-panel, split or content-pip; the person is a video tile, never covered |
| a hero number, a quote, a chapter word with the person present | **glow-bed hero**: full-frame person, the bed treatment at `bed.brightness` 0.35, one display element with a soft glow, nothing else; the "impressive" case, allowed once per scene (`dir.heroMomentsPerScene` 1) |
| a cut-out is available and the free region is behind the person | **text behind** (Part II §9 `behindSpeaker`) |

The director never uses a translucent card on a face, never scales a person to fit a column, and never chooses glass when the frame budget failed at rehearsal. Each choice is stored with its measurements so publish and review agree.

### 28.7 Rating a layout: the rater's output

The same scoring runs on demand: in the editor's layout picker (each family tile shows its score for the selected beat), in the post-take report, and through `/api/layout/rate`. Its answer is always the four things a person can act on:

```
score 74 · content-pip · beat B04 (diagram, 11 units)
  information fit 31/35  smallest text 21 px ✓ · nothing clipped ✓ · one unit under the chip ✗ (move chip to the left)
  presence        12/20  chip S: face 33 % of chip (floor 35 %) → chip M
  continuity      20/20  dwell 6.2 s · 3 changes/min
  legibility      15/15  no overlay
  composition      6/10  chip on the hero's side → move to the open side
  better: content-pip, chip M on the left → 88
```

The "better" line is the highest-scoring neighbour reachable by one change; it is what the picker suggests and what the coach says in words.

### 28.8 Guiding speakers who have never thought about it

The director speaks to the presenter in five rules, then in cues. The rules, shown once before the first take:

1. **Open on you.** The first eight seconds belong to a face, not a slide.
2. **Hand the frame to the material when it needs it.** A diagram, code or a table gets the whole screen; you become a small picture and that is right.
3. **One change per idea.** The picture changes when the idea changes, not while you breathe.
4. **Never talk over a change.** Let the frame settle in the pause before the word.
5. **Come back to close.** End on a face.

**Framing check (before the take, from the camera and the microphone).** Face size (target width 0.14 W chest-up), headroom (8–12 % of the crop), eye row (≈ 0.38 of the crop), sit to your own right so you land viewer-left, luminance and skin exposure (no overlay colour in the skin band), background energy (a calm background allows overlays; a busy one forces tiles), mic level. Each becomes one plain cue: "sit a little higher", "move a step left", "your background is busy: information will sit beside you, not over you".

**Per-beat cues (during the take, from the layout track).** "Intro on you, 8 s." · "In two seconds the diagram takes the frame; pause." · "You can point at the card on your right." · "Hand over to Ben." · "Back to you to close." Cues are preview-only (Part II §10.5), never recorded, and each is phrased in the presenter's own left/right.

**Post-take report.** Layout use over time, dwell violations, moments where the smallest text fell under 18 px, moments where a speaking person was hidden, escape hatches used and whether the track agreed, and the three highest-gain improvements ("take 2: let the table go full at 01:12; you kept the split and the numbers were 13 px").

### 28.9 Data model, tokens, ownership, validation, phases

**Schema (additive).**

```json
{
  "$defs": {
    "LayoutOffer": { "type": "object", "properties": { "family": { "$ref": "#/$defs/LayoutFamily" }, "score": { "type": "number" }, "reason": { "type": "string" }, "kind": { "enum": ["planned", "alternate", "escape"] } }, "required": ["family", "score", "kind"] },
    "LayoutTrackRow": { "type": "object", "properties": {
      "stepId": { "$ref": "#/$defs/Id" }, "class": { "enum": ["none", "slot", "beside", "frame", "takeover"] },
      "primary": { "$ref": "#/$defs/LayoutFamily" }, "treatment": { "enum": ["overlay", "bed", "separate", "glow-bed-hero", "text-behind"] },
      "alternates": { "type": "array", "items": { "$ref": "#/$defs/LayoutOffer" }, "maxItems": 2 },
      "switchCost": { "enum": ["none", "reframe", "cut"] }, "cueMs": { "type": "number" },
      "scores": { "type": "object", "additionalProperties": { "type": "number" } } }, "required": ["stepId", "class", "primary"] },
    "Director": { "type": "object", "properties": {
      "mode": { "enum": ["off", "assist", "auto"], "default": "assist" },
      "weights": { "type": "object", "properties": { "fit": { "type": "number" }, "presence": { "type": "number" }, "continuity": { "type": "number" }, "legibility": { "type": "number" }, "composition": { "type": "number" } } },
      "track": { "type": "array", "items": { "$ref": "#/$defs/LayoutTrackRow" }, "readOnly": true } } }
  }
}
```

`Stage` gains `director`; `Take` gains `layout[{atMs, family, source}]`; the resolved stage snapshot records the row that was in force and the measured treatment.

**Tokens.**

| Token | Value | Source |
|---|---|---|
| `dir.offerLeadMs` | 2000 | teleprompter practice |
| `dir.maxOffers` | 3 | one glance |
| `dir.alternateBand` | 15 points | ours |
| `dir.presenceMin` | face ≥ 35 % of a chip; a speaking person hidden only by a takeover ≤ 8 s | Part II |
| `info.fullThreshold` | 0.55 of the frame at legible size | ours |
| `info.textMin` | 18 px @1080 (`camera.textMin`) | Part II |
| `dir.heroMomentsPerScene` | 1 | taste |
| `dir.weights` | fit 0.35 · presence 0.20 · continuity 0.20 · legibility 0.15 · composition 0.10 | ours; author-adjustable |
| `hook.seconds` | ≈ 8 s open on the person | talkcraft; Part II |
| reused | `layout.minDwell` 4 s, `layout.abaWindow` 10 s, 2–4 events/min, `ant.reframeLead` 400, `legib.energyLow/High`, `bed.*` | Parts II–III |

**Ownership.**

| Decision | Rule | Speaker (runtime) | Author | LLM |
|---|---|---|---|---|
| required-area class, scores, track, treatment | ✓ | — | weights, mode | never |
| which offer to take, and when | legality only | ✓ | — | never |
| escape hatches available | ✓ | uses | may disable | never |
| framing and per-beat cues | ✓ | — | — | may phrase a cue from the narration ("when I say 'look here'") |
| glow-bed hero moment | proposes ≤ 1 per scene | — | ✓ accepts | proposes on a cue phrase |

**Validator additions.** Errors: a track row whose primary fails a hard gate; an offer shown while illegal; a recorded layout event that hid a speaking person for more than 8 s. Warnings: track changes per minute outside 2–4 after smoothing; a `frame` beat kept in a `beside` family (text under 18 px); a hero moment more than once per scene; the take disagreeing with the track in more than half the beats (the weights may be wrong for this presenter).

**Build plan addendum (phases 20–22).**

| Phase | Deliverable | Files |
|---|---|---|
| 20 | fit measure, required-area class, scorer, rater endpoint, layout picker scores | `packages/markdown-composition/src/director.ts` (new), `slide.ts` (geometry access), `apps/studio-v2/server/index.ts` (`/api/layout/rate`), `main.ts` (picker) |
| 21 | layout track with smoothing, treatment choice, coach offers with legality, hotkeys/pedal/gesture, `Take.layout`, auto/assist/off | `director.ts`, `main.ts` (coach, recording flow), `slide.ts` (`stage(k,t)` reads the track) |
| 22 | framing check, per-beat cues, post-take report, validator classes | `main.ts`, `motion-validate.ts`, `server/index.ts` |

Dependencies: 20 needs Part II phase 11 (stage model) and Part I phase 1 (geometry); 21 needs Part II phases 13–14 (reframes, takes) and Part III phase 17 for several speakers; 22 closes with the review harness.

### 28.10 Worked examples

**(a) One speaker, one big diagram.** Beats: B1 intro (`none`) → B2 names the encoder (`frame`: 11 units, smallest text 21 px only at content-pip) → B3–B5 trace and camera (`frame`) → B6 recap (`none`). Track after smoothing: speaker-full for 8 s → reframe to content-pip at B2's cue minus 400 ms (chip S on the open side) → stays through B5 (continuity beats the momentary score of a takeover in B4) → reframe back to speaker-full for B6. Offers at B2: planned content-pip (score 86), alternate takeover (74, "diagram legible at any size, but you disappear"), escape "you full" (illegal: information would fall under 18 px; shown greyed with the reason).

**(b) Two speakers, an interview with one table.** Track: dual-box (open on both) → shared card in the centre column for a figure (`slot`, treatment overlay is impossible on tiles, so shared card) → content-multi when the table is named (`frame`) → dual-box to close. Runtime: while both discuss the table the host takes "both full" for 12 s; the take records it; publish shows the table returning at the next cue because the beat's class is still `frame` and the escape's dwell expired. The report flags nothing: the escape was legal and the return was planned.

**(c) A quote with the person present.** Beat class `slot`, one speaker, calm background (energy 0.012), free region on the open side 0.42 W. Treatment: the director proposes the glow-bed hero (bed brightness 0.35, one line at 0.05 H with a soft glow, the person visible behind it), score 91 against overlay-on-scrim 79 ("a scrim on a calm background wastes the room the speaker leaves"). The author accepts; the track marks it as the scene's one hero moment.

---

# Part VI · Product design and build stages

