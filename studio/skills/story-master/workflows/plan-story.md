# Plan Story — runtime authority

The source is read; your job is the outline: which scenes, in which order, each
with one idea, the parts the page must show, and the spoken draft — under the
creator's wording policy.

## Inputs

`motion/inputs.json`:

- `source`: `{ title, site, text, words }` — the material, verbatim.
- `wordingPolicy`: `preserve` | `assist` | `draft`.
- `targetSeconds` (optional): the runtime the creator asked for.

When `brief` or `packet/BRIEF.json` is supplied, it is the accepted source explanation brief. Use its question, evidence, entities, explanatory units and proposed arc to structure the story; retain its stable entity identities. Check every factual claim against the full source. Do not treat suggestions as creator requirements.

## The wording policy is the law of the narration field

- `preserve` — the creator wrote this. Each scene's `narration` reuses their
  sentences word for word wherever they carry the idea. Your job is structure
  and order, not rewriting. Never replace a personal account with generic
  explanatory prose.
- `assist` — keep their voice, claims and examples; you may tighten sentences
  and propose clearer transitions, but every edit stays recognisably theirs.
- `draft` — draft fresh narration from the material in a clear presenter voice
  (first or second person plural), two to four plain sentences per scene.

## The outline contract

Write `story/outline.json`:

```json
{
  "title": "…",
  "targetSeconds": 180,
  "scenes": [
    {
      "title": "…",
      "idea": "One sentence: the thing the viewer learns here.",
      "kind": "title | list | diagram | numbers | quote | close",
      "seconds": 30,
      "parts": [{ "label": "2–4 words", "kind": "box | step | note | number", "detail": "one line" }],
      "relations": [{ "from": "…", "to": "…", "verb": "sends to | waits for | calls | reads | writes | returns | splits into | merges into | depends on | becomes | contains | compares with | feeds | triggers" }],
      "narration": "…",
      "source": ["two to four FULL sentences copied verbatim from the source"]
    }
  ],
  "glossary": [{ "term": "…", "meaning": "one line" }]
}
```

Rules:

- 6 to 14 scenes in order; the first is `title`, the last `close`. Seconds sum
  near the target (title 12–18, close 8–14, others 20–70).
- When `motion/inputs.json` has `targetScenes`, the creator asked for about
  that many scenes: plan within two of it, still 6 to 14.
- One idea per scene. Kind follows the content's form: a mechanism or structure
  is `diagram`; a set of parallel points is `list`; figures that carry the point
  are `numbers`; a single statement that is the picture is `quote`.
- `parts`: at most 8 per scene, labels unique within the scene, 2–4 words as
  they would be drawn. `title` and `close` scenes have no parts.
- `relations` only between parts of the same scene, verbs from the allowed set.
- `source`: whole sentences copied exactly — never fragments, headings, or
  paraphrase. They carry what a drawing cannot: the number, the named example,
  the consequence, the reason. A `title` or `close` scene may have none.
- A scene's claims must come from the source or be marked as the creator's own
  framing in the narration. Do not invent numbers.

## When the creator chose a template

`story` in `motion/inputs.json` (and `packet/STORY.json`) is the narrative the
creator chose and how they want it told. It replaces `targetScenes`. The
pages come from its beats:

- `beats` are the story's narrative functions, in order. Each says what the
  viewer must know after it (`know`), the kinds of evidence it can draw on
  and roughly how long it runs in this telling (`seconds`). A beat with
  `told: false` is left out of this telling unless the source makes it
  essential; one with `expansions` grows by them.
- Plan within `pages` (a range: the fewest and the most pages). One beat may
  take several pages, and several beats may share one. Every core beat that
  is told must be on a page.
- Each scene names the beats it carries, as ids: `"beats": ["impact"]`.
  Keep the story's order. A `cold-open` or `result-first` story may open on a
  later beat's most striking moment, then go back to the start.
- The scenes' seconds add up to the telling's `length` range. `elaboration`
  and `drama` say how much each page explains and how it sounds.
- Keep the story's `rules`; its `needs` say what the source must hold.
- Each scene lists the evidence it must show that has to come from
  somewhere, `"needs": [{ "kind": "numbers", "what": "how many requests
  failed", "source": "…" }]`: a number, a quote, code, a diff, a timeline of
  events, terminal output, a product demo (`kind` one of numbers, quote,
  code, diff, timeline, terminal, demo). `source` is one full sentence
  copied verbatim from the source when it holds that evidence, or `null`
  when it does not: the creator is asked for it. A diagram is drawn from
  the source's facts, so it is never a need left for the creator; list one
  only with the sentence it rests on. Never invent the missing evidence; a
  scene may still go ahead with a need left open.
- The first scene is still the `title` (it carries the opening beat) and the
  last the `close`.

## Receipt

Write `story/receipt.json`:

```json
{ "scenes": 8, "wordingPolicy": "preserve", "targetSeconds": 180, "notes": "" }
```

Then stop: do not draw pages, do not plan motion, do not ask questions.
