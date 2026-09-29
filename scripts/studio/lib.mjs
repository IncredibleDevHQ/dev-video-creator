// Shared by `yarn studio:setup`, `yarn studio:doctor` and `yarn studio:app`:
// how a step is said, how a command is run or probed, whether a port
// answers, whose container holds it, and where the desktop app keeps its
// work — the same way in all three.
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, lstatSync, readFileSync, readdirSync, readlinkSync, statSync } from 'node:fs'
import { createConnection } from 'node:net'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = fileURLToPath(new URL('../..', import.meta.url))
export const NODE_MAJOR = 22
export const PORTS = { postgres: 54329, minio: 59000, minioConsole: 59001, browserDev: 4173, worker: 4319 }
// The two services the studio needs from docker-compose.yaml; the file's
// other services belong to the legacy app and are never started here.
export const SERVICES = { postgres: 'studio-db', minio: 'minio' }

// ——— Saying it ———
const colour = process.stdout.isTTY && !process.env.NO_COLOR
const paint = (code, text) => (colour ? `\x1b[${code}m${text}\x1b[0m` : text)
export const say = {
  title: text => console.log(`\n${paint('1', text)}`),
  step: text => console.log(`\n${paint('1', text)}`),
  ok: text => console.log(`  ${paint('32', '✓')} ${text}`),
  warn: text => console.log(`  ${paint('33', '!')} ${text}`),
  fail: text => console.log(`  ${paint('31', '✗')} ${text}`),
  note: text => console.log(`    ${paint('2', text)}`),
  line: text => console.log(text),
}
// The one thing to do next, then stop: never a half-success.
export const stop = (problem, next) => {
  say.fail(problem)
  if (next) say.note(`Next: ${next}`)
  process.exit(1)
}

// ——— Running things ———
// A command's output when it succeeds, or null when it cannot run.
export const probe = (command, args, options = {}) => {
  const result = spawnSync(command, args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 20_000, ...options })
  return result.status === 0 ? `${result.stdout || ''}${result.stderr || ''}`.trim() : null
}
// A command run in the open, its output shown as it comes; resolves with its
// exit code.
export const run = (command, args, options = {}) =>
  new Promise(resolve => {
    const child = spawn(command, args, { cwd: ROOT, stdio: 'inherit', ...options })
    child.on('exit', code => resolve(code ?? 1))
    child.on('error', () => resolve(127))
  })
// The numbers of a version string: "v22.11.0" → [22, 11, 0].
export const versionOf = text => {
  const match = /(\d+)\.(\d+)(?:\.(\d+))?/.exec(text || '')
  return match ? match.slice(1).map(part => Number(part || 0)) : null
}
export const firstLine = text => String(text || '').split('\n')[0].trim()

// ——— Ports and containers ———
export const portAnswers = port =>
  new Promise(resolve => {
    const socket = createConnection({ host: '127.0.0.1', port })
    const done = answer => {
      socket.destroy()
      resolve(answer)
    }
    socket.once('connect', () => done(true))
    socket.once('error', () => done(false))
    socket.setTimeout(1_000, () => done(false))
  })
// The container publishing a port, with its compose project and service —
// so a studio database started from another checkout of this repository is
// used, not fought over.
export const containerOn = port => {
  const out = probe('docker', ['ps', '--filter', `publish=${port}`, '--format', '{{.Names}}|{{.Label "com.docker.compose.project"}}|{{.Label "com.docker.compose.service"}}'])
  if (!out) return null
  const [name, project, service] = firstLine(out).split('|')
  return name ? { name, project, service } : null
}
// What is listening on a port, when it is not a container (macOS and Linux).
export const listenerOn = port => {
  const out = probe('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-Fc'])
  const name = out?.split('\n').find(line => line.startsWith('c'))
  return name ? name.slice(1) : null
}

// ——— Health ———
export const postgresReady = () => probe('docker', ['compose', 'exec', '-T', SERVICES.postgres, 'pg_isready', '-U', 'incredible', '-d', 'incredible_studio']) !== null
export const minioReady = async () => {
  try {
    const response = await fetch(`http://127.0.0.1:${process.env.STUDIO_MINIO_PORT || PORTS.minio}/minio/health/live`, { signal: AbortSignal.timeout(2_000) })
    return response.ok
  } catch {
    return false
  }
}
export const waitFor = async (test, seconds) => {
  for (let i = 0; i < seconds; i += 1) {
    if (await test()) return true
    await new Promise(resolve => setTimeout(resolve, 1_000))
  }
  return false
}
// The durable store as the studio's own migrations see it (apps/studio-v2/
// scripts/store.ts): "prepare" runs what is missing, "check" only looks.
export const store = mode => {
  const result = spawnSync('yarn', ['-s', 'workspace', 'studio-v2', 'exec', 'tsx', 'scripts/store.ts', mode], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 120_000 })
  const line = `${result.stdout || ''}`.trim().split('\n').filter(entry => entry.startsWith('{')).pop()
  try {
    return line ? JSON.parse(line) : { ok: false, error: firstLine(result.stderr) || 'the store could not be read' }
  } catch {
    return { ok: false, error: 'the store answered with something unreadable' }
  }
}

// ——— Where things are ———
// Where the desktop app keeps its data and puts its exports
// (apps/studio-desktop/src/worker-host.ts).
export const desktopPaths = () => {
  const home = homedir()
  const userData =
    process.platform === 'darwin'
      ? join(home, 'Library', 'Application Support', 'studio-desktop')
      : process.platform === 'win32'
        ? join(process.env.APPDATA || join(home, 'AppData', 'Roaming'), 'studio-desktop')
        : join(process.env.XDG_CONFIG_HOME || join(home, '.config'), 'studio-desktop')
  return {
    data: process.env.STUDIO_DATA_DIR || join(userData, 'studio'),
    outputs: process.env.STUDIO_OUTPUTS_DIR || join(home, 'Downloads', 'Incredible Studio'),
  }
}
// The docker volume holding the data of the service on a port — this
// checkout's container, or another checkout's that this one uses.
export const volumeOn = port => {
  const container = containerOn(port)
  if (!container) return null
  return firstLine(probe('docker', ['inspect', '-f', '{{range .Mounts}}{{if .Name}}{{.Name}}{{end}}{{end}}', container.name])) || null
}
// A checkout whose node_modules links into another checkout's (a worktree
// set up to share them) uses that checkout's dependencies. Installing here
// would replace the links with copies, and Yarn 1 can stop half-way doing
// it. The other checkout, or null when the dependencies are this one's own.
export const sharedDependencies = () => {
  for (const entry of ['typescript', 'vite', '.bin']) {
    const path = join(ROOT, 'node_modules', entry)
    try {
      if (!lstatSync(path).isSymbolicLink()) continue
      const target = resolve(dirname(path), readlinkSync(path))
      if (!target.startsWith(ROOT)) return dirname(dirname(target))
    } catch {
      // Not there: the next entry is looked at.
    }
  }
  return null
}
// Electron's own directory, as the desktop app resolves it.
export const electronDir = () => {
  for (const base of [join(ROOT, 'apps', 'studio-desktop', 'node_modules', 'electron'), join(ROOT, 'node_modules', 'electron')]) {
    if (existsSync(join(base, 'package.json'))) return base
  }
  return null
}
export const electronInstalled = () => {
  const dir = electronDir()
  if (!dir) return false
  try {
    const wanted = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).version
    return readFileSync(join(dir, 'dist', 'version'), 'utf8').replace(/^v/, '').trim() === wanted
  } catch {
    return false
  }
}

// ——— Whether a build is current ———
// The newest file under some folders: a build older than it is stale.
const newestIn = (path, newest = 0) => {
  if (!existsSync(path)) return newest
  const stat = statSync(path)
  if (!stat.isDirectory()) return Math.max(newest, stat.mtimeMs)
  for (const entry of readdirSync(path)) {
    if (entry === 'node_modules' || entry === 'dist' || entry === 'dist-electron' || entry.startsWith('.')) continue
    newest = newestIn(join(path, entry), newest)
  }
  return newest
}
const builtAt = path => (existsSync(path) ? statSync(path).mtimeMs : 0)
const COMPOSITION = join(ROOT, 'packages', 'markdown-composition', 'src')
const V2 = join(ROOT, 'apps', 'studio-v2')
const DESKTOP = join(ROOT, 'apps', 'studio-desktop')
// The front end the desktop serves (apps/studio-v2/dist), and the desktop
// app itself, whose worker bundles the studio's server code.
export const BUILDS = [
  { name: 'the studio front end', output: join(V2, 'dist', 'index.html'), inputs: [join(V2, 'src'), join(V2, 'index.html'), join(V2, 'public'), COMPOSITION], command: ['workspace', 'studio-v2', 'build'] },
  { name: 'the desktop app', output: join(DESKTOP, 'dist-electron', 'worker.mjs'), inputs: [join(DESKTOP, 'src'), join(V2, 'server'), join(V2, 'src'), COMPOSITION], command: ['workspace', 'studio-desktop', 'build'] },
]
export const buildState = build => {
  const at = builtAt(build.output)
  if (!at) return 'missing'
  return build.inputs.some(input => newestIn(input) > at) ? 'stale' : 'current'
}

// ——— Keys, by presence only ———
// Whether a key is set where the studio's server looks for it
// (apps/studio-v2/server/index.ts): the environment, then the repository's
// .env and the ones beside it. Never its value.
export const keySource = name => {
  if (process.env[name]) return 'the environment'
  const parent = dirname(ROOT)
  for (const file of [join(ROOT, '.env'), join(parent, '.env'), join(parent, 'agents', '.env')]) {
    try {
      const line = readFileSync(file, 'utf8').split(/\r?\n/).find(entry => entry.trim().startsWith(`${name}=`))
      if (line && line.slice(line.indexOf('=') + 1).trim().replace(/^['"]|['"]$/g, '')) return file.startsWith(ROOT) ? '.env' : file
    } catch {
      // Not there: the next place is looked at.
    }
  }
  return null
}
