// Hyperframes, driven as its authors run it: the pinned CLI for lint, check,
// snapshot, transcribe and render, and the workflow's own scripts (vendored
// byte for byte at v0.8.143) for the frame design, packets, captions, the
// index and the transitions. Nothing here judges; it runs and reports.
import { spawn } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { skillsRoot } from '../creative/stage'

export const HYPERFRAMES_VERSION = '0.8.143'

/** The vendored upstream tree (skills/storyboard-master/hyperframes). */
export const bundleDir = () =>
  join(skillsRoot(), 'storyboard-master', 'hyperframes')
export const upstreamPath = (...parts: string[]) =>
  join(bundleDir(), 'skills', ...parts)
export const scriptPath = (name: string) =>
  upstreamPath('faceless-explainer', 'scripts', `${name}.mjs`)
export const presetDir = () =>
  upstreamPath('hyperframes-creative', 'frame-presets')

export type RunResult = { code: number; stdout: string; stderr: string }

// Only what the tools need: never the studio's credentials. The CLI loads a
// .env from its working folder, and a project folder holds none.
const toolEnv = () => {
  const env: Record<string, string> = {
    HYPERFRAMES_NO_TELEMETRY: '1',
    HYPERFRAMES_NO_AUTO_INSTALL: '1',
    HYPERFRAMES_SKIP_SKILLS: '1',
    NO_COLOR: '1'
  }
  for (const name of [
    'PATH',
    'HOME',
    'TMPDIR',
    'LANG',
    'USER',
    'SHELL',
    'PRODUCER_BROWSER_GPU_MODE'
  ])
    if (process.env[name]) env[name] = process.env[name]!
  return env
}

export const runTool = (
  command: string,
  args: string[],
  options: { cwd: string; timeoutMs?: number; signal?: AbortSignal }
) =>
  new Promise<RunResult>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: toolEnv(),
      stdio: ['ignore', 'pipe', 'pipe']
    })
    let stdout = '',
      stderr = ''
    const timer = setTimeout(
      () => child.kill('SIGTERM'),
      options.timeoutMs ?? 10 * 60_000
    )
    const abort = () => child.kill('SIGTERM')
    options.signal?.addEventListener('abort', abort, { once: true })
    child.stdout.on('data', (chunk) => {
      stdout = (stdout + chunk.toString()).slice(-400_000)
    })
    child.stderr.on('data', (chunk) => {
      stderr = (stderr + chunk.toString()).slice(-400_000)
    })
    child.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      options.signal?.removeEventListener('abort', abort)
      resolve({ code: code ?? 1, stdout, stderr })
    })
  })

const tail = (result: RunResult) =>
  (result.stderr.trim() || result.stdout.trim())
    .split('\n')
    .slice(-12)
    .join('\n')

/** Runs one of the workflow's scripts; a non-zero exit is an error. */
export const runScript = async (
  name: string,
  args: string[],
  cwd: string,
  timeoutMs = 5 * 60_000
) => {
  const result = await runTool(process.execPath, [scriptPath(name), ...args], {
    cwd,
    timeoutMs
  })
  if (result.code !== 0)
    throw new Error(`${name} failed: ${tail(result) || `exit ${result.code}`}`)
  return result
}

// The pinned CLI: STUDIO_HYPERFRAMES_BIN, else the copy npx already holds
// for this exact version, else npx fetches it once.
let resolvedCli: { command: string; prefix: string[] } | null = null
export const hyperframesCli = () => {
  if (resolvedCli) return resolvedCli
  const named = process.env.STUDIO_HYPERFRAMES_BIN
  if (named) return (resolvedCli = { command: named, prefix: [] })
  const cache = join(homedir(), '.npm', '_npx')
  try {
    for (const entry of readdirSync(cache)) {
      const pkg = join(cache, entry, 'node_modules', 'hyperframes')
      const manifest = join(pkg, 'package.json')
      if (!existsSync(manifest)) continue
      const { version, bin } = JSON.parse(readFileSync(manifest, 'utf8')) as {
        version?: string
        bin?: string | Record<string, string>
      }
      const entryFile =
        typeof bin === 'string' ? bin : bin?.hyperframes || bin?.hf
      if (version === HYPERFRAMES_VERSION && entryFile)
        return (resolvedCli = {
          command: process.execPath,
          prefix: [join(pkg, entryFile)]
        })
    }
  } catch {
    // No npx cache: fall through to npx itself.
  }
  return (resolvedCli = {
    command: 'npx',
    prefix: ['--yes', `hyperframes@${HYPERFRAMES_VERSION}`]
  })
}

/** Runs the pinned CLI in a project folder. */
export const runCli = (
  args: string[],
  cwd: string,
  timeoutMs = 10 * 60_000,
  signal?: AbortSignal
) => {
  const cli = hyperframesCli()
  return runTool(cli.command, [...cli.prefix, ...args], {
    cwd,
    timeoutMs,
    signal
  })
}

/** The CLI's JSON answer, or null when it printed none. */
export const cliJson = <T>(result: RunResult): T | null => {
  const text = result.stdout.trim()
  const start = text.indexOf('{')
  if (start < 0) return null
  try {
    return JSON.parse(text.slice(start)) as T
  } catch {
    // Some commands print progress before the JSON: take the last object.
    const last = text.lastIndexOf('\n{')
    if (last < 0) return null
    try {
      return JSON.parse(text.slice(last + 1)) as T
    } catch {
      return null
    }
  }
}

export const cliTail = tail
