# The scene treatment — `planning/treatment.json`

A treatment is the creative plan for one video scene: how its idea unfolds as
a sequence of **moments**, and within each moment which **channels** carry it
at once — narration, objects, text, presenter, camera, audio. It is a proposal
the creator reviews. It is not executable yet: no selectors, no coordinates,
no frame timing. Durations are estimates until audio or a take exists.

Channels overlap. A moment is not "the speaker section" or "the motion
section": the voice can explain while an object changes and a label lands.
Use only the channels a moment needs; `null` means the channel is unused.

## Shape

```json
{
  "schemaVersion": 1,
  "scene": "<SCENE.md video scene id>",
  "originScenes": ["<base page ids from SCENE.md>"],
  "units": ["admission"],
  "question": "Why does a request pass?",
  "takeaway": "An admitted request spends one token.",
  "evidenceRefs": ["ev-consume"],
  "development": "Establish the bucket as stored capacity, then follow one request as it spends a token and passes.",
  "demonstration": { "text": "Three tokens; request A arrives", "values": [ { "value": "3 tokens", "basis": "illustrative" } ] },
  "moments": [
    {
      "id": "m1",
      "title": "Establish capacity",
      "purpose": "The viewer needs the store before the spend",
      "observation": "Three tokens sit in the bucket",
      "narration": { "job": "Introduce the bucket as stored capacity", "guide": "A token bucket holds capacity." },
      "objects": { "change": "The bucket settles, full", "actors": ["bucket"] },
      "text": { "content": "token bucket", "role": "term" },
      "presenter": { "visibility": "undecided", "reason": "Could introduce the idea if a take is recorded" },
      "camera": { "treatment": "hold", "subject": "the bucket", "reason": "Let the spatial map settle" },
      "audio": null,
      "attention": "the bucket",
      "recipes": [
        { "id": "svg-path-draw", "catalog": "rule", "purpose": "Draw the route requests will take", "channel": "objects", "controls": ["route"] }
      ],
      "evidenceRefs": ["ev-consume"],
      "estimateSeconds": 5
    }
  ],
  "objects": [
    { "entity": "bucket", "role": "Holds admission capacity", "appearance": "A dimensional bucket with separable tokens",
      "performance": "Tokens leave one at a time as requests are admitted", "asset": { "status": "reuse", "ref": "<asset key from plan_assets>" } }
  ],
  "treatments": { "presenter": "…", "text": "…", "camera": "…" },
  "skills": [
    { "skill": "hyperframes-creative", "references": ["skills/hyperframes-creative/references/beat-direction.md"], "why": "Beat planning of the explanation" },
    { "skill": "hyperframes-animation", "references": ["skills/hyperframes-animation/rules-index.md"], "why": "Choosing the path and camera recipes" }
  ],
  "requirements": { "assets": ["A request packet"], "takes": [], "decisions": ["Delivery for this scene"] },
  "continuity": { "entry": "Bucket full, no requests", "exit": "Bucket holds two tokens; request A admitted" },
  "unresolved": ["Presenter visibility depends on the delivery choice"],
  "coverage": [ { "unit": "admission", "need": "Make the link between a token and admission perceptible", "moments": ["m1"] } ],
  "rosterProposal": null,
  "delivery": { "voice": "undecided", "note": "A presenter introduction would suit a recorded take" }
}
```

## Fields

- `moments[].purpose` — why the viewer needs to see this. `observation` —
  what they should notice. `attention` — the one primary target.
- `narration.guide` — the spoken idea as guidance. When the brief carries
  approved lines for this scene, those words are the narration; use `job` to
  say what the line does, and quote only approved words in `guide`.
- `objects.change` — the before → after change; `actors` are brief entity ids
  (or `objects[].entity` ids this plan introduces).
- `text.role` — `term`, `label`, `exact` (a source quotation that must be
  read), `code`, `takeaway`. Narration does not become paragraphs on screen.
- `presenter.visibility` — `full`, `shared`, `hidden` or `undecided`, with a
  reason. A suggestion only; it never decides the delivery.
- `camera.treatment` — the reason and subject of any move; `hold` is valid.
- `recipes[]` — each names where it comes from:
  - `rule`, `blueprint` or `technique`: the id exactly as in
    `skills/hyperframes-animation/rules-index.md`, `blueprints-index.md` or
    `techniques.md` (a technique's id is its title in kebab case, as listed in
    `capabilities.json`);
  - `reference`: a file path of the pinned bundle (such as
    `skills/hyperframes-creative/references/typography.md`);
  - `adapted`: something no index covers, described in `purpose`.
  Give each its `purpose`, the `channel` it serves, and the actors or layers
  it `controls` — one writer per property.
- `objects[].asset.status` — `reuse` (with the asset key from `plan_assets`),
  `generate`, `native` (drawn as text, code or exact geometry) or
  `undecided`. Planning never generates anything.
- `skills[]` — the pinned skills whose guidance shaped the plan, the files
  you read, and why. A scene may combine several.
- `coverage[]` — for **every** communication need of every unit you take on
  (copy the need text from EXPLANATION.md exactly): the moments that meet it,
  or `deferred` with a reason.
- `rosterProposal` — `null`, or a proposal to `split`, `merge` or
  `resequence` scenes, naming video scene ids and the reason. Proposals are
  reviewed; they never change the roster by themselves.
- `delivery.voice` — the creator's choice when SCENE.md states one;
  otherwise `undecided`, with any suggestion in `note`. A scene the creator
  made generated-only shows no presenter.

## What the product checks

Everything above that says "must", plus: `scene` matches SCENE.md;
`originScenes` are this scene's; units and evidence exist in the brief; ids
are unique; every moment has a purpose, an observation, an attention target
and at least one channel; catalogued recipe ids exist in the pinned catalog;
skills and references are files of the pinned bundle; reused assets exist in
the library; roster proposals name real scenes and give a reason. It also
reports, as construction risks, every adapted recipe and every catalogued one
not yet proven in the installed runtime.
