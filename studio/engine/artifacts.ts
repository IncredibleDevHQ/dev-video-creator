import { createHash } from 'node:crypto'
import {
  readAsset,
  readRow,
  writeRow,
  storeAsset,
  validObjectKey
} from './persistence'
import type { SketchFiles } from '../render/types'
export type ArtifactRef = {
  id: string
  objectKey: string
  contentType: string
  name: string
}
export type StageCheckpoint<T> = {
  projectId: string
  sceneId?: string
  stage: string
  inputKey: string
  data: T
  artifacts: ArtifactRef[]
  completedAt: string
}
const checkpointId = (
  projectId: string,
  sceneId: string | undefined,
  stage: string,
  inputKey: string
) =>
  createHash('sha256')
    .update(JSON.stringify([projectId, sceneId, stage, inputKey]))
    .digest('hex')
export const saveStageCheckpoint = async <T>(
  projectId: string,
  sceneId: string | undefined,
  stage: string,
  inputKey: string,
  data: T,
  artifacts: ArtifactRef[] = []
) => {
  const checkpoint: StageCheckpoint<T> = {
    projectId,
    sceneId,
    stage,
    inputKey,
    data,
    artifacts,
    completedAt: new Date().toISOString()
  }
  await writeRow(
    'stage-checkpoints',
    checkpointId(projectId, sceneId, stage, inputKey),
    checkpoint
  )
  return checkpoint
}
export const loadStageCheckpoint = async <T>(
  projectId: string,
  sceneId: string | undefined,
  stage: string,
  inputKey: string
) => {
  const saved = await readRow<StageCheckpoint<T>>(
    'stage-checkpoints',
    checkpointId(projectId, sceneId, stage, inputKey)
  )
  if (
    !saved ||
    saved.projectId !== projectId ||
    saved.sceneId !== sceneId ||
    saved.stage !== stage ||
    saved.inputKey !== inputKey
  )
    return null
  return saved
}
export const archiveFiles = async (
  projectId: string,
  sceneId: string | undefined,
  stage: string,
  files: SketchFiles
): Promise<ArtifactRef[]> => {
  const result: ArtifactRef[] = []
  for (const [name, file] of Object.entries(files)) {
    if (!validObjectKey(name)) throw new Error('Invalid artifact file')
    const extension = name.match(/\.[a-z0-9]+$/i)?.[0] || '.bin'
    const body =
      typeof file === 'string'
        ? Buffer.from(file)
        : Buffer.from(file.base64, 'base64')
    const contentType =
      typeof file === 'string'
        ? extension === '.html'
          ? 'text/html'
          : extension === '.svg'
            ? 'image/svg+xml'
            : extension === '.json'
              ? 'application/json'
              : extension === '.css'
                ? 'text/css'
                : extension === '.js'
                  ? 'text/javascript'
                  : 'text/plain'
        : file.contentType
    const asset = await storeAsset({
      body,
      contentType,
      projectId,
      sceneId,
      kind: `stage-${stage}`,
      extension
    })
    result.push({ id: asset.id, objectKey: asset.objectKey, contentType, name })
  }
  return result
}
export const restoreFiles = async (
  refs: ArtifactRef[]
): Promise<SketchFiles> => {
  const files: SketchFiles = {}
  for (const ref of refs) {
    if (!validObjectKey(ref.name) || files[ref.name] !== undefined)
      throw new Error('Invalid artifact manifest')
    const body = await readAsset(ref.objectKey)
    files[ref.name] = /^(text\/|application\/json|image\/svg\+xml)/.test(
      ref.contentType
    )
      ? body.toString()
      : { base64: body.toString('base64'), contentType: ref.contentType }
  }
  return files
}

export const notebookArtifacts = async (projectId: string) => {
  const { listNotebookRows } = await import('./persistence')
  const artifacts = []
  for (const id of await listNotebookRows('assets', projectId)) {
    const asset = await readRow<{
      id?: string
      projectId?: string
      sceneId?: string
      momentId?: string
      kind: string
      objectKey: string
      contentType: string
      s3Uri?: string
      sha256?: string
    }>('assets', id)
    if (asset?.projectId === projectId)
      artifacts.push({
        id,
        sceneId: asset.sceneId,
        momentId: asset.momentId,
        kind: asset.kind,
        objectKey: asset.objectKey,
        s3Uri: asset.s3Uri,
        contentType: asset.contentType,
        sha256: asset.sha256
      })
  }
  const stages = []
  for (const id of await listNotebookRows('stage-checkpoints', projectId)) {
    const checkpoint = await readRow<StageCheckpoint<unknown>>(
      'stage-checkpoints',
      id
    )
    if (checkpoint?.projectId === projectId)
      stages.push({
        id,
        sceneId: checkpoint.sceneId,
        stage: checkpoint.stage,
        inputKey: checkpoint.inputKey,
        artifacts: checkpoint.artifacts,
        completedAt: checkpoint.completedAt
      })
  }
  return { notebookId: projectId, artifacts, stages }
}
