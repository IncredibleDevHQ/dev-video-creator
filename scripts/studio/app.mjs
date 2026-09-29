// yarn studio:app — opens the desktop app, saying each step as it goes: the
// storage (started when it is not running), the builds (made again only
// when their sources changed), then the app itself and the address it
// serves the studio on — a free port it picks, so nothing else's port is
// ever taken. There is no silent fallback: without its PostgreSQL and MinIO
// the app does not start.
//
// The app's own log follows, dimmed. Quitting the app ends this command.
import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import {
  BUILDS, NODE_MAJOR, PORTS, ROOT, SERVICES, buildState, containerOn, electronInstalled, minioReady, portAnswers, postgresReady,
  probe, run, say, stop, versionOf, waitFor,
} from './lib.mjs'

say.title('Opening Incredible Studio')
if (versionOf(process.versions.node)[0] < NODE_MAJOR) stop(`Node ${process.versions.node} is too old: the studio needs Node ${NODE_MAJOR} or newer.`, `install Node ${NODE_MAJOR}, then yarn studio:setup.`)
if (!electronInstalled()) stop('The desktop app is not set up on this checkout yet.', 'yarn studio:setup (once), then yarn studio:app.')

// ——— Storage ———
const needed = []
for (const [label, port, service] of [['PostgreSQL', PORTS.postgres, SERVICES.postgres], ['MinIO', PORTS.minio, SERVICES.minio]]) {
  if (!(await portAnswers(port))) {
    needed.push(service)
    continue
  }
  const container = containerOn(port)
  if (container && container.service !== service) stop(`Port ${port}, the studio’s ${label}, is held by ${container.name}.`, `stop ${container.name}, then yarn studio:app again.`)
}
if (needed.length) {
  if (!probe('docker', ['info', '--format', '{{.ServerVersion}}'])) stop('The studio’s storage is not running, and Docker is not either.', 'start Docker, then yarn studio:app again.')
  say.note(`Starting the storage: docker compose up -d ${needed.join(' ')}`)
  if ((await run('docker', ['compose', 'up', '-d', ...needed])) !== 0) stop('The storage could not start (the lines above say why).', 'yarn studio:doctor looks at it in detail.')
  if (needed.includes(SERVICES.postgres) && !(await waitFor(postgresReady, 60))) stop('PostgreSQL did not become ready within a minute.', 'docker compose logs studio-db says why.')
}
if (!(await waitFor(minioReady, needed.includes(SERVICES.minio) ? 60 : 3))) stop('MinIO does not report itself live.', 'docker compose logs minio says why.')
say.ok(`Storage: PostgreSQL on ${PORTS.postgres}, MinIO on ${PORTS.minio}`)

// ——— Builds ———
for (const build of BUILDS) {
  const state = buildState(build)
  if (state === 'current') continue
  say.note(`${state === 'missing' ? 'Building' : 'Rebuilding'} ${build.name}${state === 'stale' ? ': its sources changed' : ''}…`)
  if ((await run('yarn', ['-s', ...build.command])) !== 0) stop(`Building ${build.name} failed (the lines above say why).`, 'fix what they name, then yarn studio:app again.')
}
say.ok('Builds: current')

// ——— The app ———
say.note('Starting the desktop app…')
const desktop = join(ROOT, 'apps', 'studio-desktop')
const electron = createRequire(join(desktop, 'package.json'))('electron')
const app = spawn(electron, ['.'], { cwd: desktop, stdio: ['ignore', 'pipe', 'pipe'] })
let origin = ''
let buffer = ''
const dim = text => (process.stdout.isTTY && !process.env.NO_COLOR ? `\x1b[2m${text}\x1b[0m` : text)
const follow = stream => stream.on('data', chunk => {
  buffer += chunk
  const lines = buffer.split('\n')
  buffer = lines.pop() || ''
  for (const line of lines) {
    const ready = /^STUDIO_ORIGIN (http:\/\/\S+)/.exec(line)
    if (ready && !origin) {
      origin = ready[1]
      say.ok(`Ready on ${origin} — the window is open. Quit the app to stop.`)
      continue
    }
    if (line.trim()) console.log(dim(`    ${line}`))
  }
})
follow(app.stdout)
follow(app.stderr)
app.on('exit', code => {
  if (origin) {
    say.line(code ? `\nThe app stopped (exit ${code}).` : '\nThe studio has closed.')
    process.exit(code ?? 0)
  }
  // One app at a time: a second launch brings the open window forward and quits.
  if (code === 0) {
    say.ok('The studio was already open: its window has been brought forward.')
    process.exit(0)
  }
  stop(`The app stopped before it was ready (exit ${code}); the lines above say why.`, 'yarn studio:doctor checks the setup.')
})
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => app.kill(signal))
