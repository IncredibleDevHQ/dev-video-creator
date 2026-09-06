---
name: motion-master
description: >
  Plans, resolves and checks the motion of a notebook page or slide for a narrated
  technical video: beats from narration, heroes and relationships, actions on the
  six primitives, timing from tokens, a validated resolved plan the studio driver
  paints. Use when the user asks to animate a page, plan steps or beats, plan the
  build order, plan motion from narration, reconcile a recorded take, or mentions
  motion-master. Presenter-on-camera layouts are the stage-director skill; several
  speakers are the speaker-crew profile.
metadata:
  version: "0.1.0"
  source: "The Motion Decision Core, Parts I–III"
---

# Motion Master Skill

A routed motion workflow. This entry owns execution discipline and route selection only; the selected runtime authority owns its procedure.

## Mandatory load order

1. Read this file. Retain the host-provided absolute directory of this file as `SKILL_DIR`; expand it in every command; never `cd`.
2. Read `${SKILL_DIR}/workflows/routing.md` and select exactly one route and profile.
3. Read only that route's runtime authority and the references its trigger table names.

| Route / profile | Runtime authority |
|---|---|
| Plan Motion — Default | `workflows/plan-motion.md` |
| Plan Motion — Quick | `workflows/profiles/quick-plan.md` |
| Reconcile Take | `workflows/reconcile-take.md` |

**Hard rule — selected authority only.** Never load another route's procedure after routing. Stage (presenter) and speaker references are loaded by the route's trigger table, never on their own.

## Vocabulary (one meaning per term)

| Term | Meaning |
|---|---|
| **Beat** | one sentence (or clause) of narration that names ≥ 1 unit; the unit of planning; carries a hero and an intent |
| **Hero** | the one element the beat is about; the ring says who explains it |
| **Unit** | one thing the atomiser can point at: box, label, connector, frame, group, image, speaker, overlay |
| **Primitive** | one channel writer: `alpha`, `xform`, `dash`, `content`, `view`, `spawn`, plus `clip` for the stage |
| **Operation** | a recipe of ≤ 3 primitives with a behaviour class and a persistence class: reveal, trace, dim, emphasize, pulse, move, connect, camera, morph, swap, count, exit |
| **Template** | intent → actions expansion (reveal-group, trace-flow, compare-two, zoom-and-explain, count-up, recap, handoff, transform) |
| **Brief** | `motion/brief.md`: one block per beat; owns meaning; never timing |
| **Lock** | `motion/lock.md`: preset, tokens column, stage base, roster, clock precedence, budgets |
| **Resolved** | `motion/resolved.json`: compiler output with times, eases, pivots, ports; never stored in the brief |
| **Receipt** | `motion/receipt.json`: per beat what fired vs what the brief planned; an absence needs a reason |
| **Clock** | which of four drives a beat: presenter Next, Play hold, publish cue word, recorded take |
| **Binding / Reference** | a brief field the resolver must follow / a sketch it may replace with no reason owed |

## Phase frame

Plan → Do · Check · Act. Plan ends when the brief and the lock exist (Default) or the decisions are retained in context (Quick). Do = the resolver materialises each beat under the per-beat chain. Check = `validate` at the early gate (after five beats of the first page) and the final gate, plus the receipt. Act = repair at the owning layer: the brief for a meaning fault, the lock for a token or preset fault, the page for a missing unit, the take for a clock fault. The cycle ends when `resolved.json` is handed to the studio compiler.

## Global execution discipline

1. Serial steps; a completed non-blocking step continues.
2. `⛔ BLOCKING` waits for the user; the app shows the dialog; never decide on the user's behalf.
3. No speculative artefacts before their owning step.
4. Numbers come from `references/tokens.md` (and the stage/speaker token tables); a number typed into the brief is a validator error.
5. The planner model decides meaning only: beats, heroes, attribution, values, intent. Never timing, easing, ports, pivots, persistence.
6. Act at the owning layer; never silently downgrade.

## Tools

All helpers are MCP tools served by the studio (or the worker's HTTP routes in development): see `scripts/README.md`. A skill step names the tool; the harness calls it. Never reimplement a helper in prose.
