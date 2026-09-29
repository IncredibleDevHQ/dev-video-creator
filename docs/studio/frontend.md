# Front end

`apps/studio-v2/src` — the studio the creator sees, one page (`index.html`)
drawn by `main.ts` and the modules beside it. It runs in the desktop app and,
for development, in a browser (`yarn studio`).

## Where things are

| Surface | Code |
| --- | --- |
| Projects (the library), its introduction on a fresh profile | `openNotebooksPage` / `renderNotebooksPage` in `main.ts`, `ui/library.css` |
| The header: project, the four notebooks, Jobs, Export, More | `index.html` (`.topbar`), `notebook-switch.ts`, `project-shell/jobs.ts` |
| The context row of the open notebook: view, source and theme, next step | `index.html` (`#contextbar`), `renderProjectStrip` in `main.ts` |
| A notebook's document (Tiptap v3, stable node IDs) | `main.ts`, `scene-node.ts`, `media-nodes.ts`, `packages/node-identifier` |
| The page view of a wireframe or presentation | `page-workspace/` (`pages.ts` is its model, `page-workspace.ts` its view) |
| A video's scenes, around one stage | `scene-workspace/workspace.ts`, `planning/` (brief, plans, previews, production) |
| The source dialog (link or pasted text, theme) | `window.__source` and the `source-*` code in `main.ts` |
| Themes | `#theme-app` in `index.html`, the theme lab code in `main.ts` |
| AI settings: harness and model per stage, or the direct API | `harness-choice.ts`, `#ai-settings-dialog` (`openAiSettings` in `main.ts`) |

`main.ts` is large and imperative: it draws a view, and draws it again when
its state changes. New behaviour goes into a module of its own with a small
interface and a unit test, and `main.ts` calls it — as `page-workspace/`,
`project-shell/` and `ui/` do.

## Routes

`/projects` opens Projects (the default: a fresh profile lands there, with an
introduction and **New project** / **Explore an example**), `/studio` the open
notebook, `/themes` the theme library. `navigateToSurface` and
`surfaceOfPath` in `main.ts` own them; the desktop app reopens the path the
creator left (`apps/studio-desktop/src/main.ts`). Closing Projects returns to
`/studio`.

## Shared components

The studio's controls come from `ui/`: plain DOM and CSS, no framework, each
with a Vitest test in happy-dom (`// @vitest-environment happy-dom`).

| Component | Module |
| --- | --- |
| Tokens: type, spacing, surfaces, lines, focus, motion; light and dark | `ui/tokens.css`, `ui/palette.css` |
| Buttons (24/28/32/36), icon tools, focus ring | `ui/shell.css` |
| Icons (Lucide paths; `icon('name')`, or `data-icon` in markup) | `ui/icons.ts` |
| Tooltips (one layer that lends every `title`) | `ui/tooltip.ts` |
| Toasts (stacked; tones; an action) | `ui/toast.ts` |
| Menus, selects (the native select kept as the value) | `ui/menu.css`, `ui/select.ts` |
| Tabs: segmented, and line tabs, with a tab list's keys | `ui/tabs.ts`, `ui/tabs.css` |
| Dialogs: one shell, focus on the first field, toasts inside | `ui/dialog.ts`, `ui/dialog.css` |
| Badges and state tones | `ui/badge.css` |
| Fields | `ui/field.css` |
| The overview of all pages or scenes | `ui/overview.ts` |

Use them before adding a control of your own, and use the tokens rather than
literal colours: every surface must read in both appearances (More →
Appearance).

## Styles

`main.ts` imports the stylesheets in cascade order: `styles.css` first (the
older rules), then `ui/tokens.css`, `palette.css`, `shell.css`, `library.css`,
`labels.css`, and last the shared components' sheets (`tabs.css`,
`dialog.css`, `badge.css`, `field.css`, `surfaces.css`), so they win. A module
that `main.ts` imports before those — `scene-review.ts`, for one — must not
import CSS itself, or its rules land before the ones they should follow.
`[hidden]` always hides (`styles.css`).

## Tests

- `yarn workspace studio-v2 test` — Vitest, the front end's and the worker's
  unit tests.
- `yarn workspace studio-v2 typecheck` — TypeScript over `src/` and `server/`.
- What a unit test cannot see — layout, focus, a flow across notebooks — is
  a desktop check ([Checks](checks.md)), which drives the real app.
