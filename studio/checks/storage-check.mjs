// Disposable containers only: never connects to the creator's services.
import { spawn } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { disposableStorage } from './disposable-storage.mjs'
const studioRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const run = (mode, env) =>
  new Promise((resolve, reject) => {
    const child = spawn(
      join(studioRoot, 'node_modules/.bin/tsx'),
      [join(studioRoot, 'checks/storage.live.ts'), mode],
      {
        cwd: studioRoot,
        env: { ...process.env, ...env },
        stdio: 'inherit',
        timeout: 120000,
        killSignal: 'SIGKILL'
      }
    )
    child.once('error', reject)
    child.once('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`Storage ${mode} failed`))
    )
  })
const { root, env, cleanup } = await disposableStorage()
try {
  await run('seed', {
    ...env,
    MINIMAL_STUDIO_DATA_DIR: join(root, 'worker-one')
  })
  // The second worker uses the SDK's normal AWS credential chain, while
  // keeping the same disposable S3-compatible endpoint and stored objects.
  await run('resume', {
    ...env,
    MINIMAL_STUDIO_S3_ACCESS_KEY_ID: '',
    MINIMAL_STUDIO_S3_SECRET_ACCESS_KEY: '',
    AWS_ACCESS_KEY_ID: 'fixture-user',
    AWS_SECRET_ACCESS_KEY: 'disposable-fixture-password',
    AWS_SESSION_TOKEN: '',
    MINIMAL_STUDIO_DATA_DIR: join(root, 'worker-two')
  })
  await run('verify-media', {
    ...env,
    MINIMAL_STUDIO_S3_ACCESS_KEY_ID: '',
    MINIMAL_STUDIO_S3_SECRET_ACCESS_KEY: '',
    AWS_ACCESS_KEY_ID: 'fixture-user',
    AWS_SECRET_ACCESS_KEY: 'disposable-fixture-password',
    AWS_SESSION_TOKEN: '',
    MINIMAL_STUDIO_DATA_DIR: join(root, 'worker-three')
  })
} finally {
  await cleanup()
}
