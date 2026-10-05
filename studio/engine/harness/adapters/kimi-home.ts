// Kimi reads its settings from KIMI_CODE_HOME, and the user's interactive
// sessions are theirs — so a run gets a home of its own: everything symlinked
// through to the real one, with a copy of the config that carries the call's
// thinking effort and its limit on one response. Their global setting is
// untouched. Kimi reports no token use over ACP; it writes a usage record for
// every model turn to the session's wire log, which this reads back.
import { mkdir, readFile, readdir, symlink, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { homedir } from 'node:os'
import type { TokenUsage } from '../../../shared/usage'

const ORDER = ['low', 'medium', 'high', 'xhigh', 'max']

export const realKimiHome = () =>
  process.env.KIMI_CODE_HOME || join(homedir(), '.kimi-code')

const section = (config: string, header: string) => {
  const start = config.indexOf(header)
  if (start < 0) return ''
  const rest = config.slice(start + header.length)
  const next = rest.search(/^\s*\[/m)
  return next < 0 ? rest : rest.slice(0, next)
}

/**
 * The effort the model accepts nearest the one asked for. K3 lists low, high
 * and max: a medium call goes to low, so a light call stays light.
 */
export const supportedEffort = (requested: string, supported: string[]) => {
  if (!supported.length || supported.includes(requested)) return requested
  const at = ORDER.indexOf(requested)
  return (
    ORDER.slice(0, Math.max(at, 0))
      .reverse()
      .find((effort) => supported.includes(effort)) ||
    ORDER.slice(at + 1).find((effort) => supported.includes(effort)) ||
    supported[0]
  )
}

/** The user's config with this run's thinking effort and response limit. */
export const runConfig = (
  config: string,
  run: { effort: string; maxOutputTokens?: number; model?: string }
) => {
  const model =
    run.model || /^\s*default_model\s*=\s*"([^"]+)"/m.exec(config)?.[1] || ''
  const listed = /^\s*support_efforts\s*=\s*\[([^\]]*)\]/m.exec(
    section(config, `[models."${model}"]`)
  )?.[1]
  const supported = (listed || '')
    .split(',')
    .map((value) => value.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean)
  const effort = supportedEffort(run.effort, supported)
  if (!ORDER.includes(run.effort) || !ORDER.includes(effort))
    throw new Error('Unsupported thinking effort')
  const cap =
    run.maxOutputTokens && run.maxOutputTokens > 0
      ? Math.round(run.maxOutputTokens)
      : 0
  const lines: string[] = []
  let current = ''
  for (const line of config.split('\n')) {
    const header = /^\s*\[([^\]]+)\]\s*$/.exec(line)?.[1]
    if (header) {
      current = header.trim()
      lines.push(line)
      if (current === 'thinking')
        lines.push('enabled = true', `effort = "${effort}"`)
      if (cap && current.startsWith('models.'))
        lines.push(`max_output_size = ${cap}`)
      continue
    }
    if (current === 'thinking' && /^\s*(?:effort|enabled)\s*=/.test(line))
      continue
    if (
      cap &&
      current.startsWith('models.') &&
      /^\s*max_output_size\s*=/.test(line)
    )
      continue
    lines.push(line)
  }
  if (!/^\s*\[thinking\]\s*$/m.test(config))
    lines.push('', '[thinking]', 'enabled = true', `effort = "${effort}"`)
  return { config: `${lines.join('\n').replace(/\s*$/, '')}\n`, effort }
}

export const kimiRunHome = async (
  projectDir: string,
  run: { effort: string; maxOutputTokens?: number; model?: string }
) => {
  const real = realKimiHome()
  const { config, effort } = runConfig(
    await readFile(join(real, 'config.toml'), 'utf8'),
    run
  )
  const home = join(projectDir, 'motion', 'kimi-home')
  // Keep this run's CLI sessions so a retry can resume its actual context.
  await mkdir(home, { recursive: true })
  for (const entry of await readdir(real)) {
    if (entry === 'config.toml' || entry === 'mcp.json') continue
    await symlink(join(real, entry), join(home, entry)).catch(() => {})
  }
  await writeFile(join(home, 'config.toml'), config, { mode: 0o600 })
  return { home, effort }
}

/** The tokens one run's session spent since it started, from its wire log. */
export const kimiSessionUsage = async (input: {
  home: string
  cwd: string
  sessionId: string
  since: number
}): Promise<TokenUsage | null> => {
  const root = join(input.home, 'sessions')
  const folders = await readdir(root).catch(() => [] as string[])
  const own = folders.filter((name) =>
    name.startsWith(`wd_${basename(input.cwd)}_`)
  )
  const usage: TokenUsage = {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    final: true
  }
  // ACP's session id is the folder's name ("session_<uuid>").
  const session = input.sessionId.startsWith('session_')
    ? input.sessionId
    : `session_${input.sessionId}`
  let found = false
  for (const folder of own.length ? own : folders) {
    const agents = join(root, folder, session, 'agents')
    for (const agent of await readdir(agents).catch(() => [] as string[])) {
      const log = await readFile(
        join(agents, agent, 'wire.jsonl'),
        'utf8'
      ).catch(() => '')
      for (const line of log.split('\n')) {
        if (!line.includes('"usage.record"')) continue
        try {
          const record = JSON.parse(line)
          if (record.type !== 'usage.record' || record.time < input.since)
            continue
          const turn = record.usage || {}
          const count = (value: unknown) =>
            typeof value === 'number' && Number.isFinite(value) && value > 0
              ? value
              : 0
          usage.input += count(turn.inputOther)
          usage.output += count(turn.output)
          usage.cacheRead += count(turn.inputCacheRead)
          usage.cacheWrite += count(turn.inputCacheCreation)
          found = true
        } catch {
          // A line still being written.
        }
      }
    }
  }
  return found ? usage : null
}
