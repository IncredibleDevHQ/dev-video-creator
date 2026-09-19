// Backend switch: STUDIO_PERSISTENCE=local selects the plain-file store,
// anything else keeps the Postgres + MinIO stack. Neither backend is
// imported statically, so the local path never loads pg or minio.
import type { Readable } from 'node:stream'
import type { ProjectDocumentV1, RecordedBlockV1 } from 'markdown-composition'
import type { ProjectArtifactSummary } from './persistence-local'

export type { ProjectArtifactSummary }

// Shaped like MinIO's statObject — server/index.ts reads metadata.size and
// metadata.metaData['content-type'].
export type StoredObjectMetadata = {
  size: number
  metaData: Record<string, string>
  etag: string
  lastModified: Date
}

// A harness run persisted before its side effects begin (D3).
export type BuildRunInput = {
  id: string
  projectId?: string | null
  skill: string
  route: string
  adapter: string
  projectDir: string
  status: string
  inputsHash?: string
  resumeId?: string
  exitCode?: number | null
  startedAt?: string
  finishedAt?: string | null
}

export type BuildRunRow = {
  id: string
  projectId: string | null
  skill: string
  route: string
  adapter: string
  projectDir: string
  status: string
  inputsHash: string | null
  resumeId: string | null
  exitCode: number | null
  startedAt: string
  finishedAt: string | null
}

export type BuildStageInput = {
  runId: string
  stage: string
  status: string
  fingerprint?: string
  detail?: unknown
}

export type PresenterTakeInput = {
  id: string
  projectId: string
  blockId: string
  assetId: string
  durationMs: number
  detail?: unknown
}

type StoreAssetInput = {
  body: Buffer
  contentType: string
  projectId?: string
  blockId?: string
  kind: string
  extension: string
}

type SaveRecordedBlockInput = {
  projectId: string
  blockId: string
  assetId: string
  mediaUrl: string
  durationMs: number
}

type PersistenceBackend = {
  initializePersistence: () => Promise<void>
  saveProjectArtifact: (project: ProjectDocumentV1) => Promise<void>
  loadProjectArtifact: (projectId: string) => Promise<ProjectDocumentV1 | null>
  listProjectArtifacts: () => Promise<ProjectArtifactSummary[]>
  deleteProjectArtifact: (projectId: string) => Promise<boolean>
  loadSetting: (key: string) => Promise<unknown>
  saveSetting: (key: string, value: unknown) => Promise<void>
  loadLatestProjectArtifact: () => Promise<ProjectDocumentV1 | null>
  storeAsset: (asset: StoreAssetInput) => Promise<{ assetId: string; objectKey: string }>
  saveRecordedBlock: (recording: SaveRecordedBlockInput) => Promise<RecordedBlockV1>
  getObject: (
    objectKey: string,
    range?: { offset: number; length: number },
  ) => Promise<{ metadata: StoredObjectMetadata; stream: Readable }>
  getObjectMetadata: (objectKey: string) => Promise<StoredObjectMetadata>
  listThemeLibrary: () => Promise<ThemeLibraryRecord[]>
  saveThemeRevision: (input: {
    id: string
    name: string
    source?: string
    theme: unknown
    site?: string
  }) => Promise<{ id: string; revision: number; hash: string; unchanged: boolean }>
  deleteTheme: (id: string) => Promise<boolean>
  saveSourceRevision: (input: {
    projectId?: string
    kind: string
    url?: string
    brandUrl?: string
    title?: string
    site?: string
    content: unknown
    brandContent?: unknown
  }) => Promise<{ id: string; hash: string }>
  loadSourceRevision: (id: string) => Promise<unknown>
  saveNarrativeRevision: (input: {
    projectId?: string
    sourceRevision?: string
    origin: 'authored' | 'article' | 'notes'
    wordingPolicy: string
    audience?: string
    takeaway?: string
    text: string
  }) => Promise<{ id: string; hash: string }>
  saveExplanationModel: (input: {
    projectId?: string
    sourceRevision?: string
    narrativeRevision?: string
    model: unknown
  }) => Promise<{ id: string; hash: string }>
  saveBuildRun: (run: BuildRunInput) => Promise<void>
  listBuildRuns: (projectId?: string) => Promise<BuildRunRow[]>
  recordBuildStage: (stage: BuildStageInput) => Promise<void>
  listBuildStages: (runId: string) => Promise<Array<Record<string, unknown>>>
  savePresenterTake: (take: PresenterTakeInput) => Promise<void>
  listPresenterTakes: (projectId: string, blockId?: string) => Promise<Array<Record<string, unknown>>>
  selectPresenterTake: (input: { projectId: string; blockId: string; takeId: string }) => Promise<void>
  clearPresenterTake: (input: { projectId: string; blockId: string }) => Promise<void>
  listTakeSelections: (projectId: string) => Promise<Array<{ projectId: string; blockId: string; takeId: string; selectedAt: string }>>
  findNotebooksReferencing: (marker: string) => Promise<Array<{ id: string; title: string }>>
  settingsWithPrefix: (prefix: string) => Promise<Record<string, unknown>>
  persistenceHealth: () => Promise<{
    database: string
    objectStorage: string
    bucket: string
  }>
}

export type ThemeLibraryRecord = {
  id: string
  name: string
  source: string
  site: string | null
  revision: number
  revisions: number
  hash: string
  theme: unknown
  updatedAt: string
}

let backend: Promise<PersistenceBackend> | null = null

const loadBackend = () => {
  backend ||=
    process.env.STUDIO_PERSISTENCE === 'local'
      ? import('./persistence-local')
      : import('./persistence-pg')
  return backend
}

export const initializePersistence = async () =>
  (await loadBackend()).initializePersistence()

export const saveProjectArtifact = async (project: ProjectDocumentV1) =>
  (await loadBackend()).saveProjectArtifact(project)

export const loadProjectArtifact = async (projectId: string) =>
  (await loadBackend()).loadProjectArtifact(projectId)

export const listProjectArtifacts = async () =>
  (await loadBackend()).listProjectArtifacts()

export const deleteProjectArtifact = async (projectId: string) =>
  (await loadBackend()).deleteProjectArtifact(projectId)

export const loadSetting = async (key: string): Promise<unknown> =>
  (await loadBackend()).loadSetting(key)

export const saveSetting = async (key: string, value: unknown) =>
  (await loadBackend()).saveSetting(key, value)

export const loadLatestProjectArtifact = async () =>
  (await loadBackend()).loadLatestProjectArtifact()

export const storeAsset = async (asset: StoreAssetInput) =>
  (await loadBackend()).storeAsset(asset)

export const saveRecordedBlock = async (
  recording: SaveRecordedBlockInput,
): Promise<RecordedBlockV1> => {
  const backend = await loadBackend()
  const saved = await backend.saveRecordedBlock(recording)
  // The take archive (D3) on every backend: this commit is one preserved
  // take, and committing selects it. The active row stays the fast path.
  await backend.savePresenterTake({
    id: saved.recordingId,
    projectId: recording.projectId,
    blockId: recording.blockId,
    assetId: recording.assetId,
    durationMs: saved.durationMs,
    detail: { mediaUrl: recording.mediaUrl },
  })
  await backend.selectPresenterTake({ projectId: recording.projectId, blockId: recording.blockId, takeId: saved.recordingId })
  return saved
}

export const clearPresenterTake = async (input: { projectId: string; blockId: string }) =>
  (await loadBackend()).clearPresenterTake(input)

export const getObject = async (
  objectKey: string,
  range?: { offset: number; length: number },
) => (await loadBackend()).getObject(objectKey, range)

export const getObjectMetadata = async (objectKey: string) =>
  (await loadBackend()).getObjectMetadata(objectKey)

export const persistenceHealth = async () =>
  (await loadBackend()).persistenceHealth()

export const listThemeLibrary = async () => (await loadBackend()).listThemeLibrary()

export const saveThemeRevision = async (input: {
  id: string
  name: string
  source?: string
  theme: unknown
  site?: string
}) => (await loadBackend()).saveThemeRevision(input)

export const deleteTheme = async (id: string) => (await loadBackend()).deleteTheme(id)

export const saveSourceRevision = async (input: {
  projectId?: string
  kind: string
  url?: string
  brandUrl?: string
  title?: string
  site?: string
  content: unknown
  brandContent?: unknown
}) => (await loadBackend()).saveSourceRevision(input)

export const loadSourceRevision = async (id: string) => (await loadBackend()).loadSourceRevision(id)

export const saveNarrativeRevision = async (input: {
  projectId?: string
  sourceRevision?: string
  origin: 'authored' | 'article' | 'notes'
  wordingPolicy: string
  audience?: string
  takeaway?: string
  text: string
}) => (await loadBackend()).saveNarrativeRevision(input)

export const saveExplanationModel = async (input: {
  projectId?: string
  sourceRevision?: string
  narrativeRevision?: string
  model: unknown
}) => (await loadBackend()).saveExplanationModel(input)

export const saveBuildRun = async (run: BuildRunInput) =>
  (await loadBackend()).saveBuildRun(run)

export const listBuildRuns = async (projectId?: string) =>
  (await loadBackend()).listBuildRuns(projectId)

export const recordBuildStage = async (stage: BuildStageInput) =>
  (await loadBackend()).recordBuildStage(stage)

export const listBuildStages = async (runId: string) =>
  (await loadBackend()).listBuildStages(runId)

export const savePresenterTake = async (take: PresenterTakeInput) =>
  (await loadBackend()).savePresenterTake(take)

export const listPresenterTakes = async (projectId: string, blockId?: string) =>
  (await loadBackend()).listPresenterTakes(projectId, blockId)

export const selectPresenterTake = async (input: { projectId: string; blockId: string; takeId: string }) =>
  (await loadBackend()).selectPresenterTake(input)

export const listTakeSelections = async (projectId: string) =>
  (await loadBackend()).listTakeSelections(projectId)

export const findNotebooksReferencing = async (marker: string) =>
  (await loadBackend()).findNotebooksReferencing(marker)

export const settingsWithPrefix = async (prefix: string) =>
  (await loadBackend()).settingsWithPrefix(prefix)
