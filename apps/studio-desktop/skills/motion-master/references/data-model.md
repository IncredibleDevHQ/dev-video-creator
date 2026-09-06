# Data Model

> Reference for the `motion-master` skill. Source: *The Motion Decision Core*, sections §3. Read only when the routing table triggers it.

The step schema (plan tier vs resolved tier) and worked examples.

## 3. Data model

### 3.1 Compatibility contract

Today a step is `{title, explanation, reveals: string[], verb: "reveal"|"trace"|"focus"}` (slide.ts:8-13), where `reveals` are element ids. V2 keeps that shape valid and defines the expansion exactly:

- `reveals` element ids resolve at driver init to the smallest unit containing the element (with the `s{N}-` prefix applied to geometry keys too); a step with both `reveals` and `actions` is invalid (`oneOf`).
- `verb: reveal` → `[{op:"reveal", targets}]`; `verb: trace` → `[{op:"trace", targets: connectors}, {op:"reveal", targets: rest}]` with reveal at arrival; `verb: focus` → `[{op:"dim", targets:"others", release: page-step-end}, {op:"reveal", targets}]`. Because V1 steps have no hero, the dim releases at the end of the step, matching today's per-step `focusDim` (slide.ts:215).
- Empty titles are back-filled with `Step N` by `sanitizeSlideSteps` before validation (today the editor does this on save).

**What changes for existing plans — intentionally.** Phase 0 does not render existing plans identically; it retunes them, and the retune is the point:

| Today (`a699ba77`) | V2 |
|---|---|
| publish motion window = `min(1.6 s, 0.5 × stepSeconds)` (slide.ts:227); presenter window 850 ms (main.ts:625) | one `motionWindowMs` derived from the actions, used by every clock |
| trace: stroke draws over 0–75 % of the window while bodies fade from 45 % (slide.ts:202-203); `easeDraw (0.25,0.6,0.4,1)` | draw → arrival → body, `ease.draw` |
| rise 14 px, no scale, stagger `min(0.12, 0.5/n)` | preset carriers, `stagger.unit` |
| focus dims everything revealed earlier including the title | chrome/anchors exempt; text dims to `dim.text` |
| play hold `min(3200, 900 + words×60)` (main.ts:7397) | the L2 hold |
| Back replays the previous step's motion (main.ts:7357, 7445) | Back = fold state with a `presenter.backCrossfadeMs` crossfade |

Time inside a step is authored in milliseconds from the step's motion start. The driver derives `motionWindowMs = max(action end) + settle`; presenter, play and publish map their clocks onto progress 0→1 across that window and append the hold. With a recorded take or word onsets the step's start is the cue (landing-aligned) and the hold absorbs the difference.

### 3.2 JSON schema

Two tiers. **Plan** is what the planner and the author write; it carries meaning and a small advanced tier. **Resolved** is compiler output (timing, ease, pivot, path, ports, persistence, implicit actions) and is never stored in the block. Properties marked `x-tier: advanced` are hidden behind the editor's advanced toggle and rejected from planner output.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "incredible-studio/slide-motion/v2",
  "type": "object",
  "properties": {
    "motion": { "$ref": "#/$defs/PageMotion" },
    "steps": { "type": "array", "minItems": 1, "maxItems": 24, "items": { "$ref": "#/$defs/Step" } },
    "takes": { "type": "array", "items": { "$ref": "#/$defs/Take" }, "description": "recorded presenter takes; precedence recorded > cue > formula" }
  },
  "required": ["steps"],
  "$defs": {
    "Id": { "type": "string", "pattern": "^(?!syn-)[A-Za-z_][\\w.:-]*$" },
    "IdList": { "type": "array", "items": { "$ref": "#/$defs/Id" }, "uniqueItems": true },
    "Point": { "type": "object", "properties": { "x": {"type":"number"}, "y": {"type":"number"} }, "required": ["x","y"] },
    "Rect": { "type": "object", "properties": { "x": {"type":"number"}, "y": {"type":"number"}, "w": {"type":"number","exclusiveMinimum":0}, "h": {"type":"number","exclusiveMinimum":0} }, "required": ["x","y","w","h"] },
    "UnitRef": {
      "type": "object",
      "properties": { "unit": { "$ref": "#/$defs/Id" }, "port": { "enum": ["auto","center","top","bottom","left","right"], "default": "auto" } },
      "required": ["unit"]
    },
    "EaseAnchor": { "enum": ["enter","settle","travel","camera","exit","pop","popOver","draw","pulse"] },
    "Targets": { "oneOf": [ { "$ref": "#/$defs/IdList" }, { "enum": ["others","all","hero","supporting"] } ] },
    "Timing": {
      "type": "object", "x-tier": "advanced",
      "properties": {
        "sequence": { "enum": ["chain","parallel"], "default": "chain", "description": "chain = start at chain.at of the previous action; parallel = start with it" },
        "offsetMs": { "type": "number", "default": 0 },
        "durationMs": { "type": "number", "minimum": 0 },
        "staggerMs": { "type": "number", "minimum": 0 },
        "staggerOrigin": { "enum": ["narration","reading","hero","center","first","last","path","reverse"] }
      }
    },
    "Release": {
      "type": "object",
      "properties": {
        "on": { "enum": ["next-hero","explicit","page-end"], "default": "next-hero" },
        "ms": { "type": "number", "default": 300 }
      }
    },
    "CameraTarget": {
      "oneOf": [
        { "const": "page" },
        { "const": "keep" },
        { "type": "object",
          "properties": {
            "units": { "$ref": "#/$defs/IdList" },
            "rect": { "$ref": "#/$defs/Rect" },
            "transition": { "enum": ["auto","direct","via-page"], "default": "auto" },
            "dwellMs": { "type": "number", "minimum": 0 }
          } }
      ]
    },
    "RevealValue": { "type": "object", "properties": {
      "enterFrom": { "enum": ["auto","up","down","left","right","hero","reading","none"], "default": "auto" },
      "lines": { "enum": ["auto","block","per-line"], "default": "auto" } } },
    "DimValue": { "type": "object", "properties": { "level": { "type": "number", "minimum": 0.15, "maximum": 1 } } },
    "EmphasizeValue": { "type": "object", "properties": { "factor": { "type": "number", "minimum": 1, "maximum": 1.08 } } },
    "PulseValue": { "type": "object", "properties": { "repeats": { "type": "integer", "minimum": 1, "maximum": 2, "default": 1 } } },
    "MoveValue": { "type": "object", "properties": {
      "freeform": { "type": "boolean", "default": false, "x-tier": "advanced", "description": "author-only; allows a Point in `to`" },
      "labelMode": { "enum": ["followCenter","scaleWith","static"], "default": "followCenter" },
      "connectors": { "enum": ["auto","tween","redraw","detach"], "default": "auto" } } },
    "ConnectValue": { "type": "object", "properties": {
      "mode": { "enum": ["highlight","author"], "default": "highlight" },
      "direction": { "enum": ["forward","reverse"], "default": "forward" },
      "arrowhead": { "type": "boolean", "default": true },
      "strokeLike": { "$ref": "#/$defs/Id" } } },
    "TraceValue": { "type": "object", "properties": {
      "direction": { "enum": ["auto","forward","reverse","fromHero"], "default": "auto" },
      "markerMode": { "enum": ["hideUntilDrawn","keep"], "default": "hideUntilDrawn" } } },
    "MorphValue": { "type": "object", "properties": { "toUnit": { "$ref": "#/$defs/Id" }, "toPath": { "type": "string" } } },
    "SwapValue": { "type": "object", "properties": {
      "text": { "type": "string" }, "href": { "type": "string" },
      "style": { "enum": ["crossfade","slide"], "default": "crossfade" } } },
    "CountValue": { "type": "object", "properties": {
      "fromMode": { "enum": ["current","zero","explicit"], "default": "current" },
      "from": { "type": "number" },
      "to": { "oneOf": [ { "type": "number" }, { "type": "string", "description": "authored string; parsed with the unit's numeric format" } ] } },
      "required": ["to"] },
    "ExitValue": { "type": "object", "properties": {
      "style": { "enum": ["auto","fade","dissolve","moveOut"], "default": "auto" },
      "direction": { "enum": ["reading","up","down","left","right"] } } },
    "Action": {
      "type": "object",
      "properties": {
        "id": { "$ref": "#/$defs/Id", "description": "unique across the plan; required on connect, move, morph, swap, camera and on any action another action sequences against" },
        "op": { "enum": ["reveal","trace","dim","undim","emphasize","pulse","move","connect","camera","morph","swap","count","exit"] },
        "targets": { "$ref": "#/$defs/Targets" },
        "except": { "$ref": "#/$defs/IdList" },
        "from": { "$ref": "#/$defs/UnitRef" },
        "to": { "oneOf": [ { "$ref": "#/$defs/UnitRef" }, { "$ref": "#/$defs/Point" } ] },
        "camera": { "$ref": "#/$defs/CameraTarget" },
        "value": { "type": "object" },
        "release": { "$ref": "#/$defs/Release", "description": "dim and emphasize only" },
        "timing": { "$ref": "#/$defs/Timing" },
        "ease": { "$ref": "#/$defs/EaseAnchor", "x-tier": "advanced" },
        "implicit": { "type": "boolean", "default": false, "readOnly": true, "description": "materialized by the compiler (camera release, undim); shown, not editable" }
      },
      "required": ["op"],
      "allOf": [
        { "if": { "properties": { "op": { "const": "reveal" } } },    "then": { "required": ["targets"], "properties": { "value": { "$ref": "#/$defs/RevealValue" } } } },
        { "if": { "properties": { "op": { "const": "trace" } } },     "then": { "required": ["targets"], "properties": { "value": { "$ref": "#/$defs/TraceValue" } } } },
        { "if": { "properties": { "op": { "enum": ["dim","undim"] } } }, "then": { "required": ["targets"], "properties": { "value": { "$ref": "#/$defs/DimValue" } } } },
        { "if": { "properties": { "op": { "const": "emphasize" } } }, "then": { "required": ["targets"], "properties": { "value": { "$ref": "#/$defs/EmphasizeValue" } } } },
        { "if": { "properties": { "op": { "const": "pulse" } } },     "then": { "required": ["targets"], "properties": { "value": { "$ref": "#/$defs/PulseValue" } } } },
        { "if": { "properties": { "op": { "const": "move" } } },      "then": { "required": ["id","targets","to"], "properties": { "value": { "$ref": "#/$defs/MoveValue" } } } },
        { "if": { "properties": { "op": { "const": "connect" } } },   "then": { "required": ["id","from","to"], "properties": { "value": { "$ref": "#/$defs/ConnectValue" } } } },
        { "if": { "properties": { "op": { "const": "camera" } } },    "then": { "required": ["id","camera"] } },
        { "if": { "properties": { "op": { "const": "morph" } } },     "then": { "required": ["id","targets"], "properties": { "value": { "$ref": "#/$defs/MorphValue" } } } },
        { "if": { "properties": { "op": { "const": "swap" } } },      "then": { "required": ["id","targets"], "properties": { "value": { "$ref": "#/$defs/SwapValue" } } } },
        { "if": { "properties": { "op": { "const": "count" } } },     "then": { "required": ["targets"], "properties": { "value": { "$ref": "#/$defs/CountValue" } } } },
        { "if": { "properties": { "op": { "const": "exit" } } },      "then": { "required": ["targets"], "properties": { "value": { "$ref": "#/$defs/ExitValue" } } } }
      ]
    },
    "Step": {
      "type": "object",
      "properties": {
        "id": { "$ref": "#/$defs/Id", "description": "stable; generated on save; keys takes, releases and editor badges" },
        "title": { "type": "string", "maxLength": 120 },
        "explanation": { "type": "string", "maxLength": 1200 },
        "narration": { "type": "object", "properties": {
          "sentences": { "type": "array", "items": { "type": "integer", "minimum": 0 } },
          "cueWordIndex": { "type": "integer", "minimum": 0 } } },
        "intent": { "enum": ["introduce","locate","relate","contrast","transform","quantify","emphasize","flow","recap","transition"] },
        "template": { "enum": ["reveal-group","trace-flow","compare-two","zoom-and-explain","emphasize","transform","count-up","recap","handoff"] },
        "hero": { "$ref": "#/$defs/IdList" },
        "supporting": { "$ref": "#/$defs/IdList" },
        "reveals": { "$ref": "#/$defs/IdList", "description": "V1 only: element ids" },
        "verb": { "enum": ["reveal","trace","focus"], "description": "V1 only" },
        "actions": { "type": "array", "items": { "$ref": "#/$defs/Action" }, "maxItems": 12 },
        "timing": { "type": "object", "properties": {
          "holdMs": { "type": "number", "minimum": 0 },
          "durationMs": { "type": "number", "minimum": 0, "description": "publish override for motion + hold" },
          "fit": { "enum": ["compress","clamp"], "default": "compress" } } }
      },
      "required": ["title"],
      "oneOf": [ { "required": ["reveals"] }, { "required": ["actions"] }, { "required": ["intent","hero"] } ]
    },
    "Take": {
      "type": "object",
      "properties": {
        "id": { "type": "string" },
        "steps": { "type": "array", "items": { "type": "object", "properties": { "stepId": { "$ref": "#/$defs/Id" }, "atMs": { "type": "number", "minimum": 0 } }, "required": ["stepId","atMs"] } }
      },
      "required": ["id","steps"]
    },
    "PageMotion": {
      "type": "object",
      "properties": {
        "preset": { "enum": ["technical-trace","premium-settle","data-confirm"] },
        "durationScale": { "type": "number", "minimum": 0.8, "maximum": 1.25 },
        "speed": { "type": "number", "minimum": 0.5, "maximum": 2, "default": 1 },
        "reducedMotion": { "type": "boolean", "default": false },
        "unreferenced": { "enum": ["static","hidden"], "default": "static" },
        "fit": { "enum": ["cue","scale-holds","clamp"], "default": "scale-holds" },
        "anchors": { "type": "object", "additionalProperties": { "$ref": "#/$defs/Id" }, "description": "cross-page anchor key -> unit id on this page; consumed by frameTransition" },
        "loop": { "type": "object", "properties": { "closure": { "enum": ["seam","hard"], "default": "seam" } } },
        "presenter": { "type": "object", "properties": {
          "nextDuringMotion": { "enum": ["fastForward","snap"], "default": "fastForward" } } },
        "geometry": { "$ref": "#/$defs/Geometry" }
      }
    },
    "Geometry": {
      "type": "object", "readOnly": true,
      "description": "static page outputs persisted by the atomizer at save; keys carry the scene prefix; used by planner and validator, re-measured by the driver for painting",
      "properties": {
        "svgHash": { "type": "string" },
        "measured": { "type": "object", "properties": { "fontsReady": { "type": "boolean" }, "at": { "enum": ["editor","driver"] } } },
        "viewBox": { "$ref": "#/$defs/Rect" },
        "readingMode": { "enum": ["ltr-ttb","center-out","hub-spoke","timeline","chain","grid"] },
        "units": { "type": "object", "additionalProperties": { "type": "object", "properties": {
          "kind": { "enum": ["group","box","label","connector","shape","frame","image","number"] },
          "label": { "type": "string" },
          "role": { "enum": ["focal","support","accent","chrome","anchor"] },
          "bbox": { "$ref": "#/$defs/Rect", "description": "root space" },
          "members": { "type": "array", "items": { "type": "object", "properties": { "id": { "$ref": "#/$defs/Id" }, "ctm": { "type": "array", "items": { "type": "number" }, "minItems": 6, "maxItems": 6 } }, "required": ["id","ctm"] } },
          "fontPx": { "type": "number" },
          "textAnchor": { "enum": ["start","middle","end"] },
          "lines": { "type": "array", "items": { "$ref": "#/$defs/Rect" } },
          "tspans": { "type": "integer" },
          "pathLength": { "type": "number" },
          "numeric": { "type": "object", "properties": { "value": {"type":"number"}, "prefix": {"type":"string"}, "suffix": {"type":"string"}, "decimals": {"type":"integer"}, "groupSeparator": {"type":"string"}, "decimalSeparator": {"type":"string"} } }
        } } },
        "edges": { "type": "array", "items": { "type": "object", "properties": {
          "connector": { "$ref": "#/$defs/Id" }, "from": { "$ref": "#/$defs/Id" }, "to": { "$ref": "#/$defs/Id" },
          "directed": { "type": "boolean" }, "fromPoint": { "$ref": "#/$defs/Point" }, "toPoint": { "$ref": "#/$defs/Point" },
          "markerStart": { "type": "boolean" }, "markerEnd": { "type": "boolean" } } } },
        "contains": { "type": "object", "additionalProperties": { "$ref": "#/$defs/IdList" } },
        "rows": { "type": "array", "items": { "$ref": "#/$defs/IdList" } }
      }
    }
  }
}
```

Companion changes outside this schema:

- `config.frameTransition.style` (types.ts; index.ts:314-336) gains `match-cut`, `morph`, `zoom-through`, and `frameTransition.fromAnchors: string[]` (anchor **keys**, not unit ids). The presenter's hold-cut is a scheduler rule.
- Compile inputs, never authored: `frame { renderScale, slideRectPx }` per layout, project `fps`, word onsets, the selected take.
- Resolved output (`ResolvedStep`): actions with absolute `startMs`, `durationMs`, curve, pivot, ports, path `d`, persistence, `motionWindowMs`, `holdMs`, plus materialized implicit actions keyed by `Step.id`.

### 3.3 Worked examples — Transformer architecture page

Assumed atomizer ids: `u-enc-mha` (Multi-Head Attention, encoder), `u-enc-addnorm-1` (Add & Norm, directly **above** it in the stack), `u-enc-arrow-mha-addnorm` (authored residual arrow), `g-encoder`, `g-decoder` (contains `u-dec-masked-mha`, `u-dec-addnorm-1`, `u-dec-mha`, `u-dec-addnorm-2`, `u-dec-ffn`, `u-dec-addnorm-3`, `u-dec-linear`, `u-dec-softmax`), `u-title` (role chrome), `u-legend` (role anchor), `u-spec-callout` (box) with texts `u-spec-callout-head` ("Base model") and `u-spec-callout-params` ("65M parameters", `text-anchor: start`).

**(a) Emphasize Multi-Head Attention and trace its output into Add & Norm.**

```json
{
  "id": "st-residual",
  "title": "Residual into Add & Norm",
  "explanation": "The attention output is added back to its input and normalised.",
  "narration": { "sentences": [4], "cueWordIndex": 1 },
  "intent": "relate",
  "hero": ["u-enc-mha"],
  "supporting": ["u-enc-addnorm-1"],
  "actions": [
    { "id": "a1", "op": "emphasize", "targets": ["u-enc-mha"], "value": { "factor": 1.08 } },
    { "id": "a2", "op": "trace", "targets": ["u-enc-arrow-mha-addnorm"] },
    { "id": "a3", "op": "pulse", "targets": ["u-enc-addnorm-1"] }
  ]
}
```

Resolved by rules: a1 = `dur.medium` with `ease.pop`, scale about the MHA rect centre, its label translating unscaled; the validator checks the 1.08 rect against the inflated bboxes of its neighbours and downgrades the factor to a `pulse` if the stack is too tight. a2 starts at `chain.at` of a1; the authored connector's edge is MHA → Add & Norm, so the draw runs upward from MHA's top port toward Add & Norm's bottom port, `marker-end` hidden until 100 % and popped as a spawned copy; duration = length / `dur.draw` speed. a3 runs `dur.pulse` after the marker pop. In publish, a1's landing is aligned to the onset of "added" (cue word 1) and a2/a3 keep their chain offsets; dim is not emitted because the intent is relate on two adjacent units. MHA's emphasis is released over `dur.release` when a later step's hero is not MHA (or a child of it). If no authored connector existed, the compiler would emit `connect` in `highlight` mode (overlay, flourish) and flag "no authored residual arrow" back to the static layer.

**(b) Camera push into the decoder stack while the rest dims.**

```json
{
  "id": "st-decoder",
  "title": "The decoder stack",
  "explanation": "Look at the decoder: it repeats the encoder's blocks and adds a masked attention layer at the bottom.",
  "narration": { "sentences": [7], "cueWordIndex": 3 },
  "intent": "locate",
  "hero": ["g-decoder"],
  "actions": [
    { "id": "d1", "op": "dim", "targets": "others" },
    { "id": "d2", "op": "camera", "camera": { "units": ["g-decoder"] } }
  ]
}
```

Resolved: "Look at" is a camera cue, so the planner may emit `camera`. "others" = entered units minus `g-decoder` minus chrome/anchors (`u-title`, `u-legend` are exempt automatically). In publish d1 starts `ant.dimLead` before d2 and overlaps it (the one concurrency the camera rule allows); in the presenter both start on Next. Target rect = union of the decoder members' bboxes plus labels within `dist.labelAttach`, padded `camera.pad`, expanded to the page aspect, zoom clamped to `camera.maxZoom` and reduced if the **largest** text in view would exceed `camera.textMax` frame px at the layout's `renderScale`; the root gets `overflow: hidden` while zoomed. If any decoder children were still un-entered they would enter during the last `1 − camera.revealDuring` of the push. Hold = max(narration remainder, `camera.dwell`). The compiler materializes into the next step whose hero lies outside the rect an implicit `camera: "page"` (`dur.cameraOut`) and `undim` (`dur.dim`), marked `implicit: true`, counted against that step's `budget.camera`, keyed by `st-decoder`'s id so reordering does not re-key them; a next step with `camera: "keep"` suppresses them, and a next step with its own `camera` target gets a direct move when the L4 camera-to-camera rule allows.

**(c) Swap the spec callout headline and count 65M → 213M.**

```json
{
  "id": "st-big",
  "title": "Base to big",
  "explanation": "The big configuration triples the parameter count, from sixty-five million to two hundred thirteen million.",
  "narration": { "sentences": [11], "cueWordIndex": 14 },
  "intent": "quantify",
  "hero": ["u-spec-callout"],
  "actions": [
    { "id": "s1", "op": "swap", "targets": ["u-spec-callout-head"], "value": { "text": "Big model" } },
    { "id": "s2", "op": "count", "targets": ["u-spec-callout-params"], "value": { "to": "213M parameters" } },
    { "id": "s3", "op": "pulse", "targets": ["u-spec-callout"] }
  ]
}
```

Resolved: s1 = sibling clone crossfade `dur.swapOut` / `dur.swapIn` / `dur.swapOverlap`; the new string is measured against the callout's inner width (error if it does not fit). s2 `fromMode: current` starts from the folded value 65 (not 0, the unit is visible), parses `to` with the unit's numeric format (prefix "", suffix "M parameters", 0 decimals), applies tabular numerals for `dur.count`, and its **landing** is aligned to the onset of "two hundred thirteen million" (cue word 14), so s1 is scheduled backward from that landing; because the text is start-anchored the string grows to the right, which the fit check covers. t=1 writes the literal "213M parameters". Back to the previous step restores "Base model" / "65M parameters" from the init-time content baseline via the fold.

---

