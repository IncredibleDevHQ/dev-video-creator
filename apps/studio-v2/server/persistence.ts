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
  persistenceHealth: () => Promise<{
    database: string
    objectStorage: string
    bucket: string
  }>
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
): Promise<RecordedBlockV1> => (await loadBackend()).saveRecordedBlock(recording)

export const getObject = async (
  objectKey: string,
  range?: { offset: number; length: number },
) => (await loadBackend()).getObject(objectKey, range)

export const getObjectMetadata = async (objectKey: string) =>
  (await loadBackend()).getObjectMetadata(objectKey)

export const persistenceHealth = async () =>
  (await loadBackend()).persistenceHealth()
