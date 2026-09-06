---
description: One-pass Plan Motion without confirmations — decisions in context, one lockless validation, the plan written into the block.
---

# Quick Plan

Trigger: the editor's *Plan from narration*, an API call with narration, or explicit "just plan it". Removes interaction and durable planning, not the rules.

1. `atomize` + `measure` (or read the studio's persisted geometry).
2. Infer the motion contract from the block kind and the notebook: camera present? speakers? narration source? Keep it in context.
3. `plan_beats` with narration and geometry; keep the brief in context (the studio may store it in the block).
4. `resolve` every beat with the default preset column; no lock file.
5. `validate --stage final --quick`; one consolidated repair; one rerun. Errors block present/publish, never save.
6. Write the plan into the block (`steps[]`, or the V2 `stage`/`steps` form). No receipt file; the validator's summary is the receipt.

The planner model returns strict JSON restricted to `id, title, explanation, narration, intent, template, hero, supporting, actions[{op, targets, from, to, value}]`. Camera only for a sentence with a camera cue; connect only in highlight mode; move only to a unit; no timing, ease, except, freeform.
