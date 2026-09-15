# page-master — pages from sources or a topic

The studio's page production is adapted from **ppt-master** (MIT, © 2025–2026 Hugo He,
https://github.com/hugohe3/ppt-master), vendored under `vendor/ppt-master/` with its
licence. ppt-master proved that a full page-production workflow runs on an agent
harness with no agent code of its own; the studio keeps that discipline and changes
the output contract so the pages can be atomised, measured, directed and animated.

## What is vendored

From `skills/ppt-master` at version 6.4.0, text and templates only (4 MB of the
120 MB skill):

- `SKILL.md`, `workflows/` — entry, routing, Plan → Do · Check · Act, the two
  confirmations, stages, governance and profiles.
- `references/*.md`, `references/modes/` — the executor manuals (base, structure,
  structured, table, chart, image, notes, visualization), plan-core, the preset
  shape vocabulary, native shape authoring, the confirm surface.
- `scripts/*.py` and their docs — the checkers, compaction, attribution guard,
  round-trip and validation helpers.
- `templates/layouts/`, `templates/schemas/`, `templates/scaffolds/`,
  `design_spec_reference.md`, the template authoring guide.

Left out on purpose: icon, sound and brand asset libraries (62 MB), the image
renderings and palettes, the Confirm UI server and the PowerPoint animation
post-processing. They are one `git clone` away when wanted.

## How the studio adapts it

Following the page-master brief in `motion-core/skills/page-master`:

**Keep.** Entry and routing; Plan → Do · Check · Act; the two confirmations (the
outline, then the pages); `design_spec` §IX with the audience move and the
relationships; the spec lock; the executor manual and its module routing; the
checker cadence and the carrier receipt; topic research with fact ids; failure
recovery.

**Change.**

| ppt-master | the studio |
|---|---|
| the checker runs as a script over `svg_output/` | `checkPageContract` in `apps/studio-v2/server/source.ts` runs at generation, and the atomiser's `contractReport` scores every page at the door (share declared vs inferred) |
| slide markup for PowerPoint fidelity | the **page contract**: stable ids per structure, separated labels, directed connectors with markers, `data-role` (`node`, `connector`, `background`, `decoration`, `header`, `footer`), `data-kind` on nodes, `data-verb` / `data-from` / `data-to` on connectors, `data-page-role` on the root, single-tspan numbers, an optional `data-world` larger than the frame |
| `svg_output/` | the notebook's scenes (`attrs.svg`), each with its idea (`directorNotes`) and first-draft line (`script`) |
| speaker notes | narration for the motion planner: the script-first flow (`script-plan.ts`) makes the plan from the lines |
| PPTX export | optional; the video is the product |
| a topic or a brief | a link, a narrative, a PDF or a deck (`/api/source/read`, `/api/source/file`) → outline → pages |

**Drop.** PowerPoint-specific animation post-processing (motion belongs to the
planner and the driver), the Confirm UI server (the studio's dialogs are the
gates), and the template libraries unless wanted.

## Where the pieces live

- Entry flow and page generator: `apps/studio-v2/server/source.ts`
  (`readSourceUrl`, `readSourceNarrative`, `outlinePrompt`, `renderPage`,
  `checkPageContract`), routes in `apps/studio-v2/server/index.ts`.
- The door for a PDF or a deck: `/api/source/file` (poppler or pypdf for PDF,
  the slide XML for `.pptx`).
- The contract on the way in: `apps/studio-v2/src/slide-atoms.ts`
  (`atomizeSlideSvg`, `contractReport`, `attachAppearance`).
- What the rows depict: `apps/studio-v2/src/page-model.ts`.
- The bundled sample deck (fifteen ppt-master pages, blueprint style):
  `apps/studio-v2/public/samples/attention-is-all-you-need/`.

## Running ppt-master itself

The vendored skill still runs as a harness skill for producing decks outside the
studio: point the harness at `vendor/ppt-master/SKILL.md` and follow its load order
(its `scripts/attribution_guard.py` checks the tree; the assets it may ask for are
the ones left out above).
