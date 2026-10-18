import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { IncomingMessage } from 'node:http'
import { Refusal } from './refusal'
import { inspectRepo } from './repo-git'

const run = promisify(execFile)
let choosing = false
/** The local engine receives the real folder path; browsers cannot expose it. */
export const pickRepositoryFolder = async (request: IncomingMessage) => {
  const peer = request.socket.remoteAddress || ''
  if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(peer))
    throw new Refusal('Browse folders on the computer running Studio.')
  if (request.headers.origin) {
    const host = new URL(request.headers.origin).hostname
    if (!['localhost', '127.0.0.1', '[::1]'].includes(host))
      throw new Refusal('Open Studio on localhost to browse local folders.')
  }
  if (choosing)
    throw new Refusal(
      'A folder picker is already open. Choose a folder or cancel it.'
    )
  choosing = true
  try {
    let path = ''
    try {
      const options = { timeout: 120_000, maxBuffer: 16_384 }
      if (process.platform === 'darwin') {
        path = (
          await run(
            'osascript',
            [
              '-e',
              'POSIX path of (choose folder with prompt "Choose a local Git repository for Incredible Studio")'
            ],
            options
          )
        ).stdout.trim()
      } else if (process.platform === 'win32') {
        path = (
          await run(
            'powershell.exe',
            [
              '-NoProfile',
              '-STA',
              '-Command',
              'Add-Type -AssemblyName System.Windows.Forms; $picker = New-Object System.Windows.Forms.FolderBrowserDialog; $picker.Description = "Choose a local Git repository"; if ($picker.ShowDialog() -eq "OK") { $picker.SelectedPath }'
            ],
            options
          )
        ).stdout.trim()
      } else {
        path = (
          await run(
            'zenity',
            [
              '--file-selection',
              '--directory',
              '--title=Choose a local Git repository'
            ],
            options
          )
        ).stdout.trim()
      }
    } catch (error) {
      const failure = error as { code?: number | string; stderr?: string }
      if (
        failure.stderr?.includes('(-128)') ||
        (process.platform !== 'darwin' && failure.code === 1)
      )
        return { repository: null }
      throw new Refusal(
        'Could not open the folder picker. Try again, or paste the repository’s full folder path.'
      )
    }
    return { repository: path ? await inspectRepo(path) : null }
  } finally {
    choosing = false
  }
}
