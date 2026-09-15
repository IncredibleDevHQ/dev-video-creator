---
name: page-master
description: >
  Draws the pages of a narrated technical video from an outline: one 1280×720 SVG
  per scene in the video's palette, composed from the scene's parts and
  relationships the way ppt-master composes a slide, and shaped to the studio's
  page contract so the atomiser can measure it, the director can stage it and the
  motion planner can animate it. Use when the user asks to draw, redraw, design or
  lay out pages or slides for a video, or mentions page-master.
metadata:
  version: "0.1.0"
  source: "ppt-master 6.4.0 (MIT, Hugo He), adapted — see VENDORING.md"
---

# Page Master Skill

A routed page workflow. This entry owns execution discipline and route selection only; the selected runtime authority owns its procedure.

## Mandatory load order

1. Read this file. Retain the host-provided absolute directory of this file as `SKILL_DIR`; expand it in every command; never `cd`.
2. Read `${SKILL_DIR}/workflows/draw-pages.md` — the only route for now.
3. Read `${SKILL_DIR}/references/page-contract.md` before drawing anything.
4. The route runs ppt-master's own pipeline (communication contract → design spec → spec lock → executor → checker cadence → review) and names the vendored manuals to read at each stage. Read them when the route says so, and nothing else from the vendored skill.

| Route | Runtime authority |
|---|---|
| Draw Pages | `workflows/draw-pages.md` |

**Hard rule — the contract is the output.** A page that fails `scripts/check_pages.py` is not done. Fix it, run the check again.

**Hard rule — the spec governs.** Pages are drawn against `pages/design_spec.md` and `pages/spec_lock.md`, authored before the first page. Nine pages invented independently look like nine decks.

**Hard rule — no questions in the first round.** The inputs carry everything a first draft needs. Decide, draw, check, write the receipt, stop.

## Vocabulary

| Term | Meaning |
|---|---|
| **Scene** | one page of the video with a title, a kind, an idea, a first-draft narration line, parts and relations |
| **Part** | a thing on the page: a box (a node), a label, a number, a quote, a row |
| **Relation** | an arrow between two parts carrying a verb (`sends to`, `waits for`, `splits into`, …) |
| **Contract** | the ids, roles and attributes the studio reads (references/page-contract.md) |
| **Chrome** | background, header, footer, decoration — drawn, never animated |
