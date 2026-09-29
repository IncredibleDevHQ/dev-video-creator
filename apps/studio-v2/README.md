# studio-v2

The studio itself: the front end the creator uses (`src/`, `index.html`) and
the worker behind it (`server/`) — the API, Hyperframes rendering, and
projects kept in PostgreSQL and MinIO.

To set up and run the studio, see the [repository README](../../README.md):
`yarn studio:setup`, then `yarn studio:app` for the desktop app. This package
also runs on its own, in a browser, for development:

```bash
yarn studio          # Vite on http://127.0.0.1:4173, the worker on 4319, both reloading
yarn studio:build    # type-check and build dist/
yarn studio:start    # serve dist/ and the worker from one process on 4319
```

In a browser the studio reads sources, edits notebooks and themes, plays what
has been made and exports it. The harness runs — the presentation's design, a
video's planning and production — need the desktop app, which starts the
local Claude Code, Codex or Kimi; the browser says so where they would begin.

## What is here

- A **project** is a container of four notebooks — Text, Wireframe,
  Presentation, Video — each made from the one before it
  (`packages/markdown-composition/src/formats.ts`).
- A notebook is a Tiptap v3 document with stable node IDs; its scenes carry
  their page, script and plans.
- The **page view** shows a wireframe's or presentation's pages around one
  stage; the **scene workspace** does the same for a video's scenes, each
  planned, previewed, voiced, produced and accepted.
- **Themes** are revisioned and kept in the library; a theme can be read
  from a site's colours or built by hand.

## Keys

None is needed to run the studio. `OPENAI_API_KEY` lets the wireframe be
outlined by the model directly; `QUIVER_API_KEY` enables generated artwork;
`FISH_AUDIO_API_KEY` Fish Audio voices. On macOS a generated voice can be the
system voice. Keys are read from the environment or the repository's `.env`
and stay in the worker. `.env.example` lists every variable.

## More

The developer guide is [docs/studio](../../docs/studio/README.md): the front
end, storage and engine, harnesses and skills, and checks.

PostgreSQL rather than a hosted realtime store: the core relationship —
notebook → block → configuration → assets and takes — is relational, and
PostgreSQL makes its transactions, foreign keys and migrations explicit,
with MinIO as the S3-compatible object store beside it.
