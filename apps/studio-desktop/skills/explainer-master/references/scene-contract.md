# Explainer artifacts and production tools

All tool calls include the absolute `projectDir` from the host task. Create
`explainer/` there. No tool needs an API key. No outside project files are outputs.

## Story

`explainer/story.json`:

```json
{"version":1,"scenes":[{"id":"the input scene id","file":"01-mechanism","title":"A short idea","question":"Why does this outcome happen?","answer":"The source-grounded causal answer","assets":["library-key"],"review":"What the inspected frames demonstrate; any remaining limitation"}]}
```

Keep one derivative per input scene for this route. `file` is a simple unique
stem, not a path. Save `<file>.svg` and `<file>.program.json`. The preview tool
creates `.proof.json`; narration creates `.narration.json`. Never write or edit
those proofs yourself. `finish` checks them against the exact current files.

## Artwork brief

`explainer_asset` accepts `operation` = `list`, `generate`, `edit`, `animate`.
Generation accepts `briefPath` (within this run) or inline `brief`; revisions
accept an existing `key` and a clear `prompt`. Generated SVG and metadata paths
are returned. Revisions are new library versions; prior versions remain usable.

```json
{
  "entity":"admission-gate", "role":"admission controller",
  "represents":"A physical gate that admits work while capacity remains and visibly stops the next arrival when it is exhausted",
  "subject":"the scene's actual topic",
  "states":["available","processing","closed"],
  "parts":[{"id":"shell","what":"the distinctive fixed body"},{"id":"arm","what":"a separate pivoting gate arm"},{"id":"indicator","what":"the status light"}],
  "ports":{"in":{"x":0.05,"y":0.6},"out":{"x":0.95,"y":0.6}},
  "labelAnchor":"below", "size":{"width":360,"height":300},
  "style":{"family":"a shared visual family name","palette":{"ground":"#101827","text":"#E8EEFA","accent":"#A5B4FC","secondary":"#64748B","warning":"#FB7185"},"angle":"three-quarter","density":"rich","depth":"soft"},
  "keepsTextOut":["the label","the capacity count"]
}
```

Use the video's actual palette, not the example colours. Roles, parts and
states come from the mechanism; a label alone is not an object brief. Design
for the size the scene actually uses. Avoid baking labels or counts into art.

## Scene SVG

1280×720, `data-scene-mode="explainer"`, `data-page-role="diagram"` (or a suitable
existing role). A mechanism is the default; an actual overview/summary may
declare `data-explainer-kind="summary"`. No presentation footer/chrome.
Content stays above y=630, leaving captions clear. Labels normally 24–32 px,
supporting text at least 20 px. A main object needs at least 240 px on one axis;
reused artwork must have at least 110 px on its shorter rendered axis.

Objects are `<g id="gate" data-role="node" data-kind="box">…</g>`.
Here `box` is an atomizer type, **not a requirement to draw a rectangle**. The
body can be the actual filled Quiver paths, with a short label below. Put
artwork inside `<g id="gate-art" data-appearance-for="gate"
data-appearance-key="returned-library-key">…</g>`. Keep the returned part ids;
add `data-part="arm"` etc. The program may address `gate.arm`. Prefix asset ids
per placement if reused twice, updating URL/href references consistently.

Quantities use separately named numbers, fills, or countable groups. A level
part may declare `data-fills="up"` or `"right"`. Countable pieces are direct
children of a named group, one child per unit. This scene layer owns quantities.

Travelling actors are independent groups with `data-actor="request"` (or job,
packet etc.), stable id, and `opacity="0"`. Make them 36–64 px and recognizable
while moving. Nodes are places; actors travel. Explicit `restage` may recompose
nodes, but unmotivated drifting makes a mechanism harder to follow.

Connectors are optional. When useful, give them `data-role="connector"`, id,
`data-from`, `data-to`, `data-verb` and a local arrow marker. Prefer the actual
actor trajectory or pipe to a permanent labelled edge everywhere.

## Local performances

An animated object has an isolated nested SVG inside its artwork group:

```xml
<svg id="gate-performance" data-part="performance" data-object-clip="1"
     data-duration-ms="1200" x="0" y="0" width="360" height="300"
     viewBox="0 0 360 300">
  <!-- Preserve the accepted Quiver drawing. This illustrates timing only. -->
  <g id="gate-arm-motion">
    <animateTransform attributeName="transform" type="rotate"
      values="0 180 160;-6 180 160;70 180 160;65 180 160;65 180 160"
      keyTimes="0;0.12;0.65;0.85;1" dur="1.2s" begin="0s" fill="freeze"/>
    <!-- the actual arm paths -->
  </g>
</svg>
```

Use native SMIL `animate`, `animateTransform`, `animateMotion` with finite
numeric `begin`/`dur`, no autonomous repeat, scripts or CSS keyframes. The player
pauses every clip at load and seeks it on the composition clock, including
backward seeking and export. Animations may shape paths, reveal strokes, change
colours, rotate mechanisms and move internal parts. Preserve holes, masks,
layer order and clipping in the source artwork. Check actual frames after edits.

The clip must not animate parts whose visibility or level the scene controls.
For example, animate the shell/inlet reaction while the scene spends tokens.
One long clip can hold several named behaviors at separate local time ranges.

## Scene program

```json
{"version":1,"cast":[{"id":"gate","role":"controller"},{"id":"request","role":"request"}],"beats":[
  {"id":"normal","moment":"explain","say":"The request arrives while capacity is available.","speaker":"page","events":[
    {"id":"arrival","actor":"request","action":"travel","to":"gate","cue":"arrives"},
    {"id":"open","actor":"gate.performance","action":"perform","after":"arrival","clip":{"fromMs":0,"toMs":1200,"durationMs":1200}}
  ]}
]}
```

Actions: `appear`, `travel`, `pass`, `reject`, `spend`, `refill`, `become`,
`highlight`, `leave`, `state`, `perform`. `travel/pass/reject/become` require an
actor when they move something. Every event requires `actor`. Quantities belong
inside a cast entry, never directly on an event:

```json
{"cast":[{"id":"bucket","role":"store","quantity":{"of":"tokens","value":3,"max":3,"shownOn":"bucket.level","counted":"bucket.tokens"}}],"beats":[{"say":"The request spends one token.","events":[{"id":"spend-1","actor":"bucket","action":"spend","amount":1,"cue":"spends"}]}]}
```

`spend` subtracts `amount`; `refill` adds it, bounded by `max`. `shownOn` names
a fill or numeric text; `counted` names a part family with separate
`data-part="tokens-1"`, `tokens-2`, `tokens-3` groups (one per factual unit).
These fields are bindings, not instructions to invent decorative token art.
Do not also `appear` those count-controlled pieces; the quantity owns them.

Events have stable ids. `cue` is one word actually spoken in this beat; when
the word repeats in the same line, pin the occurrence — `"retry#2"` is the
second "retry". The bare word means its first occurrence. `after`
names an earlier event that must finish. `atMs` explicitly starts an independent
overlapping action; omit it for ordinary causal ordering. `nudgeMs` is an author
correction. Dependencies and narration cues both constrain starts. Use a
`perform` clip for local choreography, not a generic pulse for every outcome.

Moments: establish, explain, tension, consequence, resolve, aside. Use those
appropriate to the content. Camera: omit to inherit, `"page"` to restore, or
an array of object ids to frame. Hold the spatial map; move in only when an
internal change needs to be read. Speaker: page, beside, me. The generated guide
is voice-only; use page where the mechanism needs the frame. Recorded human
speaker staging is handled by the editor's director, not by drawing a fake face.

`explainer_narrate` owns `durationMs` and `words:[{word,startMs,endMs}]` on beats.
Do not invent measured timestamps. It updates these fields from synthesized
audio and local alignment, then returns production frames for another review.

## Review and export

Call preview on each scene after structural edits. Its returned PNGs cover
beat boundaries and action midpoints. Inspect them: recognizable objects,
visible causes and consequences, count consistency, stable identities,
readable type, sufficient contrast, no collisions or frame/caption clipping.
Check performance anticipation/action/settle at its local times. After narration,
review the measured final timing and avoid holding an unchanged diagram merely
to reach a target length. State real limitations in story.json's review.

Finish saves only the reviewed derivative, preserving its origin mapping.
Export uses the saved notebook through Incredible's normal video renderer.
