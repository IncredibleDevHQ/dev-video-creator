# Working in this repository

For coding agents and new contributors. The product is **Incredible Studio**, in
`studio/`: a blog becomes slides, and the slides become a narrated video. The
earlier studio and the legacy web product were removed on 1 October 2026; they
remain in git history.

- **Set up and run:** `yarn setup`, then `yarn dev` (both run in `studio/`).
  Node 22+ (`.nvmrc`), Yarn 1, FFmpeg, Python 3 with uv, and a signed-in AI CLI
  (Claude Code, Kimi or Codex). `yarn doctor` says what is missing.
- **Where to read next:** `studio/README.md` (run and use), `studio/STORAGE.md`
  (local files by default; PostgreSQL and S3 when configured) and
  `studio/ACCEPTANCE.md` (what is proven and what is not).
- **Before you push:** `yarn test` and `yarn build` from the root (in `studio/`,
  `yarn run check`; plain `yarn check` is Yarn's own lockfile check). Run
  `yarn test:storage` too when you change storage; it needs Docker.
- **Keys:** never print, log, commit or send a credential. Keys live in the
  environment or the git-ignored `.env`, and only the engine reads them.
- **The creator's data:** checks run on temporary folders and disposable
  containers. Never point a check, a script or a migration at real notebook data.
- **Proof:** a stub or fixture check proves the machinery only. Do not present
  it, or anything you made by hand, as what a model or the product produced.
- **Commits:** conventional (`feat(studio): …`), subject at most 88 characters.

The skills in `studio/skills` are run by the studio's own harness; each one has
its own `SKILL.md`. `docs/plans` holds earlier planning documents, which
describe the old app, not this one.
