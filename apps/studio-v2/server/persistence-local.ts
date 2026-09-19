import { createHash, randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ProjectDocumentV1, RecordedBlockV1 } from 'markdown-composition'
import type { BuildRunInput, BuildRunRow, BuildStageInput } from './persistence'

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
  keepsPlan,
  cameraUrl,
  cameraAssetId,
  beatMarksMs,
}: {
  projectId: string
  blockId: string
  assetId: string
  mediaUrl: string
  durationMs: number
  keepsPlan?: boolean
  cameraUrl?: string
  cameraAssetId?: string
  beatMarksMs?: number[]
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
  const entries = await readdir(assetDirectory).catch(() => [] as string[])
  const has = (id: string) => entries.some(entry => entry.startsWith(id) && !entry.endsWith('.meta.json'))
  if (!has(assetId)) throw new Error('The recording asset does not match this block')
  // The camera of a take that keeps the plan is stored beside the composite.
  const camera = keepsPlan && cameraUrl && cameraAssetId && has(cameraAssetId) ? { cameraUrl, cameraAssetId } : {}
  const kept = keepsPlan && beatMarksMs?.length ? { keepsPlan: true as const, beatMarksMs, ...camera } : {}
  const takesPath = join(notebooksDirectory(), `${projectId}.takes.json`)
  const takes =
    (await readJsonFile<
      Record<string, { recordingId: string; assetId: string; durationMs: number; recordedAt: string }>
    >(takesPath)) || {}
  const recordedAt = new Date().toISOString()
  const recordingId = randomUUID()
  takes[blockId] = { recordingId, assetId, durationMs, recordedAt, ...kept }
  await writeFileAtomic(takesPath, JSON.stringify(takes, null, 2))
  return {
    blockId,
    recordingId,
    videoUrl: mediaUrl,
    durationMs,
    recordedAt,
    storage: 'local',
    ...kept,
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

// ——— Theme library (D1) ———
// The isolated file backend keeps the same revisioned contract in its
// settings store; PostgreSQL (persistence-pg.ts) is the production store.
type LocalThemeEntry = {
  name: string
  source: string
  site: string | null
  currentRevision: number
  revisions: Array<{ revision: number; hash: string; theme: unknown }>
  updatedAt: string
}

const readThemeEntries = async (): Promise<Record<string, LocalThemeEntry>> =>
  ((await loadSetting('studio-theme-library')) as Record<string, LocalThemeEntry> | null) || {}

export const listThemeLibrary = async () => {
  const entries = await readThemeEntries()
  return Object.entries(entries)
    .map(([id, entry]) => {
      const current = entry.revisions.find(revision => revision.revision === entry.currentRevision) || entry.revisions[entry.revisions.length - 1]
      return {
        id,
        name: entry.name,
        source: entry.source,
        site: entry.site,
        revision: entry.currentRevision,
        revisions: entry.revisions.length,
        hash: current?.hash || '',
        theme: current?.theme,
        updatedAt: entry.updatedAt,
      }
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export const saveThemeRevision = async (input: {
  id: string
  name: string
  source?: string
  theme: unknown
  site?: string
}): Promise<{ id: string; revision: number; hash: string; unchanged: boolean }> => {
  const hash = createHash('sha256').update(JSON.stringify(input.theme)).digest('hex')
  const entries = await readThemeEntries()
  const entry = entries[input.id]
  if (!entry) {
    entries[input.id] = {
      name: input.name,
      source: input.source || 'custom',
      site: input.site || null,
      currentRevision: 1,
      revisions: [{ revision: 1, hash, theme: input.theme }],
      updatedAt: new Date().toISOString(),
    }
    await saveSetting('studio-theme-library', entries)
    return { id: input.id, revision: 1, hash, unchanged: false }
  }
  const current = entry.revisions.find(revision => revision.revision === entry.currentRevision)
  if (current?.hash === hash) return { id: input.id, revision: entry.currentRevision, hash, unchanged: true }
  const next = entry.currentRevision + 1
  entry.name = input.name
  entry.source = input.source || 'custom'
  // A revision that says nothing about the site keeps the association.
  entry.site = input.site === undefined ? (entry.site ?? null) : input.site || null
  entry.currentRevision = next
  entry.revisions.push({ revision: next, hash, theme: input.theme })
  entry.updatedAt = new Date().toISOString()
  await saveSetting('studio-theme-library', entries)
  return { id: input.id, revision: next, hash, unchanged: false }
}

export const deleteTheme = async (id: string) => {
  const entries = await readThemeEntries()
  const existed = Boolean(entries[id])
  delete entries[id]
  await saveSetting('studio-theme-library', entries)
  return existed
}

// ——— Immutable source revisions (D1), file-backend variant ———
// Content-addressed ids; the settings store keeps the newest 50.
export const saveSourceRevision = async (input: {
  projectId?: string
  kind: string
  url?: string
  brandUrl?: string
  title?: string
  site?: string
  content: unknown
  brandContent?: unknown
}): Promise<{ id: string; hash: string }> => {
  const hash = createHash('sha256').update(JSON.stringify([input.kind, input.url || '', input.brandUrl || '', input.content, input.brandContent || null])).digest('hex')
  const id = `src-${hash.slice(0, 16)}`
  const list = ((await loadSetting('source-revisions')) as Array<Record<string, unknown>> | null) || []
  if (!list.some(record => record.id === id)) {
    list.unshift({ id, projectId: input.projectId || null, kind: input.kind, url: input.url || null, brandUrl: input.brandUrl || null, title: input.title || '', site: input.site || '', hash, content: input.content, brandContent: input.brandContent || null, createdAt: new Date().toISOString() })
    await saveSetting('source-revisions', list.slice(0, 50))
  }
  return { id, hash }
}

export const loadSourceRevision = async (id: string) => {
  const list = ((await loadSetting('source-revisions')) as Array<Record<string, unknown>> | null) || []
  return list.find(record => record.id === id) || null
}

// ——— Story records (D2), file-backend variant ———
const appendCapped = async (key: string, record: Record<string, unknown>, cap = 50) => {
  const list = ((await loadSetting(key)) as Array<Record<string, unknown>> | null) || []
  if (!list.some(entry => entry.id === record.id)) {
    list.unshift(record)
    await saveSetting(key, list.slice(0, cap))
  }
}

export const saveNarrativeRevision = async (input: {
  projectId?: string
  sourceRevision?: string
  origin: string
  wordingPolicy: string
  audience?: string
  takeaway?: string
  text: string
}): Promise<{ id: string; hash: string }> => {
  const hash = createHash('sha256').update(JSON.stringify([input.origin, input.wordingPolicy, input.text, input.audience || '', input.takeaway || ''])).digest('hex')
  const id = `nar-${hash.slice(0, 16)}`
  await appendCapped('narrative-revisions', { id, ...input, hash, createdAt: new Date().toISOString() })
  return { id, hash }
}

export const saveExplanationModel = async (input: {
  projectId?: string
  sourceRevision?: string
  narrativeRevision?: string
  model: unknown
}): Promise<{ id: string; hash: string }> => {
  const hash = createHash('sha256').update(JSON.stringify(input.model)).digest('hex')
  const id = `model-${hash.slice(0, 16)}`
  await appendCapped('explanation-models', { id, ...input, hash, createdAt: new Date().toISOString() })
  return { id, hash }
}

// ——— Durable build runs and stage checkpoints (D3), file-backend variant ——
export const saveBuildRun = async (run: BuildRunInput) => {
  const list = ((await loadSetting('build-runs')) as Array<Record<string, unknown>> | null) || []
  const index = list.findIndex(entry => entry.id === run.id)
  const merged = { ...list[index], ...run }
  if (index >= 0) list[index] = merged
  else list.unshift(merged)
  await saveSetting('build-runs', list.slice(0, 100))
}

export const listBuildRuns = async (projectId?: string): Promise<BuildRunRow[]> => {
  const list = ((await loadSetting('build-runs')) as Array<Record<string, unknown>> | null) || []
  return list
    .filter(run => !projectId || run.projectId === projectId)
    .map(run => ({
      id: String(run.id),
      projectId: (run.projectId as string | null) ?? null,
      skill: String(run.skill || ''),
      route: String(run.route || ''),
      adapter: String(run.adapter || ''),
      projectDir: String(run.projectDir || ''),
      status: String(run.status || ''),
      inputsHash: (run.inputsHash as string | null) ?? null,
      resumeId: (run.resumeId as string | null) ?? null,
      exitCode: (run.exitCode as number | null) ?? null,
      startedAt: String(run.startedAt || ''),
      finishedAt: (run.finishedAt as string | null) ?? null,
    }))
}

export const recordBuildStage = async (stage: { runId: string; stage: string; status: string; fingerprint?: string; detail?: unknown }) => {
  const key = `build-stages:${stage.runId}`
  const list = ((await loadSetting(key)) as Array<Record<string, unknown>> | null) || []
  const index = list.findIndex(entry => entry.stage === stage.stage)
  const row = { ...stage, updatedAt: new Date().toISOString() }
  if (index >= 0) list[index] = row
  else list.push(row)
  await saveSetting(key, list)
}

export const listBuildStages = async (runId: string) =>
  ((await loadSetting(`build-stages:${runId}`)) as Array<Record<string, unknown>> | null) || []

// ——— Presenter takes and selections (D3), file-backend variant ———
export const savePresenterTake = async (take: { id: string; projectId: string; blockId: string; assetId: string; durationMs: number; detail?: unknown }) => {
  const key = `presenter-takes:${take.projectId}`
  const list = ((await loadSetting(key)) as Array<Record<string, unknown>> | null) || []
  if (!list.some(entry => entry.id === take.id)) {
    list.push({ ...take, createdAt: new Date().toISOString() })
    await saveSetting(key, list)
  }
}

export const listPresenterTakes = async (projectId: string, blockId?: string) => {
  const list = ((await loadSetting(`presenter-takes:${projectId}`)) as Array<Record<string, unknown>> | null) || []
  return blockId ? list.filter(take => take.blockId === blockId) : list
}

export const selectPresenterTake = async (input: { projectId: string; blockId: string; takeId: string }) => {
  const takes = ((await loadSetting(`presenter-takes:${input.projectId}`)) as Array<Record<string, unknown>> | null) || []
  if (!takes.some(take => take.id === input.takeId && take.blockId === input.blockId)) {
    throw new Error('That take does not belong to this block')
  }
  const selections = ((await loadSetting(`take-selections:${input.projectId}`)) as Record<string, string> | null) || {}
  selections[input.blockId] = input.takeId
  await saveSetting(`take-selections:${input.projectId}`, selections)
}

export const listTakeSelections = async (projectId: string) => {
  const selections = ((await loadSetting(`take-selections:${projectId}`)) as Record<string, string> | null) || {}
  return Object.entries(selections).map(([blockId, takeId]) => ({ projectId, blockId, takeId, selectedAt: '' }))
}

// Removing the presenter clears the active take and its selection; the take
// itself stays in the archive (presenter-takes setting).
export const clearPresenterTake = async (input: { projectId: string; blockId: string }) => {
  const selections = ((await loadSetting(`take-selections:${input.projectId}`)) as Record<string, string> | null) || {}
  delete selections[input.blockId]
  await saveSetting(`take-selections:${input.projectId}`, selections)
  const takesPath = join(notebooksDirectory(), `${input.projectId}.takes.json`)
  const takes = (await readJsonFile<Record<string, unknown>>(takesPath)) || {}
  delete takes[input.blockId]
  await writeFileAtomic(takesPath, JSON.stringify(takes, null, 2))
}

export const findNotebooksReferencing = async (marker: string): Promise<Array<{ id: string; title: string }>> => {
  await initializePersistence()
  if (!marker) return []
  const names = await readdir(notebooksDirectory()).catch(() => [] as string[])
  const hits: Array<{ id: string; title: string }> = []
  for (const name of names.filter(entry => entry.endsWith('.json') && !entry.endsWith('.takes.json'))) {
    const text = await readFile(join(notebooksDirectory(), name), 'utf8').catch(() => '')
    if (!text.includes(marker)) continue
    const doc = await readJsonFile<ProjectDocumentV1>(join(notebooksDirectory(), name))
    if (doc?.id) hits.push({ id: doc.id, title: doc.title })
  }
  return hits
}

export const settingsWithPrefix = async (prefix: string): Promise<Record<string, unknown>> => {
  const settings = (await readJsonFile<Record<string, unknown>>(settingsPath())) || {}
  return Object.fromEntries(Object.entries(settings).filter(([key]) => key.startsWith(prefix)))
}
