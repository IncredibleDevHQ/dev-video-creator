import type { ProjectSaveOptions } from './persistence'
import { createHash, randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readdir, readFile, stat } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client as MinioClient } from 'minio'
import { Pool } from 'pg'
import type { ProjectDocumentV1, RecordedBlockV1, TiptapNode } from 'markdown-composition'
import { runMigrations } from './migrations'
import type { NewPlanningRecord, PlanningInputRow, PlanningRecordPatch } from './persistence'
import { ACTIVE_STATUSES, type PlanningRecord, type PlanningStatus } from '../src/planning/planning-records'

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

export const saveProjectArtifact = async (project: ProjectDocumentV1, options?: ProjectSaveOptions) => {
  await initializePersistence()
  const client = await database.connect()
  try {
    await client.query('begin')
    // All document writers take the same lock, including ordinary autosaves.
    await client.query('select pg_advisory_xact_lock(hashtext($1))', [project.id])
    if (options?.createOnly && (await client.query('select 1 from studio_notebooks where id = $1', [project.id])).rowCount) throw Object.assign(new Error('This notebook already exists. Load its current revision before saving.'), { statusCode: 409 })
    if (options?.expectedProject) {
      const match = await client.query('select 1 from studio_notebooks where id = $1 and artifact = $2::jsonb for update', [project.id, JSON.stringify(options.expectedProject)])
      if (!match.rowCount) throw Object.assign(new Error('The notebook changed during generation. Refresh before applying the saved candidate.'), { statusCode: 409 })
    }
    for (const blockId of options?.clearTakeBlocks || []) {
      await client.query('delete from studio_take_selections where notebook_id = $1 and block_id = $2', [project.id, blockId])
      await client.query('delete from studio_recorded_blocks where notebook_id = $1 and block_id = $2', [project.id, blockId])
    }
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
// The take archive is removed explicitly first: takes protect their media
// asset with delete-restrict, so the cascade alone would fail.
export const deleteProjectArtifact = async (projectId: string) => {
  await initializePersistence()
  await database.query('delete from studio_take_selections where notebook_id = $1', [projectId])
  await database.query('delete from studio_presenter_takes where notebook_id = $1', [projectId])
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
  // The take archive and the selection are written by the dispatcher
  // (persistence.ts saveRecordedBlock) so every backend behaves the same.
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
    const existing = await client.query<{ current_revision: number; hash: string; site: string | null }>(
      `select t.current_revision, t.site, r.hash from studio_themes t
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
    // A revision that says nothing about the site keeps the association;
    // only an explicit site (or an explicit empty one) changes it.
    const site = input.site === undefined ? current.site : input.site || null
    const next = current.current_revision + 1
    await client.query(
      `update studio_themes set name = $2, source = $3, site = $4, current_revision = $5, updated_at = now() where id = $1`,
      [input.id, input.name, input.source || 'custom', site, next],
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

// ——— Immutable source revisions (D1) ———
export type SourceRevisionRecord = {
  id: string
  projectId: string | null
  kind: string
  url: string | null
  brandUrl: string | null
  title: string
  site: string
  hash: string
  content: unknown
  brandContent: unknown | null
  createdAt: string
}

const sourceRevisionId = (input: { kind: string; url?: string; brandUrl?: string; content: unknown; brandContent?: unknown }) => {
  const hash = createHash('sha256').update(JSON.stringify([input.kind, input.url || '', input.brandUrl || '', input.content, input.brandContent || null])).digest('hex')
  return { id: `src-${hash.slice(0, 16)}`, hash }
}

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
  await initializePersistence()
  const { id, hash } = sourceRevisionId(input)
  await database.query(
    `insert into studio_source_revisions (id, project_id, kind, url, brand_url, title, site, hash, content, brand_content)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb)
     on conflict (id) do nothing`,
    [
      id,
      input.projectId || null,
      input.kind,
      input.url || null,
      input.brandUrl || null,
      input.title || '',
      input.site || '',
      hash,
      JSON.stringify(input.content),
      input.brandContent ? JSON.stringify(input.brandContent) : null,
    ],
  )
  return { id, hash }
}

export const loadSourceRevision = async (id: string): Promise<SourceRevisionRecord | null> => {


  await initializePersistence()
  const result = await database.query(
    'select * from studio_source_revisions where id = $1',
    [id],
  )
  const row = result.rows[0]
  if (!row) return null
  return {
    id: row.id,
    projectId: row.project_id,
    kind: row.kind,
    url: row.url,
    brandUrl: row.brand_url,
    title: row.title,
    site: row.site,
    hash: row.hash,
    content: row.content,
    brandContent: row.brand_content,
    createdAt: new Date(row.created_at).toISOString(),
  }
}

// ——— Story records (D2): narrative revisions and explanation models ———
export const saveNarrativeRevision = async (input: {
  projectId?: string
  sourceRevision?: string
  origin: 'authored' | 'article' | 'notes'
  wordingPolicy: string
  audience?: string
  takeaway?: string
  text: string
}): Promise<{ id: string; hash: string }> => {
  await initializePersistence()
  const hash = createHash('sha256').update(JSON.stringify([input.origin, input.wordingPolicy, input.text, input.audience || '', input.takeaway || ''])).digest('hex')
  const id = `nar-${hash.slice(0, 16)}`
  await database.query(
    `insert into studio_narrative_revisions (id, project_id, source_revision, origin, wording_policy, audience, takeaway, text, hash)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     on conflict (id) do nothing`,
    [id, input.projectId || null, input.sourceRevision || null, input.origin, input.wordingPolicy, input.audience || null, input.takeaway || null, input.text, hash],
  )
  return { id, hash }
}

export const saveExplanationModel = async (input: {
  projectId?: string
  sourceRevision?: string
  narrativeRevision?: string
  model: unknown
}): Promise<{ id: string; hash: string }> => {
  await initializePersistence()
  const hash = createHash('sha256').update(JSON.stringify(input.model)).digest('hex')
  const id = `model-${hash.slice(0, 16)}`
  await database.query(
    `insert into studio_explanation_models (id, project_id, source_revision, narrative_revision, model, hash)
     values ($1, $2, $3, $4, $5::jsonb, $6)
     on conflict (id) do nothing`,
    [id, input.projectId || null, input.sourceRevision || null, input.narrativeRevision || null, JSON.stringify(input.model), hash],
  )
  return { id, hash }
}

import type { BuildRunInput, BuildRunRow, BuildStageInput } from './persistence'

// ——— Durable build runs and stage checkpoints (D3) ———
// ——— Planning records (M0) ———
const iso = (value: unknown) => (value ? new Date(value as string).toISOString() : null)
const planningRecordFrom = (row: Record<string, unknown>): PlanningRecord => ({
  id: String(row.id),
  kind: row.kind as PlanningRecord['kind'],
  projectId: String(row.project_id),
  subject: String(row.subject || ''),
  revision: Number(row.revision),
  status: row.status as PlanningStatus,
  fingerprint: String(row.fingerprint),
  inputs: (row.inputs as Record<string, unknown>) || {},
  content: (row.content as PlanningRecord['content']) ?? null,
  report: (row.report as PlanningRecord['report']) ?? null,
  artifacts: (row.artifacts as PlanningRecord['artifacts']) ?? null,
  runId: (row.run_id as string | null) ?? null,
  adapter: (row.adapter as string | null) ?? null,
  model: (row.model as string | null) ?? null,
  reportedModel: (row.reported_model as string | null) ?? null,
  skillBundle: (row.skill_bundle as PlanningRecord['skillBundle']) ?? null,
  workflow: (row.workflow as string | null) ?? null,
  direction: String(row.direction || ''),
  error: (row.error as PlanningRecord['error']) ?? null,
  createdAt: iso(row.created_at) || '',
  updatedAt: iso(row.updated_at) || '',
  reviewedAt: iso(row.reviewed_at),
  approval: (row.approval as PlanningRecord['approval']) ?? null,
  progress: (row.progress as PlanningRecord['progress']) ?? null,
})

// The next revision for the subject is taken inside the insert; two
// concurrent queues for the same subject meet the unique key and the loser
// retries with the revision after.
export const createPlanningRecord = async (record: NewPlanningRecord): Promise<PlanningRecord> => {
  await initializePersistence()
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const id = `plan-${record.kind}-${randomUUID()}`
    try {
      const result = await database.query(
        `insert into studio_planning_records
          (id, project_id, kind, subject, revision, status, fingerprint, inputs, direction, skill_bundle, workflow, adapter, model)
         select $1, $2, $3, $4, coalesce(max(revision), 0) + 1, 'queued', $5, $6::jsonb, $7, $8::jsonb, $9, $10, $11
           from studio_planning_records where project_id = $2 and kind = $3 and subject = $4
         returning *`,
        [
          id,
          record.projectId,
          record.kind,
          record.subject || '',
          record.fingerprint,
          JSON.stringify(record.inputs || {}),
          record.direction || '',
          record.skillBundle ? JSON.stringify(record.skillBundle) : null,
          record.workflow || null,
          record.adapter || null,
          record.model || null,
        ],
      )
      return planningRecordFrom(result.rows[0])
    } catch (error) {
      if ((error as { code?: string }).code !== '23505') throw error
    }
  }
  throw new Error('Could not allocate a planning revision; try again')
}

// Claims a request once: an identical active (queued, running or verifying)
// record answers the claim. The partial unique index on active (project, kind, subject,
// fingerprint) makes a concurrent insert lose; the loser then finds and
// returns the winner. A clash on the revision number retries.
export const claimPlanningRecord = async (record: NewPlanningRecord): Promise<{ record: PlanningRecord; reused: boolean }> => {
  await initializePersistence()
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const active = await database.query(
      `select * from studio_planning_records
        where project_id = $1 and kind = $2 and subject = $3 and fingerprint = $4 and status = any($5::text[])
        order by revision desc limit 1`,
      [record.projectId, record.kind, record.subject || '', record.fingerprint, [...ACTIVE_STATUSES]],
    )
    if (active.rows[0]) return { record: planningRecordFrom(active.rows[0]), reused: true }
    const id = `plan-${record.kind}-${randomUUID()}`
    const result = await database.query(
      `insert into studio_planning_records
        (id, project_id, kind, subject, revision, status, fingerprint, inputs, direction, skill_bundle, workflow, adapter, model)
       select $1, $2, $3, $4, coalesce(max(revision), 0) + 1, 'queued', $5, $6::jsonb, $7, $8::jsonb, $9, $10, $11
         from studio_planning_records where project_id = $2 and kind = $3 and subject = $4
       on conflict do nothing
       returning *`,
      [
        id,
        record.projectId,
        record.kind,
        record.subject || '',
        record.fingerprint,
        JSON.stringify(record.inputs || {}),
        record.direction || '',
        record.skillBundle ? JSON.stringify(record.skillBundle) : null,
        record.workflow || null,
        record.adapter || null,
        record.model || null,
      ],
    )
    if (result.rows[0]) return { record: planningRecordFrom(result.rows[0]), reused: false }
  }
  throw new Error('Could not claim this planning request; try again')
}

export const listPlanningRecords = async (projectId: string): Promise<PlanningRecord[]> => {
  await initializePersistence()
  const result = await database.query(
    'select * from studio_planning_records where project_id = $1 order by kind, subject, revision desc',
    [projectId],
  )
  return result.rows.map(planningRecordFrom)
}

export const loadPlanningRecord = async (id: string): Promise<PlanningRecord | null> => {
  await initializePersistence()
  const result = await database.query('select * from studio_planning_records where id = $1', [id])
  return result.rows[0] ? planningRecordFrom(result.rows[0]) : null
}

const PLANNING_COLUMNS: Record<keyof PlanningRecordPatch, { column: string; json?: boolean; time?: boolean }> = {
  status: { column: 'status' },
  content: { column: 'content', json: true },
  report: { column: 'report', json: true },
  artifacts: { column: 'artifacts', json: true },
  runId: { column: 'run_id' },
  adapter: { column: 'adapter' },
  model: { column: 'model' },
  reportedModel: { column: 'reported_model' },
  workflow: { column: 'workflow' },
  error: { column: 'error', json: true },
  reviewedAt: { column: 'reviewed_at', time: true },
  approval: { column: 'approval', json: true },
  progress: { column: 'progress', json: true },
}

export const updatePlanningRecord = async (
  id: string,
  patch: PlanningRecordPatch,
  expected?: PlanningStatus[],
  owner?: { runId: string | null },
): Promise<PlanningRecord | null> => {
  await initializePersistence()
  const sets: string[] = []
  const values: unknown[] = [id]
  for (const [key, value] of Object.entries(patch) as Array<[keyof PlanningRecordPatch, unknown]>) {
    const spec = PLANNING_COLUMNS[key]
    if (!spec || value === undefined) continue
    values.push(spec.json ? (value === null ? null : JSON.stringify(value)) : value)
    sets.push(`${spec.column} = $${values.length}${spec.json ? '::jsonb' : spec.time ? '::timestamptz' : ''}`)
  }
  let guard = ''
  if (expected?.length) {
    values.push(expected)
    guard = ` and status = any($${values.length}::text[])`
  }
  if (owner) {
    values.push(owner.runId)
    guard += ` and run_id is not distinct from $${values.length}::text`
  }
  const result = await database.query(
    `update studio_planning_records set ${[...sets, 'updated_at = now()'].join(', ')} where id = $1${guard} returning *`,
    values,
  )
  return result.rows[0] ? planningRecordFrom(result.rows[0]) : null
}

export const listPlanningRecordsForRun = async (runId: string): Promise<PlanningRecord[]> => {
  await initializePersistence()
  const result = await database.query('select * from studio_planning_records where run_id = $1', [runId])
  return result.rows.map(planningRecordFrom)
}

const planningInputFrom = (row: Record<string, unknown>): PlanningInputRow => ({
  projectId: String(row.project_id),
  subject: String(row.subject || ''),
  direction: String(row.direction || ''),
  delivery: (row.delivery as string | null) ?? null,
  updatedAt: iso(row.updated_at) || '',
})

export const listPlanningInputs = async (projectId: string): Promise<PlanningInputRow[]> => {
  await initializePersistence()
  const result = await database.query('select * from studio_planning_inputs where project_id = $1', [projectId])
  return result.rows.map(planningInputFrom)
}

export const savePlanningInput = async (input: { projectId: string; subject: string; direction?: string; delivery?: string | null }) => {
  await initializePersistence()
  const result = await database.query(
    `insert into studio_planning_inputs (project_id, subject, direction, delivery)
     values ($1, $2, coalesce($3, ''), $4)
     on conflict (project_id, subject) do update set
       direction = coalesce($3, studio_planning_inputs.direction),
       delivery = case when $5 then $4 else studio_planning_inputs.delivery end,
       updated_at = now()
     returning *`,
    [input.projectId, input.subject || '', input.direction ?? null, input.delivery ?? null, input.delivery !== undefined],
  )
  return planningInputFrom(result.rows[0])
}

export const saveBuildRun = async (run: BuildRunInput) => {
  await initializePersistence()
  await database.query(
    `insert into studio_build_runs
      (id, project_id, skill, route, adapter, project_dir, status, inputs_hash, resume_id, exit_code, started_at, finished_at, model, reported_model, failure)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, coalesce($11::timestamptz, now()), $12::timestamptz, $13, $14, $15::jsonb)
     on conflict (id) do update set
       status = excluded.status, resume_id = excluded.resume_id,
       exit_code = excluded.exit_code, finished_at = excluded.finished_at,
       model = coalesce(excluded.model, studio_build_runs.model),
       reported_model = coalesce(excluded.reported_model, studio_build_runs.reported_model),
       failure = excluded.failure`,
    [
      run.id,
      run.projectId || null,
      run.skill,
      run.route,
      run.adapter,
      run.projectDir,
      run.status,
      run.inputsHash || null,
      run.resumeId || null,
      run.exitCode ?? null,
      run.startedAt || null,
      run.finishedAt || null,
      run.model || null,
      run.reportedModel || null,
      run.failure ? JSON.stringify(run.failure) : null,
    ],
  )
}

export const listBuildRuns = async (projectId?: string): Promise<BuildRunRow[]> => {
  await initializePersistence()
  const result = projectId
    ? await database.query('select * from studio_build_runs where project_id = $1 order by started_at desc limit 100', [projectId])
    : await database.query('select * from studio_build_runs order by started_at desc limit 100')
  return result.rows.map(row => ({
    id: row.id,
    projectId: row.project_id,
    skill: row.skill,
    route: row.route,
    adapter: row.adapter,
    projectDir: row.project_dir,
    status: row.status,
    inputsHash: row.inputs_hash,
    resumeId: row.resume_id,
    model: row.model ?? null,
    reportedModel: row.reported_model ?? null,
    failure: row.failure ?? null,
    exitCode: row.exit_code,
    startedAt: new Date(row.started_at).toISOString(),
    finishedAt: row.finished_at ? new Date(row.finished_at).toISOString() : null,
  }))
}

export const recordBuildStage = async (stage: BuildStageInput) => {
  await initializePersistence()
  await database.query(
    `insert into studio_build_stages (run_id, stage, subject, status, fingerprint, detail)
     values ($1, $2, $3, $4, $5, $6::jsonb)
     on conflict (run_id, stage, subject) do update set
       status = excluded.status, fingerprint = excluded.fingerprint,
       detail = excluded.detail, updated_at = now()`,
    [stage.runId, stage.stage, stage.subject || '', stage.status, stage.fingerprint || null, JSON.stringify(stage.detail || {})],
  )
}

export const listBuildStages = async (runId: string) => {
  await initializePersistence()
  const result = await database.query(
    'select * from studio_build_stages where run_id = $1 order by updated_at',
    [runId],
  )
  return result.rows.map(row => ({
    runId: row.run_id,
    stage: row.stage,
    subject: row.subject,
    status: row.status,
    fingerprint: row.fingerprint,
    detail: row.detail,
    updatedAt: new Date(row.updated_at).toISOString(),
  }))
}

// ——— Presenter takes and selections (D3) ———
// Every take is an immutable row; the active take is a separate selection.
export const savePresenterTake = async (take: {
  id: string
  projectId: string
  blockId: string
  assetId: string
  durationMs: number
  detail?: unknown
}) => {
  await initializePersistence()
  await database.query(
    `insert into studio_presenter_takes (id, notebook_id, block_id, asset_id, duration_ms, detail)
     values ($1, $2, $3, $4, $5, $6::jsonb)
     on conflict (id) do nothing`,
    [take.id, take.projectId, take.blockId, take.assetId, Math.round(take.durationMs), JSON.stringify(take.detail || {})],
  )
}

export const listPresenterTakes = async (projectId: string, blockId?: string) => {
  await initializePersistence()
  const result = blockId
    ? await database.query('select * from studio_presenter_takes where notebook_id = $1 and block_id = $2 order by created_at', [projectId, blockId])
    : await database.query('select * from studio_presenter_takes where notebook_id = $1 order by created_at', [projectId])
  return result.rows.map(row => ({
    id: row.id,
    projectId: row.notebook_id,
    blockId: row.block_id,
    assetId: row.asset_id,
    durationMs: row.duration_ms,
    detail: row.detail,
    createdAt: new Date(row.created_at).toISOString(),
  }))
}

export const selectPresenterTake = async (input: { projectId: string; blockId: string; takeId: string }) => {
  await initializePersistence()
  const client = await database.connect()
  try {
    await client.query('begin')
    await client.query('select pg_advisory_xact_lock(hashtext($1))', [input.projectId])
    const take = (await client.query('select * from studio_presenter_takes where id = $1 and notebook_id = $2 and block_id = $3', [input.takeId, input.projectId, input.blockId])).rows[0]
    if (!take) throw new Error('That take does not belong to this block')
    const project = (await client.query('select artifact from studio_notebooks where id = $1 for update', [input.projectId])).rows[0]?.artifact as ProjectDocumentV1 | undefined
    if (!project) throw new Error('Notebook not found')
    if (take.detail?.mediaUrl) {
      project.recordedBlocks ||= {}
      project.recordedBlocks[input.blockId] = {
        ...take.detail, blockId: input.blockId, recordingId: input.takeId,
        videoUrl: take.detail.mediaUrl, durationMs: take.duration_ms,
        recordedAt: new Date(take.created_at).toISOString(), storage: 'minio',
      }
      project.presenterTracks ||= {}
      project.presenterTracks[input.blockId] = take.detail.role === 'presenter'
        ? [{ kind: 'human-camera', videoUrl: take.detail.mediaUrl, audioUrl: take.detail.mediaUrl, audioKind: 'recorded-mic' }]
        : []
      await client.query('update studio_notebooks set artifact = $2::jsonb, updated_at = now() where id = $1', [input.projectId, JSON.stringify(project)])
    }
    await client.query(`insert into studio_take_selections (notebook_id, block_id, take_id)
      values ($1, $2, $3) on conflict (notebook_id, block_id) do update
      set take_id = excluded.take_id, selected_at = now()`, [input.projectId, input.blockId, input.takeId])
    await client.query('commit')
  } catch (error) { await client.query('rollback'); throw error }
  finally { client.release() }
}

export const listTakeSelections = async (projectId: string) => {
  await initializePersistence()
  const result = await database.query(
    'select * from studio_take_selections where notebook_id = $1',
    [projectId],
  )
  return result.rows.map(row => ({
    projectId: row.notebook_id,
    blockId: row.block_id,
    takeId: row.take_id,
    selectedAt: new Date(row.selected_at).toISOString(),
  }))
}

// Removing the presenter clears the active take and its selection; the take
// itself stays in the archive (studio_presenter_takes) — retakes preserve
// previous versions.
export const clearPresenterTake = async (input: { projectId: string; blockId: string }) => {
  await initializePersistence()
  await database.query('delete from studio_take_selections where notebook_id = $1 and block_id = $2', [input.projectId, input.blockId])
  await database.query('delete from studio_recorded_blocks where notebook_id = $1 and block_id = $2', [input.projectId, input.blockId])
}

// Which notebooks reference a marker (an artwork key, an object key) in
// their stored document — the library's "used in" answers.
export const findNotebooksReferencing = async (marker: string): Promise<Array<{ id: string; title: string }>> => {
  await initializePersistence()
  const safe = marker.replace(/[%_\\]/g, '')
  if (!safe) return []
  const result = await database.query(
    `select id, title from studio_notebooks where artifact::text like $1 order by updated_at desc limit 20`,
    [`%${safe}%`],
  )
  return result.rows.map(row => ({ id: row.id, title: row.title }))
}

export const settingsWithPrefix = async (prefix: string): Promise<Record<string, unknown>> => {
  await initializePersistence()
  const safe = prefix.replace(/[%_\\]/g, '')
  const result = await database.query('select key, value from studio_settings where key like $1', [`${safe}%`])
  return Object.fromEntries(result.rows.map(row => [row.key, row.value]))
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

export const compareAndSwapSetting = async (key: string, expected: unknown, value: unknown): Promise<boolean> => {
  await initializePersistence()
  if (expected === null) return Boolean((await database.query('insert into studio_settings (key,value) values ($1,$2::jsonb) on conflict do nothing returning key', [key, JSON.stringify(value)])).rowCount)
  return Boolean((await database.query('update studio_settings set value=$3::jsonb,updated_at=now() where key=$1 and value=$2::jsonb returning key', [key, JSON.stringify(expected), JSON.stringify(value)])).rowCount)
}
