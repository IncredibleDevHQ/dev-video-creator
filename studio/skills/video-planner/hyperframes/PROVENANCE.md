# Provenance of the pinned Hyperframes bundle

- **Upstream:** https://github.com/heygen-com/hyperframes
- **Commit:** `99221c50a5e5927ca243454b4e4f02f9adf7cfc6`
- **License:** Apache License 2.0 — the upstream `LICENSE` is included
  verbatim.
- **Vendored:** 24 September 2026, for the planning-only milestone (M0);
  the animation skill's recipe and blueprint bodies on 8 October 2026, for
  construction.

## What is here, and how it is verified

Every file under this folder except this one and `manifest.json` is a
byte-for-byte copy of the upstream file at the commit above. `manifest.json`
records each file's git blob id; the studio's test suite
(`engine/skills-bundle.test.ts`) recomputes the blob ids and fails if a
vendored file changes or an unlisted one appears. No upstream file is
modified.

The subset is what planning reads: the router and its routes, the brief,
storyboard, script and review formats, the owning `general-video` workflow,
all `hyperframes-creative` references, the explainer and motion-graphics
planning references, the `hyperframes-animation` skill with its rules,
blueprints and techniques indexes, and the entry points of the keyframes,
audio, registry, core, talking-head-recut and media-use skills.

## The recipe and blueprint bodies

Since 8 October 2026 the animation skill's bodies are here too:
`hyperframes-animation/rules/` (48 recipes), `blueprints/` (22 whole-shot
templates), `transitions/` (16), `adapters/` (12) and `examples/` (13
worked compositions), 111 files at the same commit, with
`faceless-explainer/references/motion-language.md`, which a rule cites. The planner still names
recipes from the indexes; the scene producer is given the bodies its plan
names in `packet/recipes/` and builds each moment from its body. Before
this, construction had only the index lines and built every recipe from its
name.

## What is not here

Frame presets, templates, fonts and scripts, and the upstream skills not
listed in `manifest.json`.

## Local adaptations

None to these files. The product's adaptation of the workflow — planning
only, no CLI, no network, per-scene delivery, the product's review — lives
outside this folder, in `../SKILL.md` and `../references/`, and is listed in
`../references/product-overrides.md`.

## Runtime compatibility

The studio's installed runtime is `@hyperframes/core`, `@hyperframes/player`
and `@hyperframes/producer` **0.7.106**. These references describe the
upstream at the commit above, which may be newer. No catalogued capability has
yet been proven in the installed runtime; `../capabilities.json` lists every
catalogued recipe with `verifiedInInstalledRuntime: false` until the
capability baseline (H0) proves it.
