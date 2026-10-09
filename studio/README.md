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
notebook; a failed refresh preserves its saved text. Figures arrive as their
pictures above their captions. The home page lists your notebooks under the
field; the demo shows until the first notebook exists, then behind How it works.

Create wireframes, top right, starts straight away. Under the notebook's title,
one line shows the choices it will use: the agent and model, about 6, 10 or 14
wireframes, and the look. Each opens a small menu. The agent is the notebook's,
else your saved choice, else the first of Claude Code, Codex and Kimi found on
this computer; sign in to that CLI before generating. The header pill opens the
agent menu and shows what the agent is doing ("Kimi · drawing 3 of 10").
Settings → Agent & model has the full list. Active generation must finish before
switching.

A notebook starts with a look: one you saved for the site, the site's own
colours when they could be read, or the neutral Paper look. Look, beside the
wireframes, offers named looks with a sample, three colours and two font menus;
drawn wireframes change colour as you choose, and Apply changes all of them.
A look never changes your name: Settings → You holds your name, lower-third
description and logo.

Brief, Story Master and Page Master produce a rich deck. The outline's titles
and script show as titled tiles as soon as the story is planned, and each
wireframe appears as it is drawn: each page gets an agent call of its own,
from a short spec the studio writes from the look, the page's scene and one
finished page for style. Page one goes first, then three at a time; each page
is checked when it is submitted and retried up to three times before the deck
stops and says where.
The script sits under each wireframe and can be edited once the deck is ready.
Click a part of a wireframe to point a change at it; changes for drawn
wireframes queue while the rest are drawn. Rehearse shows the wireframe, the
next one, its script and a timer. Export the wireframes as a PDF.

Make the video selects its global Off/Low/High camera presence and off-camera
voice, and which wireframes become scenes: all of them, or just some. A scene
left out can be made later, from its wireframe or the Video page, and finishing
the video joins the scenes made. Each wireframe shows its scene's state, plays
a made scene picture-in-picture, and links to that scene on the Video page,
which links back. Creative planning and one Hyperframes composition produce each
scene's content animation. Preparing all animations does not wait for speaker
recordings.
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
frontier, and token use per step (reading, story, wireframes, video) as the
agents reported it; unreported usage is shown as not reported, not zero.
Planning calls think hard; drawing one page and revising think lightly, and
every call has a limit on one response (`engine/harness/limits.ts`).

Anchored chat discusses the source and edits wireframes or scene plans. Every
agent call has a time, inactivity and tool budget sized for its operation and
model (`engine/harness/limits.ts`; Kimi K3 runs at 2.5 times the base) under a
45-minute ceiling, with explicit retry. Wireframe changes run in the background,
one at a time per notebook; a change pointed at one part skips the story step.
Source questions have a two-minute base budget. The explicit paid `checks/source-chat.live.mjs` check uses an
isolated retained diagnostic; it is never part of ordinary tests. An explicit recording edit such
as `trim take from 0.3 to 1.3 seconds` keeps that range of the selected moment's
take, preserves the original and animation, and updates timing without a model
call. Finish the scene again to use it. Ambiguous trim commands are rejected.

Your name and logo, saved looks, voice clone/AI voices and server credentials
live in Settings. The
presenter stand-in is for rehearsal/testing; actual capture and clone quality
still require the acceptance checks below.

## The content map

Map, beside Look on the Wireframe stage, opens the notebook's wireframes as a
content map: a canvas with the map's pages at the top, the series made from
them below, and a Socials box beside the series. Lines show the workflow:
from the pages into the series, from every page to its copies (faint, and
strong for what is selected), and from each made episode into the Socials
box. While the notebook is still built, every planned page is already on the
canvas by its title and fills in as it is drawn.

Keep adding notes in the Notes rail (from the header's Notes on a narrow
window). The agent sorts each note into the map in one of three ways: a new
page drawn from it, an addition queued as a change to the page it extends,
or already covered. Each result links to its page, and the note joins the
notebook's source as evidence. By order shows the pages in the notebook's
order, where a note's page is numbered where it was placed. By topic groups
them: Group by topic asks the agent, and a later page joins a topic when its
note's sorting finds one. Unused and From notes filter what is lit.

Start a series makes the series for the map. + Episode asks what the episode
is about. Let the agent choose picks the map's pages that tell it, in order,
preferring pages no other episode uses; Start empty takes pages later, and
Copy to… → New episode starts one from a page you chose. An episode is a
notebook of copies:

- drag a page into an episode's lane to copy it; hold ⌥ to cut it, so it
  belongs to that episode only;
- drag a copy to reorder it, or into another lane to move it;
- or use ⌘C, ⌘X and ⌘V.

Each page says which episodes use it, or that it is unused; set aside a page
you will not use. The map never changes because an episode did. When a page
of the map changes, its copies say "source changed" and offer Update copy or
Keep this version.

An episode's segues are its own: the cold open or "last time", a line into
each page, and "next time", written by the agent. When pages change, only
the lines around them are written again, so a scene already made keeps its
script. On the episode's Wireframe stage the script box edits the page's own
words, with its segues shown above and below it.

The bar under the canvas acts on what is selected, and ⋯ holds what is used
less. Episodes and the series can be renamed. An episode can move earlier or
later, or be taken out of the series: it stays a notebook of its own, and the
episodes either side are linked again. Make opens the episode, ready for Make
the video. Once it is made, its place in the Socials box cuts a teaser from
its scenes and drafts its posts; the teaser can be watched, and the posts
read and copied. ? lists the shortcuts. `?map=<notebook id>` opens a map
directly.

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
