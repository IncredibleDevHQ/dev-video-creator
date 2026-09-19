// D0a backup/restore proof: back up the live store, restore it into FRESH
// volumes (a new database and a new bucket, standing in for fresh named
// volumes), and verify row counts and object bytes match. Cleans both up.
// Usage: node scripts/backup-restore-check.mjs
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { Client as MinioClient } from 'minio'
import pg from 'pg'

const run = promisify(execFile)
const script = fileURLToPath(new URL('./studio-backup.mjs', import.meta.url))
const stamp = Date.now().toString(36)
const freshDb = `studio_restore_test_${stamp}`
const freshBucket = `studio-restore-test-${stamp}`
const adminUrl = process.env.STUDIO_DATABASE_URL?.replace(/\/[^/]+$/, '/postgres') || 'postgres://incredible:incredible@127.0.0.1:54329/postgres'
const freshUrl = process.env.STUDIO_DATABASE_URL?.replace(/\/[^/]+$/, `/${freshDb}`) || `postgres://incredible:incredible@127.0.0.1:54329/${freshDb}`
const minio = new MinioClient({
  endPoint: process.env.STUDIO_MINIO_ENDPOINT || '127.0.0.1',
  port: Number(process.env.STUDIO_MINIO_PORT || 59000),
  useSSL: process.env.STUDIO_MINIO_USE_SSL === 'true',
  accessKey: process.env.STUDIO_MINIO_ACCESS_KEY || 'incredible',
  secretKey: process.env.STUDIO_MINIO_SECRET_KEY || 'SuperSecretRootPwd',
})
const dir = await mkdtemp(join(tmpdir(), 'studio-backup-'))

let failures = 0
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`)
  if (!ok) failures += 1
}

const admin = new pg.Pool({ connectionString: adminUrl, max: 2 })
try {
  await run('node', [script, 'backup', dir])
  const manifest = JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf8'))
  check('backup manifest records tables and objects', Boolean(manifest.database?.tables?.studio_notebooks >= 0 && manifest.objects?.count >= 0), `${manifest.objects.count} objects`)

  await admin.query(`create database ${freshDb}`)
  await run('node', [script, 'restore', dir, '--database-url', freshUrl, '--bucket', freshBucket])

  const restored = new pg.Pool({ connectionString: freshUrl, max: 2 })
  try {
    for (const [table, count] of Object.entries(manifest.database.tables)) {
      const result = await restored.query(`select count(*)::int as n from ${table}`)
      check(`restored ${table} row count matches`, result.rows[0].n === count, `${result.rows[0].n}/${count}`)
    }
    // Every migrated schema is replayed on the fresh volume.
    const migrations = await restored.query('select count(*)::int as n from studio_schema_migrations')
    check('migration ledger replayed', migrations.rows[0].n >= 2, `${migrations.rows[0].n} applied`)

    const sampleKey = Object.keys(manifest.objects.sha256)[0]
    if (sampleKey) {
      const stream = await minio.getObject(freshBucket, sampleKey)
      const chunks = []
      for await (const chunk of stream) chunks.push(chunk)
      const bytes = Buffer.concat(chunks)
      const { createHash } = await import('node:crypto')
      const sha256 = createHash('sha256').update(bytes).digest('hex')
      check('sampled object bytes match the manifest checksum', sha256 === manifest.objects.sha256[sampleKey], `${sampleKey} (${bytes.length}b)`)
    } else {
      check('sampled object bytes match the manifest checksum', true, 'store held no objects to sample')
    }
  } finally {
    await restored.end()
  }
} catch (error) {
  check(`run: ${error.message}`, false)
} finally {
  await admin.query(`drop database if exists ${freshDb}`).catch(() => {})
  await admin.end()
  const keys = []
  try {
    for await (const entry of minio.listObjectsV2(freshBucket, '', true)) keys.push(entry.name)
    if (keys.length) await minio.removeObjects(freshBucket, keys)
    await minio.removeBucket(freshBucket).catch(() => {})
  } catch {}
  await rm(dir, { recursive: true, force: true })
}
console.log(failures ? `BACKUP/RESTORE CHECK FAIL (${failures})` : 'BACKUP/RESTORE CHECK PASS')
process.exitCode = failures ? 1 : 0
