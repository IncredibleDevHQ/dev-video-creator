# Draw Pages — runtime authority

ppt-master's Default pipeline, with its ends replaced: research and template selection are already done (the studio read the source and confirmed the outline), and the output is contract SVG rather than PPTX. Everything between is theirs, and their manuals are the authority for it.

`Inputs → Communication contract → Design Spec → Spec Lock → Executor (page by page) → Checker cadence → Visual review → Receipt`

## Inputs

`motion/inputs.json` in the project directory:

- `video`: `{ title, site }`
- `brand`: `{ palette: { ground, text, accent, secondary }, fonts: { display, body, mono }, mode }`
- `scenes[]`: `{ index, title, kind, seconds, idea, narration, parts[{ kind, label, detail }], relations[{ from, to, verb }] }`

Scene kinds: `title`, `list`, `diagram`, `numbers`, `quote`, `close`. The narration is the line the page must support — read it; it says what the page is for.

## Stage 1 — Communication contract

Write `pages/contract.md`, six lines, from the inputs alone: audience, objective, core message, consumption mode (a narrated video, watched not read), the one thing a viewer must remember, and what this deck deliberately does not cover. No user gate: the studio already confirmed the outline with the author.

## Stage 2 — Design Spec

Read `${SKILL_DIR}/vendor/ppt-master/templates/design_spec_reference.md` §§I–VI and IX, then author `pages/design_spec.md` to it — the same sections, at the depth the reference describes:

- **I Project information**, **II Canvas** (1280×720, `viewBox 0 0 1280 720`).
- **III Visual theme**: theme style in one sentence and the one visual idea that carries the deck; the colour scheme as exact hex derived from `brand.palette` — ground, surface, line, text, muted, accent, warning — each with the role it plays. One accent, one meaning.
- **IV Typography system**: the font plan from `brand.fonts` and an exact font-size hierarchy — eyebrow, page title, node label, node detail, figure, footer — in px.
- **V Layout principles**: deck-wide direction, the safe area (x 80–1200, y 120–660), the rhythm a page keeps, how the hero of a page is made to read first.
- **VI Icon usage**: the library is the project-local pool at `${SKILL_DIR}/templates/icons` (`index.json` lists every available name, `tabler-outline`, viewBox 0 0 24 24, stroke 2). Name the icons this deck will use, one per kind of thing.
- **IX Page roster**: one row per scene — index, kind, the communication move, the topology or layout it will use, the things on it and their `data-entity`, the icon each will inline.

## Stage 3 — Spec Lock

Copy `${SKILL_DIR}/vendor/ppt-master/templates/scaffolds/spec_lock.md` to `pages/spec_lock.md` and fill every field from the spec: canvas, communication, mode, visual_style, colors, typography, icons (library and stroke width), page_rhythm per page. From here the lock is the authority; a page that departs from it is a bug in the page.

## Stage 4 — Executor, page by page

Read once, before the first page, and reuse for every page:

- `${SKILL_DIR}/vendor/ppt-master/references/executor-base.md` — Page Expression Core, §2.2 per-page decision chain, §3 execution guidelines, §3.0 native shape selection, §4 icon usage, §5 font usage.
- `${SKILL_DIR}/vendor/ppt-master/references/native-shape-authoring.md` §§1–2.1 — contour before encoding: simplest exact native form → independent compound → required Boolean → necessary freeform.
- `${SKILL_DIR}/vendor/ppt-master/references/executor-structure.md` §1–§3 — relationship atoms → topology → construction order, for every `diagram` page.
- `${SKILL_DIR}/references/page-contract.md` — what the studio reads from the page. It is not negotiable.

Then, per page, follow executor-base's decision chain and write `pages/NN_<slug>.svg` (`NN` two-digit, slug ≤ 5 lowercase words).

**Icons are inlined, not referenced.** The contract forbids external references, so an icon becomes part of the page: read `${SKILL_DIR}/templates/icons/tabler-outline/<name>.svg`, take its path elements, and place them inside the thing's artwork group scaled into a 44 px box (`transform="translate(x,y) scale(44/24)"`), `fill="none" stroke="<line or accent>" stroke-width="2"`. Then add the one or two parts that make it live — a status light, a level, a token — and mark them `data-anim` (see the contract). Two or three moving parts per thing.

## Stage 5 — Checker cadence

ppt-master checks early and finally; so do you.

1. After the **first** page: `python3 ${SKILL_DIR}/scripts/check_pages.py pages` — fix what it names before drawing page two, so a mistake is made once.
2. After the **last** page: run it again over all pages and fix until it passes.

## Stage 6 — Visual review

The checker sees geometry, not judgement. Read your own pages back and ask of each: does it obey the lock; does the eye land where the narration starts; would a reader recognise the things before reading a word; is any page a grid of identical boxes. Redraw what fails, then re-run the checker.

## Stage 7 — Receipt

Write `pages/receipt.json`: `{ "pages": [{ "file", "index", "title", "kind", "topology", "entities": [{ "id", "entity", "icon", "moving parts" }], "checks": "pass" }], "spec": "pages/design_spec.md", "lock": "pages/spec_lock.md", "notes": "" }`. Then stop: do not open the notebook, do not plan motion, do not ask questions.

## The look, in one place

The spec you wrote in Stage 2 governs. What follows is the floor, not the ceiling:

- Canvas 1280×720, the ground filled, a faint construction (grid, rules, a horizon) as `data-role="decoration"` at 1–3 % opacity.
- Header: eyebrow `§ NN · VIDEO TITLE` in mono, small, accent; the page title in the display face, 34–44 px.
- Footer: site and `SHEET NN / TOTAL` in small mono, bottom right.
- Nodes: rounded rectangles (rx 12), stroke in the line colour, a real translucent fill (never `fill="none"`), label 22–26 px with its detail beneath at 17–19 px in the muted colour, and 64 px clear at the left when the node carries artwork.
- Connectors: 1.5–2 px in the accent at ~60 %, an arrowhead marker, the verb near the middle when it helps.
- Emphasis with the accent, one thing at a time. Depth from fill and weight, not from shadow.
- No page is a grid of identical boxes; the topology is the page's argument.
