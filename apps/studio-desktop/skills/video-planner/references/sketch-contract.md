# The sketch — `sketch/`

A sketch is a rough, seekable preview of **one** scene plan (`packet/PLAN.json`),
built as a standalone Hyperframes composition so the creator can feel how the
plan unfolds before anything is produced. It is not the scene. It shows the
whole progression, one representative object interaction, the intended camera
framing, the major text and any presenter transition — in motion. A montage of
static wireframes is not a sketch.

Write three things, then call `plan_submit_sketch`:

- `sketch/index.html` — the composition.
- `sketch/manifest.json` — what the composition really does.
- `sketch/assets/` — any cast artwork you use, copied from the packet's
  `assets/<id>/asset.svg` (optional).

## The composition

One standalone root in `<body>` (no `<template>`), sized by `data-width` and
`data-height`, with `data-start="0"` and `data-duration` equal to the
manifest's duration, and one paused GSAP timeline registered under the root's
id. The Studio runs the pinned Hyperframes 0.7.106 runtime: load **only**
`/runtime/gsap.min.js` and `/runtime/hyperframes.iife.js`. This skeleton passes
the pinned engine's lint:

```html
<!doctype html>
<html>
<head>
<meta charset="utf-8">
<script src="/runtime/gsap.min.js"></script>
<script src="/runtime/hyperframes.iife.js"></script>
<style>
  html, body { margin: 0; background: #0e0c17; }
  #root { position: relative; width: 100%; height: 100%; overflow: hidden; }
  .clip { position: absolute; inset: 0; }
</style>
</head>
<body>
<div id="root" data-composition-id="<CONTEXT.json composition.id>" data-start="0" data-width="1920" data-height="1080" data-duration="<seconds>">
  <div id="m1" class="clip" data-start="0" data-duration="4" data-track-index="0">
    <div class="title" data-sketch-layer="headline">Only twenty at once</div>
  </div>
  <div id="m2" class="clip" data-start="4" data-duration="5" data-track-index="0">…</div>
</div>
<script>
  window.__timelines = window.__timelines || {}
  const tl = gsap.timeline({ paused: true })
  tl.fromTo('#m1 .title', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.8 }, 0)
  window.__timelines["<CONTEXT.json composition.id>"] = tl
</script>
</body>
</html>
```

Rules the product checks (the pinned engine's lint runs too, and its errors
are problems):

- `window.__timelines = window.__timelines || {}` before the registration, and
  `data-start="0"` on the root — the pinned 0.7.106 lint requires both, even
  where newer upstream documentation says otherwise.
- Nothing from outside the sketch: no `http(s)://` URLs (the SVG and XLink
  namespaces are fine), no `fetch`, sockets, storage or dynamic `import`.
- Seekable: no clock (`Date.now`, `new Date`, `performance.now`), no
  `Math.random`, no infinite `repeat`. Every seek must show the same frame.
- Never tween `display`, `visibility` or `autoAlpha` on a `.clip`; animate a
  child. Never pair a CSS `transform` with a GSAP tween of the same property.
- Mark what draws each layer of the manifest with
  `data-sketch-layer="<layer id>"` — every layer but the camera. Several
  elements may share a mark, and one element may carry several ids,
  space-separated. Name an object's layer by its entity id in `PLAN.json`
  (the ids a moment's `objects.actors` lists), so the product can find what a
  moment changes. Not `data-layer`: Hyperframes reads that as a track.
- A container's fill stays inside it. Where `VISUAL_CAST.json` gives an
  entry's `rig.inside`, its level is already clipped to its shell: to animate
  it, inline the asset's SVG (an `<img>` cannot move its parts), keep the
  level's `clip-path`, and set the level's `y` and `height` within
  `rig.inside.extent`, with `x` and `width` at the extent's. A fill you draw
  yourself is clipped to its container's closed outline the same way.
- Artwork is the packet's cast (reuse it by its `libraryKey`) or native shapes
  and text. Never generate or fetch artwork. Where the plan wants something you
  do not have, draw a labelled placeholder.
- A presenter the plan shows is a **stand-in**: a framed silhouette in its
  reserved region, labelled, never a person.

## The manifest

```json
{
  "version": 1,
  "scene": "<CONTEXT.json scene.id>",
  "plan": { "record": "<PLAN.json record>", "revision": 3 },
  "composition": { "id": "<CONTEXT.json composition.id>", "width": 1920, "height": 1080, "fps": 30, "duration": 18 },
  "runtime": { "hyperframes": "0.7.106" },
  "moments": [
    { "id": "m1", "title": "Set the scene", "start": 0, "end": 4, "estimated": true },
    { "id": "m2", "title": "The limit bites", "start": 4, "end": 11, "estimated": true }
  ],
  "layers": [
    { "id": "pool", "kind": "object", "label": "Twenty-slot pool", "moments": ["m1", "m2"], "asset": { "libraryKey": "<VISUAL_CAST.json libraryKey>", "path": "assets/pool.svg" } },
    { "id": "headline", "kind": "text", "label": "Only twenty at once", "moments": ["m1"] },
    { "id": "camera", "kind": "camera", "label": "Push in on the pool", "moments": ["m2"] },
    { "id": "presenter", "kind": "presenter", "label": "Presenter", "moments": ["m1"], "placeholder": "Stand-in: no take recorded" }
  ],
  "provisional": ["Timing is estimated from the plan — no voice or take yet", "Presenter is a stand-in: no take recorded"],
  "schedule": {
    "quantity": "free slots in the pool", "capacity": 20, "initial": 20,
    "rules": [ { "id": "release", "change": "add", "amount": 1, "every": 3, "from": 4.5 } ],
    "pauses": [],
    "events": [
      { "at": 4.5, "moment": "m2", "change": "consume", "amount": 1, "after": 19, "layers": ["pool"] },
      { "at": 7.5, "moment": "m2", "change": "add", "amount": 1, "after": 20, "rule": "release", "layers": ["pool"] }
    ]
  }
}
```

- `moments` — **every** moment of the plan, in its order, each with an
  estimated interval inside the composition (`estimated: true`).
- `layers` — what the sketch draws: `background`, `object`, `text`, `caption`,
  `camera` or `presenter`, with the moments each takes part in. A layer that
  draws cast artwork names its `libraryKey` (and `path` if you copied the SVG).
  A layer standing in for something missing says so in `placeholder`.
- `provisional` — everything a viewer must not take for the finished scene:
  always the estimated timing; the presenter stand-in; each placeholder.
- `schedule` — required when `PLAN.json` has a `ledger`: the mechanism's
  clock. `quantity`, `capacity` and `initial` are the ledger's. `events` are
  the ledger's changes one for one, in order — the same `change`, `amount`,
  `after` (and `needs`), in the same moment — each at the time it happens on
  the composition's clock (`at`), with the drawn `layers` that show it. Each
  of the ledger's `rates` is a `rule` with the same id: a change every
  `every` seconds, its clock running from `from` (no later than the first
  time there is room, or supply); tag the events it makes with `rule`. A rule
  changes the count on every beat while there is room, and at no other time:
  time the scene to the beat, never the beat to the narration. To hold the
  clock while the scene explains, add a pause — `start`, `end`, a `note`, and
  `shown`, the layer that tells the viewer the clock is held. Nothing counted
  happens in a pause, and the beat resumes after it. Narration and camera may
  dwell on a change; they never move it.

## How the product checks it

Before a sketch is accepted, the product plays it in the pinned Hyperframes
0.7.106 player, as the Studio's stage does, where nothing outside `sketch/`
loads. It is refused, with the reason, when:

- a script throws, or the composition asks for a file that is not in
  `sketch/` (a relative path resolves against `index.html`) or anything
  outside it;
- the player never becomes ready, the timeline is never registered under the
  composition id, or it has no tweens;
- the player's length differs from `manifest.composition.duration`;
- seeking to the same time twice shows two different frames;
- a layer is not marked, or shows at no time during a moment it declares;
- a moment whose plan changes objects (`objects.change`) shows no change in
  those objects' layers — or, where none is marked, anywhere on screen;
- a counted change of the schedule shows no change in its layers within
  0.3 s of its time, or a pause's layer does not show throughout it.

A moment the plan does not change may hold still. What it proved is kept
with the preview, against the bundle's hash.

Stop when the submission is accepted. A sketch never approves a plan, chooses
a take, generates artwork or produces the scene.
