// yarn studio:doctor — what this machine has for the studio, and the next
// thing to do about each gap, without changing anything: the tools and
// their versions, the storage's health and migrations, the builds, the
// ports, the folders the app writes, the agent harnesses and when each last
// worked, and which keys are set.
//
// Keys are reported by where they are set, never by value. It never calls a
// paid model: whether a provider works is read from the last run the studio
// recorded for it. Exits 1 when something the studio needs is missing.
import { accessSync, constants, existsSync } from 'node:fs'
import { dirname } from 'node:path'
import {
  BUILDS, NODE_MAJOR, PORTS, SERVICES, buildState, containerOn, desktopPaths, electronInstalled, firstLine, keySource,
  listenerOn, minioReady, portAnswers, probe, say, sharedDependencies, store, versionOf,
} from './lib.mjs'

const mac = process.platform === 'darwin'
let needed = 0
let advised = 0
const fail = (text, next) => {
  needed += 1
  say.fail(text)
  if (next) say.note(`Next: ${next}`)
}
const warn = (text, next) => {
  advised += 1
  say.warn(text)
  if (next) say.note(next)
}
say.title('Incredible Studio: doctor')

// ——— Tools ———
say.step('Tools')
const node = versionOf(process.versions.node)
if (node[0] >= NODE_MAJOR) say.ok(`Node ${process.versions.node}`)
else fail(`Node ${process.versions.node}: the studio needs ${NODE_MAJOR} or newer`, `install Node ${NODE_MAJOR} (nvm install reads .nvmrc)`)
const yarn = probe('yarn', ['--version'])
if (yarn && versionOf(yarn)[0] === 1) say.ok(`Yarn ${firstLine(yarn)}`)
else fail(yarn ? `Yarn ${firstLine(yarn)} is not Yarn 1` : 'Yarn is not installed', 'corepack enable')
for (const tool of ['ffmpeg', 'ffprobe']) {
  const found = probe(tool, ['-version'])
  if (found) say.ok(firstLine(found).replace(/ Copyright.*$/, ''))
  else fail(`${tool} is not on your PATH`, mac ? 'brew install ffmpeg' : 'install FFmpeg with your package manager')
}
const dockerServer = probe('docker', ['info', '--format', '{{.ServerVersion}}'])
if (dockerServer) say.ok(`Docker ${firstLine(dockerServer)}, running`)
else if (probe('docker', ['--version'])) fail('Docker is installed but not running', mac ? 'start Docker Desktop' : 'sudo systemctl start docker')
else fail('Docker is not installed', mac ? 'install Docker Desktop' : 'install Docker Engine and the compose plugin')

// ——— Installed for the studio ———
say.step('Installed')
const sharedWith = sharedDependencies()
if (sharedWith) say.ok(`Dependencies: shared with ${sharedWith} (this checkout's node_modules links into it)`)
else if (existsSync(new URL('../../node_modules/.yarn-integrity', import.meta.url))) say.ok('Dependencies installed')
else fail('Dependencies are not installed', 'yarn studio:setup')
if (electronInstalled()) say.ok('Electron downloaded')
else fail('Electron has not been downloaded', 'yarn studio:setup')
const browsers = probe('yarn', ['-s', 'workspace', 'studio-v2', 'exec', 'puppeteer', 'browsers', 'list'], { timeout: 60_000 })
if (browsers && /chrome@/.test(browsers)) say.ok(`Chrome for Testing: ${firstLine(browsers.split('\n').find(line => /chrome@/.test(line))).split(' ')[0]}`)
else fail('The renderer’s browser (Chrome for Testing) is not installed', 'yarn studio:setup')
for (const build of BUILDS) {
  const state = buildState(build)
  const name = `${build.name[0].toUpperCase()}${build.name.slice(1)}`
  if (state === 'current') say.ok(`${name}: built from the current sources`)
  else if (state === 'stale') warn(`${name}: built, but the sources have changed since`, 'yarn studio:app rebuilds it before opening')
  else fail(`${name}: not built`, 'yarn studio:setup, or yarn studio:app')
}

// ——— Storage ———
say.step('Storage')
let storageUp = true
// Each harness's last recorded run, read with the migrations.
let runs = {}
for (const [label, port, service] of [['PostgreSQL', PORTS.postgres, SERVICES.postgres], ['MinIO', PORTS.minio, SERVICES.minio]]) {
  if (await portAnswers(port)) {
    const container = containerOn(port)
    if (container && container.service !== service) {
      storageUp = false
      fail(`Port ${port} answers, but from ${container.name}, not the studio’s ${label}`, `stop ${container.name}, then yarn studio:setup`)
    } else if (container) say.ok(`${label} answers on 127.0.0.1:${port}${container.project ? ` (compose project ${container.project})` : ''}`)
    else warn(`Port ${port} answers, but not from a Docker container: ${listenerOn(port) || 'another program'} holds it`, `if that is not the studio’s ${label}, stop it and run yarn studio:setup`)
  } else {
    storageUp = false
    fail(`${label} does not answer on 127.0.0.1:${port}`, 'yarn studio:infra starts it; yarn studio:setup does everything')
  }
}
if (storageUp && !(await minioReady())) fail('MinIO answers but does not report itself live', 'docker compose logs minio says why')
if (storageUp) {
  const seen = store('check')
  if (!seen.ok) fail(`The database cannot be read: ${seen.error}`, 'docker compose logs studio-db says why')
  else {
    const { migrations, bucket } = seen
    if (migrations.pending.length) warn(`${migrations.pending.length} migration${migrations.pending.length === 1 ? '' : 's'} not yet applied: ${migrations.pending.join(', ')}`, 'yarn studio:setup applies them (the app also does, when it starts)')
    else say.ok(`All ${migrations.total} migrations recorded`)
    if (bucket.ready) say.ok(`Bucket “${bucket.name}” exists`)
    else warn(`Bucket “${bucket.name}” does not exist yet`, 'yarn studio:setup makes it (the app also does, when it starts)')
    runs = seen.harnesses || {}
  }
}

// ——— Ports and folders ———
say.step('Ports and folders')
for (const [label, port] of [['browser development (yarn studio)', PORTS.browserDev], ['the worker (yarn studio, yarn studio:start)', PORTS.worker]]) {
  if (await portAnswers(port)) warn(`Port ${port}, for ${label}, is in use by ${listenerOn(port) || 'another program'}`, 'fine if that is the studio already running; otherwise stop it first. The desktop app picks its own free port.')
  else say.ok(`Port ${port} is free, for ${label}`)
}
const writable = path => {
  let at = path
  while (!existsSync(at) && dirname(at) !== at) at = dirname(at)
  try {
    accessSync(at, constants.W_OK)
    return true
  } catch {
    return false
  }
}
const paths = desktopPaths()
for (const [label, path] of [['The app’s data', paths.data], ['Exported videos', paths.outputs]]) {
  if (writable(path)) say.ok(`${label}: ${path}${existsSync(path) ? '' : ' (made on first use)'}`)
  else fail(`${label}: ${path} cannot be written`, 'fix its permissions, or set STUDIO_DATA_DIR / STUDIO_OUTPUTS_DIR')
}

// ——— AI ———
say.step('AI: harnesses and keys')
say.note('Whether a provider works is read from its last recorded run; no model is called here.')
const HARNESSES = [['claude-code', 'Claude Code', 'claude'], ['codex', 'Codex', 'codex'], ['kimi', 'Kimi', 'kimi']]
let harnesses = 0
for (const [id, label, command] of HARNESSES) {
  const version = probe(command, ['--version'])
  const last = runs[id]
  // A run cut short by the app closing says nothing about the provider.
  const interrupted = last?.failure === 'interrupted' || last?.state === 'interrupted'
  const failed = last?.state === 'error' && !interrupted
  const lastSaid = last ? `; its last run ${interrupted ? 'was interrupted before it finished' : failed ? `failed${last.failure ? ` (${last.failure})` : ''}` : last.state === 'done' ? 'worked' : `ended ${last.state}`}, ${last.at.slice(0, 16).replace('T', ' ')} UTC` : ''
  if (version) {
    harnesses += 1
    if (failed) warn(`${label} ${firstLine(version).replace(/\s*\(.*\)$/, '')}${lastSaid}`, `Next: ${last.next || `run ${command} in a terminal to check its sign-in`}`)
    else say.ok(`${label} ${firstLine(version).replace(/\s*\(.*\)$/, '')}${lastSaid}`)
  } else say.note(`${label}: not installed (optional)`)
}
const openai = keySource('OPENAI_API_KEY')
if (openai) say.ok(`OPENAI_API_KEY set (in ${openai}): the direct model can be used`)
else say.note('OPENAI_API_KEY: not set (optional; a key can also be saved in the studio’s AI settings)')
if (!harnesses && !openai) warn('No harness and no OpenAI key: writing the wireframe and designing slides will not run', 'sign in to Claude Code, Codex or Kimi, or save an OpenAI key in AI settings')
for (const [name, use] of [['QUIVER_API_KEY', 'generated artwork'], ['FISH_AUDIO_API_KEY', 'Fish Audio voices']]) {
  const where = keySource(name)
  if (where) say.ok(`${name} set (in ${where}): ${use}`)
  else say.note(`${name}: not set (optional: ${use})`)
}

// ——— Verdict ———
say.step(needed ? `${needed} thing${needed === 1 ? '' : 's'} to fix${advised ? `, ${advised} to look at` : ''}.` : advised ? `Ready, with ${advised} thing${advised === 1 ? '' : 's'} to look at.` : 'Ready.')
process.exit(needed ? 1 : 0)
