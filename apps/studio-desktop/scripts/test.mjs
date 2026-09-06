// test = build (done by the package script) + smoke + product test against
// the app's live origin. Starts the app in smoke mode with --keep-running,
// waits for `SMOKE PASS` and the printed origin, runs product-test.mjs
// against it, then shuts the app down.
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const appDir = fileURLToPath(new URL('..', import.meta.url))
const require = createRequire(import.meta.url)
// The electron package resolves to the Electron binary path outside Electron.
const electronBinary = require('electron')

const child = spawn(electronBinary, ['.', '--smoke', '--keep-running'], {
  cwd: appDir,
  env: { ...process.env, STUDIO_ALLOW_MULTI_INSTANCE: '1' },
  stdio: ['ignore', 'pipe', 'inherit'],
})

const killAndWait = async () => {
  if (child.exitCode !== null) return
  child.kill('SIGTERM')
  await new Promise(resolve => child.once('exit', resolve))
}

const waitForSmoke = () =>
  new Promise((resolve, reject) => {
    let buffer = ''
    const timeout = setTimeout(
      () => reject(new Error('timed out waiting for the smoke probe')),
      90_000,
    )
    const done = (error, origin) => {
      clearTimeout(timeout)
      if (error) reject(error)
      else resolve(origin)
    }
    child.stdout.on('data', chunk => {
      process.stdout.write(chunk)
      buffer += chunk.toString()
      const failure = buffer.match(/SMOKE FAIL: ([^\n]+)/)
      if (failure) return done(new Error(`SMOKE FAIL: ${failure[1]}`))
      const origin = buffer.match(/STUDIO_ORIGIN (\S+)/)
      if (buffer.includes('SMOKE PASS') && origin) return done(null, origin[1])
    })
    child.once('exit', code => done(new Error(`app exited early (${code})`)))
  })

let origin
try {
  origin = await waitForSmoke()
} catch (error) {
  await killAndWait()
  console.error(error.message || error)
  process.exit(1)
}

let code = 1
try {
  code = await new Promise(resolve => {
    const productTest = spawn(
      process.execPath,
      [fileURLToPath(new URL('product-test.mjs', import.meta.url)), origin],
      { stdio: 'inherit' },
    )
    productTest.on('exit', exitCode => resolve(exitCode ?? 1))
  })
} finally {
  await killAndWait()
}
process.exit(code)
