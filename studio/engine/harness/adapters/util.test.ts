import { expect, it } from 'vitest'
import { spawnJsonLines } from './util'
it('does not launch a process for an already aborted request', async () => {
  const controller = new AbortController()
  controller.abort()
  const onLine = () => {
    throw new Error('Must not execute')
  }
  expect(
    await spawnJsonLines({
      command: process.execPath,
      args: ['-e', 'console.log("ran")'],
      cwd: process.cwd(),
      onLine,
      signal: controller.signal
    })
  ).toEqual({ exitCode: 130 })
})
it.skipIf(process.platform === 'win32')(
  'terminates tool descendants when cancelling the harness',
  async () => {
    const controller = new AbortController()
    let descendant = 0
    const result = await spawnJsonLines({
      command: process.execPath,
      args: [
        '-e',
        `const {spawn}=require('node:child_process');const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'inherit'});console.log(child.pid);setInterval(()=>{},1000)`
      ],
      cwd: process.cwd(),
      signal: controller.signal,
      onLine: (line) => {
        descendant = Number(line)
        controller.abort()
      }
    })
    expect(result.exitCode).toBe(130)
    expect(descendant).toBeGreaterThan(0)
    await expect
      .poll(
        () => {
          try {
            process.kill(descendant, 0)
            return false
          } catch {
            return true
          }
        },
        { timeout: 4000 }
      )
      .toBe(true)
  }
)
