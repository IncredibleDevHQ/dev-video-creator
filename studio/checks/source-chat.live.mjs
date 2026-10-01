// Explicit paid check, using only a retained isolated diagnostic's public source.
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import assert from 'node:assert/strict'
const diagnostic = process.argv[2]
if (!diagnostic || !process.argv.includes('--live'))
  throw new Error(
    'Pass an isolated diagnostic folder and --live to authorize one bounded source-chat run'
  )
const report = JSON.parse(
  await readFile(join(diagnostic, 'diagnostic-report.json'), 'utf8')
)
assert.equal(report.storage, 'isolated-local-diagnostic-not-S3-proof')
const original = JSON.parse(
  await readFile(
    join(diagnostic, 'projects', `${report.projectId}.json`),
    'utf8'
  )
)
assert.deepEqual(original.project.harness, {
  adapter: 'claude-code',
  model: 'claude-opus-5-5'
})
assert.equal(
  original.project.sourceUrl,
  'https://openai.com/index/introducing-canvas/'
)
const source = JSON.parse(
  await readFile(
    join(diagnostic, 'sources', `${report.projectId}.json`),
    'utf8'
  )
)
const root = await mkdtemp(join(tmpdir(), 'studio-source-chat-live-'))
process.env.MINIMAL_STUDIO_DATA_DIR = root
process.env.MINIMAL_STUDIO_PERSISTENCE = 'local'
delete process.env.MINIMAL_STUDIO_DATABASE_URL
delete process.env.VITEST
process.env.OPENAI_API_KEY = ''
process.env.FISH_AUDIO_API_KEY = ''
const { writeRow, listNotebookRows, readRow } =
  await import('../engine/persistence.ts')
const { createStudioServer } = await import('../engine/server.ts')
const { chatNotebook } = await import('../engine/notebook-chat.ts')
const { stopEngineRuns } = await import('../engine/harness/runtime.ts')
const id = 'canvas-source-chat'
await writeRow('projects', id, {
  status: 'ready',
  error: null,
  events: [],
  project: {
    id,
    title: original.project.title,
    source: source.text,
    sourceUrl: original.project.sourceUrl,
    harness: original.project.harness,
    slides: [],
    video: null
  }
})
await writeRow('sources', id, source)
const server = createStudioServer().listen(0, '127.0.0.1')
await once(server, 'listening')
process.env.MINIMAL_STUDIO_HARNESS_ORIGIN = `http://127.0.0.1:${server.address().port}`
console.log(`One bounded Claude source-chat run in ${root}`)
try {
  const question =
    'In this article, when does canvas use targeted edits rather than rewriting, and what does the article leave uncertain about that behavior? Answer in three concise sentences, supported by exact passages. Do not change any slides.'
  const result = await chatNotebook(id, {
    anchor: { stage: 'notebook' },
    instruction: question
  })
  const replies = await listNotebookRows('source-chat-replies', id)
  assert.equal(replies.length, 1)
  const answer = await readRow('source-chat-replies', replies[0])
  assert.ok(answer.reply.length > 40)
  assert.ok(answer.evidence.length > 0)
  assert.equal(result.project.slides.length, 0)
  assert.equal(result.project.video, null)
  const runIds = await listNotebookRows('engine-runs', id)
  assert.equal(runIds.length, 1)
  const run = await readRow('engine-runs', runIds[0])
  assert.equal(run.status, 'done')
  await writeFile(
    join(root, 'source-chat-proof.json'),
    JSON.stringify(
      {
        projectId: id,
        question,
        answer,
        runId: run.id,
        status: run.status,
        adapter: run.adapter,
        model: run.model,
        sourceUrl: original.project.sourceUrl
      },
      null,
      2
    )
  )
  console.log(
    `Accepted source-grounded reply from ${run.adapter} ${run.model}: ${answer.reply}`
  )
  console.log(`Evidence retained in ${root}/source-chat-proof.json`)
} finally {
  await stopEngineRuns()
  await new Promise((resolve) => {
    server.close(resolve)
    server.closeAllConnections()
  })
}
