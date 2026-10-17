# State and live updates

Scene phases change through `engine/autopilot.ts`. Call `transitionScene` for
mutations and `advanceScene` for an immutable transition; do not assign a
scene's phase directly. The mutable transition takes the notebook activity
ledger and writes exactly one scene event in the same project transaction.
Callers may supply specific recording/extension copy; progress and chat events
remain independent. Every phase/signal pair is covered by lifecycle tests.
Input changes invalidate the scene, moment revisions
enter `changing`, animation readiness returns to the recording boundary, and
restart recovery uses explicit recovery signals. Input fingerprints still
prevent a late job from overwriting a newer edit. A scene the creator left out
is `idle`: no agent works on it, `make` queues it, `leave-out` returns any
scene but one rendering (cancelling its agent run), and the video's count,
key and join cover only the scenes made.

`shared/state.ts` owns scene actions and display status. The engine includes
these views in each notebook snapshot. App components consume the views rather
than maintaining their own phase-to-label rules; the shared functions also
support older snapshots. Connection and capture status remain local UI state.

Successful local notebook and engine-run writes notify `notebook-events`.
PostgreSQL uses a committed-row trigger and one `LISTEN` connection per worker,
so writes from other workers also reach viewers. Reconnection refreshes watched
notebooks to catch up on missed notifications. `live-snapshots` coalesces reads
and shares each changed snapshot across that notebook's viewers. Idle SSE
connections send only a small heartbeat; they do not reload the notebook.

The app entry point composes separate start, slides, video and recording
controllers. Their shared session/navigation contract is `app/app-context.ts`;
workspace rendering and chat submission are separate too.

Run `yarn format` to format source, and `yarn format:check` to verify it. The
Studio CI job checks formatting before tests and the build. Implementation files are limited to 800 lines and
500 characters per line by the same CI check. Long composed
settings templates use the `html` tag so the formatter can lay out their markup.

The model gateway owns remote voice transport as well as model requests:
authentication, timeouts and provider failures are handled there. Voice modules
still own narration timing and clone orchestration.

The Notebook view renders sanitized Markdown with a single article title and
readable source links. The start screen shows the selected AI and a Change
action before creation; detailed models remain in the chooser/settings and
token accounting remains in the engine/API. Experimental screens live in
`prototypes/`, available in Vite development but excluded from the production
build's public assets.

Activity events carry a semantic `stage` in addition to their display message.
Planning and production report it at the operation boundary; failed transitions
retain the last processing stage. `shared/scene-activity.ts` computes the rail's
rows from those stages and current artifacts. Older events remain in History;
the rail does not infer progress from their wording. Shared scene display rules
also own queued/failed status and recording readiness.

Source reading is divided into prose/extraction (`source-document`), transport
and painted styles (`source-fetch`), brand helpers (`source-brand`), code-host
documents (`source-github`), and web-source assembly (`source-reader`). Callers
import these owners directly. Treatment contracts and normalization live in
`treatment-model` and `treatment-normalize`; `scene-treatment` validates them.
CSS screen modules under `app/styles` are imported in their original cascade
order. Composed markup uses the shared `html` tag for formatter support.

The HTTP boundary treats JSON as unknown and validates its fields before
constructing typed chat, slide, extension and recording requests. Failed app
actions use one dismissible error surface, including inside native modal
dialogs. Voice deletion uses an app dialog with Cancel as its initial focus.

Wireframes are drawn one page per harness call (`engine/creative/pages.ts`).
A call's packet is small: `SPEC.md`, which the engine writes from the look
(`engine/creative/page-spec.ts`: colours, type, layout, icon names, drawable
objects), `PAGE.json` (the scene with its neighbours' titles and the objects it
names) and `STYLE.svg` (the first accepted page). Page one goes alone, the rest
three at a time (`MINIMAL_STUDIO_PAGE_CONCURRENCY`), each with its own budget
and up to three attempts; a retry corrects the refused draft. The agent names
icons and the studio draws them in on submission, then checks that one page
(`page-checks.ts`, including connector labels); the engine writes the receipt.
Only the route (`SKILL.md`, `workflows/draw-page.md`) is installed in the run.
Budgets, thinking effort and the limit on one response come from
`engine/harness/limits.ts`, by operation and model; Kimi's token use is read
from its session log after each call (`adapters/kimi-home.ts`). Wireframe changes are
a per-notebook queue on the snapshot (`engine/slide-changes.ts`); a change may
carry the element it points at, and restart marks a running change failed
rather than repeating it.

A notebook's look (palette and fonts) is separate from the creator's identity
(name, description, logo). `engine/looks.ts` chooses the starting look and
`engine/look-apply.ts` changes it, re-colouring drawn pages with
`shared/looks.ts`, which the app also uses for the live preview in the look
panel; later pages are drawn from a spec written from the new look.
