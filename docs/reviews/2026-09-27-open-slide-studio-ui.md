# A quieter Studio: the Open Slide pass

This records the UI consolidation planned in `docs/plans/2026-09-27-open-slide-inspired-studio-ui.md` (in the main checkout, not committed on this branch). It keeps Incredible Studio's brand exactly: the logo and name, the green identity colour (`#16a34a`, `#4ade80` on dark), Gilroy for titles and controls, InterBody for reading text, and the dark header. What it borrows from Open Slide is the arrangement and the restraint: quiet chrome, a dominant stage, one scene rail, details on demand.

## D1 · Baseline

- Branch `claude/open-slide-studio-ui`, from `eea103f8` — the tip of `claude/scene-review-loop` (PR #16), fetched and matching `origin` on 27 September 2026.
- Baseline screenshots come from the desktop checks' own captures on that commit (`*_SHOTS` / `*_CAPTURE_DIR`), on a throwaway store with stub harnesses. The ones kept are in `2026-09-27-open-slide-studio-ui-evidence/before-*.png`.
- All checks captured passed on the baseline: project switch, source intake, source design, presentation export, wireframe retry, scene workspace, scene review, scene timeline, planning progress, preview exhausted and scene recording.

What the baseline shows at 1440×900 in a video scene: two dark bars and a light scene header, about 190px of chrome before the stage, and two green or primary-looking actions competing for the same scene (the command bar's "Review scene 1" and the scene header's "Preview r1"), beside "Planning workspace", "Approve r1 without a preview", "Revise the plan" and "Context". The stage choice is a row of four chips under the stage plus a caption. A storage notice takes a further 76px.

## D1 · Every control, and where it goes

Each control keeps its id, so the scripted checks and the code that drives it stay stable; only its place changes. "Header" is the one dark row; "context row" is the light row under it, which belongs to the open artifact.

### The two dark bars

| Today | Id | New place |
| --- | --- | --- |
| Logo, back to themes | `.brand`, `#studio-logo` | Header, left — unchanged |
| Projects menu | `#notebook-menu-toggle`, `#notebook-menu-list` | Header: "Projects /" before the title, the same menu |
| Project title | `#project-title` | Header, after "Projects /", left-aligned |
| Lineage ("from …") | `#notebook-lineage` | Header, after the title, muted |
| Notebook switch | `#notebook-switch` | Header, centre: Text · Wireframe · Presentation · Video, icon and label; each one's state in its tooltip and a small dot |
| Saved / Saving… | `#save-state` | Header, right, compact |
| Export notice | `#export-status` and its actions | The Jobs panel; the Jobs control counts it and marks it when it needs you |
| Publish | `#render-video` | Export menu: "Export video…" |
| Export PDF | `#export-presentation` | Export menu, in a presentation |
| AI settings | `#open-ai-settings` | Header, right, compact: the AI mark and its status dot; the summary is its tooltip |
| Format | `.format-control` | More menu, as information (it is not a control) |
| Scenes / Notebook | `#workspace-tab-scenes`, `#workspace-tab-notebook` | The context row's view switch, in a video |
| Preview | `#open-fullscreen-tab` | Removed: the same as "Open canvas" in the More menu, and the stage's own "Full screen" |
| Theme and Edit themes | `#studio-theme-selector`, `#open-theme-builder` | More menu, "This project" |
| Import menu | `#import-menu-toggle` and its six items | More menu, "Add to this notebook" — the items keep their ids |
| Next step | `#next-step` | Context row, the artifact's one primary action. In the Scenes view the scene's own action owns it, and the command-bar copy is gone |
| Planning workspace | `#open-planning` | More menu, and the scene's Details drawer ("Open the planning workspace") |
| Advanced | `#advanced-menu-toggle`, `#advanced-menu-list` | Becomes the More menu (…); its four older paths keep their ids under "Older paths" |

### Under the bars

| Today | Id | New place |
| --- | --- | --- |
| Explainer build progress | `#explainer-progress` | The Jobs panel |
| Storage warning | `#storage-warning` | A compact notice under the header; it stays until resolved |
| Migration offer | `#migration-banner` | A compact notice under the header |
| Notebook heading | `.panel-heading`, `#notebook-title` | The context row, with the source and brand (`#project-strip`) |
| Reset sample | `#reset-sample` | More menu, last, still asking first |
| Running work of other notebooks | `#project-strip-jobs` | Kept in the context row, and listed in the Jobs panel |

### The scene workspace

| Today | Where it goes |
| --- | --- |
| ‹ Notebook | The view switch at the start of the scene's context row |
| Scene N of M and its title | Context row |
| Voice | Context row, compact; the Record tab keeps "Who speaks" |
| Plan revision | Context row |
| Status line | Context row |
| Secondary actions | A "More actions" menu beside the primary action |
| Primary action | Context row, the only primary button on screen |
| Context | "Details", opening the same drawer |
| Reference / Plan preview / Produced scene chips | One stage selector under the stage: "Reference: designed slide", "Reference: wireframe", "Preview rN", "Produced scene" |
| Full screen, Phone size, Focus stage | The stage's tool row |
| Play, clock, moments, Timeline | Unchanged in place; restyled |
| Rail, inspector, drawer | Unchanged in place; restyled, 168px and 304px at 1440 |
