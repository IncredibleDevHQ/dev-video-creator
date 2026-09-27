# Component passes: buttons, focus, icons, and the menu's surface

The request: component quality and a neat UI, without a new brand or a rewrite. A component audit compared the studio with Open Slide, control by control, in both appearances. Its top problems:
- buttons in 15 heights, 6 weights and 3 typefaces, with a disabled state that looked like a choice;
- four focus-ring colours, one of them the browser's default;
- characters where icons belong (▶ ↻ × ‹ › ■);
- the operating system's grey tooltips;
- a toast of plain text, one at a time;
- header menus that stayed dark in the light appearance;
- the operating system's select menus.

The audit proposed a build order, and these three passes follow it. They build on the one stage layout (`2026-09-27-one-stage-layout.md`) and keep Incredible's brand: its green, its logo, Gilroy for controls and InterBody for reading.

## Why not React and Base UI

The audit proposed a small React spike with Base UI for the parts with behaviour: menus, selects, tooltips and toasts. Pass 3 builds them as plain TypeScript in `src/ui/` instead, taking Base UI's and Radix's behaviour but not their code. There were three reasons:
- **The studio draws its views itself.** It redraws a view by replacing its children, so a React root mounted inside one would be torn down and rebuilt on every redraw.
- **One tooltip layer covers every title.** A single listener serves every `title` in the app, including the 79 in `index.html`, and no control needed changing. Base UI's tooltip would have meant wrapping each control.
- **The native select stays.** It remains the value holder under the new trigger, so the app's code, and the checks that set a select's value and send `change`, work unchanged.

## Pass 1: one button, one focus ring (`65eb7ab5`)

- **One focus ring.** It is indigo (`#4f46e5` light, `#818cf8` dark), with a lighter tone (`#a5b4fc`) on the dark header and the library. A field gets a soft ring and an indigo edge instead. About 26 local focus rules now use these tokens.
- **One button.**
  - Four sizes: 24, 28, 32 and 36px.
  - A 1px press.
  - One neutral disabled state for every variant, so a disabled primary no longer reads as a green choice.
  - `.icon-button` is a 28px ghost.
  - Compact places (the recording bars, the slide editor, the presenter stage, a failed run's actions) use the small size instead of their own 8–10px one-offs.
- **The scene review's buttons.** Fourteen ghost buttons became outline buttons, so its actions look like buttons. Play, produce again, compare and the planning workspace gained icons.
- **The stage's tools** are one tool style (`.ui-tool`) with icons: Focus stage, Phone size and Full screen, and the page view's tools. **Who speaks** is one column and no longer wraps.

## Pass 2: Lucide icons in place of characters (`48f7e425`)

- **Static controls.** 42 controls in `index.html` name an icon (`data-icon`), and `hydrateIcons()` draws it at start. Their characters stay in the markup as a fallback.
- **Drawn controls.** Controls drawn in code use `icon()`. This covers close, full screen, delete, the chevrons, play, pause, stop and play again.
- **The director's tabs** use layout-grid, palette, image, user and sparkles.
- **Checks changed.**
  - `plan-preview-check`, `production-check` and `scene-flow-check` now assert the stage's play-again icon (`rotate-ccw`) instead of a ↻.
  - `rehearsal-check` reads the words Stop and Rehearse.

## Pass 3: tooltips, toasts, menus and selects

**Tooltips** (`src/ui/tooltip.ts`):
- Any control with a title shows it in the studio's style. It appears after 450ms of hover, and at once when the pointer moves on to another control within 600ms.
- The tooltip is the page's inverse: ink on the light page, light on the dark one.
- It shows the control's key (`aria-keyshortcuts`) unless its words already say it.
- The title is lent while the pointer is over the control and given back when it leaves. Assistive technology and the checks still read it, and the operating system's grey tooltip never appears.
- Keyboard focus shows the tooltip only on a control that is just an icon. A menu's rows and labelled buttons already say what they do.
- Pressing, Escape, scrolling or leaving the window hides it.
- It sits in the top layer, so it shows over a dialog.

**Toasts** (`src/ui/toast.ts`):
- A toast is a card at the bottom right on the menu's surface. It has an optional line of detail, at most one action, and a dismiss button.
- Up to three stack, with the newest nearest the corner. The pointer holds them while it is over them.
- The same news said again keeps one card and restarts its time, instead of stacking copies.
- `#toast` stays the newest card, so whatever reads its words reads them as before.
- **Errors look like errors.** The 49 error messages (36 in `main.ts`, 6 in the scene review, 7 in the planning workspace) pass `tone: 'bad'` and show a red ✕.
- In the Scenes view the toasts sit above the moments row, as the old toast did.

**Menus:**
- Every menu is on one surface that follows the appearance: More, Export, Jobs, the projects switcher, the stage's modes and the scene's More. The header's menus used to stay dark in the light appearance.
- New popover tokens set the surface's colours in `tokens.css`, with one menu shadow.
- A row is 28px. The row under the pointer or the keyboard is filled rather than ringed, and the chosen row is ticked.
- The projects switcher's ways to start are plain rows, where they were dashed green boxes. "+ New project" is in the brand's ink, and a hairline divides these rows from the notebook list.

**Selects** (`src/ui/select.ts`):
- **Where.** The notebook's theme, a scene's voice, its plan revision, Compare with revision, and a block's take in Publish.
- **The trigger** shows the choice. A long choice is cut with an ellipsis and given as a title.
- **The list** opens on the menu's surface in the top layer. It answers the arrows, Home and End, Page Up and Page Down, typing to jump, Enter or Space, Escape and Tab.
- **The native select stays underneath as the value.** When code sets its value, the trigger follows.
- **The list belongs to its select.**
  - A menu or panel holding a select counts a click in its list as inside, so choosing a theme leaves More open.
  - Keys the list handles go no further, so the Scenes view's keys do not change the scene while a list is open.
- **Containers.** The labels around these selects became plain containers, since a label would pass a click to the hidden select.

## Evidence

- **Unit tests.**
  - studio-v2: 464 tests in 61 files pass.
  - `icons.test.ts` (pass 2) is new.
  - `feedback.test.ts` (8 tests) is new. It covers toasts that stack, repeat, act, dismiss and time out, and tooltips that lend and return a title, follow a changed title, move on at once, and show on keyboard focus only for an icon.
  - `select.test.ts` (5 tests) is new. It covers:
    - the trigger over the native value, with the keyboard's place kept across a redraw;
    - the list walked past disabled options;
    - Escape and typing to jump;
    - values set in code, with or without `change`;
    - the list inside its select, with its keys kept to itself, and Tab.
  - Negative runs were made. Without the icon-only rule, the focus test fails. With the list in the page's body, or removed before the click finishes, the containment test fails.
- **Pass 1: all 31 desktop checks pass in light.**
- **Passes 1 and 2: 31 of 32 checks pass in light** (the 31, plus `rehearsal-check`).
  - `sample-check` failed once. It waited a fixed 400ms for the projects switcher, which draws only after its projects are fetched.
  - It passed 3 runs in 3 on the same build.
  - It now waits for the entry, for up to five seconds.
- **Pass 3: 31 of 32 checks pass in dark** (the 31, plus `rehearsal-check`), with the menu, select, tooltip and toast code in.
  - `scene-review-check` failed on one assertion: the cast's thumbnails in the notebook's strip, which load after the review draws. The check read them once. This assertion also failed once in the one stage layout's battery.
  - It passed 3 runs in 3, with 4 thumbnails each time, after it was changed to wait for them (up to 20 seconds).
  - Two visual changes came after the battery: the header menus take the menu shadow token, and the toasts sit above the Scenes view's moments row. Both are in the screenshots below. No check reads either.
- **Checks made steadier.** Each of these now waits for what loads after a fetch, instead of reading it once:
  - `sample-check` waits for the switcher's entries.
  - `scene-review-check` waits for the cast's pictures.
- **Screenshots of pass 3, from the live video in the isolated store, in both appearances.**
  - The theme list opened inside More: Escape and a choice leave More open, and the keyboard goes back to the trigger.
  - The arrows in the voice and revision lists keep the scene on show.
  - The tooltip lends the title and gives it back.
  - The clipboard refused the plan's copy in the unfocused test window. That gave three real error toasts, which now show as one card.

**Screenshots** in `2026-09-27-component-passes-evidence/`. The before images are from the audit's captures and the after images from the final build, over the same live video.
- **Passes 1 and 2:**
  - `scene-review-actions.png`: the disabled primary is neutral, and Planning workspace is a button with its icon.
  - `output-tab.png`: the Output tab's actions are buttons, with play and produce-again icons.
  - `stage-tools.png`: the stage's tools with their icons.
  - `scene-transport.png` and `header.png`: icons in place of characters.
- **Pass 3, menus:**
  - `more-menu.png`: More on the menu's surface in the light appearance, with the theme's new select.
  - `projects-switcher.png`: plain rows instead of dashed boxes.
  - `jobs-panel.png`: the Jobs panel.
  - `stage-menu-dark.png`: the stage's menu.
- **Pass 3, selects:** `theme-list.png` and `theme-list-dark.png` show the theme's list opened inside More. `voice-list.png` and `revision-list-dark.png` show the voice and revision lists.
- **Pass 3, tooltips and toasts:** `tooltip.png` and `tooltip-dark.png` show the tooltip. `toast-error.png` and `toast-error-dark.png` show an error toast, the same message raised three times and shown once.

## Not done yet

- **Tabs** have no one style yet: the Scenes inspector's, the director's and the planning dialog's are each their own.
- **Dialogs.** They still have their own headers and close buttons, and they do not all put the keyboard on their first field.
- **Badges and chips** are still styled one by one.
- **The older surfaces** keep their small controls: the full-screen canvas's director, the theme lab and the explainer wizard.
- **The scene's More menu** has the menu surface, and `scene-workspace-check` reads its items. It was not captured on screen: the live video offers no scene with that menu, and the check does not open it.
- **A toast raised while a modal dialog is open** shows above the dialog. Under the HTML rules for modal dialogs, its dismiss and action buttons cannot be reached until the dialog closes. This was not tried.
- **A scene restarts after a trip to the notebook**, as noted in the one stage layout record.
