# Provenance of the pinned Hyperframes bundle

- **Upstream:** https://github.com/heygen-com/hyperframes
- **Commit:** `99221c50a5e5927ca243454b4e4f02f9adf7cfc6`
- **License:** Apache License 2.0 — the upstream `LICENSE` is included
  verbatim.
- **Vendored:** 24 September 2026, for the planning-only milestone (M0).

## What is here, and how it is verified

Every file under this folder except this one and `manifest.json` is a
byte-for-byte copy of the upstream file at the commit above. `manifest.json`
records each file's git blob id; the studio's test suite recomputes the blob
ids and fails if a vendored file changes. No upstream file is modified.

The subset is what planning reads: the router and its routes, the brief,
storyboard, script and review formats, the owning `general-video` workflow,
all `hyperframes-creative` references, the explainer and motion-graphics
planning references, the `hyperframes-animation` skill with its rules,
blueprints and techniques indexes, and the entry points of the keyframes,
audio, registry, core, talking-head-recut and media-use skills.

## What is not here

Recipe and blueprint bodies (`hyperframes-animation/rules/`, `blueprints/`,
`adapters/`, `transitions/`, `examples/`), frame presets, templates, fonts
and scripts are not vendored. Planning names recipes from the indexes;
construction — a later milestone — must vendor and read the bodies it uses.

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
