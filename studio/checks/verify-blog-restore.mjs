import { spawn } from 'node:child_process'
import { resolve, join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { disposableStorage } from './disposable-storage.mjs'
import { restoreBlogFixture } from './restore-blog-fixture.mjs'
const storage = await disposableStorage()
const app = join(dirname(fileURLToPath(import.meta.url)), '..')
try {
  await restoreBlogFixture(resolve(process.argv[2]), storage.env)
  await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ['--import', 'tsx', 'checks/verify-blog-restore.live.ts'],
      {
        cwd: app,
        env: {
          ...process.env,
          ...storage.env,
          MINIMAL_STUDIO_DATA_DIR: join(storage.root, 'empty-worker')
        },
        stdio: 'inherit'
      }
    )
    child.once('error', reject)
    child.once('exit', (code) =>
      code === 0
        ? resolve()
        : reject(new Error('Restored fixture verification failed'))
    )
  })
} finally {
  await storage.cleanup()
}
