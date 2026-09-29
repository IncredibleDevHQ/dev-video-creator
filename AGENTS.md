# Working in this repository

For coding agents and new contributors. The product is **Incredible Studio**
(`apps/studio-v2`, `apps/studio-desktop`, `packages/markdown-composition`,
`packages/node-identifier`); everything else under `apps/` and `packages/` is
the legacy app and is left alone unless a task names it.

- **Set up:** `yarn studio:setup`, then `yarn studio:doctor` if anything is
  off. Node 22+ (`.nvmrc`), Yarn 1.
- **Where to read next:** [docs/studio](docs/studio/README.md) — the front
  end, storage and engine, harnesses and skills, and checks, one page each.
  Read the page for the part you change; do not rely on old review logs under
  `docs/reviews` for how the code works now.
- **Before you push a change to the studio:** `yarn studio:test`,
  `yarn workspace studio-v2 test`, both builds, and the desktop checks for the
  surfaces you touched ([Checks](docs/studio/checks.md)); the whole battery
  for anything shared.
- **Keys:** never print, log, commit or send a credential. Keys live in the
  environment or the git-ignored `.env`, and only the worker reads them.
- **The creator's data:** checks run their own app on a temporary folder. Do
  not point a check, a script or a migration experiment at the real
  PostgreSQL, MinIO or data folder; back up first (`yarn studio:backup`) if a
  task must touch them.
- **Proof:** a stub-harness check proves the machinery only. Do not present
  it — or anything you made by hand — as what a model or the product
  produced.
- **Commits:** conventional (`feat(studio): …`), subject at most 88
  characters.

The skills the studio's own harness runs follow a different contract, in
[`apps/studio-desktop/skills/README.md`](apps/studio-desktop/skills/README.md);
this file is not installed into their project folders.
