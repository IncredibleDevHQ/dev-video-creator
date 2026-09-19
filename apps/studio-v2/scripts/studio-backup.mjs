// Coordinated backup/restore for the durable store (D0a): PostgreSQL rows
// plus the MinIO objects they reference, in one folder with a manifest.
//
//   node scripts/studio-backup.mjs backup  <dir>
//   node scripts/studio-backup.mjs restore <dir> [--database-url URL] [--bucket NAME]
//
// Backup reads the configured services (STUDIO_DATABASE_URL, STUDIO_MINIO_*
// or the docker-compose defaults). Restore defaults to those same services
// and accepts overrides so a restore can land on fresh, empty volumes without
// touching the originals. For a perfectly consistent snapshot, pause writes
// (quit the app) while backing up; object keys are immutable, so rows dumped
// before their objects are copied always resolve.
import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'
import { Client as MinioClient } from 'minio'
import pg from 'pg'

const [command, dir, ...flags] = process.argv.slice(2)
if (!command || !dir || !['backup', 'restore'].includes(command)) {
  console.error('usage: studio-backup.mjs backup|restore <dir> [--database-url URL] [--bucket NAME]')
  process.exit(2)
}
const flag = name => {
  const index = flags.indexOf(name)
  return index >= 0 ? flags[index + 1] : undefined
}

const databaseUrl = flag('--database-url') || process.env.STUDIO_DATABASE_URL || 'postgres://incredible:incredible@127.0.0.1:54329/incredible_studio'
const bucket = flag('--bucket') || process.env.STUDIO_MINIO_BUCKET || 'incredible-studio'
const objects = new MinioClient({
  endPoint: process.env.STUDIO_MINIO_ENDPOINT || '127.0.0.1',
  port: Number(process.env.STUDIO_MINIO_PORT || 59000),
  useSSL: process.env.STUDIO_MINIO_USE_SSL === 'true',
  accessKey: process.env.STUDIO_MINIO_ACCESS_KEY || 'incredible',
  secretKey: process.env.STUDIO_MINIO_SECRET_KEY || 'SuperSecretRootPwd',
})
const database = new pg.Pool({ connectionString: databaseUrl, max: 3 })

const TABLES = ['studio_notebooks', 'studio_blocks', 'studio_assets', 'studio_recorded_blocks', 'studio_settings', 'studio_schema_migrations']

const listObjects = async () => {
  const keys = []
  for await (const entry of objects.listObjectsV2(bucket, '', true)) keys.push({ name: entry.name, size: entry.size })
  return keys
}

const backup = async () => {
  await mkdir(join(dir, 'objects'), { recursive: true })
  const tables = {}
  for (const table of TABLES) {
    const result = await database.query(`select * from ${table}`)
    tables[table] = result.rows
  }
  const manifest = { createdAt: new Date().toISOString(), database: { tables: {} }, objects: { count: 0, bytes: 0, sha256: {} } }
  for (const [table, rows] of Object.entries(tables)) {
    await writeFile(join(dir, `${table}.json`), JSON.stringify(rows, null, 2))
    manifest.database.tables[table] = rows.length
  }
  for (const entry of await listObjects()) {
    const target = join(dir, 'objects', entry.name)
    await mkdir(join(target, '..'), { recursive: true })
    await pipeline(await objects.getObject(bucket, entry.name), createWriteStream(target))
    const body = await readFile(target)
    manifest.objects.sha256[entry.name] = createHash('sha256').update(body).digest('hex')
    manifest.objects.count += 1
    manifest.objects.bytes += entry.size
  }
  await writeFile(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2))
  console.log(`backup → ${dir}: ${JSON.stringify(manifest.database.tables)} + ${manifest.objects.count} objects (${manifest.objects.bytes}b)`)
}

// Column-safe insert: only columns present in the current table are written,
// so a backup restores cleanly across additive migrations.
const restoreTable = async (client, table, rows) => {
  if (!rows.length) return 0
  const columns = (await client.query(`select column_name from information_schema.columns where table_name = $1`, [table])).rows.map(row => row.column_name)
  let written = 0
  for (const row of rows) {
    const keys = Object.keys(row).filter(key => columns.includes(key))
    const values = keys.map(key => (typeof row[key] === 'object' && row[key] !== null ? JSON.stringify(row[key]) : row[key]))
    const result = await client.query(
      `insert into ${table} (${keys.map(k => `"${k}"`).join(', ')}) values (${keys.map((_, i) => `$${i + 1}`).join(', ')}) on conflict do nothing`,
      values,
    )
    written += result.rowCount || 0
  }
  return written
}

const walkObjects = async (root, sub = '') => {
  const entries = await readdir(join(root, sub), { withFileTypes: true }).catch(() => [])
  const keys = []
  for (const entry of entries) {
    const rel = sub ? `${sub}/${entry.name}` : entry.name
    if (entry.isDirectory()) keys.push(...(await walkObjects(root, rel)))
    else keys.push(rel)
  }
  return keys
}

// Standalone copy of the server's migration ledger (server/migrations.ts) —
// this script runs under plain node and cannot import the TypeScript module.
const runMigrations = async db => {
  const migrationsDir = fileURLToPath(new URL('../server/migrations/', import.meta.url))
  await db.query(`create table if not exists studio_schema_migrations (
    name text primary key,
    applied_at timestamptz not null default now()
  )`)
  const applied = new Set((await db.query('select name from studio_schema_migrations')).rows.map(row => row.name))
  const files = (await readdir(migrationsDir)).filter(name => /^\d+_.*\.sql$/.test(name)).sort()
  for (const name of files) {
    if (applied.has(name)) continue
    const client = await db.connect()
    try {
      await client.query('begin')
      await client.query(await readFile(join(migrationsDir, name), 'utf8'))
      await client.query('insert into studio_schema_migrations (name) values ($1)', [name])
      await client.query('commit')
    } catch (error) {
      await client.query('rollback')
      throw error
    } finally {
      client.release()
    }
  }
}

const restore = async () => {
  const manifest = JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf8'))
  // Fresh volumes get the schema from the tracked migrations first.
  const client = await database.connect()
  try {
    await runMigrations(database)
    await client.query('begin')
    const restored = {}
    for (const table of TABLES) {
      const rows = JSON.parse(await readFile(join(dir, `${table}.json`), 'utf8'))
      restored[table] = await restoreTable(client, table, rows)
    }
    await client.query('commit')
    if (!(await objects.bucketExists(bucket))) await objects.makeBucket(bucket)
    let objectsWritten = 0
    let objectsSkipped = 0
    for (const key of await walkObjects(join(dir, 'objects'))) {
      const path = join(dir, 'objects', key)
      const file = await stat(path)
      const sha256 = createHash('sha256').update(await readFile(path)).digest('hex')
      if (manifest.objects.sha256[key] && manifest.objects.sha256[key] !== sha256) {
        throw new Error(`backup object ${key} fails its manifest checksum`)
      }
      const present = await objects.statObject(bucket, key).catch(() => null)
      if (present && present.size === file.size) {
        objectsSkipped += 1
        continue
      }
      await objects.putObject(bucket, key, createReadStream(path), file.size)
      const stored = await objects.statObject(bucket, key)
      if (stored.size !== file.size) throw new Error(`restore stored ${stored.size} of ${file.size} bytes for ${key}`)
      objectsWritten += 1
    }
    console.log(`restore ← ${dir}: ${JSON.stringify(restored)} + ${objectsWritten} objects (${objectsSkipped} already present)`)
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
  }
}

try {
  if (command === 'backup') await backup()
  else await restore()
} finally {
  await database.end()
}
