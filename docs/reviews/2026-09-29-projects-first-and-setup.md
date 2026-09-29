# Projects first, and one setup

Two reviews of 29 September 2026 set this iteration: the **Perplexity component
review** (findings F01–F10, on `claude/component-passes` at `502149da`) and the
**Open Slide local review** (setup, documentation and repository lessons).
Both are kept outside this branch. Their shared first step, which this
iteration takes, is:
- accurate setup and documentation;
- Projects as the default entry;
- truthful status: stage readiness, waiting slides, progress;
- the small defects F06 and F08.

F07, F09, F10, the Assets workspace and the curated example gallery are the
next iterations (see the end).

## What changed for the creator

**F01 — Projects is where the studio opens.**
- A fresh profile now opens on Projects (`/projects`), not the theme library.
- It shows a short introduction: what the studio makes (presentations and
  explainer videos), the four stages from text to video, and **New project**
  with **Explore an example** beside it.
- The keyboard starts on New project. While the introduction shows, the
  header's own New project is hidden, so there is one.
- A returning profile reopens where it was left (`/studio`, `/themes` or
  `/projects`), without the introduction.
- The brand link and the theme library's back button lead to Projects.
- Closing Projects returns the address to `/studio`.
- Code: `navigateToSurface` / `surfaceOfPath` in `main.ts`; the desktop's
  start path in `apps/studio-desktop/src/main.ts`.

**F02 — A refused link has one recovery.**
- The panel says what happened and names the one thing to do: *Switch to
  Paste text and paste the article: the site stays credited.*
- **Paste article text** is the primary action; **Try again** and
  **Change link** are secondary.
- The publisher's raw answer (`403 from …`) is folded under Technical
  details, not repeated in the footer.
- The footer's Read is hidden while the recovery shows. It comes back as
  soon as the creator changes the link, pastes, or moves to another input by
  its tab.
- The input tabs are now named **Source type**.

**F03 — A slide waiting for its design looks like one.**
- A presentation page still waiting for its design has a stage of its own:
  - the page's title;
  - **Waiting for its design**;
  - who is designing the deck, and that the page shows here when its design
    lands;
  - **Show the wireframe reference**.
- Its schematic is no longer shown at full size as if it were the slide.
- Asked for, the wireframe shows labelled *Wireframe reference · not the
  designed slide*, with **Hide the reference**. The focus moves between the
  two buttons.
- Once the design lands, the slide takes the stage on the same selection.
- A design run designs the deck's pages, not necessarily this one at this
  moment, so no page claims to be "being designed". The notebook's chip
  says *schematic draft · waiting for its design* too.

**F04 — Where each stage stands, shown.**
- The four notebooks in the header read as one line: Text → Wireframe →
  Presentation → Video, joined by chevrons.
- Each shows where it stands beside its name: *ready*, *14 pages*,
  *4/14 designed*, *2/6 produced*, *not made*. The full words stay for a
  screen reader and the tooltip.
- Three signals, each independent of the others:
  - the open stage is raised;
  - the words say how far each stage has come;
  - a stage still working is amber, and one that failed is red.
- Below 1080px the switch becomes a compact stepper: each stage by its icon,
  and the open one with its name and state.
- Code: `NotebookSummary.short` in `packages/markdown-composition`, rendered
  by `notebook-switch.ts`.

**F05 — Context and progress that guide rather than repeat.**
- *The context row.* In a project, the row no longer says the notebook's name
  and description again: the switch already says it (the heading stays for
  assistive technology).
- The project's source and theme are two compact controls: **Source:
  example.com**, and the theme's swatches with its name. When the name is
  just the site again, it reads **Theme**.
- Either control opens one details popover:
  - the source's full title, its site, and when it was read;
  - its link, shown and copyable, never opened;
  - whether a copy of the article is kept;
  - the theme's colours, and where they came from.
- *The progress row.* The design run's banner, which printed the harness's
  last raw event, is now one steady row:
  - the milestone (*Designing the slides*, or *Checking the designed
    slides*);
  - the notebook's real count, the same one the switch shows (*4 of 14
    designed*), with a meter of that count;
  - the time the run has worked;
  - **Details** and **Stop remaining work**.
- Details holds what the run is doing, and its last step in full, for when
  something looks stuck. The milestone and count are the status that a
  screen reader hears; the seconds are not.
- The wireframe's job moves its raw last step under a Details button in
  the same way.

**F06 — Jobs closes on Escape.**
- A header panel with nothing to act on in it now takes the keyboard itself.
  Jobs is one such panel when its only job is the open notebook's own.
- Escape closes the panel from inside it, or from its toggle, and puts the
  focus back on the toggle.

**F08 — A saved key says so at once.**
- After a save, the key field is cleared, and its hint names the saved key
  by its last characters: *A key ending …4242 is saved. Leave blank to keep
  it.*
- Replacing a key names the new one. Nothing needs the dialog closed and
  reopened.

## Setup and documentation

- **`yarn studio:setup`** (`scripts/studio/setup.mjs`) goes from a fresh
  checkout to a built studio. It stops at the first gap and names the next
  step:
  - checks Node ≥ 22, Yarn 1, FFmpeg/ffprobe and a running Docker;
  - installs the dependencies (the legacy workspaces' scripts skipped), then
    Electron and Chrome for Testing;
  - checks the storage ports. A port held by another program stops setup
    and names it; a studio database from another checkout of the repository
    is used rather than fought over;
  - starts only PostgreSQL and MinIO, and waits until both are healthy;
  - applies the studio's migrations through the server's own runner
    (`apps/studio-v2/scripts/store.ts`) and makes the bucket;
  - builds what is out of date;
  - prints how to open the studio and where each kind of data lives.
- Running it again changes nothing: no reinstall, no new migration, no
  rebuild.
- **`yarn studio:doctor`** reports without changing anything: tools, storage,
  migrations, builds, ports, folders, harness CLIs (and each one's last
  recorded run), and which keys are set. Keys are reported by where they are
  set, never by value, and no model is called.
- **`yarn studio:app`** opens the desktop app. It starts the storage if
  needed, rebuilds only what changed, and prints the address the app picked.
  If the app is already open, it brings the window forward.
- The root `package.json` requires Node ≥ 22 (it said ≥ 14), and `.nvmrc`
  names 22.
- **The README now describes the current product.** It covers:
  - what the studio makes;
  - one setup path;
  - what works without a key;
  - one scene from start to finish;
  - what to do when something is wrong.

  The old hosted app's README moved to `docs/legacy.md`.
- The **studio-v2 README** drops the stale statements (playback and export
  only after recording; AI themes "later"). The **desktop README** puts
  start, stop and resume first.
- **Layered developer docs** in `docs/studio/` give each part one page, and
  each command one home. The pages are the front end, storage and engine,
  harnesses and skills, and checks (which now holds the check catalogue
  that used to open the desktop README).
- A short `AGENTS.md` routes coding agents to those pages.
- **Fresh-install CI** (`.github/workflows/studio-fresh-install.yml`) runs on a
  clean Ubuntu runner:
  - setup twice, the second run finding nothing new;
  - the doctor;
  - the unit tests;
  - the desktop app's smoke on PostgreSQL and MinIO;
  - the bundled example and the page view, with stub harnesses.

## Checks

- `page-view-check`:
  - the waiting stage, the reference shown and put away, and the focus;
  - the progress row;
  - Jobs and Escape (F06);
  - the switch's visible states (F04);
  - the source details popover (F05).

  Its waiting slide is now bound to a registered, running design run and to
  the page it shows. With a made-up run, a landing pass had let the binding
  go when it ran early; the check failed that way twice with screenshots on.
- `source-intake-check`: the one recovery state; Read's return, by the
  recovery's paste or by the input's tab.
- `source-design-check`: the progress row's milestone, count and elapsed
  time; its Details; the chip's new words. It now waits until the window
  has taken the first slide before reading the row.
- `wireframe-retry-check`: the source control's words.
- `restart-check`: a fresh profile opens on Projects, on New project (F01);
  its returning profile already opened on the studio.
- `agent-picker-check`: a key saved, then replaced, is named at once (F08).
- `pages.test.ts`, `formats.test.ts`: the waiting state's words; each stage's
  short state.
- `create-explainer-check`, `notebooks-hierarchy-check`, `sample-check`,
  `stage-panel-check` and `rehearsal-check` now use the file store in their
  temp folder, as the other 27 battery checks do. They set their own data
  folder but no store, so their app used the default PostgreSQL and MinIO.
  On this machine that is the developer's own. All five pass on the file
  store, with the same assertions.

## Found while verifying

- **The samples on Projects.** Now that Projects is the first screen, its
  two sample rows showed as the light notebook menu's tinted cards on the
  library's dark. They are the library's own dark rows now.
- **A ring around a whole dialog.** A long dialog (AI settings) takes the
  keyboard on itself, at its top (pass 4). The browser then drew its focus
  ring round the entire dialog, in the system's accent colour. The dialog
  is where focus waits, not a control, so it draws none.
- **The run's words, set as its words.** In Details, only the run's own step
  is set in the monospaced face; the studio's line that no step has come
  yet is not.
- **Setup in a checkout that shares its dependencies.** This worktree's
  `node_modules` is a folder of links into the main checkout's. Run here,
  `yarn install` began replacing the links with copies and stopped part-way,
  on a different nested package each time. The main checkout's
  `node_modules` was not changed (nothing under it newer than the run). The
  worktree's links were put back exactly as they were, and the builds, unit
  tests and checks were run again on them. Setup now recognises such a
  checkout: it leaves the dependencies to the checkout that owns them and
  says so; the doctor reports them as shared. If an install stops
  mid-link, setup's message says how to recover.
- **Checks that wrote to the developer's store.** The five checks above had
  been doing so in every battery. On this machine they had left, in the
  development database, a "D0 check notebook" and its video, and two
  `stage-panel-…` build runs; nothing in them came from real work. They were
  not deleted: that store is the developer's to clear.

## Commits

| Commit | What |
| --- | --- |
| `77eb070c` | F01: Projects first, with the introduction |
| `f7c31cb2` | F02: one recovery for a refused link; Source type |
| `aa2e5c88` | F04: each stage's state, shown |
| `36a9a5d6` | F05: the source and theme controls; the progress row |
| `b5a9a60c` | F06 and F08: Escape closes Jobs; the saved key's hint; no ring round a dialog |
| `7c1b9ba7` | F03: the waiting stage; the page view's and design checks |
| `9dc95bd5` | `yarn studio:setup`, `studio:doctor`, `studio:app`; Node 22 |
| `5666f108` | The README, `docs/legacy.md`, the app READMEs, `docs/studio`, `AGENTS.md` |
| `467149fc` | The fresh-install workflow |
| `d0b08e78` | Five checks moved to the file store |

## Verification

- **Unit tests.**
  - studio-v2: 475 tests in 64 files pass.
  - markdown-composition: 114 in 12, with the new `formats.test.ts`.
  - node-identifier: 3.
- **Typecheck and builds.** Both apps typecheck and build.
- **The desktop battery, in light.**
  - The first run, on the build before the last fixes, passed 31 of 32.
    The 32nd was the new assertion that leaving a refused link by its tab
    gives Read back. That build failed it, as it should; on the rebuilt app
    `source-intake-check` passed 40 of 40.
  - The final run, on the final build, passed all 32, each on its first
    run, in about 24 minutes. Nothing in the development database is newer
    than its start, run or notebook.
- **Setup, twice, on this checkout.** This checkout is a worktree that
  shares the main checkout's dependencies and its running PostgreSQL and
  MinIO. The first run took 28s and the second 22s; the second installed,
  started, migrated and built nothing. The doctor then exits 0.
- **The store from zero.** `scripts/store.ts prepare` ran on a throwaway
  database in an isolated PostgreSQL. It applied all 16 migrations and made
  the bucket; run again, it applied none. The database and the bucket were
  removed after.
- **Fresh-install CI.** The workflow runs for the first time on this push;
  its result is in the pull request, not claimed here.
- **On screen.** Nine screenshots per appearance, from a fresh profile on
  the file store, are in `2026-09-29-projects-first-and-setup-evidence/`:
  - Projects on first launch;
  - the refused link, and its technical details;
  - the waiting slide with the progress row, and the wireframe reference;
  - the progress row's Details, and the source details;
  - Jobs open;
  - the saved key's hint.

## Not in this iteration

- **F07** — one persisted job view, the same in every notebook and in Jobs.
- **F09** — API setup: discovery and model choice.
- **F10** — the video entry opening a live, per-scene workspace.
- **The Assets workspace**, and the shell controls shared across it.
- **The curated example gallery.** It needs real productions, reviewed
  before they ship; none is made up to fill it. Until then, Explore an
  example opens the bundled 15-page sample deck.
- **Other systems.** Setup is developed on macOS. The fresh-install workflow
  is its first run on Linux; the desktop app is not claimed for Linux or
  Windows.
