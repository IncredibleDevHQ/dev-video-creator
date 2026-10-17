// The models each local harness can run (M0 planning picks one per run).
//
// Claude Code has no command that lists models, so its list is the current
// Claude family; a model newer than the resolved CLI is marked unavailable
// with the version it needs. Kimi and Codex name their models in their own
// config files; Codex also exposes its local model catalog. Only model picker
// metadata is returned, never account identity or credentials.
import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { HarnessModels } from './types'

export { CLAUDE_MODELS } from '../../shared/agent-models'
import { CLAUDE_MODELS, modelName } from '../../shared/agent-models'

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
  source: `The models Claude Code${cliVersion ? ` ${cliVersion}` : ''} offers.`,
  options: CLAUDE_MODELS.map((model) => ({
    id: model.id,
    label: model.label,
    ...(model.hint ? { hint: model.hint } : {}),
    ...(model.minVersion &&
    /\d+\.\d+/.test(cliVersion) &&
    compareVersions(cliVersion, model.minVersion) < 0
      ? {
          unavailable: `needs Claude Code ${model.minVersion} or newer (found ${cliVersion})`
        }
      : {})
  }))
})

// `default_model = "…"` and every `[models."…"]` table name in a Kimi config.
export const kimiModelsFrom = (config: string): HarnessModels => {
  const names = [
    ...config.matchAll(/^\s*\[models\.(?:"([^"]+)"|([A-Za-z0-9_./-]+))\]\s*$/gm)
  ].map((match) => match[1] || match[2])
  const fallback =
    config.match(/^\s*default_model\s*=\s*"([^"]+)"/m)?.[1] || null
  const options = [...new Set([...(fallback ? [fallback] : []), ...names])]
  return {
    default: fallback,
    source: 'From your Kimi settings.',
    // Plain names in the picker; the id it runs is in the tooltip.
    options: options.map((id) => ({
      id,
      label: modelName(id),
      ...(modelName(id) !== id ? { hint: id } : {})
    }))
  }
}

export const kimiModels = async (): Promise<HarnessModels> => {
  const home = process.env.KIMI_CODE_HOME || join(homedir(), '.kimi-code')
  try {
    return kimiModelsFrom(await readFile(join(home, 'config.toml'), 'utf8'))
  } catch {
    return {
      default: null,
      source: 'No Kimi settings were found.',
      options: []
    }
  }
}

// Codex names one default `model = "…"` at the top of its config.
export const codexModelsFrom = (config: string): HarnessModels => {
  const topLevel = config.split(/^\s*\[/m)[0]
  const model = topLevel.match(/^\s*model\s*=\s*"([^"]+)"/m)?.[1] || null
  return {
    default: null,
    source: 'From your Codex settings.',
    options: model
      ? [
          {
            id: model,
            label: modelName(model),
            hint:
              modelName(model) === model
                ? 'The model in your Codex config'
                : `The model in your Codex config: ${model}`
          }
        ]
      : []
  }
}

/** Only expose picker metadata from the CLI cache, never account identity or config secrets. */
export const codexCatalogFrom = (
  config: string,
  cache: unknown
): HarnessModels => {
  const configured = codexModelsFrom(config)
  const rows =
    cache &&
    typeof cache === 'object' &&
    'models' in cache &&
    Array.isArray(cache.models)
      ? cache.models
      : []
  const options = rows.flatMap((model) => {
    if (
      !model ||
      typeof model !== 'object' ||
      model.visibility !== 'list' ||
      typeof model.slug !== 'string'
    )
      return []
    const label =
      typeof model.display_name === 'string' ? model.display_name : model.slug
    // The id it runs, in the tooltip, as for the other agents.
    return [
      {
        id: model.slug,
        label,
        ...(label !== model.slug ? { hint: model.slug } : {})
      }
    ]
  })
  for (const option of configured.options)
    if (!options.some((item) => item.id === option.id)) options.push(option)
  return {
    default: null,
    source: rows.length
      ? 'Models listed by your local Codex installation. Account access is checked when you run.'
      : 'Codex configuration. Open Codex to refresh its model catalog.',
    options: [...new Map(options.map((option) => [option.id, option])).values()]
  }
}
export const codexModels = async (): Promise<HarnessModels> => {
  const directory = process.env.CODEX_HOME || join(homedir(), '.codex')
  const [config, cache] = await Promise.all([
    readFile(join(directory, 'config.toml'), 'utf8').catch(() => ''),
    readFile(join(directory, 'models_cache.json'), 'utf8')
      .then((text) => {
        try {
          return JSON.parse(text)
        } catch {
          return null
        }
      })
      .catch(() => null)
  ])
  return codexCatalogFrom(config, cache)
}
