# Provenance of the storyboard bundle

- **Upstream:** https://github.com/heygen-com/hyperframes
- **Tag:** `v0.8.143`, commit `3aa68869f7d4cec8b37cdfcb9cd539389b63abed`, the
  release the studio drives through the pinned CLI (`hyperframes@0.8.143`).
- **License:** Apache License 2.0; the upstream `LICENSE` is included verbatim.
- **Vendored:** 15 October 2026, for storyboard production.

Every file under this folder except this one and `manifest.json` is a byte for
byte copy of the upstream file at that commit, kept at its upstream path so the
scripts find their siblings. `manifest.json` records each file's git blob id;
`engine/skills-bundle.test.ts` recomputes them and fails when a file changes or
an unlisted one appears.

## What is here, and who reads it

- `skills/faceless-explainer/`: the workflow, its story, visual-design, motion
  and cut references, the frame-worker delta, and its scripts. The studio runs
  the scripts itself (`build-frame`, `frame-packets`, `captions`,
  `assemble-index`, `transitions`); the agent reads the references.
- `skills/hyperframes/references/`: the storyboard, script, brief and review
  formats, the pitch round, and the shared frame-worker contract.
- `skills/hyperframes/scripts/lib/frame-packets-core.mjs`: the packet builder.
- `skills/hyperframes-creative/`: every reference, and the 13 frame presets
  with their fonts and caption skins.
- `skills/hyperframes-animation/`: the blueprint and rule indexes, the 22
  blueprints, the 48 motion rules and the transitions catalog.
- `skills/talking-head-recut/`: the workflow and its layout, style and frame
  references, for scenes built on the creator's take.
- `skills/motion-graphics/`: the workflow, its catalog map and references, for
  design-led motion scenes.

## Local adaptations

None to these files. How the studio uses them (one project per episode, scene
build types, the studio's own voice and takes) is in `../SKILL.md` and
`../workflows/`.
