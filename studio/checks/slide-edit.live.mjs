// Explicit bounded paid run against an isolated retained public Canvas notebook.
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import assert from 'node:assert/strict'
const diagnostic = process.argv[2]
if (!diagnostic || !process.argv.includes('--live'))
  throw new Error(
    'Pass an isolated diagnostic folder and --live for one bounded slide revision'
  )
const report = JSON.parse(
  await readFile(join(diagnostic, 'diagnostic-report.json'), 'utf8')
)
assert.equal(report.storage, 'isolated-local-diagnostic-not-S3-proof')
const saved = JSON.parse(
  await readFile(
    join(diagnostic, 'projects', `${report.projectId}.json`),
    'utf8'
  )
)
assert.deepEqual(saved.project.harness, {
  adapter: 'claude-code',
  model: 'claude-opus-5-5'
})
assert.equal(
  saved.project.sourceUrl,
  'https://openai.com/index/introducing-canvas/'
)
const outline = JSON.parse(
  await readFile(
    join(diagnostic, 'outlines', `${report.projectId}.json`),
    'utf8'
  )
)
const style = JSON.parse(
  await readFile(
    join(diagnostic, 'creative-deck-style', `${report.projectId}.json`),
    'utf8'
  )
)
const root = await mkdtemp(join(tmpdir(), 'studio-slide-edit-live-'))
process.env.MINIMAL_STUDIO_DATA_DIR = root
process.env.MINIMAL_STUDIO_PERSISTENCE = 'local'
delete process.env.MINIMAL_STUDIO_DATABASE_URL
delete process.env.VITEST
process.env.OPENAI_API_KEY = ''
process.env.FISH_AUDIO_API_KEY = ''
const { writeRow, listNotebookRows, readRow } =
  await import('../engine/persistence.ts')
const { createStudioServer } = await import('../engine/server.ts')
const { chatSlide, settledChanges } = await import('../engine/slide-changes.ts')
const { loadProject } = await import('../engine/projects.ts')
const { stopEngineRuns } = await import('../engine/harness/runtime.ts')
const id = 'canvas-slide-edit',
  project = { ...saved.project, id, video: null }
await writeRow('projects', id, {
  status: 'ready',
  error: null,
  events: [],
  project
})
await writeRow('outlines', id, outline)
await writeRow('creative-deck-style', id, { ...style, projectId: id })
const server = createStudioServer().listen(0, '127.0.0.1')
await once(server, 'listening')
process.env.MINIMAL_STUDIO_HARNESS_ORIGIN = `http://127.0.0.1:${server.address().port}`
console.log(`One bounded Claude slide-edit run in ${root}`)
try {
  const instruction =
    'Rename this slide to “Where chat reaches its limits”. Keep the visual comparison of chat and canvas, but simplify the supporting text. Preserve the deck typography and palette. Ground every claim in the article; do not change other slides.'
  await chatSlide(id, {
    anchor: { stage: 'presentation', slideId: project.slides[1].id },
    instruction
  })
  // Changes run in the background; wait for this one to finish.
  await settledChanges(id)
  const result = await loadProject(id)
  assert.deepEqual(result.changes || [], [])
  assert.equal(result.project.slides.length, project.slides.length)
  for (let i = 0; i < project.slides.length; i++)
    if (i !== 1) assert.deepEqual(result.project.slides[i], project.slides[i])
  const slide = result.project.slides[1]
  assert.equal(slide.id, project.slides[1].id)
  assert.notEqual(slide.svg, project.slides[1].svg)
  assert.ok(slide.evidence?.length)
  assert.equal(result.project.video, null)
  const ids = await listNotebookRows('engine-runs', id)
  const runs = await Promise.all(
    ids.map((runId) => readRow('engine-runs', runId))
  )
  assert.equal(runs.length, 2)
  assert.ok(runs.every((run) => run.status === 'done'))
  await writeFile(join(root, 'revised-slide.svg'), slide.svg)
  await writeFile(
    join(root, 'slide-edit-proof.json'),
    JSON.stringify(
      {
        projectId: id,
        instruction,
        slide,
        runs: runs.map((run) => ({
          id: run.id,
          status: run.status,
          adapter: run.adapter,
          model: run.model
        })),
        unchangedOtherSlides: true
      },
      null,
      2
    )
  )
  console.log(`Accepted slide: ${slide.title}; retained SVG/proof in ${root}`)
} finally {
  await stopEngineRuns()
  await new Promise((resolve) => {
    server.close(resolve)
    server.closeAllConnections()
  })
}
