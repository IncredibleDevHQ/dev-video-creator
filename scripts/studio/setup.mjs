// yarn studio:setup — from a fresh checkout to a studio that opens on
// Projects, in one command (the Open Slide local review): the supported Node
// and Yarn; the dependencies, Electron and the renderer's browser; FFmpeg and
// Docker; the local PostgreSQL and MinIO — started, healthy and migrated; and
// the two builds the desktop app runs.
//
// Run it again at any time: what is there already is kept, migrations only
// run once, and no notebook, take or export is touched. It stops at the first
// thing it cannot do and says the one thing to do next — never a
// half-success.
import { basename, join } from 'node:path'
import {
  BUILDS, NODE_MAJOR, PORTS, ROOT, SERVICES, buildState, containerOn, desktopPaths, electronDir, electronInstalled, firstLine,
  listenerOn, minioReady, portAnswers, postgresReady, probe, run, say, sharedDependencies, stop, store, versionOf, volumeOn, waitFor,
} from './lib.mjs'

const mac = process.platform === 'darwin'
const started = Date.now()
say.title('Setting up Incredible Studio')

// ——— 1. This machine ———
say.step('1. This machine')
const node = versionOf(process.versions.node)
if (!node || node[0] < NODE_MAJOR) stop(`Node ${process.versions.node} is too old: the studio needs Node ${NODE_MAJOR} or newer.`, `install Node ${NODE_MAJOR} (with nvm: nvm install; the repository's .nvmrc names it), then run yarn studio:setup again.`)
say.ok(`Node ${process.versions.node}`)
const yarn = probe('yarn', ['--version'])
if (!yarn) stop('Yarn is not installed.', 'run corepack enable (it comes with Node), then run yarn studio:setup again.')
if (versionOf(yarn)[0] !== 1) stop(`Yarn ${firstLine(yarn)} is not Yarn 1, which this repository's lockfile is written for.`, 'run corepack enable in this folder (package.json pins yarn@1.22), then run yarn studio:setup again.')
say.ok(`Yarn ${firstLine(yarn)}`)
for (const tool of ['ffmpeg', 'ffprobe']) {
  const found = probe(tool, ['-version'])
  if (!found) stop(`${tool} is not on your PATH: the studio renders and checks video with it.`, mac ? 'brew install ffmpeg, then run yarn studio:setup again.' : 'install FFmpeg with your package manager (for example sudo apt-get install ffmpeg), then run yarn studio:setup again.')
  say.ok(firstLine(found).replace(/ Copyright.*$/, ''))
}
if (!probe('docker', ['--version'])) stop('Docker is not installed: the studio keeps its work in a local PostgreSQL and MinIO, run by Docker.', mac ? 'install Docker Desktop (docker.com), start it, then run yarn studio:setup again.' : 'install Docker Engine and the compose plugin, then run yarn studio:setup again.')
if (!probe('docker', ['info', '--format', '{{.ServerVersion}}'])) stop('Docker is installed but not running.', mac ? 'start Docker Desktop, wait for it to say it is running, then run yarn studio:setup again.' : 'start the Docker service (sudo systemctl start docker), then run yarn studio:setup again.')
if (!probe('docker', ['compose', 'version'])) stop('Docker Compose is missing.', 'install the Docker Compose plugin, then run yarn studio:setup again.')
say.ok(`Docker ${firstLine(probe('docker', ['info', '--format', '{{.ServerVersion}}']))}, running`)

// ——— 2. Dependencies ———
say.step('2. Dependencies')
const sharedWith = sharedDependencies()
if (sharedWith) {
  // A worktree sharing another checkout's node_modules: they are that
  // checkout's to install, and installing here would unshare them.
  say.ok(`Dependencies: shared with ${sharedWith}, whose node_modules this checkout links to`)
  say.note(`To install or update them, run yarn studio:setup there.`)
} else {
  // The legacy workspaces' install scripts need services the studio does
  // not use, so they are skipped; Electron's download is run on its own below.
  const install = ['install', '--ignore-scripts', ...(process.env.CI ? ['--frozen-lockfile'] : [])]
  say.note(`yarn ${install.join(' ')}`)
  if ((await run('yarn', install)) !== 0) stop('Installing the dependencies failed (the lines above say why).', 'fix what they name, then run yarn studio:setup again. If Yarn stopped with ENOENT while "Linking dependencies", node_modules is half-linked: delete node_modules (it holds no projects) and run yarn studio:setup again.')
  say.ok('Dependencies installed')
}
const electron = electronDir()
if (!electron) stop('Electron is missing from node_modules.', sharedWith ? `run yarn studio:setup in ${sharedWith}.` : 'run yarn install, then yarn studio:setup again.')
if (!electronInstalled()) {
  say.note('Downloading Electron…')
  if ((await run('node', [join(electron, 'install.js')])) !== 0 || !electronInstalled()) stop('Electron could not be downloaded.', 'check the connection, then run yarn studio:setup again.')
}
say.ok('Electron ready')
say.note('The renderer’s browser (Chrome for Testing)…')
if ((await run('yarn', ['-s', 'workspace', 'studio-v2', 'exec', 'puppeteer', 'browsers', 'install', 'chrome'])) !== 0) stop('The renderer’s browser could not be installed.', 'check the connection, then run yarn studio:setup again.')
say.ok('Chrome for Testing ready')

// ——— 3. Local storage ———
say.step('3. Local storage: PostgreSQL and MinIO')
// A port taken by another program would stop the services half-way; one
// held by this studio's own service — from this checkout or another
// checkout of the repository — is simply used.
const ours = []
for (const [label, port, service] of [['PostgreSQL', PORTS.postgres, SERVICES.postgres], ['MinIO', PORTS.minio, SERVICES.minio]]) {
  if (!(await portAnswers(port))) continue
  const container = containerOn(port)
  if (container?.service === service) {
    ours.push(service)
    // Compose names a project after its folder, lower-cased.
    if (container.project && container.project !== basename(ROOT).toLowerCase().replace(/[^a-z0-9_-]/g, '')) say.note(`${label} is already running from another checkout (${container.project}); this one uses it.`)
    continue
  }
  const holder = container ? `the container ${container.name}` : listenerOn(port) || 'another program'
  stop(`Port ${port}, which the studio’s ${label} uses, is taken by ${holder}.`, `stop ${holder}, then run yarn studio:setup again.`)
}
const toStart = [SERVICES.minio, SERVICES.postgres].filter(service => !ours.includes(service))
if (toStart.length) {
  say.note(`docker compose up -d ${toStart.join(' ')}`)
  if ((await run('docker', ['compose', 'up', '-d', ...toStart])) !== 0) stop('The storage services could not start (the lines above say why).', 'fix what they name, then run yarn studio:setup again.')
}
const shared = ours.length > 0 && !toStart.includes(SERVICES.postgres)
if (!(await waitFor(async () => (shared ? portAnswers(PORTS.postgres) : postgresReady()), 60))) stop('PostgreSQL did not become ready within a minute.', 'docker compose logs studio-db says why; then run yarn studio:setup again.')
say.ok(`PostgreSQL ready on 127.0.0.1:${PORTS.postgres}`)
if (!(await waitFor(minioReady, 60))) stop('MinIO did not become ready within a minute.', 'docker compose logs minio says why; then run yarn studio:setup again.')
say.ok(`MinIO ready on 127.0.0.1:${PORTS.minio} (console on ${PORTS.minioConsole})`)
const prepared = store('prepare')
if (!prepared.ok) stop(`The database could not be prepared: ${prepared.error}`, 'yarn studio:doctor looks at the storage in detail.')
const { migrations, bucket } = prepared
say.ok(`${migrations.recorded} of ${migrations.total} migrations recorded${migrations.appliedNow.length ? ` (${migrations.appliedNow.length} applied now)` : ', none new'}`)
say.ok(`Bucket “${bucket.name}” ready`)

// ——— 4. The builds ———
say.step('4. The studio and the desktop app')
for (const build of BUILDS) {
  const state = buildState(build)
  if (state === 'current') {
    say.ok(`${build.name[0].toUpperCase()}${build.name.slice(1)}: already built from these sources`)
    continue
  }
  say.note(`Building ${build.name}…`)
  if ((await run('yarn', ['-s', ...build.command])) !== 0) stop(`Building ${build.name} failed (the lines above say why).`, 'fix what they name, then run yarn studio:setup again.')
  say.ok(`${build.name[0].toUpperCase()}${build.name.slice(1)} built`)
}

// ——— Ready ———
const paths = desktopPaths()
const seconds = Math.round((Date.now() - started) / 1000)
say.step(`Ready, in ${seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`}.`)
say.line(`
  Open the studio            yarn studio:app
  Develop in a browser       yarn studio            → http://127.0.0.1:${PORTS.browserDev}
  Check this setup later     yarn studio:doctor

  Your projects              PostgreSQL, docker volume ${volumeOn(PORTS.postgres) || 'studio-db'}
  Their pictures and takes   MinIO, docker volume ${volumeOn(PORTS.minio) || 'minio_storage'} (console http://127.0.0.1:${PORTS.minioConsole})
  The app’s own data         ${paths.data}
  Exported videos            ${paths.outputs}

  The studio opens on Projects: New project starts from a link or your own
  text, and Explore an example opens a bundled 15-page sample deck.
  Writing the wireframe and designing slides needs a signed-in Claude Code,
  Codex or Kimi, or an OpenAI key — see “What works without a key” in
  README.md.
`)
