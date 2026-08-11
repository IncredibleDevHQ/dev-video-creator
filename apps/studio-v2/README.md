# Incredible Studio v2 MVP

The first human-centric vertical slice: Markdown notebook → stable Tiptap node IDs → per-block direction → Hyperframes preview → real camera presenter → Hyperframes MP4.

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

No API key is required for the basic Markdown, configuration, camera, preview, or MP4 flow. On macOS, guide voice uses the local system voice.

`FISH_AUDIO_API_KEY` is optional. When configured, a creator can enter an owned or authorized Fish Audio reference ID for generated guide/final voice. On non-macOS systems, either configure Fish Audio or use camera + microphone.

Research, avatar/lip-sync providers, and AI-generated brand templates are later milestones and are intentionally not wired into this MVP.

## Storage

Local assets, previews, and renders are written to the ignored `.studio-data/` directory. Projects themselves are saved in browser local storage for this single-user MVP.
