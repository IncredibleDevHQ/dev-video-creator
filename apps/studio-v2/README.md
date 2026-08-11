# Incredible Studio v2 MVP

The first human-centric vertical slice: Markdown notebook → stable Tiptap node IDs → per-block direction → inline Hyperframes live canvas → real or generated presenter recording → Hyperframes MP4.

The focused Markdown block drives a live canvas alongside the document. It can be opened as a full-viewport presentation, but it is deliberately not presented as a video player: playback controls, timeline, and MP4 export only enter the workflow after a presenter track has been recorded.

The expanded canvas includes a block-aware director. Headings, paragraphs, lists, quotes, and code blocks receive different compatible layout and animation choices, and changing a Markdown node type automatically normalizes settings that no longer apply.

## Run locally

Requirements: Node.js 22+, Yarn 1, and FFmpeg on `PATH`.

```bash
yarn studio:setup
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

## Storage

Local assets, previews, and renders are written to the ignored `.studio-data/` directory. Projects themselves are saved in browser local storage for this single-user MVP.
