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

1. Read this file.
2. Read `${SKILL_DIR}/workflows/draw-page.md` — the only route. It names the packet files to read; read nothing else.

| Route | Runtime authority |
|---|---|
| Draw Page | `workflows/draw-page.md` |

**Hard rule — one page per call.** Draw only the page in `packet/PAGE.json`, submit it with `pages_submit_page`, and stop. The studio writes the deck's spec, draws the named icons in, checks the page on submission, and writes the receipt.

**Hard rule — the spec governs.** Every page is drawn against `packet/SPEC.md`, so the pages read as one deck.

**Hard rule — no questions.** The packet carries everything the page needs. Decide, draw, submit, stop.

## Vocabulary

| Term | Meaning |
|---|---|
| **Scene** | one page of the video with a title, a kind, an idea, a first-draft narration line, parts and relations |
| **Part** | a thing on the page: a box (a node), a label, a number, a quote, a row |
| **Relation** | an arrow between two parts carrying a verb (`sends to`, `waits for`, `splits into`, …) |
| **Contract** | the ids, roles and attributes the studio reads (workflows/draw-page.md) |
| **Chrome** | the background and the header — drawn, never animated |
