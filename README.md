<div align="center">
  <img alt="Incredible" src="assets/logo.png"/>
</div>

# Incredible Studio

Turn an article, a README or your own words into a **presentation** and an
**explainer video**, on your own machine.

A project moves through four notebooks, each made from the one before it:

| Notebook | What it holds | How it is made |
| --- | --- | --- |
| **Text** | The source, as an article you can edit | Read from a link, or pasted |
| **Wireframe** | The story as pages, in basic shapes | Outlined from the text by an AI harness or model |
| **Presentation** | The designed slides; exports a PDF | Each page designed by an AI harness |
| **Video** | The explainer, scene by scene; exports an MP4 | Each scene planned, previewed, voiced and produced, then accepted by you |

Rendering is local ([Hyperframes](https://www.npmjs.com/package/@hyperframes/producer)
and FFmpeg). Your projects are kept in a local PostgreSQL and MinIO, run by
Docker. The AI work runs on a coding agent you are signed in to — Claude
Code, Codex or Kimi — and the wireframe can also be outlined with an OpenAI
key.

> Looking for the original hosted Incredible app? It is described in
> [docs/legacy.md](docs/legacy.md).

## Set up and run

You need **Node 22 or newer** (`.nvmrc`), **Yarn 1** (`corepack enable`),
**FFmpeg** and **Docker** (running). The desktop app is developed on macOS.

```bash
yarn studio:setup
```

One command, safe to run again at any time. It checks the tools above and
stops with the next step if one is missing; installs the dependencies,
Electron and the renderer's browser; starts the studio's PostgreSQL (port
54329) and MinIO (59000) and waits until they are healthy; applies the
database migrations; and builds the app. It never touches your projects.

```bash
yarn studio:app
```

Opens the desktop app: on **Projects** the first time, and where you left it
after that. It starts the storage if it is not running, rebuilds only what
changed, and prints the address it serves on.
Quit the app to stop it; `yarn studio:infra:stop` stops the storage too.
Your projects are there the next time you open it.

`yarn studio:doctor` reports what this machine has for the studio — tools,
storage, migrations, builds, ports, folders, harnesses and which keys are
set — and the next step for anything missing. It changes nothing and never
calls a paid model.

## What works without a key

- **Without any AI:** create a project from a link (the article is read and
  its site's colours become a theme) or from pasted text; edit the Text
  notebook; build and save themes; and open the bundled example (**Explore
  an example**: a 15-page deck on *Attention Is All You Need*, made with
  [ppt-master](https://github.com/hugohe3/ppt-master)).
- **With a signed-in harness** — Claude Code, Codex or Kimi, on your own
  subscription: the wireframe is outlined, the presentation's slides are
  designed, and a video's scenes are planned and produced. The harness and
  model for each stage are chosen in the studio's AI settings.
- **With an OpenAI key** — `OPENAI_API_KEY` in `.env` or saved in AI
  settings: the wireframe can be outlined by the model directly.
- **Optional:** `QUIVER_API_KEY` (generated artwork) and
  `FISH_AUDIO_API_KEY` (Fish Audio voices). On macOS a scene with a
  generated voice is narrated by the system voice, without a key.

Keys stay on the local server: never in the browser, a prompt, a saved
notebook or a render. See [`apps/studio-v2/.env.example`](apps/studio-v2/.env.example).

## One scene, start to finish

1. **Projects → New project.** Paste a link or your text, choose a theme,
   and create the project. It opens on its Text; the wireframe is outlined
   in the background, and the header says when it is ready.
2. **Wireframe → Design presentation.** The presentation opens at once. Each
   slide takes its place as its design lands; until then its stage says it is
   waiting, with the wireframe one click away as a reference.
3. **Presentation → Create video.** The video notebook opens on its scenes.
4. **Prepare the brief**, then pick a scene and **Plan scene**. **Build
   preview** to watch the plan play, then **Approve plan** — or revise it.
5. **Choose how it is voiced:** your own voice (record your lines against
   the teleprompter), a generated voice, or silence. **Produce** the scene
   from its approved plan, **review the output**, and **accept** it.
6. When every scene plays its accepted output, **Export → Export video…**
   renders the MP4 into `~/Downloads/Incredible Studio`. A presentation's
   **Export → Export PDF** writes its slides, one page a slide.

## When something is wrong

| What you see | What to do |
| --- | --- |
| A storage warning in the app | The studio could not reach PostgreSQL or MinIO. Start Docker, then `yarn studio:app` (it starts them), or `yarn studio:infra`. |
| `yarn studio:setup` stops | It says why and what to do next; run it again after. |
| A port is taken | `yarn studio:doctor` names who holds 54329, 59000, 4173 and 4319. The desktop app picks its own free port. |
| A run failed with *sign in*, *credits* or *model* | Sign in to that harness in a terminal (`claude`, `codex`, `kimi`), restore its credits, or choose another harness or model in AI settings. The failure names which. |
| The app will not open | `yarn studio:doctor`, then `yarn studio:app` shows the app's own log. |
| Anything else | Back up with `yarn studio:backup <folder>` before experimenting; `yarn studio:restore <folder>` puts it back. |

## Developing

- `yarn studio` runs the studio in a browser with hot reload
  (<http://127.0.0.1:4173>, worker on 4319). Planning and production run in
  the desktop app, which drives the local harnesses.
- [docs/studio](docs/studio/README.md) is the developer guide: the front
  end, the storage and engine, the harnesses and skills, and the checks.
- [AGENTS.md](AGENTS.md) is the short guide for coding agents working in this
  repository.

## License

[Apache-2.0](LICENSE)
