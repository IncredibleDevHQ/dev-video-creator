// Restore the check's retained immutable objects into brand-new owned stores.
import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { createHash } from 'node:crypto'
import pg from 'pg'
import {
  S3Client,
  CreateBucketCommand,
  PutObjectCommand
} from '@aws-sdk/client-s3'
export const restoreBlogFixture = async (directory, env) => {
  if (env.MINIMAL_STORAGE_FIXTURE !== 'disposable')
    throw new Error('Only disposable fixture stores may be restored')
  const root = resolve(directory)
  const rows = JSON.parse(await readFile(join(root, 'rows.json'), 'utf8'))
  const artifacts = JSON.parse(
    await readFile(join(root, 'artifacts.json'), 'utf8')
  )
  const buckets = new Set(artifacts.map((artifact) => artifact.bucket))
  if (
    buckets.size !== 1 ||
    !/^minimal-fixture-[a-f0-9]{8}$/.test([...buckets][0])
  )
    throw new Error('Not a retained blog fixture')
  env.MINIMAL_STUDIO_S3_BUCKET = [...buckets][0]
  const pool = new pg.Pool({
    connectionString: env.MINIMAL_STUDIO_DATABASE_URL
  })
  const objects = new S3Client({
    endpoint: env.MINIMAL_STUDIO_S3_ENDPOINT,
    region: 'us-east-1',
    forcePathStyle: true,
    credentials: {
      accessKeyId: env.MINIMAL_STUDIO_S3_ACCESS_KEY_ID,
      secretAccessKey: env.MINIMAL_STUDIO_S3_SECRET_ACCESS_KEY
    }
  })
  try {
    await pool.query(
      await readFile(
        new URL('../engine/storage/schema.sql', import.meta.url),
        'utf8'
      )
    )
    await objects.send(
      new CreateBucketCommand({ Bucket: env.MINIMAL_STUDIO_S3_BUCKET })
    )
    for (const artifact of artifacts) {
      if (
        !/^[a-zA-Z0-9_-]+$/.test(artifact.id) ||
        !artifact.object_key.startsWith('notebooks/') ||
        artifact.object_key.split('/').includes('..') ||
        artifact.status !== 'ready'
      )
        throw new Error('Invalid fixture object')
      const body = await readFile(join(root, 'objects', artifact.id))
      if (
        createHash('sha256').update(body).digest('hex') !== artifact.sha256 ||
        body.length !== Number(artifact.byte_size)
      )
        throw new Error('Retained fixture checksum mismatch')
      await objects.send(
        new PutObjectCommand({
          Bucket: artifact.bucket,
          Key: artifact.object_key,
          Body: body,
          ContentType: artifact.content_type
        })
      )
      await pool.query(
        'insert into minimal_studio_artifacts (id,notebook_id,scene_id,moment_id,kind,bucket,object_key,s3_uri,content_type,byte_size,sha256,status,created_at) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)',
        [
          artifact.id,
          artifact.notebook_id,
          artifact.scene_id,
          artifact.moment_id,
          artifact.kind,
          artifact.bucket,
          artifact.object_key,
          artifact.s3_uri,
          artifact.content_type,
          artifact.byte_size,
          artifact.sha256,
          artifact.status,
          artifact.created_at
        ]
      )
    }
    await pool.query('begin')
    for (const row of rows)
      await pool.query(
        'insert into minimal_studio_rows(kind,id,notebook_id,document,artifact_id,updated_at) values($1,$2,$3,$4,$5,$6)',
        [
          row.kind,
          row.id,
          row.notebook_id,
          row.document,
          row.artifact_id,
          row.updated_at
        ]
      )
    await pool.query('commit')
    console.log(
      `Restored ${rows.length} rows and ${artifacts.length} exact objects into new disposable stores.`
    )
  } finally {
    objects.destroy()
    await pool.end()
  }
}
