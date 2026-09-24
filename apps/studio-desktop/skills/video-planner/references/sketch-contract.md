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
  <div id="m1" class="clip" data-start="0" data-duration="4" data-track-index="0">…</div>
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
  "provisional": ["Timing is estimated from the plan — no voice or take yet", "Presenter is a stand-in: no take recorded"]
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

Stop when the submission is accepted. A sketch never approves a plan, chooses
a take, generates artwork or produces the scene.
