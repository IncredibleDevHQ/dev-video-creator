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
  "demonstration": {
    "text": "Three tokens; request A arrives",
    "values": [ { "value": "3 tokens", "basis": "illustrative" } ],
    "example": {
      "before": "The bucket holds 3 tokens", "action": "Request A spends one",
      "after": "2 tokens remain", "unchanged": null, "observed": "Request A passes",
      "later": "With the bucket empty, the next request is refused — the next scene"
    }
  },
  "ledger": {
    "quantity": "tokens in the bucket", "capacity": 3, "initial": 3,
    "events": [ { "moment": "m1", "what": "request A is admitted", "change": "consume", "amount": 1, "after": 2 } ],
    "final": 2
  },
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
      "performance": "Tokens leave one at a time as requests are admitted",
      "asset": { "status": "reuse", "ref": "<libraryKey from VISUAL_CAST.json>", "reason": "The page's own bucket already has three separate tokens to spend" } }
  ],
  "treatments": { "presenter": "…", "text": "…", "camera": "…" },
  "skills": [
    { "skill": "hyperframes-creative", "references": ["skills/hyperframes-creative/references/beat-direction.md"], "why": "Beat planning of the explanation" },
    { "skill": "hyperframes-animation", "references": ["skills/hyperframes-animation/rules-index.md"], "why": "Choosing the path and camera recipes" }
  ],
  "requirements": { "assets": ["A request packet"], "takes": [], "decisions": ["Delivery for this scene"] },
  "continuity": {
    "entry": "Bucket full, no requests", "exit": "Bucket holds two tokens; request A admitted",
    "incoming": { "kind": "self-contained" },
    "outgoing": { "kind": "proposed", "note": "The next scene could open on the two remaining tokens" }
  },
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
- `objects[].asset` — what the scene does for the thing's artwork, with a
  `reason` tied to what the viewer needs to understand:
  - `reuse` — an ingredient unchanged, by its `libraryKey` in
    `VISUAL_CAST.json` (or a key from `plan_assets`) as `ref`;
  - `adapt` — that ingredient recoloured or re-rigged (`ref` as above);
  - `enrich` — a richer version made from its silhouette, role and parts
    (`ref` as above); a provider failure leaves an unmet requirement, never
    a plain box;
  - `native` — exact shapes, charts, counts, code or labels, where exactness
    preserves correctness;
  - `generate` — new artwork where nothing in the cast serves;
  - `omit` — left out (then no moment may move it);
  - `undecided`.
  Planning never generates, adapts or enriches anything itself; it decides.
  A cast ingredient whose verification is `mismatch` is a reference only.
  An affordance (a part the page animates) says what can move, never what
  the scene must do with it.
- `skills[]` — the pinned skills whose guidance shaped the plan, the files
  you read, and why. A scene may combine several.
- `coverage[]` — for **every** communication need of every unit you take on
  (copy the need text from EXPLANATION.md exactly): the moments that meet it,
  or `deferred` with a reason.
- `rosterProposal` — `null`, or a proposal to `split`, `merge` or
  `resequence` scenes, naming video scene ids and the reason. Proposals are
  reviewed; they never change the roster by themselves.
- `demonstration.example` — required when the scene explains how state
  changes (a write, a copy, a commit, an update, a queue, a cache, a count):
  one small concrete case with real values. `before` — what is there, with
  its value; `action` — the operation; `after` — the changed state;
  `unchanged` — what stays as it was, when something does (a snapshot, an
  old version, another reader), else `null`; `observed` — what someone then
  sees or gets; `later` — what the case leads to that belongs to another
  scene, named as such, else `null`. The moments show it: its values appear
  on screen where they change, so the result is understood without the
  plan. Keep the example `PREVIOUS_PLAN.json` gives unless the direction
  changes it, so revisions can be compared. The review shows it in one line
  — before → action → observed — under the takeaway.
- `ledger` — required when the demonstration counts something (tokens,
  slots, requests, retries): what is counted, its `capacity` (or `null`),
  the `initial` count, every change in the order it happens — `add`,
  `consume` or `refuse`, with the `moment` it happens in and the count
  `after` it — and the `final` count. The product replays it: nothing is
  consumed that is not there, a refused request consumes nothing (amount 0)
  and is refused only when too little remains (`needs`, default 1), an add
  never overfills the capacity, and every stated count must be the count.
  Illustrative numbers are welcome; they must still obey the mechanism.
  `null` when nothing is counted. A change the mechanism makes by itself at
  a steady pace — a refill, a leak — is a rate: declare it in `ledger.rates`
  (`id`, `what`, `change`, `amount`) and tag each change it makes with
  `rate`. A rate acts on every beat while there is room (or supply), so list
  every change it makes, between the others, in order. The sketch gives the
  rate its period, and is refused if its beat and your ledger disagree.
- `continuity.incoming` / `continuity.outgoing` — how the opening and the
  ending meet the neighbours in `NEIGHBORS.json`: `self-contained` (needs
  nothing from them), `agreed` (rests on the neighbour's **reviewed** plan;
  the product records which revision, and the agreement breaks when that plan
  changes) or `proposed` (asks for a boundary the neighbour has not promised —
  provisional until both sides agree; say what in `note`). Never describe a
  neighbour's image as fact when its plan does not promise it; with no
  reviewed plan, open self-contained or propose.
- `delivery.voice` — the creator's choice when SCENE.md states one;
  otherwise `undecided`, with any suggestion in `note`. A scene the creator
  made generated-only shows no presenter.

## What the product checks

Everything above that says "must", plus: `scene` matches SCENE.md;
`originScenes` are this scene's; units and evidence exist in the brief; ids
are unique; every moment has a purpose, an observation, an attention target
and at least one channel; catalogued recipe ids exist in the pinned catalog;
skills and references are files of the pinned bundle; reused assets exist in
the library; roster proposals name real scenes and give a reason; a ledger
adds up, moment by moment; an agreed seam rests on a reviewed neighbour; a
concrete example gives before, action, after and observed. A
demonstration that counts without a ledger is reported. It also
reports, as construction risks, every adapted recipe and every catalogued one
not yet proven in the installed runtime.
