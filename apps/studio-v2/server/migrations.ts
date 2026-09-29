// Tracked, ordered SQL migrations (D0a): every migrations/NNN_*.sql file
// runs once, in name order, inside a transaction, and is recorded in
// studio_schema_migrations. Startup no longer re-runs one big untracked SQL
// file, and schema changes ship as ordered, auditable steps.
import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import type { Pool } from 'pg'

const migrationsDir = fileURLToPath(new URL('./migrations/', import.meta.url))

// The migration files, in the order they run.
export const migrationFiles = async () =>
  (await readdir(migrationsDir)).filter(name => /^\d+_.*\.sql$/.test(name)).sort()

// The migrations a database has recorded, without running any (yarn
// studio:doctor): none before the ledger exists.
export const appliedMigrations = async (database: Pool): Promise<string[]> => {
  const ledger = await database.query<{ name: string | null }>(`select to_regclass('studio_schema_migrations')::text as name`)
  if (!ledger.rows[0]?.name) return []
  return (await database.query<{ name: string }>('select name from studio_schema_migrations order by name')).rows.map(row => row.name)
}

export const runMigrations = async (database: Pool): Promise<string[]> => {
  await database.query(`create table if not exists studio_schema_migrations (
    name text primary key,
    applied_at timestamptz not null default now()
  )`)
  const applied = new Set(
    (await database.query<{ name: string }>('select name from studio_schema_migrations')).rows.map(
      row => row.name,
    ),
  )
  const files = await migrationFiles()
  for (const name of files) {
    if (applied.has(name)) continue
    const sql = await readFile(join(migrationsDir, name), 'utf8')
    const client = await database.connect()
    try {
      await client.query('begin')
      await client.query(sql)
      await client.query('insert into studio_schema_migrations (name) values ($1)', [name])
      await client.query('commit')
    } catch (error) {
      await client.query('rollback')
      throw new Error(
        `Migration ${name} failed: ${error instanceof Error ? error.message : String(error)}`,
      )
    } finally {
      client.release()
    }
  }
  return files
}
