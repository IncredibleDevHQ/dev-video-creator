// Which local harness and model each stage runs on — story outline, page
// drawing, video planning and scene production — from the one durable
// preference (server settings, so a restart or a new local port keeps it),
// and each harness's last provider status.
//
// A stage runs on its own override, else the default. With nothing chosen,
// the first available harness is suggested and labelled as a suggestion.
// A chosen harness that is not available is reported, never silently
// swapped for another.
export type HarnessId = 'claude-code' | 'kimi' | 'codex'
export type HarnessStage = 'story' | 'drawing' | 'planning' | 'composition'
export type HarnessChoice = { harness: HarnessId; model: string | null }
export type HarnessPreferences = {
  default: HarnessChoice | null
  stages: Partial<Record<HarnessStage, HarnessChoice>>
  updatedAt: string | null
}
export type HarnessModels = { default: string | null; options: Array<{ id: string; label: string; unavailable?: string }>; source: string }
export type HarnessAvailability = { id: string; ok: boolean; version?: string; reason?: string; models?: HarnessModels }
export type RunFailureView = { category: string; message: string; recovery: string[]; requestedModel?: string; reportedModel?: string }
export type HarnessStatus = Record<string, { state: 'ok' | 'error'; runId: string; skill: string; model: string | null; at: string; failure?: RunFailureView }>

export const HARNESS_LABELS: Record<string, string> = { 'claude-code': 'Claude Code', kimi: 'Kimi', codex: 'Codex' }
export const STAGE_LABELS: Record<HarnessStage, string> = {
  story: 'Story outline',
  drawing: 'Page drawing',
  planning: 'Video planning',
  composition: 'Scene production',
}
export const HARNESS_STAGES: HarnessStage[] = ['story', 'drawing', 'planning', 'composition']

// What the studio suggests when nothing is chosen: Claude Code on the latest
// Opus; Kimi and Codex on the model their own config names.
const SUGGESTION_ORDER: HarnessId[] = ['claude-code', 'kimi', 'codex']
const RECOMMENDED_MODELS: Partial<Record<HarnessId, string>> = { 'claude-code': 'claude-opus-5-5' }

const FAILURE_TITLES: Record<string, string> = {
  quota: 'Out of credits or over the usage limit',
  auth: 'Not signed in',
  model: 'This model is not available',
  'rate-limit': 'Rate limited',
  network: 'Network problem',
  unavailable: 'Harness not available',
  interrupted: 'Interrupted',
  other: 'The run failed',
}
export const failureTitle = (category: string | undefined) => FAILURE_TITLES[category || 'other'] || FAILURE_TITLES.other

type FetchJson = <T>(path: string, init?: RequestInit) => Promise<T>

export const loadHarnessPreferences = async (fetchJson: FetchJson) =>
  (await fetchJson<{ preferences: HarnessPreferences }>('/api/settings/harness')).preferences

export const saveHarnessPreferences = async (fetchJson: FetchJson, patch: { default?: HarnessChoice | null; stages?: Partial<Record<HarnessStage, HarnessChoice | null>> }) =>
  (
    await fetchJson<{ preferences: HarnessPreferences }>('/api/settings/harness', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    })
  ).preferences

export const loadHarnessStatus = async (fetchJson: FetchJson) =>
  (await fetchJson<{ status: HarnessStatus }>('/api/harness/status').catch(() => ({ status: {} as HarnessStatus }))).status

export type ResolvedHarness = {
  harness: HarnessId | null
  model: string | null
  // 'stage': this stage's override; 'default'; 'suggested': nothing chosen yet.
  source: 'stage' | 'default' | 'suggested' | 'none'
  available: boolean
  reason: string | null
}

export const modelLabel = (adapters: HarnessAvailability[], harness: string | null, model: string | null) => {
  if (!harness) return ''
  if (!model) {
    const fallback = adapters.find(entry => entry.id === harness)?.models?.default
    return `CLI default${fallback ? ` (${fallback})` : ''}`
  }
  return adapters.find(entry => entry.id === harness)?.models?.options.find(option => option.id === model)?.label || model
}

export const resolveStage = (preferences: HarnessPreferences, stage: HarnessStage, adapters: HarnessAvailability[]): ResolvedHarness => {
  const chosen = preferences.stages[stage] ? { ...preferences.stages[stage]!, source: 'stage' as const } : preferences.default ? { ...preferences.default, source: 'default' as const } : null
  if (chosen) {
    const adapter = adapters.find(entry => entry.id === chosen.harness)
    const option = chosen.model ? adapter?.models?.options.find(entry => entry.id === chosen.model) : undefined
    const label = HARNESS_LABELS[chosen.harness] || chosen.harness
    const reason = !adapter?.ok
      ? `${label} is not available${adapter?.reason ? ` (${adapter.reason.replace(/\s+/g, ' ').slice(0, 120)})` : ''}. Choose another harness in AI settings.`
      : option?.unavailable
        ? `${option.label} ${option.unavailable}. Choose another model in AI settings.`
        : null
    return { harness: chosen.harness, model: chosen.model, source: chosen.source, available: !reason, reason }
  }
  const online = SUGGESTION_ORDER.map(id => adapters.find(entry => entry.id === id && entry.ok)).find(Boolean)
  if (!online) return { harness: null, model: null, source: 'none', available: false, reason: 'No local harness is available — install Claude Code, Kimi or Codex, then choose it in AI settings.' }
  const recommended = RECOMMENDED_MODELS[online.id as HarnessId] ?? online.models?.default ?? null
  const usable = recommended && !online.models?.options.find(option => option.id === recommended)?.unavailable ? recommended : null
  return { harness: online.id as HarnessId, model: usable, source: 'suggested', available: true, reason: null }
}

// Where planning can run from here, told apart (R9): a browser can review
// but not run the local harness; the desktop app may have no harness at all,
// or not the one chosen. A provider's quota, sign-in or run failure is the
// last status, shown beside this — never mistaken for "not installed".
export type PlanningHost = { state: 'browser' | 'no-harness' | 'unavailable' | 'ready'; message: string | null }
export const BROWSER_REVIEW_MESSAGE = 'You are reviewing in a browser: plans, sketches and approvals can be read and compared here, but planning, sketching and recording run in the Incredible Studio desktop app, with your local harness. Open this notebook there to continue.'
export const planningHostOf = (isDesktop: boolean, adapters: HarnessAvailability[], resolved: ResolvedHarness): PlanningHost =>
  !isDesktop
    ? { state: 'browser', message: BROWSER_REVIEW_MESSAGE }
    : !adapters.some(adapter => adapter.ok)
      ? { state: 'no-harness', message: 'No local harness was found on this computer — install Claude Code, Kimi or Codex, then choose it in AI settings.' }
      : !resolved.available
        ? { state: 'unavailable', message: resolved.reason }
        : { state: 'ready', message: null }

// "Claude Code · Claude Opus 5.5", marked when it is only a suggestion.
export const resolvedLabel = (resolved: ResolvedHarness, adapters: HarnessAvailability[]) =>
  resolved.harness
    ? `${HARNESS_LABELS[resolved.harness] || resolved.harness} · ${modelLabel(adapters, resolved.harness, resolved.model)}${resolved.source === 'suggested' ? ' (suggested)' : ''}`
    : 'No harness'

// Browser-stored choices from before the durable preference are adopted
// once, so an existing creator keeps what they picked.
export const adoptLegacyChoices = async (fetchJson: FetchJson, preferences: HarnessPreferences): Promise<HarnessPreferences> => {
  if (preferences.default || Object.keys(preferences.stages).length) return preferences
  const read = (key: string) => {
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  }
  const legacyModels: Record<string, string> = { kimi: 'kimi-code/k3', 'claude-code': 'claude-fable-5-1' }
  const creation = read('studio.codingAgent')
  const planning = read('studio.planningHarness')
  const patch: { default?: HarnessChoice; stages?: Partial<Record<HarnessStage, HarnessChoice>> } = {}
  if (creation && creation in legacyModels) patch.default = { harness: creation as HarnessId, model: legacyModels[creation] }
  if (planning && planning in HARNESS_LABELS) {
    // What the old workspace ran: the model picked, else its recommendation.
    const model = read(`studio.planningModel.${planning}`)
    patch.stages = { planning: { harness: planning as HarnessId, model: model && model !== '__custom__' ? model : RECOMMENDED_MODELS[planning as HarnessId] ?? null } }
  }
  if (!patch.default && !patch.stages) return preferences
  return saveHarnessPreferences(fetchJson, patch).catch(() => preferences)
}

// One progress line from a harness event, naming what it actually does:
// reading a manual is "Reading", never "wrote".
const VERBS: Record<string, string> = { read: 'Reading', search: 'Searching', write: 'Writing', edit: 'Editing', run: 'Running', tool: 'Using' }
export const progressText = (event: { type: string; text?: string; tool?: string; file?: string; error?: string; operation?: string; model?: string }) => {
  if (event.type === 'text' && event.text) return event.text.replace(/\s+/g, ' ').trim().slice(0, 160)
  if (event.type === 'file' && event.file) return `${VERBS[event.operation || ''] || 'Working on'} ${event.file.split('/').pop()}`
  if (event.type === 'tool' && event.tool) {
    // Reading and writing tools are followed by their file event.
    if (['read', 'write', 'edit'].includes(event.operation || '')) return ''
    if (event.operation === 'run') return 'Running a command'
    if (event.operation === 'search') return 'Searching the files'
    return `Using ${event.tool.replace(/^mcp__studio__/, '')}`
  }
  if (event.type === 'session' && event.model) return `Started on ${event.model}`
  if (event.type === 'error' && event.error) return event.error.replace(/\s+/g, ' ').trim().slice(0, 240)
  return ''
}
