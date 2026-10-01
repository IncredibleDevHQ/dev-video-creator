# State and live updates

Scene phases change through `engine/autopilot.ts`. Call `transitionScene` for
mutations and `advanceScene` for an immutable transition; do not assign a
scene's phase directly. Input changes invalidate the scene, moment revisions
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

The Notebook view renders sanitized Markdown. Model selection stays in settings
and token accounting remains in the engine/API. Experimental screens live in
`prototypes/`, available in Vite development but excluded from the production
build's public assets.
