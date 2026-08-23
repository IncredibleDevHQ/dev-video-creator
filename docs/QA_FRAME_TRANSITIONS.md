# QA — Frame transitions between blocks

How to reach and test the block-to-block transition flow in Studio v2, and what
correct behavior looks like. Written for handover; current as of 2026-08-24.

## Where the code is

| | |
| --- | --- |
| Repo | `https://github.com/IncredibleDevHQ/Incredible.git` |
| **Branch** | **`feat/hyperframes-markdown-mvp`** (pushed to origin; do not restart from `main`) |
| Working checkout | `/Users/think/Documents/code/dev-video-creator-main` |
| Latest commit at writing | `752c0d1c` — fix: true pushes, no mid-switch resting frame, one junction focus |

The feature landed across these commits: `1f78dad4` (switchover system + compiler),
`dba8b601` (drawer + From/To spotlight), `1aeb4ab3` (audition driver),
`5c9dcda3` (take-overlay yield), `752c0d1c` (true pushes, resting frames, focus).

## Start the app

```bash
yarn studio:infra   # docker compose up -d minio studio-db (Postgres + MinIO)
yarn studio         # dev server → http://127.0.0.1:4173
```

First-time setup is `yarn studio:setup`; the broader environment is described in
`docs/DEVELOPMENT_HANDOFF.md`. Then open **http://127.0.0.1:4173/studio** —
note the `/studio` path; the bare root URL opens the Theme Builder instead
(its top-right "Open notebook" button also gets you across).

## Two transition systems — don't conflate them

1. **Content motion** — how the words and media *inside one block* animate in.
   Lives in the right rail: select a block → **Transition** tab ("Content
   motion · Animate this block's information"). Duration 0.2–3 s.
2. **Frame switchover** — how the whole video frame hands over *between two
   blocks*. Lives on the timeline boundary nodes. Duration 0.2–1.5 s. **This
   doc tests the second one.**

## Reach the flow

1. Open `http://127.0.0.1:4173/studio`. You land in the notebook (Markdown
   editor with the live canvas preview in the right rail).
2. Click **Open canvas** (top right of the command bar). The full canvas view
   opens with the **Story timeline** floating at the bottom — one chip per
   block, `01…10`.
3. Between every pair of chips sits a small round **boundary node**. Hollow
   node = plain cut. Green-filled node = a switchover is set (hover shows
   which). This is the entry point.
4. Click any boundary node. Three things must happen at once:
   - A **drawer rises from the timeline**, headed `Frame switch
     [03 · Title] → [04 · Points]` with seven style tiles and a
     **Switch duration** slider (0.2–1.5 s).
   - On the timeline, the two chips the junction connects get **From** and
     **To** tags and light up green; every other chip and node dims; the
     clicked node stays enlarged and ringed.
   - The main canvas starts a **looping slow-motion preview** of the junction,
     with the badge `Previewing · Frame · <Style> · slow-mo` and a green glow
     around the frame.
5. Click tiles to audition styles. Each pick recompiles the composition,
   persists automatically (watch the **Saved** chip in the top bar), and keeps
   looping on the canvas. The drawer stays open so styles can be compared
   back-to-back. **Cut** removes the switchover.
6. Close with the drawer's ×, or click anywhere outside it. All spotlighting
   tears down; the node stays green only if a non-cut style is set.

The same seven styles also appear per-junction in the guided **Publish**
walkthrough (Publish → select takes → junction-by-junction finalize bar).

## QA checklist

Style catalog — what each pick must look like on the canvas loop:

| Style | Pass criteria |
| --- | --- |
| Cut | Instant switch, no motion (loop shows tail → hard switch → next block) |
| Crossfade | Next frame dissolves in **over the held previous frame** |
| Push left / right / up | **True push: both frames move together**, glued edge-to-edge — the old frame is shoved out as the new one enters. Never a slide over a frozen frame |
| Wipe | An edge sweeps the new frame in across the held previous frame |
| Zoom | Next frame settles from a slight over-scale while fading in over the held frame |

Behaviors to verify:

- [ ] Drawer header names the correct pair; From/To tags sit on the same two
      chips; everything else on the rail is dimmed.
- [ ] The node stays visibly focused (ringed, enlarged) through every pick,
      until the drawer closes.
- [ ] While the loop runs, the canvas **never rests on a frozen half-and-half
      frame**: it holds the outgoing block while preparing, sweeps the switch
      in slow motion, rests briefly on the arrived block, repeats.
- [ ] **Junction into a recorded block** (e.g. `03 → 04 Points · Recorded`):
      the canvas must show the composition with the real take video sliding
      in — not the raw take player. The take player (with its own transport)
      returns as soon as the drawer closes.
- [ ] Moving the **Switch duration** slider re-previews at the new length and
      persists (badge shows `Preparing …`).
- [ ] Reload the page: green nodes, styles and durations survive (persisted in
      the Postgres artifact — inspect via
      `curl http://127.0.0.1:4173/api/projects/latest`, field
      `project.blocks[<blockId>].frameTransition`).
- [ ] Open the Publish walkthrough, then click a timeline node directly: the
      walkthrough exits and only the drawer's junction is highlighted (no
      competing From/To spotlights).
- [ ] Content motion (right rail → Transition tab) still works independently
      and only animates the block's inner content.
- [ ] `yarn studio:test` passes (node-identifier + markdown-composition — 41
      tests, including `compiles frame switchovers with visibility overlap`
      and `pushes both frames on slide switchovers` — plus the studio-v2
      typecheck).

## Verify the export

Switchovers are compiled into the GSAP timeline, so the render carries them by
construction — but verify frames end to end:

1. **Publish → walkthrough → render**, then use the Download button, or POST
   the project JSON to `/api/render` and download the returned MP4.
2. Extract frames around a junction (scene start = sum of the previous block
   durations; the switch begins exactly at the incoming block's start):

```bash
ffmpeg -ss 15.15 -i render.mp4 -frames:v 1 junction.png
```

3. A mid-switch frame must show both blocks sharing the frame (for pushes:
   both displaced, seam between them). A hard cut at the junction with a
   non-cut style set is a regression.

## Where things live

- Compiler (tweens, overlap): `packages/markdown-composition/src/index.ts` —
  frame tween builder in `animationMarkup` (search `frameTween`); the outgoing
  scene's visibility window is extended via the section `data-duration`.
- Types: `packages/markdown-composition/src/types.ts` — `FrameTransitionStyle`,
  `BlockRenderConfigV1.frameTransition`.
- Client: `apps/studio-v2/src/main.ts` — `openTransitionPopover` (drawer),
  `auditionFrameSwitchover` (canvas preview driver), `highlightCurrentJunction`
  (From/To spotlight), `FRAME_TRANSITION_OPTIONS` (catalog).
- Styles: `apps/studio-v2/src/styles.css` — `.transition-drawer`,
  `.timeline-transition-node`, `junction-*`, `frame-*` keyframes.
- Tests: `packages/markdown-composition/src/index.test.ts`.

How the preview works (for debugging): the player is paused and parked inside
the switch overlap — where the runtime keeps both frames visible — and the
switch segment is stepped on the composition's GSAP timeline by a 30 Hz timer
from the studio page. That makes the audition deterministic: it cannot be
swallowed by media buffering at the junction and is immune to
requestAnimationFrame throttling in embedded panes.

## Known behaviors

- The canvas preview is deliberately slow motion (0.45×) so styles are
  tellable apart; the export runs at full speed.
- Recorded takes are transcoded WebM → seekable MP4 at save time (ffmpeg);
  transitions need no separate ffmpeg compositing — they are part of the
  compiled composition.
- Abandoning the client mid-render leaves the server render job running
  (pre-existing limitation; the orphaned output is harmless).
