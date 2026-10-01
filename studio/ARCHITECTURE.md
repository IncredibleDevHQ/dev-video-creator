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
prevent a late job from overwriting a newer edit.

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
Studio CI job checks formatting before tests and the build. Long composed
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
