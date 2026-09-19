# Building an explainer with the local harness

Use **Build explainer** in the desktop notebook. The application saves the base,
creates a derived video notebook when necessary, and starts local Kimi K3 with
thinking enabled. The base wireframes remain available for later slides, articles,
and other derivatives. A visible progress panel reports work and can stop the run.

The installed `explainer-master` skill is self-contained. It plans causal beats,
chooses a visual treatment, reuses or generates Quiver objects, independently
composes each scene, authors object performances, checks production-rendered
frames, generates and aligns guide speech locally, saves the editable derivative,
and exports through the application's renderer. Codex does not author the resulting
video. Each run retains its sources, candidate files, reviews, and receipts.

## Configuration

- A signed-in local Kimi CLI with `kimi-code/k3` available.
- `QUIVER_API_KEY` in the ignored project-root `.env`; never in a browser variable,
  skill, notebook, or prompt. `QUIVER_MODEL` defaults to `arrow-2`.
- `uv`, Python, ffmpeg and ffprobe. The narration tool provisions pinned
  `faster-whisper==1.2.0` and `requests==2.32.5` through uv, and downloads/caches
  the `base.en` alignment model on first use. It rejects unreliable alignment
  rather than presenting estimated timings as measured speech cues.
- The existing configured guide voice is used. Human recordings are separate;
  old takes are retained in derivative provenance when new guide speech replaces
  them, and are not claimed to match rewritten narration.

## Reusable SVG assets

**Assets → Reusable SVG objects** lists artwork across notebooks. Each entry
stores the accepted editable SVG, role, visual states, named parts, ports,
palette/style brief, Quiver model/request provenance, and generation operation.
Use it on a selected object or download the SVG. The local harness uses the same
library. Matching briefs reuse accepted art without another provider call.

Edits and animated revisions have new keys and a `parentKey`; the original is
retained. Library files are not owned by an individual notebook, so deleting a
video does not remove reusable artwork. Provider budgets count actual requests,
including repair attempts, and default to 24 per project.

## Motion and review contract

The base page is a wireframe, not the final composition. Declared semantic nodes
can consist entirely of rich artwork; rectangles are not required. Animation
parts resolve against their whole object. Video compositions remove presentation
page numbers, footers, and borders.

Native SVG performances use isolated nested SVG clocks and finite SMIL animation.
`perform` events seek those clips deterministically in the editor and export,
including composition ID prefixing and backward seeking. This is **not a Lottie
JSON/Skottie player**. Pinned MIT-licensed upstream Lottie design and motion
references inform the agent's authoring; the native SVG runtime is explicit.

Quantities belong to cast objects; events change them. `after` expresses causal
dependencies; explicit times allow independent overlap. Measured word cues come
from generated speech. Layout-only edits preserve alignment; changed narration
invalidates old timestamps. A new narration pass is required before finishing.

Review rejects missing targets, unbound quantities, undersized main artwork,
missing authored clips, indefinite animation, presentation footers, stale proofs,
and concurrent notebook changes. It captures before/action/settled frames for
visual inspection. Structural success is not an aesthetic score. The actual MP4
also has review frames, so the agent can inspect final composition and captions.
The saved block uses the reviewed narration duration. Export checks the actual
MP4 duration against the complete performance and rejects truncated or stale
results before the build can report success.

## Verification

```
yarn workspace studio-v2 test
yarn workspace markdown-composition test
yarn workspace studio-v2 typecheck
yarn workspace studio-desktop typecheck
node apps/studio-desktop/scripts/skills-install-check.mjs
node apps/studio-desktop/scripts/object-performance-check.mjs
node apps/studio-desktop/scripts/explainer-persistence-check.mjs
```

The paid integration test launches the actual desktop RunManager and local Kimi,
with only a base wireframe and source facts:

```
yarn workspace studio-v2 build
yarn workspace studio-desktop build
node --import tsx apps/studio-desktop/scripts/explainer-e2e.ts
```

Its isolated temporary directory contains the generated artwork, SVG/program,
alignment, reviews, saved notebook and exported MP4. Inspect the actual video;
passing tests alone does not establish reference-level visual quality. The current
route uses one derivative per input scene and English local word alignment.

The first live integration run produced a 26.97-second, 1920×1080 narrated
token-bucket mechanism from the wireframe/facts fixture. Local Kimi authored the
scene and its performances; Quiver generation and editing both succeeded.
The run demonstrated spending, depletion, rejection and refill with measured
speech cues. This establishes a working single-scene guide-voice pipeline,
not reference-quality consistency across a complete blog or a human-presenter
composition. Those need their own representative viewing evaluations.
