import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runCommand } from './voice'
import { storeAsset } from './persistence'
import { Refusal } from './refusal'
export const uploadLogo = async (body: Buffer, contentType: string) => {
  if (
    !body.length ||
    body.length > 5000000 ||
    !['image/png', 'image/jpeg', 'image/webp'].includes(contentType)
  )
    throw new Refusal('Choose a PNG, JPEG or WebP logo under 5 MB')
  const dir = await mkdtemp(join(tmpdir(), 'minimal-brand-logo-'))
  try {
    const input = join(dir, 'image')
    const output = join(dir, 'logo.png')
    await writeFile(input, new Uint8Array(body))
    await runCommand('ffmpeg', [
      '-y',
      '-i',
      input,
      '-vf',
      'scale=512:512:force_original_aspect_ratio=decrease',
      '-frames:v',
      '1',
      output
    ])
    return await storeAsset({
      body: await readFile(output),
      contentType: 'image/png',
      extension: '.png',
      kind: 'brand-logo'
    })
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}
