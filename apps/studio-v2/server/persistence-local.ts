import { createHash, randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ProjectDocumentV1, RecordedBlockV1 } from 'markdown-composition'

const dataDirectory = () =>
  process.env.STUDIO_DATA_DIR ||
  fileURLToPath(new URL('../../../.studio-data/', import.meta.url))
const notebooksDirectory = () => join(dataDirectory(), 'notebooks')
const objectsDirectory = () => join(dataDirectory(), 'objects')
const indexPath = () => join(dataDirectory(), 'index.json')
const settingsPath = () => join(dataDirectory(), 'settings.json')

let ready: Promise<void> | null = null

export const initializePersistence = () => {
  ready ||= (async () => {
    await mkdir(notebooksDirectory(), { recursive: true })
    await mkdir(objectsDirectory(), { recursive: true })
  })().catch(error => {
    ready = null
    throw error
  })
  return ready
}

// Writes go to a sibling tmp file first, then rename over the target, so a
// crash mid-write never leaves a truncated JSON document behind.
const writeFileAtomic = async (path: string, contents: string | Buffer) => {
  const temporary = `${path}.${randomUUID()}.tmp`
  await writeFile(temporary, contents)
  await rename(temporary, path)
}

const readJsonFile = async <T>(path: string): Promise<T | null> => {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T
  } catch {
    return null
  }
}

type ProjectIndexRow = {
  id: string
  title: string
  blockCount: number
  createdAt: string
  updatedAt: string
  derivedFrom?: { notebook: string; kind?: string }
}

type ProjectIndex = { projects: Record<string, ProjectIndexRow> }

const readIndex = async (): Promise<ProjectIndex> =>
  (await readJsonFile<ProjectIndex>(indexPath())) || { projects: {} }

const writeIndex = async (index: ProjectIndex) =>
  writeFileAtomic(indexPath(), JSON.stringify(index, null, 2))

export const saveProjectArtifact = async (project: ProjectDocumentV1) => {
  await initializePersistence()
  const blockCount = project.notebook.content.filter(
    node => typeof node.attrs?.id === 'string' && node.attrs.id,
  ).length
  const index = await readIndex()
  const existing = index.projects[project.id]
  const now = new Date().toISOString()
  index.projects[project.id] = {
    id: project.id,
    title: project.title,
    blockCount,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    ...(project.derivedFrom ? { derivedFrom: project.derivedFrom } : {}),
  }
  await writeFileAtomic(
    join(notebooksDirectory(), `${project.id}.json`),
    JSON.stringify(project),
  )
  await writeIndex(index)
}

export const loadProjectArtifact = async (projectId: string) => {
  await initializePersistence()
  return readJsonFile<ProjectDocumentV1>(
    join(notebooksDirectory(), `${projectId}.json`),
  )
}

export type ProjectArtifactSummary = {
  id: string
  title: string
  blockCount: number
  createdAt: string
  updatedAt: string
  derivedFrom?: { notebook: string; kind?: string }
}

// Every saved notebook, newest first — the switcher's list.
export const listProjectArtifacts = async (): Promise<ProjectArtifactSummary[]> => {
  await initializePersistence()
  const index = await readIndex()
  return Object.values(index.projects).sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  )
}

// Removing a notebook drops its document, takes and index row; the objects
// stay in the store (cheap, and recoverable).
export const deleteProjectArtifact = async (projectId: string) => {
  await initializePersistence()
  const index = await readIndex()
  const existed = Boolean(index.projects[projectId])
  delete index.projects[projectId]
  await rm(join(notebooksDirectory(), `${projectId}.json`), { force: true })
  await rm(join(notebooksDirectory(), `${projectId}.takes.json`), { force: true })
  await writeIndex(index)
  return existed
}

// Small key/value settings store (model provider choices and the like).
export const loadSetting = async (key: string): Promise<unknown> => {
  await initializePersistence()
  const settings = await readJsonFile<Record<string, unknown>>(settingsPath())
  return settings?.[key] ?? null
}

export const saveSetting = async (key: string, value: unknown) => {
  await initializePersistence()
  const settings = (await readJsonFile<Record<string, unknown>>(settingsPath())) || {}
  settings[key] = value
  await writeFileAtomic(settingsPath(), JSON.stringify(settings, null, 2))
}

export const loadLatestProjectArtifact = async () => {
  await initializePersistence()
  const [latest] = await listProjectArtifacts()
  if (!latest) return null
  return loadProjectArtifact(latest.id)
}

const safePart = (value: string) =>
  value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'unknown'

type ObjectSidecar = {
  assetId: string
  contentType: string
  byteSize: number
  kind: string
  projectId?: string
  blockId?: string
}

const objectPath = (objectKey: string) => join(objectsDirectory(), objectKey)
const sidecarPath = (objectKey: string) => `${objectPath(objectKey)}.meta.json`

export const storeAsset = async ({
  body,
  contentType,
  projectId,
  blockId,
  kind,
  extension,
}: {
  body: Buffer
  contentType: string
  projectId?: string
  blockId?: string
  kind: string
  extension: string
}) => {
  await initializePersistence()
  const assetId = randomUUID()
  const objectKey = [
    'projects',
    safePart(projectId || 'unattached'),
    safePart(blockId || kind),
    `${assetId}${extension}`,
  ].join('/')
  await mkdir(dirname(objectPath(objectKey)), { recursive: true })
  await writeFileAtomic(objectPath(objectKey), body)
  const sidecar: ObjectSidecar = {
    assetId,
    contentType,
    byteSize: body.length,
    kind,
    ...(projectId ? { projectId } : {}),
    ...(blockId ? { blockId } : {}),
  }
  await writeFileAtomic(sidecarPath(objectKey), JSON.stringify(sidecar, null, 2))
  return { assetId, objectKey }
}

export const saveRecordedBlock = async ({
  projectId,
  blockId,
  assetId,
  mediaUrl,
  durationMs,
}: {
  projectId: string
  blockId: string
  assetId: string
  mediaUrl: string
  durationMs: number
}): Promise<RecordedBlockV1> => {
  await initializePersistence()
  // The asset must have been stored against this exact project and block —
  // its object lives under projects/<pid>/<bid>/<assetId><ext>.
  const assetDirectory = join(
    objectsDirectory(),
    'projects',
    safePart(projectId),
    safePart(blockId),
  )
  const assetExists = await readdir(assetDirectory)
    .then(entries =>
      entries.some(entry => entry.startsWith(assetId) && !entry.endsWith('.meta.json')),
    )
    .catch(() => false)
  if (!assetExists) throw new Error('The recording asset does not match this block')
  const takesPath = join(notebooksDirectory(), `${projectId}.takes.json`)
  const takes =
    (await readJsonFile<
      Record<string, { recordingId: string; assetId: string; durationMs: number; recordedAt: string }>
    >(takesPath)) || {}
  const recordedAt = new Date().toISOString()
  const recordingId = randomUUID()
  takes[blockId] = { recordingId, assetId, durationMs, recordedAt }
  await writeFileAtomic(takesPath, JSON.stringify(takes, null, 2))
  return {
    blockId,
    recordingId,
    videoUrl: mediaUrl,
    durationMs,
    recordedAt,
    storage: 'local',
  }
}

// Shaped like MinIO's statObject — server/index.ts reads metadata.size and
// metadata.metaData['content-type'].
const localObjectMetadata = async (objectKey: string) => {
  const file = await stat(objectPath(objectKey))
  if (!file.isFile()) throw new Error(`Object not found: ${objectKey}`)
  const sidecar = await readJsonFile<ObjectSidecar>(sidecarPath(objectKey))
  return {
    size: file.size,
    metaData: {
      'content-type': sidecar?.contentType || 'application/octet-stream',
    },
    etag: createHash('sha1')
      .update(`${objectKey}:${file.size}:${file.mtimeMs}`)
      .digest('hex')
      .slice(0, 32),
    lastModified: file.mtime,
  }
}

export const getObject = async (
  objectKey: string,
  range?: { offset: number; length: number },
) => {
  await initializePersistence()
  const metadata = await localObjectMetadata(objectKey)
  return {
    metadata,
    stream: createReadStream(
      objectPath(objectKey),
      range ? { start: range.offset, end: range.offset + range.length - 1 } : undefined,
    ),
  }
}

export const getObjectMetadata = async (objectKey: string) => {
  await initializePersistence()
  return localObjectMetadata(objectKey)
}

export const persistenceHealth = async () => {
  await initializePersistence()
  return { database: 'files', objectStorage: 'files', bucket: dataDirectory() }
}
