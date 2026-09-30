# The produced scene — `production/`

A produced scene is the scene itself: one standalone Hyperframes composition
that realizes **one approved plan** (`packet/PLAN.json`) with its final
artwork, on the scene's real clock (`packet/CLOCK.json`). The app renders the accepted composition, saves it, and makes it available
on the Studio stage for playback and export. It is not a sketch: nothing in it stands in for anything.

Write, then call `produce_submit_scene`:

- `production/index.html` — the composition.
- `production/manifest.json` — what the composition really does.
- `production/media/scene-audio.wav` — the app installs the scene's complete
  voice track here before the run. Keep it unchanged.
- `production/media/scene-camera.mp4` — the app installs this muted, aligned
  camera reel when recordings contain camera windows. Keep it unchanged.
- `production/assets/` — artwork used by the composition.

## The clock

`packet/CLOCK.json` is authoritative. For example:

```json
{
  "kind": "take",
  "audio": "media/scene-audio.wav",
  "video": "media/scene-camera.mp4",
  "duration": 9.2,
  "moments": [
    { "id": "m1", "start": 0, "end": 3.4, "lines": "First spoken line.", "camera": "full", "layout": "beside-slide", "overlay": null, "clips": [{ "start": 0, "end": 3.4, "camera": true }] },
    { "id": "m2", "start": 3.4, "end": 9.2, "lines": "Second spoken line.", "camera": "none", "layout": "full-screen", "overlay": null, "clips": [{ "start": 3.4, "end": 9.2, "camera": false }] }
  ]
}
```

The clock is measured by the app, not estimated by the harness. The audio
plays once from scene start. The optional video is a muted reel on the same
whole-scene clock; show it only within camera clips. Clip start/end values
are absolute scene seconds. Follow each moment's `layout` and `overlay`;
these accepted script choices take precedence over rough treatment staging.

`kind` is `generated-voice`, `take`, or `silent`. A take may contain audio
without camera: only a non-null `video` supplies a presenter picture. With
no camera reel, `video` is null. Use the exact file paths in the packet.
Do not synthesize an avatar or reserve a presenter region without camera
media. A test recording supplied by the app follows the same media contract
as a real recording; do not substitute other imagery.

Keep every moment's interval. The scene lasts `duration` seconds, with at
most two extra seconds for the final frame to settle. Do not change the
sound, recordings, or spoken timing to fit the animation.

The app seeds `production/media/` before you start and validates its bytes.
Reference those files in place. Do not copy, regenerate, trim, or edit them.
Keep presenter video separate from artwork in the HTML; never rasterize it
into a content image. The final encoder combines these layers into the MP4.

## The composition

As for a sketch: one standalone root in `<body>` with `data-composition-id`
(the id in `PRODUCTION.md`), `data-start="0"`, `data-width`, `data-height`
and `data-duration` equal to the manifest's duration; one paused GSAP
timeline registered after `window.__timelines = window.__timelines || {}`;
only `/runtime/gsap.min.js` and `/runtime/hyperframes.iife.js`. Nothing from
the network, no storage, no clock, no randomness, no infinite repeat. Never
tween `display`, `visibility` or `autoAlpha` on a `.clip`, and never pair a
CSS `transform` with a GSAP tween of the same property. Mark what draws each
layer with `data-sketch-layer="<layer id>"`, naming an object's layer by its
entity id in `PLAN.json`. A container's fill stays inside it: where
`VISUAL_CAST.json` gives an entry's `rig.inside`, keep the level's clip-path
and move it within `rig.inside.extent`.

The clock's sound plays once, whole, from the start — never offset, trimmed
or cut short:

```html
<audio id="voice" src="media/scene-audio.wav" data-start="0" data-duration="<clock duration>" data-track-index="20"></audio>
```

When `CLOCK.json.video` exists, use a single muted presenter video on the
whole-scene clock. Animate its wrapper between the moment layouts:
`full-screen` fills the frame, `beside-slide` shares separate regions with
content, and `corner` uses reserved space that does not obscure content.
Hide the presenter outside the camera clips. The picture stays synchronized
with the separate audio; it never restarts when its wrapper reappears.

```html
<div id="presenter" data-sketch-layer="presenter">
  <video id="take" src="media/scene-camera.mp4" muted playsinline data-start="0" data-duration="<clock duration>" data-track-index="10"></video>
</div>
```

Every timed `<video>` and `<audio>` needs an `id`. A generated or silent
scene has **no** presenter layer and reserves no empty camera box.

## The manifest

```json
{
  "version": 1,
  "kind": "production",
  "scene": "<PLAN.json scene>",
  "plan": { "record": "<PRODUCTION.md plan record>", "revision": 1 },
  "composition": { "id": "<PRODUCTION.md composition id>", "width": 1920, "height": 1080, "fps": 30, "duration": 13.9 },
  "runtime": { "hyperframes": "0.7.106" },
  "clock": { "kind": "generated-voice", "audio": "media/scene-audio.wav" },
  "moments": [
    { "id": "m1", "title": "Set the scene", "start": 0, "end": 6.2 },
    { "id": "m2", "title": "The limit bites", "start": 6.2, "end": 13.9 }
  ],
  "layers": [
    { "id": "bucket", "kind": "object", "label": "Token bucket", "moments": ["m1", "m2"], "asset": { "libraryKey": "<VISUAL_CAST.json libraryKey>", "path": "assets/bucket.svg" } },
    { "id": "headline", "kind": "text", "label": "Only twenty at once", "moments": ["m1"] },
    { "id": "camera", "kind": "camera", "label": "Push in on the bucket", "moments": ["m2"] }
  ],
  "unmet": [],
  "controls": [
    { "id": "m2-token", "label": "Token entry", "kind": "offset", "moment": "m2", "default": 0.6, "min": 0, "max": 2 }
  ]
}
```

- `clock` — the packet's clock, as it is: its `kind` and its `audio` file.
- `moments` — every moment of the approved plan, in its order, each with the
  clock's interval (within 0.1 s).
- `layers` — what the scene draws, as for a sketch, but with **no**
  `placeholder`. A layer that draws cast artwork names its `libraryKey` (and
  its `path`).
- `unmet` — what the approved plan asked for that this production could not
  meet, by name (for example “richer artwork of the GPU: not in the cast”).
  Empty when the plan is met in full. An object the plan marks `enrich` or
  `generate` is either drawn or named here.
- `controls` — optional, and worth offering: the times the creator may nudge
  in the Studio. Each is an `offset`: when one of a moment's actions starts,
  in seconds after the moment starts, with a default inside `min`–`max`. The
  range keeps the action inside its moment: `min` at least 0, `max` at most
  the moment's length less 0.25 s. The code reads it by its id where it
  places that action, e.g.
  `tl.fromTo('#m2 .token', …, m2Start + (window.__controls?.["m2-token"] ?? 0.4))`.
  Anything that would change the clock (a hold, a longer moment) is not a
  control: the creator asks for it, and the scene is produced again.
- `schedule` — required when `PLAN.json` has a `ledger`, as for a sketch, on
  the clock's times.

## How the product checks it

Submission checks the bundle paths, file limits, manifest, plan, timing,
layer declarations, controls, and unchanged supplied media. A refused
submission returns concrete problems to fix, within six submissions.
Acceptance saves the composition; the app then renders with the pinned
Hyperframes runtime and checks render failures and missing media/audio.
Do not assume structural acceptance proves visual quality. Inspect long text,
layout boundaries, and transitions while building the composition.

Stop when the submission is accepted. The producer never approves a plan,
accepts its own scene, records, generates audio or exports.

### Text changes and presenter space

Keep each edited sentence inside its allocated text column at its longest
revealed state. When animating individual characters, preserve normal word
wrapping (`white-space: pre-wrap` where spaces must be retained); never turn
every space into an unbreakable run. Margin comments, annotations, and speaker
regions must remain outside that column. Check the fully revealed replacement,
not only its first frame. A beside-slide presenter reserves a separate region;
a corner presenter must not obscure important text, diagrams, or controls.
