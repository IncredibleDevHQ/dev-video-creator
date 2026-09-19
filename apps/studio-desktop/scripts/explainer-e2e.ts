// Paid provider integration test: real product RunManager → local Kimi K3 →
// Quiver → production preview → locally aligned narration → product export.
// This file provides only a base wireframe and facts, never the finished scene.
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defaultBrand } from '../../../packages/markdown-composition/src/index'

const root = await mkdtemp(join(tmpdir(), 'incredible-explainer-product-'))
const projectDir = join(root, 'run')
const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720"><g data-role="background"><rect width="1280" height="720" fill="#101827"/></g><g id="bucket" data-role="node" data-kind="box"><rect x="420" y="240" width="380" height="200" rx="12" fill="#343C65"/><text x="470" y="310" font-size="30" fill="white">Token bucket</text><text x="470" y="355" font-size="24" fill="white">3 tokens, then refill</text></g></svg>'
const base = {
  version: 1, id: `test-base-${Date.now()}`, title: 'Why a burst passes and the next request fails', fps: 30, width: 1920, height: 1080,
  brand: { ...defaultBrand, background: '#101827', accent: '#A5B4FC' }, blocks: {}, presenterTracks: {}, captions: { burnIn: true },
  notebook: { type: 'doc', content: [{ type: 'scene', attrs: { id: 'base-bucket', title: 'Capacity restores access', svg, script: '',
    directorNotes: 'Explain the causal mechanism in roughly 30–40 seconds with a clearly illustrative three-token example.',
    sourcePassages: ['A token bucket stores a bounded number of tokens. Each admitted request consumes one token. When no tokens remain, the next request is rejected. Tokens replenish over time, allowing later requests to pass. Use an explicitly illustrative bucket with capacity three; the source makes no claim that three is a production setting.'] } }] },
}
const config = join(root, 'e2e.json')
await writeFile(config, JSON.stringify({ adapter: 'kimi', skill: 'explainer-master', route: 'Build Explainer', projectDir,
  seedProject: base, inputs: { video: { title: base.title }, brand: base.brand, model: 'kimi-code/k3', effort: 'high', autonomous: true }, expectResume: false, timeoutMs: 1_800_000 }))
console.log(`EXPLAINER_TEST_ROOT ${root}`)
const require = createRequire(import.meta.url)
const appDir = fileURLToPath(new URL('..', import.meta.url))
const child = spawn(require('electron'), ['.'], { cwd: appDir,
  env: { ...process.env, STUDIO_ALLOW_MULTI_INSTANCE: '1', STUDIO_HARNESS_E2E: config, STUDIO_DATA_DIR: join(root, 'data'), STUDIO_OUTPUTS_DIR: join(root, 'outputs') },
  stdio: 'inherit' })
process.on('SIGTERM', () => child.kill('SIGTERM'))
process.on('SIGINT', () => child.kill('SIGINT'))
process.exitCode = await new Promise<number>(resolve => child.once('exit', code => resolve(code ?? 1)))
