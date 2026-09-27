# One stage layout: the page view

The request: like Open Slide, put the frame at the centre and give Wireframe, Presentation and Video the same minimal layout. Only the Text notebook stays different, since it is an article. This slice does it for Wireframe and Presentation, and brings the video's Scenes rail into the same form. It builds on the Open Slide pass (`2026-09-27-open-slide-studio-ui.md`) and keeps Incredible's brand as that pass did.

## What Open Slide does, from using it

Open Slide 2.0.1 (commit `eec7417`) was cloned and run from its repository, and its editor was used on its demo decks.

**Its stack.**
- React 19 and Tailwind v4.
- Base UI primitives in the shadcn style: tooltip, dropdown menu, context menu, scroll area, tabs, dialog.
- Lucide for every icon.
- cmdk for its ⌘K menu, sonner for toasts, dnd-kit to reorder pages, next-themes for dark mode, and the Geist font.

Incredible Studio is plain TypeScript without React, so none of these libraries was taken. What was taken is how they behave, rebuilt in our own code and palette. The icons are Lucide's own path data.

**What it does.**
- **One layout for a deck.** A 48px header holds a back button, the deck's title in the centre, and the view and panel toggles. A split Present button sits at the right. Below it, from left to right:
  - a rail of numbered page pictures;
  - the page on a stage, as large as the room allows;
  - an inspector that opens when there is something to inspect.
  
  A notes drawer runs along the bottom, and an overview covers the whole deck.
- **The rail.** Each row is a page number in a mono face, green-equivalent when current, then the page's picture. Small icons under the number say what the page has, and a tooltip names each icon. The picture's border strengthens on hover, the current page has a 2px accent ring, and pressing a row shrinks it slightly. Right-click offers Duplicate and Delete. The rail can be resized by dragging or from the keyboard.
- **Moving through pages.**
  - → ↓ Space PageDown turn to the next page; ← ↑ PageUp to the previous.
  - Home and End go to the first and last.
  - The wheel or trackpad turns pages over the stage.
  - O shows every page at once; F fills the screen; Enter presents.
  - A letter shortcut never fires with ⌘, Ctrl or Alt, and no key does while typing in a field or when a menu or dialog has it.
- **Feedback.** Icon buttons are 28px and nudge down 1px when pressed. Every icon-only control has a tooltip naming its key. Colours change in 100ms, and one ease-out curve is used everywhere. Copying a link changes the icon to a tick rather than showing a toast. Menu items show an icon, a label and the key.
- **Surfaces.** The header, rail and panels share one background, and the page sits above it as a card. The palette is neutral with one accent, and dark mode is designed rather than inverted.

## What changed

**The page view** (`apps/studio-v2/src/page-workspace/`). A Wireframe, a Presentation or a base made from a source now opens on its pages:
- **The rail.** The pages are numbered 01, 02… with the current number in green. Under the number a small icon says how the page was made: designed, a schematic draft, or still being designed, which spins. A tooltip explains each icon.
- **The stage.** The page on show is as large as the room allows, at its own proportions. A page still being designed says so in a badge on the stage.
- **Under the stage.** Previous and next, the page counter, the page's title, All pages (O) and Full screen (F).
- **The inspector.** What the page explains, its notes, the source it rests on and how it was made. A wireframe does not call each of its pages a schematic draft, as its notebook does not.
- **Moving through pages.**
  - → ↓ PageDown, ← ↑ PageUp, and Home and End turn the pages, as in Open Slide.
  - The arrows also walk the rail, with the keyboard focus following the page.
  - The wheel turns one page per gesture, so a flick's momentum does not run through the deck.
  - O shows every page at once, opened on the page on show. The arrows move through them, a page chosen opens, and Escape closes the view.
- **Notices.** The notebook's own notices move above the stage while the view shows. These are the page design run ("still designing 1 page… Stop remaining work") and the wireframe being made or failed ("Make it again").
- **Switching views.** The notebook is one click away (Pages · Notebook) and opens on the same page. The choice of view is kept, and the page last on show comes back when the notebook is opened again.
- **Selection.** Choosing a page moves the notebook's own selection to it without taking the keyboard, so a save or a page landing does not move it back.
- **Nothing is copied.** The pages are the notebook's scene blocks, read again whenever the notebook changes.

**The Scenes rail** takes the same form. The number is in its own column (green when current), then the picture with its 2px ring, then the title and what the scene needs. In the compact rail the number sits on the picture, green for the current scene. Pages and scenes share one rail width (188px).

**Icons.** `src/ui/icons.ts` holds the Lucide icons the studio draws its own controls with.

## Evidence

- **Unit tests.** studio-v2: 449 tests in 57 files pass. `pages.test.ts` is new: which blocks are pages, how each was made, the notes without the video's directions, the page keys, and one page per wheel gesture.
- **`page-view-check` (new)** passes in both appearances. It asserts:
  - the rail's numbers and states;
  - the first page on the stage with its words;
  - →, End, Home, PageDown and ← on the counter and the inspector;
  - that a key typed into a field turns no page;
  - the rail click, and the arrows walking the rail with the focus;
  - the being-designed badge;
  - one page per wheel gesture;
  - the overview opening on the current page, a page chosen opening, and Escape closing it;
  - F and Full screen asking for the stage alone;
  - Notebook on the same page, the view kept on reopening, and Pages again;
  - the wireframe's pages without draft labels;
  - the text staying an article with no view switch.
- **Checks changed**, only where they assumed the document was on screen:
  - `source-intake-check` now asserts the wireframe's page view, then reads its badges and posters in the Notebook view.
  - `wireframe-retry-check` accepts the job notice at the top of whichever view shows.
  - `scene-workspace-check` asserts that a base of pages has no scenes view, shows its pages, and has its notebook one click away.
- **Other checks re-run on this code, all passing:**
  - presentation export, source design, source delivery, source destination, source theme reuse, wording preserve;
  - review layout, create explainer, notebooks hierarchy, sample, stage panel;
  - scene flow, scene review, scene timeline, scene recording, planning progress, preview exhausted, project switch.
- **One flaky assertion.** `scene-review-check` failed once, on the cast thumbnails in the notebook's scene strip. Those load asynchronously and the check reads them once. It passed when run on its own, and in the run before.
- **One stuck teardown.** `source-delivery-check` passed, but its app did not quit on SIGTERM once: the worker's stop never finished. It was stopped by hand. The same check exited cleanly in the run before.

**Screenshots** in `2026-09-27-one-stage-layout-evidence/`:
- `presentation-pages.png` and `presentation-pages-dark.png`: a presentation's page view.
- `page-being-designed-dark.png`: a page still being drawn, with the design run's notice above the stage.
- `all-pages.png`: All pages (O).
- `presentation-notebook.png`: the same presentation's Notebook view.
- `wireframe-pages.png`: a wireframe's page view.
- `scenes-rail.png` and `scenes-rail-compact-dark.png`: the Scenes rail in its new form, wide and compact.

## Not in this slice

- **The video's Notebook view** is still its two-column document. Folding it into a Script view on the same pages is the next step.
- **The Scenes view's keys.** It does not yet take the page keys (arrows between scenes, O for all scenes).
- **Page actions.** The rail has no right-click actions, because pages have no duplicate, delete or reorder yet. Its width is fixed rather than resizable.
- **Notes** are read-only in the page view, as they were in the notebook. Open Slide's notes drawer is not borrowed yet.
- **Full screen** could only be checked as requested. The test hook cannot grant the gesture that a real full screen needs.
