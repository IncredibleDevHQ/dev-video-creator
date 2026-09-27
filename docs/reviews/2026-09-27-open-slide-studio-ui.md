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
| Theme and Edit themes | `#studio-theme-selector`, `#open-theme-builder` | More menu, "This notebook" |
| Import menu | `#import-menu-toggle` and its six items | More menu, "Add to it"; the six items keep their ids |
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
| Reset sample | `#reset-sample` | More menu, last, still asking first; not offered in a project's notebooks |
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

## D2 · The studio's tokens and its one header

- **Tokens.** `apps/studio-v2/src/ui/tokens.css` holds one `--studio-ui-*` scale for the studio's own chrome, panels, menus and controls: the brand colours, the dark header, surfaces, semantic colours, Gilroy and InterBody, a 4/8/12/16/24/32 spacing scale, 6/8/10px corners, a 32px control (44px on a coarse pointer), 140ms motion that drops to none under reduced motion, a visible focus ring. A notebook's theme, a slide, a generated SVG and an exported video never read them.
- **One control style.** `.button` is 32px, 13px Gilroy semibold, 6px corners, with no lift on hover. It is used everywhere, dialogs included.
- **One header, one context row.** The header is 56px: the logo, "Projects / Title", the four notebooks, then Saved, Jobs, Export, the AI mark and More. The context row is 48px and belongs to the open notebook: its kind, what it holds, its source and brand, and its one next step. In the Scenes view the scene workspace's own row takes the context row's place, so a video's chrome is always two rows (104px). The notices under them are 40px, not 76px.
- **Menus.** Export offers what the open notebook can be exported as: "Export video…" (Publish, `#render-video`) and "Export PDF" in a presentation. For a Text or Wireframe notebook it says there is nothing to export yet, and why. More holds the theme, format, what can be added, the planning workspace and canvas, and the older paths. Menus open under their toggle and close on a choice, a click elsewhere or Escape, with focus returned to the toggle. Arrow keys move through them.
- **Jobs.** One control with a count. Its panel lists every job to follow — this project's notebooks being made, each scene's brief, plan, preview and production runs, the export and the older explainer build — with its stage, how long it has run, who runs it, and Stop, Open or Try again. A failure, or an export ready to download, stays marked until it is seen to, and is announced once to a screen reader; a run the creator stopped is not counted as a failure. Nothing in the panel starts or polls anything: every action is its source's own (`src/project-shell/jobs.ts`, `scene-review.ts` `jobs()`).
- **One action owner.** `src/project-shell/action-owner.ts` decides who draws a video's next step. In the Scenes view it is the scene workspace's row. In the notebook it is the context row, and the scene review beside the stage keeps its approve, accept, produce and adopt actions secondary. The brief and the export belong to no scene, so they always go in the context row. The header therefore never shows a second green action for the same scene.

## D3 · The focused scene

- **The scene's context row.** Left to right: the view switch (Scenes · Notebook), "Scene N of M" and the title, who speaks, the plan revision on show, what is running, Details, and the one primary action as a split button whose menu holds the scene's other actions ("More actions for this scene"). With no primary action, the first other action stands on its own. Near 1024px, who speaks moves to the Record tab (where it is always offered), and the inspector and Details drawer open under the row, not over it.
- **One stage selector.** The row of reference chips under the stage is now one selector that always says what the stage shows: "Reference: designed slide", "Reference: wireframe", "Reference: the base's newer slide", "Preview rN", "Produced scene". Choices that cannot be shown yet stay listed and disabled, and say why ("Preview r1 · not built yet", "Produced scene · not produced yet"). A static slide is never called a preview. The stage modes keep their `data-stage-mode` buttons and handlers.
- **The plan's action names.** Following the plan's action table: "Plan scene", "Build preview of r1" / "Rebuild preview of r1", "Approve plan r1", "Approve plan r1 without a preview", "Record my lines", "Produce scene", "Review output", "Accept output". The notebook's review uses the same words, from the same selectors.
- **Layout.** A 168px scene rail headed "Scenes N", the selected scene outlined in the brand green; a 304px inspector whose selected tab is underlined in green; a recessed surround behind the stage. Labels are sentence case, not small uppercase. The workspace no longer drifts when something scrolls into view; the stage column scrolls on its own when a failure's detail is opened under it.

## D4 · The library, and a Text notebook that reads as an article

- **Library.** A gallery of project cards: a picture of the project's first page (its presentation's, else its wireframe's, else its video's, drawn as a picture that runs nothing), its name and date, and its four notebooks. The card resumes the project where it was left, and a notebook chip opens that notebook. The header links to Themes and Assets, and has New project. Notebooks outside a project and the samples stay listed underneath.
- **Text.** The article is set at about 72 characters a line in 17px body type, with a contents list of its headings beside it. The list appears from two sections up, and marks the section being read. The Text notebook's next step is "View wireframe" once its wireframe exists. While the wireframe is being made, the step waits and says so; if it could not be made, the step opens it so it can be made again.
- **Not changed.** The Source → Brand intake keeps its structure and takes the new tokens. A presentation's pending slides keep their existing states (the F2 design status and schematic placeholders).

## D5 · Recording, timeline and recovery

These kept their structure and took the new visual language: capture beside the stage, takes in the Record tab, and the single expanded timeline. A preview or production failure keeps its details under the stage, and they can now be scrolled to (`preview-exhausted-check`). Every error also stays reachable from the Jobs panel.

## The dark appearance

Added after D1–D5, under the same rule: Incredible's brand does not change, and nothing the studio makes changes.

- **The choice.** More has a Studio section with Appearance: System, Light or Dark. System follows the operating system, including when it changes while the studio is open. The choice is kept in the studio's web storage, which the desktop app keeps between runs. `index.html` applies it before the first paint, so the studio never opens in the wrong appearance. Arrow keys move between the three choices (`src/project-shell/appearance.ts`).
- **What goes dark.** The studio's own surfaces, panels, dialogs, menus and controls. The header was already dark and stays as it is. The green keeps its place: `#16a34a` for the primary action, `#4ade80` where green sits on dark. What a state means keeps its colour, as a tint on the dark surface: blue for busy, green for done, amber for a warning, red for a failure. The focus ring is a lighter indigo.
- **What never changes.** Slides and pages, generated SVG, the stage and the player, recorded takes, exported video and PDF, theme previews, code themes, thumbnails, and the small illustrations inside the pickers. An embedded composition keeps the page's default colour scheme, so the browser does not paint a dark scheme's opaque canvas behind it.
- **How.** Every colour the studio's stylesheets used for their light UI is now a token in `apps/studio-v2/src/ui/palette.css`. That covers about 1,160 declarations in `styles.css` and `workspace.css`, plus the controls and notices in `shell.css`. Each token's light value is the colour it replaced, so the light appearance is as it was. Its dark value keeps the same role on a dark surface. A small dark control on a light surface — a badge, a pressed segment, the play button — turns light on the dark surface.
- **How it was converted.** A script converted the colours and left out artwork, previews and parts that were already dark. Every rule it left out was then checked by hand, which put back 94 declarations it had left out too broadly: the Publish canvas's side panel, the presenter and layout pickers, the theme lab, the slide editor's strip and stage buttons, the teleprompter and the scene poster's frame.
- **More.** On a wide window More now shows in two columns, so every item shows at once. It also opens above a notebook's scene band.
- **The window.** Before the page paints, the desktop window shows the dark header's colour, as the page's own background does in both appearances, instead of a white flash.

## Commits

| Commit | Package |
| --- | --- |
| `d6ae2d66` | D1 · the control inventory and the baseline screenshots |
| `63181332` | D2 · tokens, one header, one context row, Jobs, the action owner |
| `676c9344` | D3 · the scene's context row, the stage selector, the plan's action names |
| `60a2aef5` | D4 · the library of project cards, the Text notebook as an article |
| `4b32bf8d` | Labels read as words |
| `6054065d` | The dark appearance · the studio's UI colours as a palette with dark values (light unchanged) |
| `78ae2373` | The dark appearance · the choice in More, applied before the first paint |

Each commit was typechecked and its unit tests run on its own (`verify-staged`: the index's content checked out, then the working tree put back). The desktop checks ran on the final code, which is what `4b32bf8d` holds. The dark appearance's palette commit was also typechecked and built on its own; its page has no appearance script yet, so nothing turns dark.

## Evidence

**Unit tests.** studio-v2: 439 tests in 55 files pass, up from 430 in 53. The new tests cover who draws the next step (`action-owner.test.ts`), the Jobs summary (`jobs.test.ts`), the Text notebook's next step, and the renamed scene actions (`next-step.test.ts`, `scene-state.test.ts`).

**Desktop checks.** Forty checks ran on a throwaway store with stub harnesses. That build differed from the final one only in three small changes: arrow keys in a menu no longer take over a field's arrows, a run the creator stopped is not counted as needing them, and a base's video is named as a video. Thirty-seven passed. The three that failed:

- `planning-progress-check`, twice. My new Jobs assertion had lost a backslash in its regular expression, so it could never match. An existing assertion read the planning status once, instead of waiting for it; the Jobs step before it had shifted the timing. Both were fixed in the check.
- `source-intake-check` still looked for primary buttons in the old command bar.
- `sample-check` hung for 300 seconds on one test-hook call. Rerun, it passed in 4 seconds.

On the final build, the seven checks those fixes and changes touch were run again and all passed: planning progress, source intake, sample, review layout, project switch, scene review and scene workspace.

The checks run: planning, source design, scene workspace, scene review, production, preview exhausted, planning progress, plan preview, presented production, scene timeline, review layout, project switch, scene flow, presentation export, restart, export, local store, source intake, wireframe retry, scene recording, preview hand-off, export recovery, visual cast, agent picker, migration, stage panel, create explainer, notebooks hierarchy, source delivery, source theme reuse, source destination, teleprompter, mic default, presenter take, build fork, wording preserve, sample, notebook draft and theme site. `skill-references-check` and `skills-install-check` were not run: they check the vendored skills installed on this machine, and failed the same way before this pass.

**What the checks now say.** They were changed only where they asserted the old chrome or the old names:

- `project-switch-check` and `source-intake-check`: Publish and Export PDF are judged by what the Export menu offers, not by a visible button. The Preview tab is gone. Primary actions are looked for in the header. The Text notebook's next step is "View wireframe".
- `review-layout-check`: the chrome is the header and the context row. The only primary action on screen is the scene's next step, since the review's Approve is secondary to it. More holds the theme, what can be added, the planning workspace and canvas, and the older paths, and every item shows whole. This replaces the separate Import and Advanced assertions.
- `scene-workspace-check`: the new names, plus a new assertion. At 1440×900 and 1280×800, the chrome is two rows of at most 112px, with one primary action, the scene's other actions beside it, and the stage saying what it shows.
- `scene-review-check`: primary actions are looked for in the header; the stage's choices have their new names.
- `planning-progress-check`: follows a run in the Jobs panel, both while it runs and once it has failed and needs the creator; the new names.
- `scene-flow`, `plan-preview`, `preview-exhausted`, `preview-handoff`, `production`, `scene-recording` and `scene-timeline` checks, and the live scripts `live-workspace-run` and `live-review-loop`: the new names only. The live scripts were not run.

**Screenshots.** In `2026-09-27-open-slide-studio-ui-evidence/`:

| Before | After |
| --- | --- |
| `before-video-1440.png` | `after-video-1440.png`, `after-video-1280.png` |
| `before-video-details-1440.png` | `after-video-details-1440.png` |
| `before-video-1024.png` | `after-video-1024.png` |
| `before-video-notebook.png` | `after-video-notebook.png` |
| `before-text.png` | `after-text.png` |
| `before-presentation.png` | `after-presentation.png` |
| `before-library.png` | `after-library.png` |
| `before-recording.png` | `after-recording.png` |
| — | `after-more-menu.png`, `after-jobs-running.png`, `after-jobs-failed.png` |

**Real content.** The new UI was opened over the §10 live run's "Write-Ahead Logging" video: real Claude Code and Opus 5.5 pages, plans and export, in the isolated PostgreSQL and MinIO store. No harness ran and nothing was made (`real-wal-*.png`). Its plans now read as out of date, because products changed since they were made, so the context row leads with "Update the brief" and the scene with "Plan scene". Its 46-second export shows in the Jobs panel as ready to download. The tour did not put a produced scene on the stage: it chose scenes by their state in the rail, and every scene there reads as out of date or not yet planned.

**The dark appearance.**

- *Light is unchanged.* Six checks' screenshots (scene workspace, project switch, review layout, planning progress, scene review, source intake) were compared pixel by pixel before and after the palette. Every difference is timing, or content that changes between runs: a tooltip, a timer, a source revision id, a page captured before it painted. The one intended change is More's new grouping.
- *Dark.* The desktop app reads `STUDIO_APPEARANCE=light|dark` so that checks and captures can force an appearance. With the studio forced dark, 22 checks ran and passed, and their screenshots were read screen by screen. A tour over the §10 video covered what no check photographs: the theme builder and theme library, the scene studio (the slide editor), Paste Markdown, the asset library, and the dialogs that start from a source or create an explainer. That reading found four faults, all fixed: the Publish canvas's side panel, whose headings had turned light on a panel that stayed white; a light frame around each page's picture in the video notebook; the play button, whose icon had turned white on white; and the scene studio's dialogue lines, whose dark grey the conversion had missed. Error text also has a lighter red in dark. After the fixes, the checks they touch ran again in both appearances and passed. `review-layout-check` now also chooses Dark, Light and System in More. It checks that each applies at once, that Dark and Light are kept, and that System follows the system again.
- *Unit tests.* studio-v2: 441 tests in 56 files pass. The new `appearance.test.ts` covers how a kept choice is read, and which appearance a choice shows.

**Screenshots of the dark appearance**, in the same folder: `dark-video-1440.png`, `dark-video-details-1440.png`, `dark-video-notebook.png`, `dark-timeline.png`, `dark-recording.png`, `dark-text.png`, `dark-presentation.png`, `dark-more-menu.png`, `dark-planning.png`, `dark-publish.png`, `dark-ai-settings.png`, `dark-theme-builder.png`, `dark-scene-studio.png`.

## Limits

- **No fresh live run.** The plan's D6 asks for a fresh technical blog through the real local harness, every artifact transition, a revised scene, production, export and restart, all on the new UI. That was not done in this pass. The real-content tour above re-used earlier live output and spent no model budget.
- **No task-based observation.** Watching someone new to the UI find the source, plan a scene and recover a failed job needs a person.
- **The dark appearance was judged by eye.** It was read from screenshots; no contrast ratios were measured. The older explainer wizard was not opened in dark. The canvas and the scene studio were looked at less closely than the scene workspace, the notebooks and the dialogs. The library, the Jobs panel and the header's menus were already dark and are the same in both appearances.
- **Intake and pending slides.** The Source → Brand intake and a presentation's pending slides take the new tokens but no structural change.
- **Recording and the timeline.** These are restyled only, with no new behaviour.
- **Not measured.** 200% text zoom was not checked separately; narrow widths were, at 1024 and 800px.
- **Not changed.** Switching notebooks still reloads the page, as before.
