import assert from 'node:assert/strict'
if (
  process.env.MINIMAL_STORAGE_FIXTURE !== 'disposable' ||
  !process.env.MINIMAL_STUDIO_S3_BUCKET?.startsWith('minimal-fixture-')
)
  throw new Error('Disposable stores required')
const { initializePersistence, closePersistence, readRow, readAsset } =
  await import('../engine/persistence')
const { loadProject } = await import('../engine/projects')
const { notebookArtifacts } = await import('../engine/artifacts')
await initializePersistence()
try {
  const saved = await readRow<{ projectId: string }>('test-cases', 'kimi-blog')
  assert(saved)
  const notebook = await loadProject(saved.projectId)
  assert(notebook?.project.slides.length === 10)
  assert(notebook.project.harness?.adapter === 'kimi')
  assert(notebook.project.video?.scenes.length === 10)
  const manifest = await notebookArtifacts(saved.projectId)
  assert(manifest.artifacts.length > 20)
  for (const artifact of manifest.artifacts) {
    assert(
      artifact.s3Uri?.startsWith(
        `s3://${process.env.MINIMAL_STUDIO_S3_BUCKET}/notebooks/${saved.projectId}/`
      )
    )
    await readAsset(artifact.objectKey)
  }
  console.log(
    `Fresh-store restore verified: 10 slides, 10 scenes, ${manifest.artifacts.length} readable notebook assets and ${manifest.stages.length} stage checkpoints. No model was run.`
  )
} finally {
  await closePersistence()
}
