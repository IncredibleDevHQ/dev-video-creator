// MCP verification driver: starts the app (--smoke --keep-running), speaks
// JSON-RPC over stdio to dist-electron/mcp-stdio.mjs, and exercises all
// seven tools against a synthetic page: initialize → tools/list → atomize →
// measure → plan_beats (real model gateway) → resolve → validate → receipt →
// frames. Prints `MCP CHECK PASS` or `MCP CHECK FAIL: <reason>`.
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const appDir = fileURLToPath(new URL('..', import.meta.url))
const require = createRequire(import.meta.url)
const electronBinary = require('electron')

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720">
  <rect id="bg" x="0" y="0" width="1280" height="720" fill="#0f1411"/>
  <g id="encoder">
    <rect id="u-input" x="170" y="430" width="280" height="70" rx="8" fill="#1b211e" stroke="#4ade80"/>
    <text id="u-input-label" x="310" y="472" fill="#f4f4f5" font-size="26" text-anchor="middle">Input embedding</text>
    <rect id="u-attn" x="170" y="260" width="280" height="70" rx="8" fill="#1b211e" stroke="#4ade80"/>
    <text id="u-attn-label" x="310" y="302" fill="#f4f4f5" font-size="26" text-anchor="middle">Multi-head attention</text>
    <rect id="u-norm" x="170" y="90" width="280" height="70" rx="8" fill="#1b211e" stroke="#4ade80"/>
    <text id="u-norm-label" x="310" y="132" fill="#f4f4f5" font-size="26" text-anchor="middle">Add &amp; norm</text>
    <line id="u-arrow-1" x1="310" y1="430" x2="310" y2="330" stroke="#4ade80" stroke-width="3" marker-end="url(#arrowhead)"/>
    <line id="u-arrow-2" x1="310" y1="260" x2="310" y2="160" stroke="#4ade80" stroke-width="3" marker-end="url(#arrowhead)"/>
  </g>
</svg>`

const NARRATION =
  'Tokens come in as input embeddings. Each position looks at every other through multi-head attention. The result is added back and normalised.'

const results = []
const step = async (name, fn) => {
  try {
    const value = await fn()
    results.push([name, 'PASS', value])
  } catch (error) {
    results.push([name, 'FAIL', String(error && error.message ? error.message : error).slice(0, 200)])
  }
}

// ——— app lifecycle (same pattern as scripts/test.mjs) ———
const app = spawn(electronBinary, ['.', '--smoke', '--keep-running'], {
  cwd: appDir,
  stdio: ['ignore', 'pipe', 'inherit'],
})
const killApp = async () => {
  if (app.exitCode !== null) return
  app.kill('SIGTERM')
  await new Promise(resolve => app.once('exit', resolve))
}
const origin = await new Promise((resolve, reject) => {
  let buffer = ''
  const timeout = setTimeout(() => reject(new Error('timed out waiting for SMOKE PASS')), 90_000)
  app.stdout.on('data', chunk => {
    process.stdout.write(chunk)
    buffer += chunk.toString()
    const failure = buffer.match(/SMOKE FAIL: ([^\n]+)/)
    if (failure) {
      clearTimeout(timeout)
      reject(new Error(`SMOKE FAIL: ${failure[1]}`))
    }
    const match = buffer.match(/STUDIO_ORIGIN (\S+)/)
    if (buffer.includes('SMOKE PASS') && match) {
      clearTimeout(timeout)
      resolve(match[1])
    }
  })
  app.once('exit', code => reject(new Error(`app exited early (${code})`)))
}).catch(async error => {
  await killApp()
  throw error
})

// ——— JSON-RPC stdio client ———
const shim = spawn(process.execPath, [fileURLToPath(new URL('../dist-electron/mcp-stdio.mjs', import.meta.url))], {
  env: { ...process.env, STUDIO_MCP_URL: `${origin}/mcp` },
  stdio: ['pipe', 'pipe', 'inherit'],
})
const pending = new Map()
let nextId = 1
let shimBuffer = ''
shim.stdout.on('data', chunk => {
  shimBuffer += chunk.toString()
  let newline
  while ((newline = shimBuffer.indexOf('\n')) >= 0) {
    const line = shimBuffer.slice(0, newline)
    shimBuffer = shimBuffer.slice(newline + 1)
    if (!line.trim()) continue
    let message
    try {
      message = JSON.parse(line)
    } catch {
      continue
    }
    const waiter = pending.get(message.id)
    if (waiter) {
      pending.delete(message.id)
      waiter(message)
    }
  }
})
const rpc = (method, params) =>
  new Promise((resolve, reject) => {
    const id = nextId++
    pending.set(id, resolve)
    setTimeout(() => {
      if (pending.delete(id)) reject(new Error(`${method} timed out`))
    }, 120_000)
    shim.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n')
  })
const callTool = async (name, args) => {
  const response = await rpc('tools/call', { name, arguments: args })
  if (response.error) throw new Error(`${name}: ${response.error.message}`)
  const result = response.result
  const text = result?.content?.[0]?.text || ''
  if (result?.isError) throw new Error(`${name}: ${text.slice(0, 160)}`)
  try {
    return JSON.parse(text)
  } catch {
    return { raw: text }
  }
}

const workDir = await mkdtemp(join(tmpdir(), 'studio-mcp-'))
try {
  let geometryPath = join(workDir, 'motion', 'geometry.json')
  await step('initialize handshake', async () => {
    const response = await rpc('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'mcp-check', version: '0' },
    })
    if (response.error) throw new Error(response.error.message)
    if (!response.result?.capabilities?.tools) throw new Error('no tools capability')
    shim.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n')
    return response.result.serverInfo
  })
  await step('tools/list shows 7 tools with schemas', async () => {
    const response = await rpc('tools/list', {})
    const tools = response.result?.tools || []
    const names = tools.map(tool => tool.name).sort()
    const expected = ['atomize', 'frames', 'measure', 'plan_beats', 'receipt', 'resolve', 'validate']
    if (JSON.stringify(names) !== JSON.stringify(expected)) throw new Error(`tools: ${names}`)
    for (const tool of tools) {
      if (!tool.inputSchema || tool.inputSchema.type !== 'object') throw new Error(`${tool.name} has no object schema`)
    }
    return names.join(', ')
  })
  await step('atomize (hidden window)', async () => {
    const svgPath = join(workDir, 'page.svg')
    await writeFile(svgPath, SVG)
    const summary = await callTool('atomize', { svgPath, projectDir: workDir })
    geometryPath = summary.file
    if (summary.units < 5) throw new Error(`only ${summary.units} units`)
    return `${summary.units} units, ${summary.edges} edges, ${summary.readingMode}`
  })
  await step('measure (fonts.ready)', async () => {
    const summary = await callTool('measure', { geometryPath, projectDir: workDir })
    if (!summary.fontsReady) throw new Error('fonts not ready')
    return `${summary.units} units measured`
  })
  await step('plan_beats (real gateway)', async () => {
    const summary = await callTool('plan_beats', {
      narration: NARRATION,
      geometry: geometryPath,
      contract: { title: 'Encoder' },
      projectDir: workDir,
    })
    if (!summary.steps) throw new Error('no steps')
    return `${summary.steps} steps via ${summary.provider}`
  })
  let resolvedPath
  await step('resolve (deterministic rules)', async () => {
    const summary = await callTool('resolve', {
      brief: join(workDir, 'motion', 'brief.blocks.json'),
      geometry: geometryPath,
      projectDir: workDir,
    })
    resolvedPath = summary.file
    if (!summary.actions) throw new Error('no actions resolved')
    return `${summary.steps} steps, ${summary.actions} actions`
  })
  await step('validate → {errors, warnings, gateSignal}', async () => {
    const summary = await callTool('validate', {
      resolved: resolvedPath,
      geometry: geometryPath,
      stage: 'final',
      projectDir: workDir,
    })
    if (!Array.isArray(summary.errors) || !Array.isArray(summary.warnings)) {
      throw new Error('report shape wrong')
    }
    if (!('gateSignal' in summary)) throw new Error('no gateSignal key')
    return `${summary.errors.length} errors, ${summary.warnings.length} warnings, gateSignal ${JSON.stringify(summary.gateSignal)}`
  })
  await step('validate flags L10 error classes', async () => {
    const summary = await callTool('validate', {
      resolved: {
        steps: [
          {
            id: 'st-bad',
            title: 'Bad step',
            hero: [],
            supporting: [],
            actions: [
              { id: 'b1', op: 'emphasize', targets: ['u-nope', 'u-nada'], startMs: 0, durationMs: 320, ease: 'pop', persistence: 'state', implicit: false },
              { id: 'b2', op: 'dim', targets: ['bg'], startMs: 0, durationMs: 300, ease: 'exit', persistence: 'state', implicit: false },
            ],
            motionWindowMs: 620,
            holdMs: 600,
          },
        ],
      },
      geometry: geometryPath,
      stage: 'early',
      projectDir: workDir,
    })
    const classes = summary.errors.map(error => error.class).sort()
    for (const expected of ['dim-on-chrome', 'duty-on-unentered', 'missing-target']) {
      if (!classes.includes(expected)) throw new Error(`missing class ${expected} (got ${classes})`)
    }
    if (summary.gateSignal?.category !== 'missing-target') {
      throw new Error(`gateSignal should be missing-target ×2 (got ${JSON.stringify(summary.gateSignal)})`)
    }
    return `${summary.errors.length} errors: ${classes.join(', ')}`
  })
  await step('receipt', async () => {
    const summary = await callTool('receipt', {
      brief: join(workDir, 'motion', 'brief.blocks.json'),
      resolved: resolvedPath,
      projectDir: workDir,
    })
    return `${summary.beats} beats, ${summary.absences.length} absences`
  })
  await step('frames (hidden-window capture)', async () => {
    const summary = await callTool('frames', {
      resolved: resolvedPath,
      geometry: geometryPath,
      at: [[0, 0], [0, 5000]],
      projectDir: workDir,
    })
    if (summary.frames !== 2) throw new Error(`${summary.frames} frames`)
    const first = await readFile(summary.files[0])
    if (first.length < 1000 || first.slice(1, 4).toString() !== 'PNG') throw new Error('not a PNG')
    return summary.files.map(file => file.split('/').pop()).join(', ')
  })
} finally {
  shim.kill()
  await killApp()
  const failures = results.filter(result => result[1] === 'FAIL')
  for (const [name, status, value] of results) {
    console.log(`${status}  ${name}  ${typeof value === 'string' ? value : JSON.stringify(value)}`)
  }
  console.log(failures.length ? `MCP CHECK FAIL: ${failures.length} step(s) failed` : 'MCP CHECK PASS')
  await rm(workDir, { recursive: true, force: true })
  process.exit(failures.length ? 1 : 0)
}
