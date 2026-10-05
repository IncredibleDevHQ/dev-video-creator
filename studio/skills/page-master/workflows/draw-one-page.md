# Draw One Page — runtime authority

One more page for a deck whose design system already exists. The deck's first call (`workflows/draw-pages.md`) wrote the communication contract, the design spec and the spec lock; this call draws the single page named `draw` in `motion/inputs.json` against them, so every page of the deck looks like one deck.

`Design system (given) → Executor (one page) → Checker → Visual review → Submit`

## Inputs

- `motion/inputs.json`: the same inputs as the first call (`video`, `brand`, every `scenes[]` entry, `objects[]`) plus `draw`, the index of this page.
- `packet/retained-pages/`: `contract.md`, `design_spec.md`, `spec_lock.md`, and one or two pages already drawn, as examples of the deck's look. Copy the three design files into `pages/` unchanged. Do not copy the example pages, and do not redraw them.
- `packet/PROGRESS.json`: which pages are drawn and which one is this call's.
- `packet/FIX.json`, when present: the problems the deck check found in this page, with the refused draft among the retained pages. Correct that draft rather than starting over.
- `packet/EDIT.json` and `packet/CURRENT_PAGE.svg`, when present: the creator's change to this page, and the page as it is. `target`, when set, is the element they pointed at: change that part first, and keep everything they did not ask to change.

## Read, once

1. `pages/design_spec.md` and `pages/spec_lock.md` — the authority. A page that departs from the lock is a bug in the page.
2. `${SKILL_DIR}/references/page-contract.md` — what the studio reads from the page. It is not negotiable.
3. For a `diagram` page, `${SKILL_DIR}/references/objects.json` and `${SKILL_DIR}/vendor/ppt-master/references/executor-structure.md` §1–§3.

Read the other vendored manuals only if the spec leaves a decision open. Start writing early: save the SVG first, then refine it.

## Draw

Write `pages/NN_<slug>.svg` and `pages/NN_<slug>.program.json` exactly as `workflows/draw-pages.md` Stages 4 and 4b describe, for this page only, with its scene's exact title and kind. "Forms, not boxes" and "The look, in one place" in that file apply unchanged: no page furniture, and connector labels in clear space beside their lines.

## Check and submit

Run `python3 ${SKILL_DIR}/scripts/check_pages.py pages` and fix what it names until it passes. Read the page back as in Stage 6. Then call `pages_submit_page` with this run directory, the page's `index`, its `form` and its `topology`. Correct a refusal and submit again; stop after acceptance.
