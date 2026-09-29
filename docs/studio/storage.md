# Storage and engine

`apps/studio-v2/server` — the worker. In the desktop app it runs in-process
(`apps/studio-desktop/src/worker-host.ts`) on a free `127.0.0.1` port and
serves the built front end from the same origin; in development
`yarn studio` runs it with `tsx watch server/bin.ts` on 4319, beside Vite on
4173. `server/index.ts` holds the API routes.

## Where work is kept

| Kept in | What | Where |
| --- | --- | --- |
| **PostgreSQL** (`studio-db`, `postgres:17-alpine`) | Notebooks and their blocks, projects, themes and their revisions, source and story revisions, takes, run records and stage checkpoints, planning records, settings | Port `54329`; named volume `studio-db` |
| **MinIO** (`minio`) | Every binary: uploads, recordings, artwork, generated audio, rendered scenes and exports | API `59000`, console `59001`; named volume `minio_storage`; bucket `incredible-studio` |
| **The app's data folder** | Harness project folders (`projects/<id>`), render jobs and previews, the desktop's web storage | `~/Library/Application Support/studio-desktop/studio` on macOS (`STUDIO_DATA_DIR`) |
| **Exports** | Published MP4s | `~/Downloads/Incredible Studio` (`STUDIO_OUTPUTS_DIR`) |

`docker-compose.yaml` defines the two services (its other services are the
legacy app's). `yarn studio:setup` and `yarn studio:app` start them;
`yarn studio:infra` / `studio:infra:stop` start or stop only them. Compose
prefixes the volumes with the checkout's folder name (`yarn studio:setup`
prints the real names); they survive restarts, but they are not backups.

Without its PostgreSQL and MinIO the app says so — a storage warning — and
does not pretend work is saved. There is no silent fallback.

## Migrations

Schema changes are ordered SQL files in `server/migrations/`
(`NNN_name.sql`). Each runs once, in name order, in a transaction, and is
recorded in `studio_schema_migrations` (`server/migrations.ts`). The worker
applies what is missing when it first connects; `yarn studio:setup` does the
same beforehand, and `yarn studio:doctor` lists what is pending — both
through `scripts/store.ts`, which calls the same functions. A new change is a
new file: an applied migration is never edited.

## The file store, for tests

`STUDIO_PERSISTENCE=local` swaps PostgreSQL and MinIO for plain files in the
data folder (`server/persistence-local.ts`), with the same contract as
`server/persistence-pg.ts`. It exists so a check can run a whole app in a
temp folder; the desktop never chooses it by itself.

## Backups

`yarn studio:backup <dir>` writes the rows and the objects they refer to,
with a manifest and checksums; `yarn studio:restore <dir>` puts them back,
optionally into another database or bucket (`--database-url`, `--bucket`).
Quit the app first for a consistent copy. `apps/studio-v2/scripts/backup-restore-check.mjs`
restores into a fresh database and bucket and compares.

## Rendering

Scenes, previews and exports are Hyperframes compositions rendered by
`@hyperframes/producer` in Chrome for Testing (installed by
`yarn studio:setup`), with FFmpeg for the audio and the MP4. Jobs report
their progress and survive a window reload (`server/export-jobs.ts`).

## Environment

Defaults need no configuration; see `apps/studio-v2/.env.example`.

| Variable | For |
| --- | --- |
| `STUDIO_DATABASE_URL` | PostgreSQL (default `postgres://incredible:incredible@127.0.0.1:54329/incredible_studio`) |
| `STUDIO_MINIO_ENDPOINT`, `_PORT`, `_USE_SSL`, `_ACCESS_KEY`, `_SECRET_KEY`, `_BUCKET` | MinIO (defaults match `docker-compose.yaml`) |
| `STUDIO_PERSISTENCE` | `local` for the file store (tests only) |
| `STUDIO_DATA_DIR`, `STUDIO_OUTPUTS_DIR` | The app's data folder, and where exports go |
| `STUDIO_DIST_DIR` | Another build of the front end for the desktop to serve |
| `OPENAI_API_KEY` | The direct model, until a key is saved in AI settings |
| `QUIVER_API_KEY`, `QUIVER_MODEL` | Generated artwork (server side only) |
| `FISH_AUDIO_API_KEY`, `FISH_AUDIO_MODEL` | Fish Audio voices |

Keys are read from the environment, then the repository's `.env`
(git-ignored). They stay in the worker: never a `VITE_` variable, a prompt, a
log line, a notebook or a render.
