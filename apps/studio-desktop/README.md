# studio-desktop

The desktop app for Incredible Studio: an Electron shell that runs the
studio's worker in-process, serves the studio on a free `127.0.0.1` port,
drives the local harnesses (Claude Code, Codex, Kimi) and serves them the
studio's MCP tools.

## Start, stop, resume

From the repository root:

```bash
yarn studio:setup    # once, and again after pulling: safe to repeat
yarn studio:app      # open the app
```

`yarn studio:app` starts the studio's PostgreSQL and MinIO if they are not
running, rebuilds the app when its sources changed, and prints the address it
serves on. **Quit the app** to stop it (the terminal command ends with it);
`yarn studio:infra:stop` also stops the storage.

To **resume**, run `yarn studio:app` again: the app reopens where you left
it — the notebook you had open, Projects, or Themes. Your projects are in
PostgreSQL and MinIO, not in the app, so a rebuild or a new checkout keeps
them. One app runs at a time; opening it again brings its window forward.

If it will not open, `yarn studio:doctor` says what is missing.

## Package scripts

| Script | Does |
| --- | --- |
| `yarn workspace studio-desktop build` | Bundles `src/` into `dist-electron/` (`main.js`, `preload.cjs`, `worker.mjs`, `atomizer.js`, `mcp-stdio.mjs`) |
| `yarn workspace studio-desktop start` | Runs the app from the last build (as `yarn studio:app` does after its checks) |
| `yarn workspace studio-desktop smoke` | Launches, probes the storage and the page, and quits: `SMOKE PASS` or why not |
| `yarn workspace studio-desktop typecheck` | TypeScript over `src/` |

## More

- How a harness run works, what a skill may do, and the MCP tools:
  [docs/studio/harness.md](../../docs/studio/harness.md).
- The storage, migrations, backups and every environment variable:
  [docs/studio/storage.md](../../docs/studio/storage.md).
- The checks in `scripts/`, the battery and the live proofs kept apart from
  them: [docs/studio/checks.md](../../docs/studio/checks.md).
