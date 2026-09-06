// End-to-end product test against a running studio origin — the desktop app
// (started manually or via scripts/test.mjs) or `yarn studio:start`.
// Usage: node scripts/product-test.mjs [baseUrl]
const base = process.argv[2] || 'http://127.0.0.1:4319'
const results = []
const step = async (name, fn) => { try { const v = await fn(); results.push([name, 'PASS', v]); } catch (e) { results.push([name, 'FAIL', String(e.message || e).slice(0, 160)]) } }
const j = async (p, init) => { const r = await fetch(base + p, init); const t = await r.text(); let b; try { b = JSON.parse(t) } catch { b = t } if (!r.ok) throw new Error(p + ' → ' + r.status + ' ' + (typeof b === 'string' ? b.slice(0, 120) : JSON.stringify(b).slice(0, 120))); return b }
;(async () => {
  const id = 'e2e-' + Date.now()
  await step('health', async () => { const h = await j('/api/health'); if (!h.renderer) throw new Error('renderer false'); return h.persistence })
  await step('front end served (bundle reachable)', async () => { const html = await (await fetch(base + '/')).text(); const m = html.match(/src="(\/static\/[^"]+\.js)"/); if (!m) throw new Error('no bundle in index'); const r = await fetch(base + m[1]); if (!r.ok || !/javascript/.test(r.headers.get('content-type') || '')) throw new Error(m[1] + ' → ' + r.status); return m[1] })
  await step('create notebook (PUT)', async () => { const project = { version: 1, id, title: 'E2E notebook', notebook: { type: 'doc', content: [{ type: 'heading', attrs: { id: 'blk-h1', level: 1 }, content: [{ type: 'text', text: 'Transformers' }] }, { type: 'paragraph', attrs: { id: 'blk-p1' }, content: [{ type: 'text', text: 'Attention lets every position see every other.' }] }] }, fps: 30, width: 1920, height: 1080, blocks: { 'blk-p1': { speakerNotes: 'Attention lets every position look at every other one in a single step.' } }, presenterTracks: {}, recordedBlocks: {}, brand: {}, theme: {} }; return j('/api/projects/' + id, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(project) }) })
  await step('read it back', async () => { const b = await j('/api/projects/' + id); if (!b.project || b.project.title !== 'E2E notebook') throw new Error('mismatch'); return b.project.notebook.content.length + ' blocks' })
  await step('listed', async () => { const l = await j('/api/projects'); const arr = Array.isArray(l) ? l : l.projects; if (!arr.some(p => p.id === id)) throw new Error('not in list'); return arr.length + ' notebooks' })
  await step('plan slide steps from narration', async () => { const body = { title: 'Encoder', narration: 'Tokens come in as input embeddings. Each position looks at every other through multi-head attention. The result is added back and normalised.', units: [{ id: 'u1', kind: 'box', label: 'Input embedding', x: 170, y: 250, w: 140, h: 40, group: 'enc' }, { id: 'u2', kind: 'box', label: 'Multi-head attention', x: 170, y: 190, w: 140, h: 40, group: 'enc' }, { id: 'u3', kind: 'box', label: 'Add & norm', x: 170, y: 130, w: 140, h: 40, group: 'enc' }, { id: 'u5', kind: 'connector', label: 'arrow 1', x: 240, y: 230, w: 0, h: 20 }, { id: 'u6', kind: 'connector', label: 'arrow 2', x: 240, y: 170, w: 0, h: 20 }], steps: [] }; const r = await j('/api/slides/plan', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); const steps = r.steps || r.plan || []; if (!steps.length) throw new Error('no steps: ' + JSON.stringify(r).slice(0, 120)); return steps.length + ' steps · first hero ' + JSON.stringify(steps[0].reveals || steps[0].targets || steps[0]).slice(0, 60) })
  await step('delete notebook', async () => { await j('/api/projects/' + id, { method: 'DELETE' }); const b = await j('/api/projects/' + id); if (b.project) throw new Error('still present'); return 'gone' })
  for (const [n, s, v] of results) console.log(`${s.padEnd(4)}  ${n}  ${typeof v === 'string' ? v : JSON.stringify(v)}`)
  const fails = results.filter(r => r[1] === 'FAIL').length
  console.log(`\n${results.length - fails}/${results.length} passed`)
  process.exit(fails ? 1 : 0)
})()
