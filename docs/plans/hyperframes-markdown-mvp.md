# Incredible OSS rebuild: notebook to Hyperframes

Status: proposed implementation plan  
Branch: `feat/hyperframes-markdown-mvp`  
Base: `origin/oss` at `a3a31e5`

## Product thesis

Keep Incredible's strongest interaction: a document block is both something the creator writes and an addressable visual scene. The notebook, frame preview, per-block settings, presenter capture, and timeline should feel like one system rather than a text editor bolted onto a video tool.

The rendering engine changes. Hyperframes becomes the only composition, preview-timing, and final-render contract. Existing user intent remains intact:

- Write or paste Markdown in a rich notebook.
- Select a notebook block and see its exact video frame.
- Choose how each block should render, animate, and present.
- Talk over the visual with camera and microphone when available.
- When a creator cannot or does not want to record, turn an approved script into narration and, optionally, a consented avatar presenter.
- Keep manual brand controls, while allowing OpenAI or Gemini to propose a validated brand template from uploaded brand inputs.

## Non-negotiable product invariant: stable node identity

Every renderable Tiptap node owns a durable `id`. That ID is the foreign key joining all product state:

```text
Tiptap node.id
  ├── BlockRenderConfig
  ├── camera/microphone take
  ├── script and citations
  ├── generated narration/avatar asset
  ├── Hyperframes scene/track
  └── timeline selection and duration
```

IDs must survive normal text edits and collaboration updates. Missing IDs are repaired, duplicated IDs from paste or split are regenerated, and existing valid IDs are preserved. Rendering configuration must never be keyed by document position or by a hash of mutable text.

The repository now uses an open-source Tiptap v3 `NodeIdentifier` extension in place of the missing paid UniqueID dependency. It is intentionally small, testable, and owned by this codebase. Its behavior follows Tiptap's documented ID lifecycle for paste, split, undo/redo, and collaboration: <https://tiptap.dev/docs/editor/extensions/functionality/uniqueid>. Before enabling collaborative editing in the new studio, normalization must wait until the initial Yjs document sync completes so a blank local document cannot assign IDs ahead of remote content.

## Central experience

The first useful studio retains the current notebook-oriented shape:

- **Notebook:** Tiptap v3 document editing, Markdown paste/import, slash commands, and block selection.
- **Frame:** an exact `@hyperframes/player` preview for the selected node or scene.
- **Inspector:** per-block visual, motion, duration, presenter, and brand overrides.
- **Timeline:** derived tracks for scenes, live takes, narration, avatar clips, and music; initially reorderable only through notebook order.
- **Presenter controls:** camera/mic capture, retake, or AI-assisted alternatives.
- **Render:** deterministic server-side MP4 export through `@hyperframes/producer`.

The notebook document remains canonical for content. Generated HTML is never stored as source-of-truth state.

## User journeys

### 1. Markdown to frame

1. Open a sample, paste Markdown, import `.md`, or edit the rich notebook.
2. Each renderable block receives a stable node ID.
3. The compiler turns nodes plus render configuration into a versioned scene graph.
4. Selecting a block seeks the Hyperframes player to its scene and opens its inspector.
5. Changes to text, theme, layout, reveal style, or duration update the same composition used for export.
6. Render and download an MP4 with visible queue/progress/error states.

### 2. Live presenter

1. Choose **Camera + mic** for one block or the whole document.
2. Request permission only when recording starts and show a device test first.
3. Play the exact Hyperframes scene while recording webcam and microphone against its clock.
4. Save each take as a media track associated with the node ID and capture timing metadata.
5. Let the user retake, trim heads/tails, reposition the camera bubble, or disable it per block.
6. The final Hyperframes composition layers the selected take over the Markdown visuals.

Camera capture is an input track, not a second rendering engine. The browser no longer records the canvas to create the visual background.

### 3. Assisted presenter when recording is unavailable

1. Select **Narration** or **Avatar presenter**.
2. Optionally research the topic, retaining source links alongside every generated claim.
3. Generate an editable script split by stable node IDs.
4. Require explicit script approval before generating paid media.
5. Generate narration from a stock voice or an authorized clone.
6. For avatar mode, send the approved script/audio to a provider that actually produces lip-synced presenter video.
7. Preview, approve, and attach the result as a node-keyed track before final rendering.

The system must never silently research, clone a voice, synthesize a likeness, or publish. Voice and likeness cloning require proof of ownership/authorization, recorded consent, provenance metadata, and a deletion path.

### 4. AI-assisted brand template

1. Start from the existing manual brand-color workflow.
2. Upload a logo, palette image, brand guide screenshot/PDF-derived images, and optional font choices.
3. Extract colors deterministically first; the user can correct them.
4. Ask OpenAI or Gemini to propose a strict `BrandTemplateV1` JSON document—not arbitrary CSS or HTML.
5. Validate contrast, token names, values, motion limits, font availability/licensing, and asset URLs.
6. Show a visual diff across representative title, code, list, quote, image, and presenter frames.
7. Save only after user approval; manual editing remains available at every step.

## Architecture

Build a new vertical slice beside the legacy service graph. Reuse product concepts and data where helpful, but do not route Hyperframes through the old Konva canvas-recorder/AWS MediaConvert pipeline.

```text
apps/studio-v2 (browser)
  Tiptap v3 notebook + node IDs
  block inspector + timeline + MediaRecorder capture
  @hyperframes/player preview
              |
              | ProjectDocumentV1 / signed asset references
              v
packages/composition
  notebook JSON -> scene graph -> deterministic Hyperframes HTML
  shared schemas, themes, timing, sanitization, compile warnings
              |
              +-------------------------------+
              |                               |
              v                               v
apps/render-worker (Node 22)          apps/generation-worker
  bounded render queue                  research/script providers
  @hyperframes/producer                 voice providers
  Chromium + FFmpeg -> MP4              avatar/lip-sync providers
```

Hyperframes' official repository describes HTML-native compositions, `@hyperframes/player` for playback, and `@hyperframes/producer` for deterministic video rendering, with Node 22, Chromium, and FFmpeg requirements. Pin exact versions behind a small adapter because the project is still evolving: <https://github.com/heygen-com/hyperframes>.

### Why separate workers

The OSS app is based on an older Next/React runtime and initializes several hosted services. Hyperframes production rendering is a Node 22, ESM, Chromium, FFmpeg workload. Voice/avatar generation is a slow, paid, retryable external workflow. Keeping both behind explicit job boundaries provides cancellation, concurrency limits, idempotency, cost controls, and later deployment flexibility without blocking web requests.

### Preview/export parity

`packages/composition` emits the complete composition from one `ProjectDocumentV1`. The browser loads it in `@hyperframes/player`; the render worker gives the same compiled artifact to `@hyperframes/producer`. No separate React/Konva preview implementation is permitted.

## Core data contracts

```ts
type ProjectDocumentV1 = {
  version: 1
  id: string
  title: string
  notebook: TiptapJSON
  fps: 30
  width: 1920
  height: 1080
  defaultThemeId: string
  blocks: Record<NodeId, BlockRenderConfigV1>
  presenterTracks: Record<NodeId, PresenterTrackV1[]>
  brandTemplate?: BrandTemplateV1
}

type BlockRenderConfigV1 = {
  nodeId: string
  layout: 'title' | 'prose' | 'code' | 'media' | 'split'
  durationMs: number
  reveal: 'none' | 'fade' | 'rise' | 'type' | 'line-by-line'
  alignment: 'left' | 'center'
  camera: {
    position: 'hidden' | 'bottom-left' | 'bottom-right' | 'split-left' | 'split-right'
    shape: 'circle' | 'rounded-rectangle'
    scale: number
  }
  themeOverrides?: Partial<AllowedThemeTokens>
}

type PresenterTrackV1 =
  | { kind: 'live'; takeAssetId: string; startMs: number; trim: Trim }
  | { kind: 'voice'; audioAssetId: string; voiceConsentId?: string }
  | { kind: 'avatar'; videoAssetId: string; likenessConsentId: string }
  | { kind: 'none' }

type ResearchPacketV1 = {
  query: string
  claims: Array<{ text: string; sourceIds: string[] }>
  sources: Array<{ id: string; title: string; url: string; accessedAt: string }>
}

type BrandTemplateV1 = {
  version: 1
  name: string
  colors: {
    background: Hex
    surface: Hex
    text: Hex
    mutedText: Hex
    primary: Hex
    accent: Hex
    codeBackground: Hex
  }
  typography: {
    headingFont: AllowedFontId
    bodyFont: AllowedFontId
    codeFont: AllowedFontId
    scale: 'compact' | 'balanced' | 'editorial'
  }
  shape: { radius: number; borderWidth: number }
  motion: { personality: 'calm' | 'precise' | 'energetic'; intensity: 0 | 1 | 2 }
  logoAssetId?: string
}
```

Generated research, scripts, provider requests, consent records, and assets need their own versioned job records. They must not be embedded as opaque blobs inside Tiptap JSON.

## Markdown/notebook compilation rules

- Parse trusted Tiptap JSON or Markdown AST; never execute arbitrary raw HTML.
- Preserve `node.attrs.id` and report missing/duplicate IDs as compiler errors after editor normalization.
- Use headings and explicit horizontal rules as scene boundaries; keep a code block intact.
- Enforce deterministic content budgets and split only at block boundaries with visible warnings.
- Sanitize URLs and emitted attributes. Bound remote image fetch size and time, and use deterministic placeholders.
- Emit explicit Hyperframes timing and track-index attributes.
- Keep animation seekable and frame-safe; avoid wall-clock timers or browser-only nondeterminism.
- Resolve block settings through defaults → brand template → block overrides.
- Produce a source map from every scene/track back to node ID for selection, errors, captions, and analytics.

## Provider strategy

Use provider interfaces so the notebook and composition layers do not depend on a vendor payload.

### Research and structured generation

- `ResearchProvider`: OpenAI Responses with web search, or Gemini with Google Search grounding.
- `StructuredGenerationProvider`: either provider must return JSON matching application-owned schemas.
- Store citations and accessed timestamps; generated script lines link back to claims/sources.

OpenAI documents image inputs, built-in web search in the Responses API, and JSON-schema-constrained output; Gemini documents Google Search grounding, structured output, and image understanding/generation: <https://platform.openai.com/docs/quickstart/make-your-first-api-request>, <https://developers.openai.com/api/docs/guides/tools-web-search>, <https://developers.openai.com/api/docs/guides/structured-outputs>, <https://ai.google.dev/gemini-api/docs/google-search>, <https://ai.google.dev/gemini-api/docs/structured-output>, <https://ai.google.dev/gemini-api/docs/image-generation>.

### Voice and presenter video

Fish Audio is a good candidate for narration/voice cloning, but it generates audio—not lip-synced video. A separate presenter-video provider is required.

| Product | Best fit | Integration note |
| --- | --- | --- |
| Fish Audio | Primary narration candidate | TTS can use a persistent `reference_id` or reference audio; require owned/authorized voice samples. <https://docs.fish.audio/api-reference/endpoint/openapi-v1/text-to-speech> |
| ElevenLabs | Alternative narration/voice clone | Supports instant and professional voice cloning; useful fallback and enterprise option. <https://elevenlabs.io/docs/eleven-api/concepts/voice-cloning> |
| HeyGen | Primary avatar/lip-sync candidate | Produces avatar video from an approved script/voice and aligns naturally with the Hyperframes ecosystem. <https://docs.heygen.com/reference/create-an-avatar-video-v2> |
| Tavus | Replica-style presenter | Creates replica videos from a script and supports an audio URL input. <https://docs.tavus.io/api-reference/video-request/create-video> |
| D-ID | Still-image presenter fallback | Creates a talking video from text or audio plus a source image. <https://docs.d-id.com/reference/createtalk> |

Initial recommendation: implement `VoiceProvider` with Fish Audio first and an ElevenLabs adapter second. Implement `PresenterVideoProvider` with HeyGen first, then Tavus or D-ID only if real user needs justify another adapter. Stock voices must work without cloning.

## Delivery sequence

### Phase 0 — identity and Hyperframes feasibility

- Replace the missing paid node-ID plugin with the local Tiptap v3 extension.
- Upgrade editor dependencies and compatibility points to the latest compatible Tiptap v3 packages.
- Prove a hand-authored two-scene composition in `@hyperframes/player`.
- Render a 10-second MP4 through `@hyperframes/producer` on Node 22.
- Probe dimensions, duration, frame rate, and non-blank first/middle/last frames.

Exit: node-ID tests pass; one command previews and one command renders the fixture; player/export checkpoints match.

### Phase 1 — notebook-to-frame MVP

- Define the versioned contracts and composition package.
- Compile the existing Tiptap document, including stable IDs, to scenes.
- Support headings, prose, lists, quotes, code, links, images, and explicit scene breaks.
- Add the selected-block frame, scene rail, and inspector.
- Preserve per-block layout, reveal, duration, camera placement, and theme overrides.
- Add local/sample project persistence before hosted persistence.
- Add compiler fixtures and snapshot the scene model plus normalized HTML.

Exit: paste a README, select any block, change its render configuration, and see the exact Hyperframes frame update without reload.

### Phase 2 — render/export

- Add schema-validated render jobs, one-at-a-time queue, progress events, cancellation, timeout, cleanup, and download.
- Localize/cache remote assets before render.
- Add MP4 smoke tests and player/export screenshot checkpoints.
- Add Docker/runtime health checks for Node 22, Chromium, and FFmpeg.

Exit: the sample project renders from the studio with timing and visuals matching the player.

### Phase 3 — live camera talk-over

- Add permission/device test UX and camera/microphone capture.
- Drive capture against the Hyperframes player clock and save take timing.
- Add retake, choose take, trim, mute, and camera placement controls.
- Convert/uploads browser media into normalized render assets through a bounded media job.
- Add drift, dropped-frame, denied-device, no-camera, and interrupted-upload tests.

Exit: a creator can record over a scene, retake it, and render the selected synchronized take; declining camera offers narration/avatar options without blocking creation.

### Phase 4 — assisted research, script, voice, and avatar

- Add cited research and editable per-node script generation.
- Add approval and cost estimate gates.
- Add stock voice first, then consented Fish Audio cloning; add ElevenLabs adapter if required.
- Add HeyGen presenter generation behind `PresenterVideoProvider`.
- Track retries, provider job IDs, idempotency keys, cost, provenance, consent, and deletion.
- Generate captions from the approved script and align them to narration timing.

Exit: without camera or microphone, a user can approve a cited script and render narration or an authorized avatar over the same Markdown frames.

### Phase 5 — AI brand templates

- Preserve and migrate the current manual color configuration.
- Add brand input uploads and deterministic palette extraction.
- Add OpenAI and Gemini schema-constrained adapters.
- Validate template output, render representative preview fixtures, and require approval.
- Version templates and retain rollback/manual editing.

Exit: uploaded brand inputs produce an editable, accessible template whose preview and final render match.

### Phase 6 — hardening

- Add authentication/authorization around private media and consent records.
- Cap project size, duration, assets, render concurrency, provider spend, retries, and disk use.
- Add accessible focus states, reduced motion, keyboard controls, and recovery UX.
- Document clean setup without proprietary credentials for the core Markdown → frame → local render path.

## What is deliberately deferred from the first Markdown MVP

- Freeform multi-track editing and keyframe curves.
- Team collaboration, comments, huddles, invitations, and publishing/watch pages.
- Multiple aspect ratios, complex transitions, music licensing, and template marketplace.
- Automatic publishing or unattended generation.
- Migrating all historical Incredible stories before the new contracts stabilize.

These are deferred, not architectural dead ends. Stable node IDs, a versioned scene graph, and media tracks leave room for them without making the first rendering slice depend on every legacy service.

## Risks and controls

- **Node IDs mutate or collide:** own the extension, preserve valid IDs, repair duplicates, test paste/split/undo/collaboration, and normalize only after Yjs initial sync.
- **Preview/export drift:** share compiler output and Hyperframes timing; compare checkpoints in automated renders.
- **Legacy runtime mismatch:** isolate Node 22 producer code; never import it into the old Next server process.
- **Untrusted render input:** accept constrained schemas, sanitize content and URLs, localize remote assets, and isolate renderer resources.
- **Media clock drift:** record player time, media timestamps, and sync markers; normalize capture assets before composition.
- **Provider lock-in:** application-owned interfaces and records; provider payloads remain adapter-local.
- **Unexpected AI cost:** show estimates, require approval, use idempotency, cache outputs, set budgets, and never regenerate unchanged approved work.
- **Voice/likeness misuse:** stock voices by default; explicit consent and ownership checks, provenance, audit log, deletion, and no automatic publication.
- **Brand output is unsafe or inconsistent:** strict schema, allowlisted tokens/fonts, deterministic validation, contrast checks, fixture previews, and user approval.
- **Hyperframes API churn:** pin versions, wrap the producer/player boundary, and require fixture renders for upgrades.

## First implementation slice

The first branch-sized slice is Phase 0 plus only the data types needed for its fixture. It proves the two irreversible choices—stable node identity and Hyperframes preview/export parity—before rebuilding application surfaces. Phase 1 then restores the central notebook/frame/configuration loop. Camera, assisted presenter generation, and AI brand templates are explicit subsequent phases with contracts already reserved, so they do not require replacing the core again.
