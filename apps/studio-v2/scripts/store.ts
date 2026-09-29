// The durable store — local PostgreSQL and MinIO — made ready, or looked at,
// from the command line (yarn studio:setup, yarn studio:doctor): the same
// ordered migrations and the same bucket the worker prepares when it starts,
// never a copy of them.
//
//   tsx scripts/store.ts prepare   run the migrations not yet recorded; make the bucket
//   tsx scripts/store.ts check     say what is recorded and what is pending; change nothing
//
// Prints one JSON line. Exits 1 when the store cannot be reached. Nothing it
// prints carries a credential: the database address is shown without its
// password, and a harness's last failure only by its category.
import { Client as MinioClient } from 'minio'
import pg from 'pg'
import { appliedMigrations, migrationFiles, runMigrations } from '../server/migrations'

const databaseUrl = process.env.STUDIO_DATABASE_URL || 'postgres://incredible:incredible@127.0.0.1:54329/incredible_studio'
const bucket = process.env.STUDIO_MINIO_BUCKET || 'incredible-studio'
const objects = new MinioClient({
  endPoint: process.env.STUDIO_MINIO_ENDPOINT || '127.0.0.1',
  port: Number(process.env.STUDIO_MINIO_PORT || 59000),
  useSSL: process.env.STUDIO_MINIO_USE_SSL === 'true',
  accessKey: process.env.STUDIO_MINIO_ACCESS_KEY || 'incredible',
  secretKey: process.env.STUDIO_MINIO_SECRET_KEY || 'SuperSecretRootPwd',
})
const database = new pg.Pool({ connectionString: databaseUrl, max: 1, connectionTimeoutMillis: 5_000 })

const withoutPassword = (url: string) => {
  try {
    const parsed = new URL(url)
    return `${parsed.protocol}//${parsed.username ? `${parsed.username}@` : ''}${parsed.host}${parsed.pathname}`
  } catch {
    return 'the configured database'
  }
}

const mode = process.argv[2] === 'check' ? 'check' : 'prepare'
try {
  const before = await appliedMigrations(database)
  if (mode === 'prepare') {
    await runMigrations(database)
    if (!(await objects.bucketExists(bucket))) await objects.makeBucket(bucket)
  }
  const applied = await appliedMigrations(database)
  const files = await migrationFiles()
  const bucketReady = await objects.bucketExists(bucket).catch(() => false)
  // Each harness's newest finished run: whether it last worked, and when.
  const harnesses: Record<string, { state: string; at: string; failure?: string; next?: string }> = {}
  if (applied.includes('011_run_failures.sql')) {
    const rows = await database.query<{ adapter: string; status: string; finished_at: Date; failure: { category?: string; recovery?: string[] } | null }>(
      `select distinct on (adapter) adapter, status, finished_at, failure from studio_build_runs
       where finished_at is not null order by adapter, finished_at desc`,
    )
    for (const row of rows.rows) {
      harnesses[row.adapter] = {
        state: row.status === 'error' ? 'error' : row.status,
        at: row.finished_at.toISOString(),
        ...(row.failure?.category ? { failure: row.failure.category } : {}),
        // The first way on that the run's failure named (provider-errors.ts).
        ...(row.failure?.recovery?.[0] ? { next: row.failure.recovery[0] } : {}),
      }
    }
  }
  console.log(JSON.stringify({
    ok: true,
    database: withoutPassword(databaseUrl),
    migrations: { recorded: applied.length, total: files.length, pending: files.filter(name => !applied.includes(name)), appliedNow: applied.filter(name => !before.includes(name)) },
    bucket: { name: bucket, ready: bucketReady },
    harnesses,
  }))
} catch (error) {
  console.log(JSON.stringify({ ok: false, database: withoutPassword(databaseUrl), error: error instanceof Error ? error.message : String(error) }))
  process.exitCode = 1
} finally {
  await database.end().catch(() => undefined)
}
