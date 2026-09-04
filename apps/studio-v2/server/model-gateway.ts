// Model gateway: one place that decides where the studio's AI requests go.
//
// Every generation in the worker was written against OpenAI's Responses API
// (structured JSON outputs, image inputs). Users can now point the studio at
// any OpenAI-compatible endpoint instead — OpenAI itself, a self-hosted
// LiteLLM proxy fanning out to a hundred providers, OpenRouter, a local
// Ollama, Anthropic's compatibility endpoint, or anything custom — and pick a
// model per task. Call sites keep their Responses-shaped payloads; this module
// translates to Chat Completions for providers that need it and hands back a
// Responses-shaped body, so the rest of the server does not care.

import { loadSetting, saveSetting } from './persistence'

export type ModelTask = 'writing' | 'vision' | 'coding'
export type ModelProviderPreset =
  | 'openai'
  | 'litellm'
  | 'openrouter'
  | 'ollama'
  | 'anthropic'
  | 'custom'
export type ReasoningEffort = 'none' | 'low' | 'medium' | 'high'

export type ModelSettingsV1 = {
  version: 1
  provider: ModelProviderPreset
  baseUrl: string
  apiKey: string
  models: Record<ModelTask, string>
  reasoningEffort: ReasoningEffort
}

export type ModelSettingsPublic = Omit<ModelSettingsV1, 'apiKey'> & {
  hasKey: boolean
  keyHint: string
  source: 'saved' | 'environment' | 'none'
}

type PresetInfo = {
  label: string
  baseUrl: string
  // Whether the endpoint speaks OpenAI's Responses API (else Chat Completions).
  responsesApi: boolean
  // Whether reasoning effort can be forwarded.
  reasoning: boolean
  keyRequired: boolean
  models: Record<ModelTask, string>
  note: string
}

export const MODEL_PRESETS: Record<ModelProviderPreset, PresetInfo> = {
  openai: {
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    responsesApi: true,
    reasoning: true,
    keyRequired: true,
    models: { writing: 'gpt-5.6-luna', vision: 'gpt-5.6-luna', coding: 'gpt-5.6-luna' },
    note: 'Direct to OpenAI with your own key.',
  },
  litellm: {
    label: 'LiteLLM proxy (self-hosted gateway)',
    baseUrl: 'http://127.0.0.1:4000/v1',
    responsesApi: false,
    reasoning: true,
    keyRequired: false,
    models: { writing: 'gpt-5.6-luna', vision: 'gpt-5.6-luna', coding: 'gpt-5.6-luna' },
    note: 'Open-source gateway that routes to 100+ providers behind one OpenAI-compatible URL. Run it with `docker run -p 4000:4000 ghcr.io/berriai/litellm:main-latest --config litellm.yaml` and name the models from your config.',
  },
  openrouter: {
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    responsesApi: false,
    reasoning: true,
    keyRequired: true,
    models: {
      writing: 'anthropic/claude-sonnet-4.5',
      vision: 'openai/gpt-5.6-luna',
      coding: 'anthropic/claude-sonnet-4.5',
    },
    note: 'Hosted router across providers; model ids look like vendor/model.',
  },
  ollama: {
    label: 'Ollama (local)',
    baseUrl: 'http://127.0.0.1:11434/v1',
    responsesApi: false,
    reasoning: false,
    keyRequired: false,
    models: { writing: 'llama3.1', vision: 'llava', coding: 'qwen2.5-coder' },
    note: 'Runs on your machine, no key. Vision tasks need a multimodal model such as llava.',
  },
  anthropic: {
    label: 'Anthropic (OpenAI-compatible endpoint)',
    baseUrl: 'https://api.anthropic.com/v1',
    responsesApi: false,
    reasoning: false,
    keyRequired: true,
    models: {
      writing: 'claude-sonnet-4-5',
      vision: 'claude-sonnet-4-5',
      coding: 'claude-sonnet-4-5',
    },
    note: 'Uses Anthropic’s OpenAI SDK compatibility layer; structured output falls back to prompt-guided JSON.',
  },
  custom: {
    label: 'Custom OpenAI-compatible',
    baseUrl: '',
    responsesApi: false,
    reasoning: false,
    keyRequired: false,
    models: { writing: '', vision: '', coding: '' },
    note: 'Any server that speaks /v1/chat/completions (vLLM, LM Studio, Together, Groq, …).',
  },
}

const SETTINGS_KEY = 'models'
const TASKS: ModelTask[] = ['writing', 'vision', 'coding']

let environmentKey = ''
let cache: { settings: ModelSettingsV1 | null; source: ModelSettingsPublic['source'] } | null =
  null

export const configureModelGateway = ({ envKey }: { envKey: string }) => {
  environmentKey = envKey
  cache = null
}

const normalizeSettings = (value: unknown): ModelSettingsV1 | null => {
  if (!value || typeof value !== 'object') return null
  const raw = value as Partial<ModelSettingsV1> & { models?: Partial<Record<ModelTask, string>> }
  const provider = (Object.keys(MODEL_PRESETS) as ModelProviderPreset[]).includes(
    raw.provider as ModelProviderPreset,
  )
    ? (raw.provider as ModelProviderPreset)
    : 'custom'
  const preset = MODEL_PRESETS[provider]
  const models = {} as Record<ModelTask, string>
  for (const task of TASKS) {
    models[task] = String(raw.models?.[task] || '').trim().slice(0, 200)
  }
  const effort = raw.reasoningEffort
  return {
    version: 1,
    provider,
    baseUrl: String(raw.baseUrl || preset.baseUrl).trim().replace(/\/+$/, '').slice(0, 500),
    apiKey: String(raw.apiKey || '').trim().slice(0, 4_000),
    models,
    reasoningEffort:
      effort === 'none' || effort === 'low' || effort === 'medium' || effort === 'high'
        ? effort
        : 'medium',
  }
}

const environmentSettings = (): ModelSettingsV1 | null => {
  if (!environmentKey) return null
  const writing = process.env.OPENAI_NOTES_MODEL || 'gpt-5.6-luna'
  return {
    version: 1,
    provider: 'openai',
    baseUrl: MODEL_PRESETS.openai.baseUrl,
    apiKey: environmentKey,
    models: {
      writing,
      vision: writing,
      coding: writing,
    },
    reasoningEffort: 'medium',
  }
}

export const loadModelSettings = async () => {
  if (cache) return cache
  const saved = normalizeSettings(await loadSetting(SETTINGS_KEY))
  if (saved) {
    cache = { settings: saved, source: 'saved' }
  } else {
    const fromEnv = environmentSettings()
    cache = { settings: fromEnv, source: fromEnv ? 'environment' : 'none' }
  }
  return cache
}

export const saveModelSettings = async (
  patch: Partial<ModelSettingsV1> & { models?: Partial<Record<ModelTask, string>> },
) => {
  const current = (await loadModelSettings()).settings
  const merged = normalizeSettings({
    ...(current || {}),
    ...patch,
    // A blank key means "keep what is saved"; users never see the stored key.
    apiKey: patch.apiKey ? patch.apiKey : current?.apiKey || '',
    models: { ...(current?.models || {}), ...(patch.models || {}) },
  })
  if (!merged) throw new Error('Model settings are invalid')
  await saveSetting(SETTINGS_KEY, merged)
  cache = null
  return merged
}

export const publicModelSettings = async (): Promise<ModelSettingsPublic> => {
  const { settings, source } = await loadModelSettings()
  const base = settings || {
    version: 1 as const,
    provider: 'openai' as const,
    baseUrl: MODEL_PRESETS.openai.baseUrl,
    apiKey: '',
    models: { ...MODEL_PRESETS.openai.models },
    reasoningEffort: 'medium' as const,
  }
  const { apiKey, ...rest } = base
  return {
    ...rest,
    hasKey: Boolean(apiKey),
    keyHint: apiKey ? `…${apiKey.slice(-4)}` : '',
    source,
  }
}

export const hasModelAccess = async () => {
  const { settings } = await loadModelSettings()
  if (!settings) return false
  const preset = MODEL_PRESETS[settings.provider]
  if (!settings.baseUrl) return false
  return Boolean(settings.apiKey) || !preset.keyRequired
}

const authHeaders = (settings: Pick<ModelSettingsV1, 'apiKey' | 'provider'>) => {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (settings.apiKey) headers.authorization = `Bearer ${settings.apiKey}`
  if (settings.provider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://incredible.dev'
    headers['X-Title'] = 'Incredible Studio'
  }
  return headers
}

export const listModels = async (
  override?: Partial<ModelSettingsV1>,
): Promise<string[]> => {
  const current = (await loadModelSettings()).settings
  const settings = normalizeSettings({
    ...(current || {}),
    ...(override || {}),
    apiKey: override?.apiKey || current?.apiKey || '',
  })
  if (!settings?.baseUrl) throw new Error('Set a base URL first')
  const response = await fetch(`${settings.baseUrl}/models`, {
    headers: authHeaders(settings),
  })
  if (!response.ok) {
    throw new Error(`The provider rejected the request (${response.status})`)
  }
  const body = (await response.json()) as {
    data?: Array<{ id?: string }>
    models?: Array<{ name?: string; model?: string }>
  }
  const ids = [
    ...(body.data || []).map(item => String(item.id || '')),
    ...(body.models || []).map(item => String(item.model || item.name || '')),
  ].filter(Boolean)
  return Array.from(new Set(ids)).sort()
}

type ResponsesContentPart = { type?: string; text?: string; image_url?: string }
type ResponsesMessage = { role?: string; content?: string | ResponsesContentPart[] }
type ResponsesPayload = {
  model?: string
  // The Responses API accepts a bare prompt string or a list of messages.
  input?: string | ResponsesMessage[]
  reasoning?: { effort?: string }
  text?: {
    format?: {
      type?: string
      name?: string
      strict?: boolean
      schema?: unknown
    }
  }
}

type ResponsesShape = {
  output: Array<{ content: Array<{ type: string; text: string }> }>
}

export type ModelFetchResult = {
  ok: boolean
  status: number
  json: () => Promise<ResponsesShape>
}

const stripFences = (text: string) =>
  text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()

const wrap = (text: string): ModelFetchResult => ({
  ok: true,
  status: 200,
  json: async () => ({ output: [{ content: [{ type: 'output_text', text }] }] }),
})

/**
 * Drop-in for `fetch('https://api.openai.com/v1/responses', init)`: the body
 * is a Responses API payload; the result reads like a Responses API reply.
 */
export const modelFetch = async (
  task: ModelTask,
  init: { method?: string; body: string },
): Promise<ModelFetchResult> => {
  const { settings } = await loadModelSettings()
  if (!settings) {
    throw new Error('No AI provider configured — open Models in the top bar to add one')
  }
  const preset = MODEL_PRESETS[settings.provider]
  const payload = JSON.parse(init.body) as ResponsesPayload
  const model = settings.models[task] || settings.models.writing || preset.models[task]
  if (!model) throw new Error(`Choose a ${task} model in Models settings`)

  if (preset.responsesApi) {
    const body: ResponsesPayload = { ...payload, model }
    if (settings.reasoningEffort === 'none') delete body.reasoning
    else if (body.reasoning) body.reasoning = { effort: settings.reasoningEffort }
    const response = await fetch(`${settings.baseUrl}/responses`, {
      method: 'POST',
      headers: authHeaders(settings),
      body: JSON.stringify(body),
    })
    return {
      ok: response.ok,
      status: response.status,
      json: () => response.json() as Promise<ResponsesShape>,
    }
  }

  // Chat Completions translation for everything else.
  const inputMessages: ResponsesMessage[] =
    typeof payload.input === 'string'
      ? [{ role: 'user', content: [{ type: 'input_text', text: payload.input }] }]
      : payload.input || []
  const messages = inputMessages.map(message => ({
    role: message.role || 'user',
    content: (typeof message.content === 'string'
      ? [{ type: 'input_text', text: message.content }]
      : message.content || []
    )
      .map(part => {
        if (part.type === 'input_text') return { type: 'text', text: part.text || '' }
        if (part.type === 'input_image') {
          return { type: 'image_url', image_url: { url: part.image_url || '' } }
        }
        return null
      })
      .filter((part): part is NonNullable<typeof part> => Boolean(part)),
  }))
  const format = payload.text?.format
  const structured = format?.type === 'json_schema' && format.schema
  const send = async (withSchema: boolean) => {
    const body: Record<string, unknown> = { model, messages }
    if (withSchema && structured) {
      body.response_format = {
        type: 'json_schema',
        json_schema: {
          name: format?.name || 'result',
          strict: format?.strict !== false,
          schema: format?.schema,
        },
      }
    } else if (structured) {
      body.messages = [
        {
          role: 'system',
          content: `Respond with a single JSON object that matches this JSON schema exactly, with no prose or code fences: ${JSON.stringify(format?.schema)}`,
        },
        ...messages,
      ]
    }
    if (preset.reasoning && payload.reasoning && settings.reasoningEffort !== 'none') {
      body.reasoning_effort = settings.reasoningEffort
    }
    return fetch(`${settings.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: authHeaders(settings),
      body: JSON.stringify(body),
    })
  }
  let response = await send(true)
  if (!response.ok && structured && (response.status === 400 || response.status === 422)) {
    // Provider does not support structured outputs: guide the JSON by prompt.
    response = await send(false)
  }
  if (!response.ok) {
    // Surface the provider's own message: it is what the user needs to fix.
    const detail = (await response.text().catch(() => '')).slice(0, 400)
    throw new Error(`${preset.label} rejected the request (${response.status})${detail ? `: ${detail}` : ''}`)
  }
  const body = (await response.json()) as {
    choices?: Array<{
      message?: { content?: string | Array<{ type?: string; text?: string }> }
    }>
  }
  const content = body.choices?.[0]?.message?.content
  const text =
    typeof content === 'string'
      ? content
      : (content || []).map(part => part.text || '').join('')
  return wrap(stripFences(text))
}
