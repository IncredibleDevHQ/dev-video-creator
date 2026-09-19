import { createHash, randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readdir, readFile, stat } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client as MinioClient } from 'minio'
import { Pool } from 'pg'
import type { ProjectDocumentV1, RecordedBlockV1, TiptapNode } from 'markdown-composition'
import { runMigrations } from './migrations'

const databaseUrl =
  process.env.STUDIO_DATABASE_URL ||
  'postgres://incredible:incredible@127.0.0.1:54329/incredible_studio'
const bucket = process.env.STUDIO_MINIO_BUCKET || 'incredible-studio'
const minioEndpoint = process.env.STUDIO_MINIO_ENDPOINT || '127.0.0.1'
const minioPort = Number(process.env.STUDIO_MINIO_PORT || 59000)
const minioUseSSL = process.env.STUDIO_MINIO_USE_SSL === 'true'

const database = new Pool({ connectionString: databaseUrl, max: 5 })
const objects = new MinioClient({
  endPoint: minioEndpoint,
  port: minioPort,
  useSSL: minioUseSSL,
  accessKey: process.env.STUDIO_MINIO_ACCESS_KEY || 'incredible',
  secretKey: process.env.STUDIO_MINIO_SECRET_KEY || 'SuperSecretRootPwd',
})

let ready: Promise<void> | null = null

// Rows left 'pending' by an interrupted upload are reconciled before the
// store serves traffic: bytes that landed whole become ready; anything else
// is dropped so a missing/corrupt object never poses as accepted.
const reconcilePendingAssets = async () => {
  const pending = await database.query<{ id: string; object_key: string; byte_size: string | number }>(
    `select id, object_key, byte_size from studio_assets where status = 'pending'`,
  )
  for (const row of pending.rows) {
    const stat = await objects.statObject(bucket, row.object_key).catch(() => null)
    if (stat && stat.size === Number(row.byte_size)) {
      await database.query(`update studio_assets set status = 'ready' where id = $1`, [row.id])
    } else {
      await database.query(`delete from studio_assets where id = $1`, [row.id])
    }
  }
}

export const initializePersistence = () => {
  ready ||= (async () => {
    await runMigrations(database)
    if (!(await objects.bucketExists(bucket))) await objects.makeBucket(bucket)
    await reconcilePendingAssets()
  })().catch(error => {
    ready = null
    throw error
  })
  return ready
}

const blockKind = (node: TiptapNode) =>
  node.type === 'heading'
    ? 'title'
    : node.type === 'codeBlock'
      ? 'code'
      : node.type === 'bulletList' || node.type === 'orderedList'
        ? 'list'
        : node.type === 'blockquote'
          ? 'quote'
          : node.type === 'image'
            ? 'image'
            : node.type === 'screenRecording'
              ? 'screen'
              : 'content'

export const saveProjectArtifact = async (project: ProjectDocumentV1) => {
  await initializePersistence()
  const client = await database.connect()
  try {
    await client.query('begin')
    await client.query(
      `insert into studio_notebooks (id, title, artifact)
       values ($1, $2, $3::jsonb)
       on conflict (id) do update set title = excluded.title,
       artifact = excluded.artifact, updated_at = now()`,
      [project.id, project.title, JSON.stringify(project)],
    )
    await client.query('delete from studio_blocks where notebook_id = $1', [project.id])
    for (const [position, node] of project.notebook.content.entries()) {
      const blockId = typeof node.attrs?.id === 'string' ? node.attrs.id : ''
      if (!blockId) continue
      await client.query(
        `insert into studio_blocks
          (notebook_id, block_id, position, kind, configuration)
         values ($1, $2, $3, $4, $5::jsonb)`,
        [
          project.id,
          blockId,
          position,
          blockKind(node),
          JSON.stringify(project.blocks[blockId] || {}),
        ],
      )
    }
    await client.query('commit')
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
  }
}

export const loadProjectArtifact = async (projectId: string) => {
  await initializePersistence()
  const result = await database.query<{ artifact: ProjectDocumentV1 }>(
    'select artifact from studio_notebooks where id = $1',
    [projectId],
  )
  return result.rows[0]?.artifact || null
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
  const result = await database.query<{
    id: string
    title: string
    block_count: string | number
    created_at: string | Date
    updated_at: string | Date
    derived_from: { notebook: string; kind?: string } | null
  }>(
    // derivedFrom rides inside the artifact JSONB — no schema change needed.
    `select n.id, n.title,
       (select count(*) from studio_blocks b where b.notebook_id = n.id) as block_count,
       n.created_at, n.updated_at, n.artifact->'derivedFrom' as derived_from
     from studio_notebooks n
     order by n.updated_at desc`,
  )
  return result.rows.map(row => ({
    id: row.id,
    title: row.title,
    blockCount: Number(row.block_count) || 0,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    ...(row.derived_from ? { derivedFrom: row.derived_from } : {}),
  }))
}

// Removing a notebook cascades to its blocks, assets and recorded takes in
// the database; the objects stay in the bucket (cheap, and recoverable).
export const deleteProjectArtifact = async (projectId: string) => {
  await initializePersistence()
  const result = await database.query(
    'delete from studio_notebooks where id = $1',
    [projectId],
  )
  return (result.rowCount || 0) > 0
}

// Small key/value settings store (model provider choices and the like).
export const loadSetting = async (key: string): Promise<unknown> => {
  await initializePersistence()
  const result = await database.query<{ value: unknown }>(
    'select value from studio_settings where key = $1',
    [key],
  )
  return result.rows[0]?.value ?? null
}

export const saveSetting = async (key: string, value: unknown) => {
  await initializePersistence()
  await database.query(
    `insert into studio_settings (key, value)
     values ($1, $2::jsonb)
     on conflict (key) do update set value = excluded.value, updated_at = now()`,
    [key, JSON.stringify(value)],
  )
}

export const loadLatestProjectArtifact = async () => {
  await initializePersistence()
  const result = await database.query<{ artifact: ProjectDocumentV1 }>(
    'select artifact from studio_notebooks order by updated_at desc limit 1',
  )
  return result.rows[0]?.artifact || null
}

const safePart = (value: string) =>
  value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'unknown'

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
  const sha256 = createHash('sha256').update(body).digest('hex')
  // 1. Reserve the row as pending — global library assets (no owning
  //    notebook) are first-class rows, never silently skipped.
  await database.query(
    `insert into studio_assets
      (id, notebook_id, block_id, object_key, content_type, byte_size, kind, status, sha256)
     values ($1, $2, $3, $4, $5, $6, $7, 'pending', $8)`,
    [assetId, projectId || null, blockId || null, objectKey, contentType, body.length, kind, sha256],
  )
  // 2. Upload, then verify the stored byte count before the row goes ready.
  //    (The store's ETag is not a universal content checksum.)
  await objects.putObject(bucket, objectKey, body, body.length, {
    'Content-Type': contentType,
  })
  const stored = await objects.statObject(bucket, objectKey)
  if (stored.size !== body.length) {
    throw new Error(`Stored ${stored.size} of ${body.length} bytes for ${objectKey}`)
  }
  await database.query(`update studio_assets set status = 'ready' where id = $1`, [assetId])
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
  const asset = await database.query<{ object_key: string }>(
    `select object_key from studio_assets
     where id = $1 and notebook_id = $2 and block_id = $3 and status = 'ready'`,
    [assetId, projectId, blockId],
  )
  if (!asset.rows[0]) throw new Error('The recording asset does not match this block')
  const recordingId = randomUUID()
  const result = await database.query<{ id: string; updated_at: Date }>(
    `insert into studio_recorded_blocks
      (id, notebook_id, block_id, asset_id, duration_ms)
     values ($1, $2, $3, $4, $5)
     on conflict (notebook_id, block_id) do update set
       id = excluded.id, asset_id = excluded.asset_id,
       duration_ms = excluded.duration_ms, updated_at = now()
     returning id, updated_at`,
    [recordingId, projectId, blockId, assetId, durationMs],
  )
  const saved = result.rows[0]
  if (!saved) throw new Error('The recorded block could not be saved')
  return {
    blockId,
    recordingId: saved.id,
    videoUrl: mediaUrl,
    durationMs,
    recordedAt: saved.updated_at.toISOString(),
    storage: 'minio',
  }
}

export const getObject = async (
  objectKey: string,
  range?: { offset: number; length: number },
) => {
  await initializePersistence()
  const metadata = await objects.statObject(bucket, objectKey)
  return {
    metadata,
    stream: range
      ? await objects.getPartialObject(bucket, objectKey, range.offset, range.length)
      : await objects.getObject(bucket, objectKey),
  }
}

export const getObjectMetadata = async (objectKey: string) => {
  await initializePersistence()
  return objects.statObject(bucket, objectKey)
}

export const persistenceHealth = async () => {
  await initializePersistence()
  await database.query('select 1')
  return { database: 'postgres', objectStorage: 'minio', bucket }
}

// ——— Durable theme library (D1) ———
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

export const listThemeLibrary = async (): Promise<ThemeLibraryRecord[]> => {
  await initializePersistence()
  const result = await database.query(
    `select t.id, t.name, t.source, t.site, t.current_revision, r.hash, r.theme, t.updated_at,
       (select count(*)::int from studio_theme_revisions where theme_id = t.id) as revisions
     from studio_themes t
     join studio_theme_revisions r on r.theme_id = t.id and r.revision = t.current_revision
     order by t.updated_at desc`,
  )
  return result.rows.map(row => ({
    id: row.id,
    name: row.name,
    source: row.source,
    site: row.site,
    revision: row.current_revision,
    revisions: row.revisions,
    hash: row.hash,
    theme: row.theme,
    updatedAt: new Date(row.updated_at).toISOString(),
  }))
}

// Idempotent by content: re-saving the same theme changes nothing; saving
// changed content under the same id creates the next revision.
export const saveThemeRevision = async (input: {
  id: string
  name: string
  source?: string
  theme: unknown
  site?: string
}): Promise<{ id: string; revision: number; hash: string; unchanged: boolean }> => {
  await initializePersistence()
  const hash = createHash('sha256').update(JSON.stringify(input.theme)).digest('hex')
  const client = await database.connect()
  try {
    await client.query('begin')
    const existing = await client.query<{ current_revision: number; hash: string }>(
      `select t.current_revision, r.hash from studio_themes t
       join studio_theme_revisions r on r.theme_id = t.id and r.revision = t.current_revision
       where t.id = $1 for update of t`,
      [input.id],
    )
    const current = existing.rows[0]
    if (!current) {
      await client.query(
        `insert into studio_themes (id, name, source, site) values ($1, $2, $3, $4)`,
        [input.id, input.name, input.source || 'custom', input.site || null],
      )
      await client.query(
        `insert into studio_theme_revisions (theme_id, revision, theme, hash) values ($1, 1, $2::jsonb, $3)`,
        [input.id, JSON.stringify(input.theme), hash],
      )
      await client.query('commit')
      return { id: input.id, revision: 1, hash, unchanged: false }
    }
    if (current.hash === hash) {
      await client.query('rollback')
      return { id: input.id, revision: current.current_revision, hash, unchanged: true }
    }
    const next = current.current_revision + 1
    await client.query(
      `update studio_themes set name = $2, source = $3, site = $4, current_revision = $5, updated_at = now() where id = $1`,
      [input.id, input.name, input.source || 'custom', input.site || null, next],
    )
    await client.query(
      `insert into studio_theme_revisions (theme_id, revision, theme, hash) values ($1, $2, $3::jsonb, $4)`,
      [input.id, next, JSON.stringify(input.theme), hash],
    )
    await client.query('commit')
    return { id: input.id, revision: next, hash, unchanged: false }
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
  }
}

export const deleteTheme = async (id: string) => {
  await initializePersistence()
  const result = await database.query('delete from studio_themes where id = $1', [id])
  return (result.rowCount || 0) > 0
}

// ——— Legacy file-store import (D0a) ———
// One-way, non-destructive import of the file backend's data directory into
// PostgreSQL + MinIO. Ids and object keys are preserved so takes and
// references keep resolving; existing rows are skipped, never overwritten;
// the source directory is left untouched.
type LocalStoreInspection = {
  directory: string
  notebooks: number
  // Notebooks not yet in PostgreSQL — the offer is only useful for these.
  pendingNotebooks: number
  objects: number
  takes: number
  settings: number
}

export type LocalStoreImportReport = {
  notebooks: { imported: number; skipped: number }
  assets: { imported: number; skipped: number }
  takes: { imported: number; skipped: number }
  settings: { imported: number; skipped: number }
  unresolved: string[]
}

const legacyDataDirectory = () =>
  process.env.STUDIO_DATA_DIR ||
  fileURLToPath(new URL('../../../.studio-data/', import.meta.url))

const legacyJson = async <T>(path: string): Promise<T | null> => {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T
  } catch {
    return null
  }
}

// All object files under a directory, as MinIO-style keys (posix slashes),
// skipping the file backend's .meta.json sidecars.
const listLegacyObjects = async (root: string, sub = ''): Promise<string[]> => {
  const entries = await readdir(join(root, sub), { withFileTypes: true }).catch(() => [])
  const keys: string[] = []
  for (const entry of entries) {
    const rel = sub ? `${sub}/${entry.name}` : entry.name
    if (entry.isDirectory()) keys.push(...(await listLegacyObjects(root, rel)))
    else if (!entry.name.endsWith('.meta.json')) keys.push(rel)
  }
  return keys
}

export const inspectLocalStore = async (): Promise<LocalStoreInspection> => {
  const directory = legacyDataDirectory()
  const notebooksDir = join(directory, 'notebooks')
  const names = await readdir(notebooksDir).catch(() => [] as string[])
  const notebookNames = names.filter(name => name.endsWith('.json') && !name.endsWith('.takes.json'))
  const objectsList = await listLegacyObjects(join(directory, 'objects')).catch(() => [] as string[])
  const settings = await legacyJson<Record<string, unknown>>(join(directory, 'settings.json'))
  let pendingNotebooks = 0
  for (const name of notebookNames) {
    const id = name.slice(0, -'.json'.length)
    const existing = await database.query('select 1 from studio_notebooks where id = $1', [id]).catch(() => null)
    if (!existing?.rows.length) pendingNotebooks += 1
  }
  return {
    directory,
    notebooks: notebookNames.length,
    pendingNotebooks,
    objects: objectsList.length,
    takes: names.filter(name => name.endsWith('.takes.json')).length,
    settings: settings ? Object.keys(settings).length : 0,
  }
}

const UUID_LIKE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const importLocalStore = async (): Promise<LocalStoreImportReport> => {
  await initializePersistence()
  const directory = legacyDataDirectory()
  const report: LocalStoreImportReport = {
    notebooks: { imported: 0, skipped: 0 },
    assets: { imported: 0, skipped: 0 },
    takes: { imported: 0, skipped: 0 },
    settings: { imported: 0, skipped: 0 },
    unresolved: [],
  }

  // Notebooks first: assets and takes reference them.
  const notebooksDir = join(directory, 'notebooks')
  const names = await readdir(notebooksDir).catch(() => [] as string[])
  for (const name of names.filter(entry => entry.endsWith('.json') && !entry.endsWith('.takes.json'))) {
    const project = await legacyJson<ProjectDocumentV1>(join(notebooksDir, name))
    if (project?.version !== 1 || !project.id) {
      report.unresolved.push(`notebook ${name}: not a readable project document`)
      continue
    }
    const existing = await database.query('select 1 from studio_notebooks where id = $1', [project.id])
    if (existing.rows.length) {
      report.notebooks.skipped += 1
      continue
    }
    await saveProjectArtifact(project)
    report.notebooks.imported += 1
  }

  // Objects: same keys, same asset ids, verified byte counts.
  const objectsDir = join(directory, 'objects')
  for (const key of await listLegacyObjects(objectsDir).catch(() => [] as string[])) {
    const path = join(objectsDir, key)
    const sidecar = await legacyJson<{
      assetId?: string
      contentType?: string
      kind?: string
      projectId?: string
      blockId?: string
    }>(`${path}.meta.json`)
    const file = await stat(path)
    const assetId = sidecar?.assetId && UUID_LIKE.test(sidecar.assetId) ? sidecar.assetId : randomUUID()
    const duplicate = await database.query('select 1 from studio_assets where id = $1', [assetId])
    if (duplicate.rows.length) {
      report.assets.skipped += 1
      continue
    }
    const present = await objects.statObject(bucket, key).catch(() => null)
    if (!present || present.size !== file.size) {
      await objects.putObject(bucket, key, createReadStream(path), file.size, {
        'Content-Type': sidecar?.contentType || 'application/octet-stream',
      })
      const storedStat = await objects.statObject(bucket, key)
      if (storedStat.size !== file.size) {
        report.unresolved.push(`object ${key}: stored ${storedStat.size} of ${file.size} bytes`)
        continue
      }
    }
    const body = await readFile(path)
    await database.query(
      `insert into studio_assets
        (id, notebook_id, block_id, object_key, content_type, byte_size, kind, status, sha256)
       values ($1, $2, $3, $4, $5, $6, $7, 'ready', $8)
       on conflict (id) do nothing`,
      [
        assetId,
        sidecar?.projectId || null,
        sidecar?.blockId || null,
        key,
        sidecar?.contentType || 'application/octet-stream',
        file.size,
        sidecar?.kind || 'imported',
        createHash('sha256').update(body).digest('hex'),
      ],
    )
    report.assets.imported += 1
  }

  // Recorded takes: only when both the notebook and its asset are resolvable.
  for (const name of names.filter(entry => entry.endsWith('.takes.json'))) {
    const projectId = name.slice(0, -'.takes.json'.length)
    const takes = await legacyJson<Record<string, { recordingId?: string; assetId?: string; durationMs?: number; recordedAt?: string }>>(
      join(notebooksDir, name),
    )
    if (!takes) continue
    const notebook = await database.query('select 1 from studio_notebooks where id = $1', [projectId])
    if (!notebook.rows.length) {
      report.unresolved.push(`takes ${name}: notebook ${projectId} is not imported`)
      continue
    }
    for (const [blockId, take] of Object.entries(takes)) {
      if (!take.assetId || !UUID_LIKE.test(take.assetId) || !take.durationMs) {
        report.unresolved.push(`takes ${name}: block ${blockId} has no resolvable asset`)
        continue
      }
      const asset = await database.query('select 1 from studio_assets where id = $1', [take.assetId])
      if (!asset.rows.length) {
        report.unresolved.push(`takes ${name}: block ${blockId} asset ${take.assetId} missing`)
        continue
      }
      const written = await database.query(
        `insert into studio_recorded_blocks (id, notebook_id, block_id, asset_id, duration_ms)
         values ($1, $2, $3, $4, $5)
         on conflict (notebook_id, block_id) do nothing`,
        [take.recordingId && UUID_LIKE.test(take.recordingId) ? take.recordingId : randomUUID(), projectId, blockId, take.assetId, Math.round(take.durationMs)],
      )
      if (written.rowCount) report.takes.imported += 1
      else report.takes.skipped += 1
    }
  }

  // Settings: never clobber a choice the durable store already holds.
  const settings = await legacyJson<Record<string, unknown>>(join(directory, 'settings.json'))
  for (const [key, value] of Object.entries(settings || {})) {
    const written = await database.query(
      `insert into studio_settings (key, value) values ($1, $2::jsonb) on conflict (key) do nothing`,
      [key, JSON.stringify(value)],
    )
    if (written.rowCount) report.settings.imported += 1
    else report.settings.skipped += 1
  }
  return report
}
