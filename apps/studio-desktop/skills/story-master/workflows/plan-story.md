# Plan Story — runtime authority

The source is read; your job is the outline: which scenes, in which order, each
with one idea, the parts the page must show, and the spoken draft — under the
creator's wording policy.

## Inputs

`motion/inputs.json`:

- `source`: `{ title, site, text, words }` — the material, verbatim.
- `wordingPolicy`: `preserve` | `assist` | `draft`.
- `targetSeconds` (optional): the runtime the creator asked for.

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

## Receipt

Write `story/receipt.json`:

```json
{ "scenes": 8, "wordingPolicy": "preserve", "targetSeconds": 180, "notes": "" }
```

Then stop: do not draw pages, do not plan motion, do not ask questions.
