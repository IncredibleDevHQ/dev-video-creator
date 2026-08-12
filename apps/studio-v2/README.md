# Incredible Studio v2 MVP

The first human-centric vertical slice: Markdown notebook → stable Tiptap node IDs → per-block direction → inline Hyperframes live canvas → real or generated presenter recording → Hyperframes MP4.

The focused Markdown block drives a live canvas alongside the document. It can be opened as a full-viewport presentation, but it is deliberately not presented as a video player: playback controls, timeline, and MP4 export only enter the workflow after a presenter track has been recorded.

The expanded canvas includes a block-aware director. Headings, paragraphs, lists, quotes, and code blocks receive different compatible layout and animation choices, and changing a Markdown node type automatically normalizes settings that no longer apply.

## Run locally

Requirements: Node.js 22+, Yarn 1, Docker, and FFmpeg on `PATH`.

```bash
yarn studio:setup
yarn studio:infra
yarn studio
```

Open <http://127.0.0.1:4173>. The setup command installs dependencies and the Chrome-for-Testing build required by `@hyperframes/producer`.

To serve the production build from one process:

```bash
yarn studio:build
yarn studio:start
```

Open <http://127.0.0.1:4319>.

## Keys

No API key is required for the basic Markdown, configuration, camera, live-canvas, or MP4 flow. On macOS, guide voice uses the local system voice.

`FISH_AUDIO_API_KEY` is optional. When configured, a creator can enter an owned or authorized Fish Audio reference ID for generated guide/final voice. On non-macOS systems, either configure Fish Audio or use camera + microphone.

Research, avatar/lip-sync providers, and AI-generated brand templates are later milestones and are intentionally not wired into this MVP.

## Persistence

The MVP uses a small Supabase-compatible local stack instead of requiring the
full Supabase service suite:

- PostgreSQL stores the versioned notebook artifact, normalized block rows,
  asset metadata, and the latest recorded take for each stable Tiptap block ID.
- MinIO stores uploaded images, screen recordings, generated guide audio, and
  finalized directed-block MP4s. The worker serves these through `/objects/*`
  with byte-range support for video playback.
- Browser local storage remains an offline fallback. At startup the editor first
  loads its matching PostgreSQL artifact (or the latest notebook on a new
  browser), then debounces edits back to the database.

PostgreSQL is exposed on `54329`; MinIO uses `59000` for S3 and `59001` for its
console. Defaults live in `.env.example`. Stop only these two services with:

```bash
yarn studio:infra:stop
```

### Why PostgreSQL / Supabase rather than Convex

The product's core relationship is notebook → stable block → configuration →
assets / recorded take. PostgreSQL makes that relational model, transactions,
foreign keys, and migrations explicit. It also gives us a direct path to hosted
Supabase later while keeping MinIO as the local S3-compatible object store.
Convex remains a strong option for a realtime-first hosted product, but its local
deployment is currently a beta development workflow and its native file storage
would duplicate the explicitly selected MinIO layer.

Transient Hyperframes render jobs, previews, and completed whole-project renders
still use the ignored `.studio-data/` working directory. They can move to the same
object-store adapter when collaborative/export lifecycle work begins.
