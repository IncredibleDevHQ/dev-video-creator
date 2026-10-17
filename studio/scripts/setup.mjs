import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
if (Number(process.versions.node.split('.')[0]) < 22)
  throw new Error('Install Node 22 or later before setup')
const run = (command, args) => {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit' })
  if (result.error || result.status !== 0) {
    console.error(
      `Setup stopped at ${command}. Fix the reported issue and run yarn setup again.`
    )
    process.exit(result.status || 1)
  }
}
run('yarn', ['install', '--frozen-lockfile'])
run(resolve(root, 'node_modules/.bin/puppeteer'), [
  'browsers',
  'install',
  'chrome'
])
run(process.execPath, ['scripts/doctor.mjs'])
console.log(
  'Setup complete. Run yarn dev, then choose your signed-in AI harness after entering a source.'
)
