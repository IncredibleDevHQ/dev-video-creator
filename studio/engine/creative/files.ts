import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { SketchFiles } from '../../render/types'
import { readSubmission } from '../harness/submissions'
export const collectCreativeFiles = async (
  directory: string,
  folder: string,
  supplied: Record<string, Buffer> = {},
  verifyMedia = true
): Promise<SketchFiles> => {
  const files: SketchFiles = {}
  let count = 0,
    total = 0
  const walk = async (relative: string) => {
    for (const entry of await readdir(join(directory, folder, relative), {
      withFileTypes: true
    })) {
      const name = relative ? `${relative}/${entry.name}` : entry.name
      if (entry.isDirectory()) await walk(name)
      else {
        if (++count > 160) throw new Error('Too many production files')
        const original = supplied[name]
        const body = await readSubmission(
          directory,
          `${folder}/${name}`,
          original ? original.length + 1 : 40 * 1024 * 1024
        )
        if (verifyMedia && original && !body.equals(original))
          throw new Error(`Keep the product-supplied media unchanged: ${name}`)
        if (!original && (total += body.length) > 40 * 1024 * 1024)
          throw new Error('Production exceeds the file-size budget')
        files[name] = /\.(html|json|svg|css|js|md|txt)$/.test(name)
          ? body.toString('utf8')
          : {
              base64: body.toString('base64'),
              contentType: 'application/octet-stream'
            }
      }
    }
  }
  await walk('')
  for (const name of Object.keys(supplied))
    if (verifyMedia && !(name in files))
      throw new Error(
        `Copy the product-supplied media into production: ${name}`
      )
  return files
}
