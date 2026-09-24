// The models each local harness can run (M0 planning picks one per run).
//
// Claude Code has no command that lists models, so its list is the current
// Claude family; a model newer than the resolved CLI is marked unavailable
// with the version it needs. Kimi and Codex name their models in their own
// config files; only model names are read from them, nothing else.
import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { HarnessModels } from './types'

export const CLAUDE_MODELS: Array<{ id: string; label: string; minVersion?: string }> = [
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5', minVersion: '2.1.280' },
  { id: 'claude-fable-5-1', label: 'Claude Fable 5.1' },
  { id: 'claude-sonnet-5', label: 'Claude Sonnet 5' },
  { id: 'claude-opus-5', label: 'Claude Opus 5' },
  { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
]

// Dotted numeric versions, compared part by part ("2.1.280" > "2.1.278").
export const compareVersions = (a: string, b: string) => {
  const left = (a.match(/\d+(?:\.\d+)*/)?.[0] || '0').split('.').map(Number)
  const right = (b.match(/\d+(?:\.\d+)*/)?.[0] || '0').split('.').map(Number)
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const difference = (left[index] || 0) - (right[index] || 0)
    if (difference) return difference
  }
  return 0
}

// A CLI whose version is unknown (an explicit wrapper) is not gated.
export const claudeModels = (cliVersion: string): HarnessModels => ({
  default: null,
  source: `Claude models; Claude Code ${cliVersion || 'version unknown'}`,
  options: CLAUDE_MODELS.map(model => ({
    id: model.id,
    label: model.label,
    ...(model.minVersion && /\d+\.\d+/.test(cliVersion) && compareVersions(cliVersion, model.minVersion) < 0
      ? { unavailable: `needs Claude Code ${model.minVersion} or newer (found ${cliVersion})` }
      : {}),
  })),
})

// `default_model = "…"` and every `[models."…"]` table name in a Kimi config.
export const kimiModelsFrom = (config: string): HarnessModels => {
  const names = [...config.matchAll(/^\s*\[models\.(?:"([^"]+)"|([A-Za-z0-9_./-]+))\]\s*$/gm)].map(match => match[1] || match[2])
  const fallback = config.match(/^\s*default_model\s*=\s*"([^"]+)"/m)?.[1] || null
  const options = [...new Set([...(fallback ? [fallback] : []), ...names])]
  return { default: fallback, source: 'Kimi config.toml', options: options.map(id => ({ id, label: id })) }
}

export const kimiModels = async (): Promise<HarnessModels> => {
  const home = process.env.KIMI_CODE_HOME || join(homedir(), '.kimi-code')
  try {
    return kimiModelsFrom(await readFile(join(home, 'config.toml'), 'utf8'))
  } catch {
    return { default: null, source: 'no Kimi config found', options: [] }
  }
}

// Codex names one default `model = "…"` at the top of its config.
export const codexModelsFrom = (config: string): HarnessModels => {
  const topLevel = config.split(/^\s*\[/m)[0]
  const model = topLevel.match(/^\s*model\s*=\s*"([^"]+)"/m)?.[1] || null
  return { default: null, source: 'Codex config.toml', options: model ? [{ id: model, label: `${model} (your Codex config)` }] : [] }
}

export const codexModels = async (): Promise<HarnessModels> => {
  try {
    return codexModelsFrom(await readFile(join(homedir(), '.codex', 'config.toml'), 'utf8'))
  } catch {
    return { default: null, source: 'no Codex config found', options: [] }
  }
}
