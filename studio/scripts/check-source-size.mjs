// Keep implementation modules reviewable after formatting. Fixtures and tests
// deliberately have a different budget; shipped app/engine/render code does not.
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
const failures = []
async function inspect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) await inspect(path)
    else if (/\.(ts|css)$/.test(path) && !/\.test\.ts$/.test(path)) {
      const lines = (await readFile(path, 'utf8')).trimEnd().split('\n')
      if (lines.length > 800)
        failures.push(`${path}: ${lines.length} lines (limit 800)`)
      lines.forEach((line, index) => {
        if (line.length > 500)
          failures.push(
            `${path}:${index + 1}: ${line.length} characters (limit 500)`
          )
      })
    }
  }
}
for (const directory of ['app', 'engine', 'shared', 'render'])
  await inspect(directory)
if (failures.length) {
  console.error(failures.join('\n'))
  process.exitCode = 1
} else
  console.log(
    'Implementation size limits pass (800 lines/file, 500 characters/line).'
  )
