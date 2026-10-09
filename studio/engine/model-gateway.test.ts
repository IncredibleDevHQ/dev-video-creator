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
    // A provider's refusal reaches the creator in its own words.
    await expect(
      gateway.modelFetch('coding', { body: JSON.stringify({ input: 'hi' }) })
    ).rejects.toThrow(
      'rejected the request (404): {"error":{"message":"The model does not exist"}}'
    )
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

it('says a provider’s refusal in its own words, with any key it echoes hidden', async () => {
  await gateway.saveModelSettings({
    provider: 'openai',
    models: { writing: 'gpt-5.6-sol' }
  })
  vi.stubGlobal(
    'fetch',
    async () =>
      new Response(
        `{"error":{"message":"Incorrect API key provided: sk-envi****9f3a. Sent ${ENV_KEY} as Bearer ${ENV_KEY}"}}`,
        { status: 401 }
      )
  )
  const refusal = await gateway
    .modelFetch('writing', { body: JSON.stringify({ input: 'hi' }) })
    .catch((error: Error) => error)
  expect(refusal).toBeInstanceOf(Error)
  expect((refusal as Error).message).toContain(
    'rejected the request (401): {"error":{"message":"Incorrect API key provided: [key]. Sent [key] as Bearer [key]"}}'
  )
  expect((refusal as Error).message).not.toMatch(/sk-env|9f3a/)
})

it('leaves a provider’s words alone where they hold no key', () => {
  // A local server's placeholder key is not a secret: its letters stay.
  expect(
    gateway.withoutKeys('The model "x-large" does not exist', 'x', 400)
  ).toBe('The model "x-large" does not exist')
  expect(gateway.withoutKeys('Invalid bearer token', '', 400)).toBe(
    'Invalid bearer token'
  )
  expect(
    gateway.withoutKeys('Sent Bearer abcdefghijklmnop1234.', '', 400)
  ).toBe('Sent Bearer [key].')
  // Nor a longer placeholder, words after "Bearer", or a word that starts
  // like a key.
  expect(
    gateway.withoutKeys(
      'Load a model in lm-studio first. Bearer authentication-scheme. SK_NOT_FOUND, rk_limit, sk-SK',
      'lm-studio',
      400
    )
  ).toBe(
    'Load a model in lm-studio first. Bearer authentication-scheme. SK_NOT_FOUND, rk_limit, sk-SK'
  )
  // A short key that is a secret goes, whole or by its prefix.
  expect(
    gateway.withoutKeys(
      'Received API Key = sk-1234; try admin123',
      'admin123',
      400
    )
  ).toBe('Received API Key = [key]; try [key]')
  // A huge answer is searched no further than can be shown.
  const started = Date.now()
  gateway.withoutKeys('sk-'.repeat(40_000), '', 400)
  expect(Date.now() - started).toBeLessThan(200)
  // A long key that starts before the cut is hidden whole.
  const long = `k${'9'.repeat(899)}`
  expect(gateway.withoutKeys(`${'a'.repeat(300)}${long}`, long, 400)).toBe(
    `${'a'.repeat(300)}[key]`
  )
  // A key is hidden before the text is cut, so none of it shows.
  const key = 'LONGSECRETKEY1234567'
  const cut = gateway.withoutKeys(`${'a'.repeat(395)}${key}`, key, 400)
  expect(cut).toBe(`${'a'.repeat(395)}[key]`)
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
