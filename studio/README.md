# Incredible Studio

Minimalist rebuild of the supplied `studio-rebuild-handoff.html`. The app lives
in this standalone folder alongside the earlier studio during validation.

## Run

Install Node 22+, Yarn 1, FFmpeg (including ffprobe), Python 3, uv, and a supported
AI CLI: Claude Code, Kimi or Codex. Sign in to the CLI you intend to use. Then:

```sh
yarn setup
yarn dev
```

Setup installs locked dependencies and the matching rendering browser, then runs
`yarn doctor`. Doctor checks tools and configuration without opening notebooks
or making model calls. This currently requires preinstalled system tools; it is
not a clean-machine provisioning command.

Open http://127.0.0.1:4180. The engine uses 4320. Set
`MINIMAL_STUDIO_WEB_PORT` and `MINIMAL_STUDIO_PORT` for another port pair. The
launcher refuses occupied ports before accessing storage and stops both servers
if either exits. `yarn desktop` opens the same app in the development Electron
shell. It is not a packaged installer.

## Create and finish a video

Enter a blog URL or text, then choose a harness and model before generation. The
choice is saved as your default and attached to the notebook. Brief, Story Master
and Page Master produce a rich deck; slides appear as they are accepted. Review
or edit the slides and export their PDF.

Make the video selects its global Off/Low/High camera presence and off-camera
voice. Creative planning and one Hyperframes composition produce each scene's
content animation. Preparing all animations does not wait for speaker recordings.
The notebook has a permanent `?notebook=<id>` URL and displays its harness.

Record the required moments in any order, individually or as an open-moment pass.
Practice records nothing. Recording includes permission guidance, a countdown,
teleprompter, optional timed stop and Esc to stop. Review, save or retake before
finishing a scene. Scene-card hover settings override camera presence; notebook
settings preview their effect before applying changes.

Finishing combines retained animation, measured narration and speaker footage.
Retakes reuse the animation. Download finished scenes, select transitions, produce
the joined video and export MP4. Later edits invalidate the affected exports.
Activity remains visible with completed steps and the current processing/stalled
frontier. Token usage shows reported harness usage; unavailable usage is not zero.

Anchored chat edits source, slides or scene plans. An explicit recording edit such
as `trim take from 0.3 to 1.3 seconds` keeps that range of the selected moment's
take, preserves the original and animation, and updates timing without a model
call. Finish the scene again to use it. Ambiguous trim commands are rejected.

Branding, voice clone/AI voices and server credentials live in Settings. The
presenter stand-in is for rehearsal/testing; actual capture and clone quality
still require the acceptance checks below.

## Storage and checks

Local files default to `.minimal-studio-data`; override with
`MINIMAL_STUDIO_DATA_DIR`. For PostgreSQL plus MinIO/AWS-compatible storage, see
[STORAGE.md](STORAGE.md) and `.env.example`. Credentials stay on the server.
Never point checks at a creator's existing notebook store.

```sh
yarn run check
yarn run build
yarn run check:storage
```

`check` runs TypeScript and isolated tests. `check:storage` provisions disposable
PostgreSQL/MinIO and verifies three-worker artifact recovery with synthetic media.
It requires a running Docker engine and removes its fixtures afterward.

Current requirements, authoritative evidence and remaining release gates are in
[ACCEPTANCE.md](ACCEPTANCE.md). Historical implementation notes are retained in
[checks/IMPLEMENTATION-HISTORY.md](checks/IMPLEMENTATION-HISTORY.md).
