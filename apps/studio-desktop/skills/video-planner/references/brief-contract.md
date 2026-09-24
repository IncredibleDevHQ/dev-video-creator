# The Explanation Brief — `planning/brief.json`

The brief is the video's counterpart of the outline that fed the slides. It
reduces the retained source and the creator's narrative into what needs
explaining and how the idea develops. It is **not** a shot plan: no scene
boundaries, camera moves, recipes, coordinates, rigs or exact seconds. If the
creator explicitly asked for one of those, keep it — as creator guidance, in
prose.

Keep three kinds of statement apart everywhere a `basis` is asked for:

- `source` — the retained source says so (and a unit cites the passage);
- `creator` — the creator wrote or decided it (narrative, scene scripts,
  direction), as `NARRATIVE.md` carries it;
- `suggestion` — you propose it. Suggestions stay revisable.

The page notes in `PRESENTATION.md` were written for the slides — their
layout, their presenter panel, their legibility — not by the creator for the
video. Read them as reference. Never cite them as `creator`, and do not carry
their slide-layout constraints (a presenter chip or panel, a text-size gate)
into the brief as requirements.

A condition may also be `illustrative`: a value you chose to demonstrate with
(three tokens, request A) that the source does not specify.

## Shape

```json
{
  "schemaVersion": 1,
  "purpose": {
    "deliverable": "Narrated technical explainer",
    "audience": "Developers learning request admission",
    "message": "Available tokens decide whether a request passes; exhaustion causes rejection until refill.",
    "language": "en",
    "requestedSeconds": 90,
    "styleConstraints": []
  },
  "source": {
    "revisionRef": "<CONTEXT.json sourceRevision>",
    "narrativeRef": "<CONTEXT.json narrativeRevision or null>",
    "wordingPolicy": "<CONTEXT.json wordingPolicy>",
    "coverage": "full",
    "limitations": []
  },
  "evidence": [
    { "id": "ev-consume", "kind": "source", "text": "Each request that is admitted consumes one token.", "locator": "¶3" },
    { "id": "ev-calm", "kind": "creator", "text": "Keep it calm and concrete." }
  ],
  "entities": [
    { "id": "bucket", "name": "Token bucket", "role": "Stores admission capacity and refills it over time",
      "interactions": ["admits a request while it holds a token"], "evidenceRefs": ["ev-consume"],
      "legacyObjectIds": ["obj-token-bucket-2"] }
  ],
  "units": [
    {
      "id": "admission",
      "question": "Why does a request pass?",
      "explain": "An admitted request consumes one token of stored capacity.",
      "evidenceRefs": ["ev-consume"],
      "entities": ["bucket"],
      "conditions": [
        { "text": "An accepted request consumes exactly one token.", "basis": "source" },
        { "text": "The bucket starts with three tokens.", "basis": "illustrative" }
      ],
      "demonstration": null,
      "observations": [],
      "communicationNeeds": [
        { "need": "Make the link between a token and admission perceptible", "why": "The mechanism is the point", "basis": "suggestion" }
      ],
      "preserve": ["Mark invented counts as illustrative"],
      "originScenes": ["<base scene id>"],
      "dependsOn": []
    }
  ],
  "progression": [ { "unit": "admission", "note": "The normal case first", "ordering": "causal" } ],
  "narrative": { "approvedLines": [], "terminology": [ { "term": "token bucket", "meaning": "a store of admission capacity" } ], "omissions": [] },
  "material": { "themeRef": "<CONTEXT.json themeRef>", "baseNotebookRef": "<CONTEXT.json baseNotebook>", "baseRevision": "<CONTEXT.json baseRevision>", "assetRefs": [], "takeRefs": [] },
  "delivery": { "sceneDecisions": [], "unresolved": "Voice source and presenter visibility will be decided per scene." },
  "creativeGuidance": [ { "text": "Keep it calm and concrete.", "basis": "creator" } ],
  "openDecisions": ["Demonstration details, scene boundaries, visual treatment and selected capabilities"],
  "uncertainty": [],
  "route": { "workflow": "general-video", "reason": "A narrated explainer with per-scene delivery; one owning workflow." },
  "coverage": [ { "scene": "<base scene id>", "units": ["admission"] } ]
}
```

## What the product checks

- `schemaVersion` is 1.
- `purpose.deliverable`, `audience` and `message` are present.
  `requestedSeconds` is the creator's chosen total length from
  `CONTEXT.json`, or `null` — never a sum of slide estimates.
- `source.revisionRef`, `source.wordingPolicy` and all of `material` repeat
  exactly the values pinned in `CONTEXT.json`.
- `source.coverage` is `full` only when `SOURCE.md` holds the full retained
  text. With fragments, say `fragments` and write the limitation.
- **Evidence is quoted exactly.** Every `source` passage must occur in
  `SOURCE.md`; every `creator` passage in `NARRATIVE.md`. Spacing, case and
  typographic quotes are forgiven; an ellipsis (`…`) may join fragments in
  order. A paraphrase is refused. Keep passages short and specific.
- Ids are unique; every reference resolves (evidence, entities, units).
- Every unit has a question, what it explains, at least one evidence
  reference and at least one communication need (the need and why it
  matters). Needs describe what the viewer should hear, see or read — not
  which medium or recipe satisfies them.
- `demonstration` is `null` unless the source or the creator already gave
  one (`basis` `source` or `creator`). A proposed demonstration belongs to the
  creative plan; list it under `openDecisions`.
- `observations` lists only what the creator requires the viewer to notice.
- `dependsOn` records causal dependencies; there are no cycles. `progression`
  lists every unit exactly once, marking each step `causal` or `editorial`.
- `coverage` accounts for **every** base page in `CONTEXT.json`: map it to
  units, or leave it out with an `omittedReason`. `originScenes` of a unit
  are base page ids — lineage, not scene boundaries.
- With `wordingPolicy` `preserve`, `narrative.approvedLines` carries the
  approved scripts verbatim, one entry per video scene that has one (the
  scene ids in `CONTEXT.json` `videoScenes`; the scripts in `NARRATIVE.md`).
- `delivery.sceneDecisions` repeats only choices listed in `CONTEXT.json`
  (keyed by video scene id); everything else stays in `delivery.unresolved`.
- Two id spaces, used on purpose: `coverage` and `originScenes` name **base
  pages** (lineage); `approvedLines` and `sceneDecisions` name **video
  scenes** (what the video speaks and how).
- `route.workflow` is one of `general-video`, `faceless-explainer`,
  `motion-graphics`, `talking-head-recut`, with a reason.
- None of these keys may appear anywhere as structure: `kind` (outside
  `evidence` and `uncertainty`), `parts`, `seconds`, `durationMs`, `camera`,
  `recipe(s)`, `blueprint`, `shot(s)`, `x`, `y`, `width`, `height`,
  `selector`, `layout`.
