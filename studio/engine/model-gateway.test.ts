import { mkdtempSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

// The direct API as the AI settings show it (F7 of the Perplexity review):
// an environment key is used without being saved, and each task's last
// request is kept for the settings to show.
process.env.STUDIO_PERSISTENCE = 'local'
const dataDir = mkdtempSync(join(tmpdir(), 'model-gateway-'))
process.env.MINIMAL_STUDIO_DATA_DIR = dataDir

const persistence = await import('./persistence')
const gateway = await import('./model-gateway')
const ENV_KEY = 'sk-environment-test-9f3a'

// Every file under the store, read back, to prove what was written.
const storeText = (dir: string): string =>
  readdirSync(dir)
    .map((name) => join(dir, name))
    .map((path) =>
      statSync(path).isDirectory()
        ? storeText(path)
        : readFileSync(path, 'utf8')
    )
    .join('\n')

beforeAll(async () => {
  await persistence.initializePersistence()
  gateway.configureModelGateway({ envKey: ENV_KEY })
})
afterEach(() => vi.unstubAllGlobals())

describe('the direct API with a key from the environment', () => {
  it('saves the models a creator picks, and never the environment key', async () => {
    const before = await gateway.publicModelSettings()
    expect(before.source).toBe('environment')
    expect(before.hasKey).toBe(true)

    await gateway.saveModelSettings({
      provider: 'openai',
      models: {
        writing: 'gpt-5.6-sol',
        vision: 'gpt-5.6-astra',
        coding: 'gpt-5.6-sol'
      }
    })
    const after = await gateway.publicModelSettings()
    expect(after.source).toBe('environment')
    expect(after.hasKey).toBe(true)
    expect(after.models).toEqual({
      writing: 'gpt-5.6-sol',
      vision: 'gpt-5.6-astra',
      coding: 'gpt-5.6-sol'
    })
    expect(storeText(dataDir)).not.toContain(ENV_KEY)

    // The request goes out with the environment's key and the picked model.
    const seen: Array<{ url: string; model: string; authorization: string }> =
      []
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      seen.push({
        url,
        model: JSON.parse(String(init.body)).model,
        authorization: String(
          (init.headers as Record<string, string>).authorization
        )
      })
      return new Response(
        JSON.stringify({ model: 'gpt-5.6-astra-2026-09-01', output: [] }),
        { status: 200 }
      )
    })
    const reply = await gateway.modelFetch('vision', {
      body: JSON.stringify({ model: 'ignored', input: 'hi' })
    })
    await reply.json()
    expect(seen).toEqual([
      {
        url: 'https://api.openai.com/v1/responses',
        model: 'gpt-5.6-astra',
        authorization: `Bearer ${ENV_KEY}`
      }
    ])
  })

  it('keeps a key the creator saves, in place of the environment one', async () => {
    await gateway.saveModelSettings({ apiKey: 'sk-creator-key-7c21' })
    const saved = await gateway.publicModelSettings()
    expect(saved.source).toBe('saved')
    expect(saved.keyHint).toBe('…7c21')
    // Saving models again keeps the creator's key.
    await gateway.saveModelSettings({
      models: {
        writing: 'gpt-5.6-sol',
        vision: 'gpt-5.6-astra',
        coding: 'gpt-5.6-sol'
      }
    })
    expect((await gateway.publicModelSettings()).keyHint).toBe('…7c21')
  })
})

describe('what each task last did', () => {
  it('keeps each task’s last request, with the model the provider reported', async () => {
    vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
      const model = JSON.parse(String(init.body)).model
      return model === 'gpt-5.6-sol'
        ? new Response(
            JSON.stringify({ model: 'gpt-5.6-sol-2026-09-01', output: [] }),
            { status: 200 }
          )
        : new Response('{"error":{"message":"The model does not exist"}}', {
            status: 404
          })
    })
    await gateway.saveModelSettings({
      models: {
        writing: 'gpt-5.6-sol',
        vision: 'gpt-5.6-astra',
        coding: 'gpt-5.6-nowhere'
      }
    })
    await (
      await gateway.modelFetch('writing', {
        body: JSON.stringify({ input: 'hi' })
      })
    ).json()
    const coding = await gateway.modelFetch('coding', {
      body: JSON.stringify({ input: 'hi' })
    })
    expect(coding.ok).toBe(false)
    const { results } = await gateway.publicModelSettings()
    expect(results.writing).toMatchObject({
      ok: true,
      status: 200,
      model: 'gpt-5.6-sol',
      reportedModel: 'gpt-5.6-sol-2026-09-01'
    })
    expect(results.coding).toMatchObject({
      ok: false,
      status: 404,
      model: 'gpt-5.6-nowhere'
    })
  })
})

it('does not forward a saved key to a different provider', async () => {
  await gateway.saveModelSettings({
    provider: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: 'test-original-secret'
  })
  await gateway.saveModelSettings({
    provider: 'custom',
    baseUrl: 'https://other-provider.example/v1',
    models: { writing: 'example-model' }
  })
  expect((await gateway.publicModelSettings()).hasKey).toBe(false)
})

describe('voice provider transport', () => {
  it('authenticates synthesis, catalogue and clone uploads without changing their bodies', async () => {
    await persistence.saveSetting('fish-key', 'test-private-voice-key')
    const seen: Array<{ url: string; init: RequestInit }> = []
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      seen.push({ url, init })
      return new Response('fixture audio', { status: 200 })
    })
    const speech = JSON.stringify({
      text: 'Test',
      reference_id: 'voice',
      format: 'mp3'
    })
    await gateway.voiceProviderRequest('/v1/tts', {
      method: 'POST',
      headers: { 'content-type': 'application/json', model: 'fixture' },
      body: speech
    })
    await gateway.voiceProviderRequest('/model?licensed=true')
    const clone = new FormData()
    clone.set('visibility', 'private')
    await gateway.voiceProviderRequest('/model', {
      method: 'POST',
      body: clone
    })
    expect(seen.map((call) => call.url)).toEqual([
      'https://api.fish.audio/v1/tts',
      'https://api.fish.audio/model?licensed=true',
      'https://api.fish.audio/model'
    ])
    for (const { init } of seen) {
      expect(new Headers(init.headers).get('authorization')).toBe(
        'Bearer test-private-voice-key'
      )
      expect(init.signal).toBeInstanceOf(AbortSignal)
    }
    expect(seen[0].init.body).toBe(speech)
    expect(new Headers(seen[0].init.headers).get('model')).toBe('fixture')
    expect(seen[2].init.body).toBe(clone)
    expect(new Headers(seen[2].init.headers).has('content-type')).toBe(false)
  })
  it('allows an already deleted clone only for idempotent deletion', async () => {
    vi.stubGlobal('fetch', async () => new Response('', { status: 404 }))
    await expect(
      gateway.voiceProviderRequest('/model/removed', { method: 'DELETE' }, true)
    ).resolves.toMatchObject({ status: 404 })
    await expect(
      gateway.voiceProviderRequest('/model/removed')
    ).rejects.toThrow('404')
  })
  it('rejects other endpoints before a credential can be sent', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    await expect(
      gateway.voiceProviderRequest('//another-host.example')
    ).rejects.toThrow('Unknown voice operation')
    expect(fetch).not.toHaveBeenCalled()
  })
})
