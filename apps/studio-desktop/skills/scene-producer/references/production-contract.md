# The produced scene — `production/`

A produced scene is the scene itself: one standalone Hyperframes composition
that realizes **one approved plan** (`packet/PLAN.json`) with its final
artwork, on the scene's real clock (`packet/CLOCK.json`). The creator watches
it on the Studio's stage, accepts it, and the notebook plays and exports its
render. It is not a sketch: nothing in it stands in for anything.

Write, then call `produce_submit_scene`:

- `production/index.html` — the composition.
- `production/manifest.json` — what the composition really does.
- `production/audio/narration.mp3` — the scene's voice, copied unchanged from
  `packet/audio/narration.mp3` (when the clock is a generated voice).
- `production/assets/` — the cast artwork you use, copied from the packet's
  `assets/<id>/asset.svg`.

## The clock

`CLOCK.json` is the scene's clock, set by the product before your run:

```json
{
  "kind": "generated-voice",
  "audio": "audio/narration.mp3",
  "video": null,
  "duration": 21.4,
  "moments": [ { "id": "m1", "start": 0, "end": 6.2 }, { "id": "m2", "start": 6.2, "end": 13.9 } ],
  "spoken": [ { "id": "m1", "words": "A token bucket refills at a steady rate.", "spokenEnd": 5.8 } ]
}
```

- `kind` is `generated-voice` (the product spoke the approved narration),
  `take` (the creator's own recording, aligned to the approved plan's lines)
  or `silent` (silent by the creator's choice; the moments keep the plan's
  estimates).
- Each moment's interval is fixed. Its words are said between its `start` and
  its `spokenEnd`; the rest of the interval lets the frame settle.
- The composition lasts `duration` seconds, and at most two seconds more to
  settle at the end.

A take's clock also says where the creator is in each moment, and lists the
file the product supplies:

```json
{
  "kind": "take",
  "audio": "media/take.webm",
  "video": "media/take.webm",
  "duration": 9.2,
  "moments": [ { "id": "m1", "start": 0, "end": 3.4 }, { "id": "m2", "start": 3.4, "end": 9.2 } ],
  "spoken": [ { "id": "m1", "words": "Each request consumes one token.", "spokenEnd": 2.6 } ],
  "presenter": [ { "id": "m1", "visibility": "full" }, { "id": "m2", "visibility": "hidden" } ],
  "review": [],
  "media": ["media/take.webm"]
}
```

`media/` is the product's: it supplies the take there to your production,
checked and rendered with it. Do not copy it and write nothing under
`production/media/`; `packet/references/take-frame.jpg` shows its framing.

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
<audio id="voice" src="audio/narration.mp3" data-start="0" data-duration="<clock duration>" data-track-index="20"></audio>
```

A scene the creator presents (`kind: take`) plays `media/take.webm` as that
sound, and its picture in **one** presenter layer: a single muted video for
the whole scene, inside a wrapper your timeline moves between the framings
`CLOCK.json` gives each moment — `full` fills the frame, `shared` sits beside
the graphics on the side they leave free, `hidden` is out of view while the
voice carries on. The picture never restarts and is never offset: it stays
in step with the voice.

```html
<div id="presenter" data-sketch-layer="presenter">
  <video id="take" src="media/take.webm" muted playsinline data-start="0" data-duration="<clock duration>" data-track-index="10"></video>
</div>
```

Every timed `<video>` and `<audio>` needs an `id`. A generated or silent
scene has **no** presenter layer and reserves no empty camera box.

## The manifest

```json
{
  "version": 1,
  "kind": "production",
  "scene": "<CONTEXT.json scene.id>",
  "plan": { "record": "<PLAN.json record>", "revision": 3 },
  "composition": { "id": "<PRODUCTION.md composition id>", "width": 1920, "height": 1080, "fps": 30, "duration": 21.4 },
  "runtime": { "hyperframes": "0.7.106" },
  "clock": { "kind": "generated-voice", "audio": "audio/narration.mp3" },
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
    { "id": "hold-m2", "label": "Hold after the limit bites", "kind": "hold", "moment": "m2", "default": 0.6, "min": 0, "max": 2 }
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

Before the scene is accepted as produced, the product checks the files and
the manifest against the approved plan and the clock, runs the pinned
engine's lint, and plays the composition in the pinned Hyperframes 0.7.106
player. It is refused, with the reason, when:

- a moment's interval is not the clock's, the composition is shorter than the
  clock or more than two seconds longer, or the manifest's clock is not the
  packet's;
- the sound is missing from `production/`, no `<audio>` plays it, it is
  played more than once, offset or cut short, or the player never loads it;
- a take's picture plays unmuted, carries its own sound, or runs out of step
  with the voice;
- a layer is a placeholder, a presenter layer appears without a take, or an
  object the plan asks to enrich is neither drawn nor named in `unmet`;
- a control is not read by the code, is not an `offset`, its default is
  outside its range, or its range leaves its moment;
- a script throws, the composition asks for a file that is not in
  `production/`, the timeline is not registered or has no tweens, or the
  player's length differs from the manifest's;
- seeking to the same time twice shows two frames, a layer never shows during
  a moment it declares, or a moment whose plan changes objects shows no
  change.

Stop when the submission is accepted. The producer never approves a plan,
accepts its own scene, records, generates audio or exports.
