import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { Client as MinioClient } from 'minio'
import { Pool } from 'pg'
import type { ProjectDocumentV1, RecordedBlockV1, TiptapNode } from 'markdown-composition'

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

const migrationPath = fileURLToPath(
  new URL('./migrations/001_studio_artifacts.sql', import.meta.url),
)

let ready: Promise<void> | null = null

export const initializePersistence = () => {
  ready ||= (async () => {
    await database.query(await readFile(migrationPath, 'utf8'))
    if (!(await objects.bucketExists(bucket))) await objects.makeBucket(bucket)
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
  await objects.putObject(bucket, objectKey, body, body.length, {
    'Content-Type': contentType,
  })
  if (projectId) {
    await database.query(
      `insert into studio_assets
        (id, notebook_id, block_id, object_key, content_type, byte_size, kind)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [assetId, projectId, blockId || null, objectKey, contentType, body.length, kind],
    )
  }
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
     where id = $1 and notebook_id = $2 and block_id = $3`,
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
