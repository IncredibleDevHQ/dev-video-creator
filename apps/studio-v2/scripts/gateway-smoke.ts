// Smoke test for the model gateway's Chat Completions translation using the
// abstract handler's real payload shape.
// Usage (from apps/studio-v2): npx tsx scripts/gateway-smoke.ts
import { configureModelGateway, modelFetch, saveModelSettings, loadModelSettings } from '../server/model-gateway'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const envKey =
  process.env.OPENAI_API_KEY ||
  (await readFile(resolve(process.cwd(), '../../agents/.env'), 'utf8')
    .then(text => text.split(/\r?\n/).find(l => l.startsWith('OPENAI_API_KEY='))?.split('=').slice(1).join('=').trim().replace(/^['"]|['"]$/g, '') || '')
    .catch(() => ''))
configureModelGateway({ envKey })
const before = (await loadModelSettings()).settings
try {
  await saveModelSettings({ provider: 'custom', baseUrl: 'https://api.openai.com/v1', models: { writing: 'gpt-5.6-luna', vision: 'gpt-5.6-luna', coding: 'gpt-5.6-luna' }, reasoningEffort: 'low' })
  const result = await modelFetch('writing', {
    method: 'POST',
    body: JSON.stringify({
      model: 'ignored',
      input: 'Explain softmax in one sentence.',
      reasoning: { effort: 'medium' },
      text: { format: { type: 'json_schema', name: 'answer', strict: true, schema: { type: 'object', additionalProperties: false, required: ['definition'], properties: { definition: { type: 'string' } } } } },
    }),
  })
  console.log('string-input ok', result.ok, result.status, JSON.stringify(await result.json()).slice(0, 160))
} catch (error) {
  console.log('ERROR', error instanceof Error ? error.message : error)
} finally {
  if (before) await saveModelSettings({ provider: before.provider, baseUrl: before.baseUrl, models: before.models, reasoningEffort: before.reasoningEffort })
  process.exit(0)
}
