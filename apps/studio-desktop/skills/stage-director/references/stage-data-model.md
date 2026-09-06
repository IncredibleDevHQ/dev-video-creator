# Stage Data Model

> Reference for the `stage-director` skill. Source: *The Motion Decision Core*, sections §13. Read only when the routing table triggers it.

Schema additions, compatibility, worked examples.

## 13. Data model extension

### 13.1 Schema additions (`incredible-studio/slide-motion/v2`, additive)

```json
{
  "properties": { "stage": { "$ref": "#/$defs/Stage" } },
  "$defs": {
    "Fraction": { "type": "number", "minimum": 0, "maximum": 1 },
    "FRect": { "type": "object", "properties": { "x": {"$ref":"#/$defs/Fraction"}, "y": {"$ref":"#/$defs/Fraction"}, "w": {"$ref":"#/$defs/Fraction"}, "h": {"$ref":"#/$defs/Fraction"} }, "required": ["x","y","w","h"] },
    "LayoutFamily": { "enum": ["speaker-full","speaker-panel","split","content-pip","content-card","content-cutout","ots-box","takeover","gesture","speaker-card-board"] },
    "SpeakerTreatment": { "enum": ["video","card","cutout","bed"] },
    "SpeakerFrame": {
      "type": "object",
      "properties": {
        "rect": { "$ref": "#/$defs/FRect", "x-tier": "advanced", "description": "derived from the family when absent" },
        "treatment": { "$ref": "#/$defs/SpeakerTreatment", "description": "default per family" },
        "crop": { "enum": ["auto","full","waist","chest","head"], "default": "auto", "x-tier": "advanced" },
        "radius": { "$ref": "#/$defs/Fraction", "description": "of the shorter side; 0.5 = circle chip" },
        "side": { "enum": ["left","right","auto"], "default": "auto" },
        "chipSize": { "enum": ["S","M","L"], "default": "M" },
        "faceCenter": { "$ref": "#/$defs/Point", "readOnly": true, "description": "face-box centre, fractions of the capture frame; from Take.tracks or the canonical presenter" }
      }
    },
    "OverlaySlot": {
      "type": "object",
      "properties": {
        "id": { "$ref": "#/$defs/Id" },
        "slot": { "enum": ["lowerThird","sideRail","topBand","heroLine","cornerCard","pinnedCallout","floatingStack","fullPlate","bug","ticker"] },
        "role": { "enum": ["identity","topic"], "description": "lowerThird only; decides the side" },
        "rect": { "$ref": "#/$defs/FRect", "x-tier": "advanced" },
        "device": { "enum": ["auto","scrim","gradient","glass","solid","outline"], "default": "auto", "x-tier": "advanced" },
        "behindSpeaker": { "type": "boolean", "default": false, "x-tier": "advanced", "description": "underlay root; requires treatment cutout" },
        "members": { "type": "array", "items": { "type": "object", "properties": { "id": { "$ref": "#/$defs/Id" }, "kind": { "enum": ["plate","text","number","icon","leader","dot"] }, "text": { "type": "string" }, "numeric": { "type": "object" } }, "required": ["id","kind"] } },
        "anchor": { "$ref": "#/$defs/Anchor" }
      },
      "required": ["id","slot"]
    },
    "Anchor": { "type": "object", "properties": { "kind": { "enum": ["unit","face","hand","frame"] }, "ref": { "type": "string" }, "point": { "$ref": "#/$defs/Point" } }, "required": ["kind"] },
    "StageLayout": {
      "type": "object",
      "properties": {
        "family": { "$ref": "#/$defs/LayoutFamily" },
        "speaker": { "$ref": "#/$defs/SpeakerFrame" },
        "content": { "$ref": "#/$defs/FRect", "description": "replaces frame.slideRectPx as the compile input; derived from the family when absent" },
        "slots": { "type": "array", "items": { "$ref": "#/$defs/OverlaySlot" } }
      },
      "required": ["family"]
    },
    "LayoutTransition": { "type": "object", "properties": { "kind": { "enum": ["auto","cut","reframe"], "default": "auto" }, "makeRoom": { "type": "boolean", "default": true } } },
    "StageEvent": { "type": "object", "properties": { "atStep": { "$ref": "#/$defs/Id" }, "layout": { "$ref": "#/$defs/StageLayout" }, "transition": { "$ref": "#/$defs/LayoutTransition" } }, "required": ["atStep","layout"] },
    "Stage": {
      "type": "object",
      "properties": {
        "aspect": { "enum": ["16:9","9:16","1:1"], "default": "16:9", "description": "drives project.width/height" },
        "base": { "$ref": "#/$defs/StageLayout" },
        "timeline": { "type": "array", "items": { "$ref": "#/$defs/StageEvent" } },
        "legacyGeometry": { "type": "boolean", "readOnly": true, "description": "set when derived from config.camera; keeps today's pixel rects" }
      },
      "required": ["base"]
    }
  }
}
```

`Action.op` is **unchanged** (13). `PulseValue.style` gains `ring`; `SwapValue.style` gains `strike`; `RevealValue.lines` gains `type`. Overlay ops target slot ids or member ids. `Take` gains `overlays[]`, `tracks{}`, `deltas[]`, `media{}`. `Geometry.units[]` gains `kind: speaker | overlay | caption`, `space: page | frame`; the speaker unit carries `role: chrome`. Self-view, clock lead and theme values (plate tint, radii, ring alpha, caption style) are studio preferences or `themes.ts`, not plan state.

### 13.2 Backwards compatibility

- A block without `stage` derives `stage.base` from `config.camera` **keeping today's pixel rects** (`legacyGeometry: true`): `information-circle` → `content-pip`, chip 17.19 % W at today's rect (bottom 0.843 H); `information-tile` → `content-pip` tile at today's rect; `portrait-overlay` / `portrait-rail` → `content-card` (card right, today's widths); `split` → `split`; `person-background-left/right` → `speaker-full` with today's 0.42 W × 0.64 H content rect as a `sideRail` slot rect (the existing gradient is the slot's `gradient` device); `person-only` → `speaker-full`; `position: hidden` → `takeover`. Legacy blocks stay **camera-right**; the viewer-left default applies to new stage blocks only. Phase 11 therefore renders every existing block identically; the re-derived family geometry applies only when `legacyGeometry` is cleared by picking a family.
- **Write-back** (lossy, named per family): speaker-full → `person-only` / `person-background-*` (if a rail exists); speaker-panel → `person-background-*`; split → `split`; content-pip → `information-circle` / `information-tile`; content-card → `portrait-overlay` / `portrait-rail`; content-cutout → `information-circle`; ots-box → `information-tile`; takeover → `position: hidden`; gesture → `person-only`; speaker-card-board → `portrait-rail`. The take is marked `stageAuthored: true` so an old reader's different render is known, not silent.
- Plans without stage events render as today; V1 steps are untouched; overlay units never appear in V1.
- Resolved output gains per step a `stage` snapshot: speaker rect, crop, clip, slot rects, **device, p95 luminance, energy** per slot, and for reframes `startMs`/`durationMs`/curve.
- `Stage.aspect` other than 16:9 sets `project.width/height` (`#composition` is project-sized, index.ts 640) and switches the scene stylesheet to fraction-based rules; the 1920-px absolute CSS is the 16:9 case of that stylesheet.

### 13.3 Worked examples

**(a) Speaker full, a topic strap counts a figure on the cue word.** Sentence 2: "…we cut latency from three hundred to forty milliseconds."

```json
{ "stage": { "base": { "family": "speaker-full", "speaker": { "side": "left" },
    "slots": [ { "id": "lt", "slot": "lowerThird", "role": "topic", "members": [
      { "id": "lt-plate", "kind": "plate" }, { "id": "lt-num", "kind": "number", "text": "300 ms" }, { "id": "lt-cap", "kind": "text", "text": "p95 latency" } ] } ] } },
  "steps": [ { "id": "st-latency", "title": "Latency drop", "narration": { "sentences": [2], "cueWordIndex": 7 }, "intent": "quantify", "hero": ["lt"],
    "actions": [ { "op": "reveal", "targets": ["lt"] }, { "op": "count", "targets": ["lt-num"], "value": { "to": "40 ms" } } ] } ] }
```
Resolved: a topic strap ⇒ open side (right); the default solid card stands (lower thirds never use glass; measured p95 0.62, energy 0.04 recorded in the snapshot). The count lands on the onset of "forty" and lasts `dur.count` 600; the number is visible from 70 % of the plate wipe, so the strap starts at onset − (600 + 210) ≈ −810 ms (the 300 ms place lead is a floor); the plate `clip`-wipes from the speaker side; caption +`lag.label`. Hold is hold(k) with `hold.number` as the floor; the exit runs in reverse ≥ 300 ms before the next cue. The strap sits at y 0.72–0.84 above the caption band; the hard zone is untouched.

**(b) Speaker slides left as a side panel builds three bullets.**

```json
{ "stage": { "base": { "family": "speaker-full", "speaker": { "side": "left" } },
    "timeline": [ { "atStep": "st-three", "transition": { "kind": "reframe" }, "layout": { "family": "speaker-panel",
      "slots": [ { "id": "rail", "slot": "sideRail", "members": [ { "id": "b1", "kind": "text", "text": "Fewer round trips" }, { "id": "b2", "kind": "text", "text": "Smaller payloads" }, { "id": "b3", "kind": "text", "text": "Edge caching" } ] } ] } } ] },
  "steps": [ { "id": "st-three", "title": "Three reasons", "narration": { "sentences": [4,5,6], "cueWordIndex": 3 }, "intent": "introduce", "hero": ["rail"],
    "actions": [ { "op": "reveal", "targets": ["rail"] }, { "op": "reveal", "targets": ["b1","b2","b3"], "timing": { "staggerOrigin": "narration" } } ] } ] }
```
Resolved: the event materialises an implicit `reframe` starting `ant.reframeLead` before the cue (on Next in the studio): clip and inner crop from one t over 500 ms; the eye row is held at 0.38 H while the face travels to x ≈ 0.28 W (lead room toward the panel); the rail enters from the right edge by its own width 150 ms after the speaker starts; b1–b3 rise on the onsets of sentences 4–6 with `stagger.unit` as the floor; captions re-anchor 450 ms after the settle; the validator confirms the rail's top is on the eye row and no item enters the hard zone.

**(c) Content full with the cut-out presenter while a diagram traces.**

```json
{ "stage": { "base": { "family": "content-cutout", "speaker": { "treatment": "cutout", "side": "right" } } },
  "steps": [ { "id": "st-flow", "title": "Request path", "narration": { "sentences": [8], "cueWordIndex": 2 }, "intent": "flow", "hero": ["u-gateway"], "supporting": ["u-service"],
    "actions": [ { "op": "dim", "targets": "others" }, { "op": "trace", "targets": ["u-arrow-gw-svc"] }, { "op": "pulse", "targets": ["u-service"] } ] } ] }
```
Resolved: the family supplies `content` (0.05, 0.08, 0.66, 0.84), which replaces `frame.slideRectPx`; the speaker is chrome; the body is a no-go zone and the validator pushes the page `view` left by rule if a unit lands under it. The cut-out is enabled because the per-beat matte minimum is 0.83 ≥ 0.8 and the rehearsal frame budget passed; otherwise the block compiles as `content-pip` with the same plan. The actions are unchanged §2.2 operations.

**(d) 9:16 restack of (b).** `stage.aspect: "9:16"`, same base and event. Resolved: project becomes 1080×1920; reservations subtracted for overlays (usable 0.09–0.78 H); content 0.09–0.40 H, speaker 0.40–0.78 H bleeding to the bottom edge; the rail becomes a `floatingStack` in the content band (0.10–0.38 H); captions over the chest at 0.68–0.76 H; no reframe (the speaker is already in place), so the step compiles to reveals only, entering downward from the top, away from the speaker.

---

