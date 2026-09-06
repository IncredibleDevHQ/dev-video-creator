// Shared spawn plumbing for the CLI adapters: line-delimited stdout parsing,
// stderr capture, abort → kill, exit-code resolution.
import { spawn, type ChildProcess } from 'node:child_process'
import { createInterface } from 'node:readline'

export type SpawnJsonLinesOptions = {
  command: string
  args: string[]
  cwd: string
  env?: Record<string, string>
  onLine: (line: string) => void
  onStderr?: (text: string) => void
  signal: AbortSignal
}

export const spawnJsonLines = (
  options: SpawnJsonLinesOptions,
): Promise<{ exitCode: number }> =>
  new Promise((resolve, reject) => {
    let child: ChildProcess
    try {
      child = spawn(options.command, options.args, {
        cwd: options.cwd,
        env: { ...process.env, ...options.env },
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    } catch (error) {
      reject(error)
      return
    }
    const abort = () => {
      child.kill('SIGTERM')
      // A stuck CLI gets a hard kill shortly after.
      setTimeout(() => child.kill('SIGKILL'), 3_000).unref()
    }
    if (options.signal.aborted) abort()
    else options.signal.addEventListener('abort', abort, { once: true })
    child.once('error', reject)
    const lines = createInterface({ input: child.stdout! })
    lines.on('line', options.onLine)
    let stderrTail = ''
    child.stderr!.on('data', chunk => {
      const text = chunk.toString()
      stderrTail = (stderrTail + text).slice(-4_000)
      options.onStderr?.(text)
    })
    child.on('close', code => {
      options.signal.removeEventListener('abort', abort)
      resolve({ exitCode: code ?? (options.signal.aborted ? 130 : 1) })
    })
  })

// Runs `command --version`-style probes with a timeout for adapter.available().
export const probeVersion = (
  command: string,
  args: string[] = ['--version'],
  timeoutMs = 5_000,
): Promise<{ ok: boolean; version?: string; reason?: string }> =>
  new Promise(resolve => {
    let child: ChildProcess
    try {
      child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    } catch (error) {
      resolve({ ok: false, reason: String(error) })
      return
    }
    const timeout = setTimeout(() => {
      child.kill('SIGKILL')
      resolve({ ok: false, reason: `no answer within ${timeoutMs} ms` })
    }, timeoutMs)
    let output = ''
    child.stdout!.on('data', chunk => {
      output += chunk.toString()
    })
    child.once('error', error => {
      clearTimeout(timeout)
      resolve({ ok: false, reason: error.message })
    })
    child.on('close', code => {
      clearTimeout(timeout)
      if (code === 0) resolve({ ok: true, version: output.trim().split('\n')[0].slice(0, 120) })
      else resolve({ ok: false, reason: `exited with ${code}` })
    })
  })
