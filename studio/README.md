# Incredible Studio

Minimalist rebuild of the supplied `studio-rebuild-handoff.html`. The app lives
in this standalone folder. The earlier studio and the legacy web product were
removed from the repository on 1 October 2026; they remain in git history.

See [ARCHITECTURE.md](ARCHITECTURE.md) for scene state ownership and live updates.

## Run

Install Node 22+, Yarn 1, FFmpeg (including ffprobe), Python 3, uv, and a supported
AI CLI for generation: Claude Code, Kimi or Codex. You can open and read
notebooks before choosing an agent. Then:

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

Paste a blog URL or Markdown, or write your notes, and open the notebook. Your
source is saved and rendered before any AI generation. Link imports prefer the
article body over the surrounding page and remove navigation and site controls.
Before slides exist, Refresh article re-reads the original link in the same
notebook; a failed refresh preserves its saved text. Choose Create presentation
when ready. Review the website's suggested brand and preview the title slide in
different colour combinations before continuing. The chosen colours and fonts
are saved in Settings → Branding and applied to the notebook. A saved brand for
the same domain is restored automatically for review; you can choose another
saved brand or detect the website again. Re-detection leaves your edited notes
and saved brand unchanged until you explicitly confirm an overwrite.
On first use, Detect local agents checks Claude Code, Codex and Kimi
individually. Select an installed agent and model; sign in to that CLI before
generating. The choice is saved for new notebooks. The notebook header shows
its agent name; click it to open Settings → Agent and change the current
notebook and your default. Agent & model settings automatically detect installed
agents and show selectable model cards. Codex choices come from its local catalog
and configuration, Claude uses its supported CLI aliases, and Kimi uses its
configured models. Account access is checked when generation runs. Active
generation must finish before switching.
Brief, Story Master and Page Master produce a rich deck; slides appear as they are accepted. Review
or edit the slides and export their PDF.

Make the video selects its global Off/Low/High camera presence and off-camera
voice. Creative planning and one Hyperframes composition produce each scene's
content animation. Preparing all animations does not wait for speaker recordings.
The notebook has a permanent `?notebook=<id>` URL. Its source is rendered as a
readable document. Before creating slides, click into the notes and type: the
Tiptap editor supports Markdown shortcuts and automatically saves Markdown,
preserving headings, lists, links, tables and code blocks. Edits save before
leaving the notebook or starting a presentation; model choices remain in settings.

Record the required moments in any order, individually or as an open-moment pass.
Practice records nothing. Recording includes permission guidance, a countdown,
teleprompter, optional timed stop and Esc to stop. Review, save or retake before
finishing a scene. Saving has a two-minute upload deadline. If its response is
lost, Studio makes one five-second read-only check for the exact saved take;
it keeps the local recording if it cannot confirm, and never automatically
re-uploads it. Denied access or a busy device opens focused recovery guidance;
retry returns to setup and checks the script before requesting devices again.
An unanswered permission request stops after one minute; Cancel ends setup
immediately, and any late device grant is released. Scene-card hover settings override camera presence; notebook
settings preview their effect before applying changes. Settings open with
immediate loading feedback, and closing the dialog ignores a delayed response.

Finishing combines retained animation, measured narration and speaker footage.
Retakes reuse the animation. Download finished scenes, select transitions, produce
the joined video and export MP4. Later edits invalidate the affected exports.
Activity remains visible with completed steps and the current processing/stalled
frontier. Token usage shows reported harness usage; unavailable usage is not zero.

Anchored chat discusses the source and edits slides or scene plans. Single-slide
revision is bounded to two minutes and its style-preserving redraw to four
minutes, with inactivity/tool-call caps and explicit retry. Source
questions have a two-minute wall limit, 45-second inactivity limit and a
20-tool-call cap. The explicit paid `checks/source-chat.live.mjs` check uses an
isolated retained diagnostic; it is never part of ordinary tests. An explicit recording edit such
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

`node checks/standalone-check.mjs` installs committed studio source in a fresh
Linux container and runs tests/build plus a real launcher/API startup check without mounting host dependencies, keys or
notebook data. It needs Docker and network access and stops after 20 minutes.
`node checks/startup-check.mjs` also runs that bounded startup check locally, using
a temporary empty store and free ports. It makes no model calls.
Native macOS voice tests are skipped on Linux; this is not signed-in harness,
physical-device or complete clean-machine product-flow acceptance.

Current requirements, authoritative evidence and remaining release gates are in
[ACCEPTANCE.md](ACCEPTANCE.md). Historical implementation notes are retained in
[checks/IMPLEMENTATION-HISTORY.md](checks/IMPLEMENTATION-HISTORY.md).

Startup checks required tools and the rendering browser before opening notebook
storage. Missing tools stop startup with repair instructions; checks do not call
models or request device access.

## Dependency purposes

| Dependency | Purpose |
| --- | --- |
| AWS S3 SDK | Portable object storage and standard credential resolution |
| pg | PostgreSQL notebook and artifact index |
| Hyperframes core, player, producer | Composition contract, browser playback and video rendering |
| GSAP | Generated composition animation |
| linkedom | Parse and validate generated markup on the server |
| Puppeteer | Rich-slide validation, rasterization, PDF and presenter overlays |
| Electron | Optional local desktop shell |
| tsx, TypeScript, Vite | Typed engine execution, checks and app build/development |
| Vitest, Node/pg types | Isolated verification and type contracts |

FFmpeg/ffprobe perform media normalization, measurement and composition; Python
runs presentation validation; uv runs the pinned speech aligner. AI CLIs execute
the chosen harness. The rendering browser is installed separately by setup.
