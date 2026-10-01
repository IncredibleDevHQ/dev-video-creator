import { mkdir, readFile, writeFile, rename, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID, createHash } from 'node:crypto'
import { dataRoot } from './config'
const pathFor = (kind: string, id: string) => {
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error('Invalid storage id')
  return join(dataRoot, kind, `${id}.json`)
}
export const initializePersistence = () =>
  mkdir(dataRoot, { recursive: true, mode: 0o700 })
export const readRow = async <T>(
  kind: string,
  id: string
): Promise<T | null> => {
  try {
    return JSON.parse(await readFile(pathFor(kind, id), 'utf8')) as T
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}
export const writeRow = async (kind: string, id: string, value: unknown) => {
  const path = pathFor(kind, id)
  await mkdir(join(dataRoot, kind), { recursive: true, mode: 0o700 })
  const temporary = `${path}.${randomUUID()}.tmp`
  await writeFile(temporary, JSON.stringify(value), { mode: 0o600 })
  await rename(temporary, path)
}
export const loadSetting = (key: string) => readRow<unknown>('settings', key)
export const saveSetting = (key: string, value: unknown) =>
  writeRow('settings', key, value)
export const storeAsset = async (input: {
  body: Buffer
  contentType: string
  projectId?: string
  kind: string
  extension: string
  sceneId?: string
  momentId?: string
}) => {
  const id = randomUUID()
  const extension = /^\.[a-z0-9]+$/i.test(input.extension)
    ? input.extension
    : '.bin'
  const objectKey = `${id}${extension}`
  await mkdir(join(dataRoot, 'objects'), { recursive: true, mode: 0o700 })
  await writeFile(
    join(dataRoot, 'objects', objectKey),
    new Uint8Array(input.body)
  )
  await writeRow('assets', id, {
    sha256: createHash('sha256').update(input.body).digest('hex'),
    contentType: input.contentType,
    objectKey,
    projectId: input.projectId,
    sceneId: input.sceneId,
    momentId: input.momentId,
    kind: input.kind
  })
  return { id, objectKey }
}

export const listRows = async (kind: string) => {
  if (!/^[a-zA-Z0-9_-]+$/.test(kind)) throw new Error('Invalid storage kind')
  try {
    return (await readdir(join(dataRoot, kind)))
      .filter((name) => /^[a-zA-Z0-9_-]+\.json$/.test(name))
      .map((name) => name.slice(0, -5))
      .sort()
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
}

export const readAsset = async (key: string) => {
  const body = await readFile(join(dataRoot, 'objects', key))
  const asset = await readRow<{ sha256?: string }>('assets', key.split('.')[0])
  if (
    asset?.sha256 &&
    createHash('sha256').update(body).digest('hex') !== asset.sha256
  )
    throw new Error('Stored artifact checksum mismatch')
  return body
}
export const deleteRow = async (kind: string, id: string) => {
  const { rm } = await import('node:fs/promises')
  await rm(pathFor(kind, id), { force: true })
}
export const deleteAsset = async (key: string) => {
  const { rm } = await import('node:fs/promises')
  await rm(join(dataRoot, 'objects', key), { force: true })
  await deleteRow('assets', key.split('.')[0])
}
export const closePersistence = async () => {}
export const listNotebookRows = async (kind: string, projectId: string) => {
  const ids = []
  for (const id of await listRows(kind)) {
    const row = await readRow<{ projectId?: string; notebookId?: string }>(
      kind,
      id
    )
    if (row?.projectId === projectId || row?.notebookId === projectId)
      ids.push(id)
  }
  return ids
}

const operations = new Set<string>()
export const withOperationLock = async <T>(
  key: string,
  work: () => Promise<T>
): Promise<T> => {
  if (operations.has(key)) throw new Error('This operation is already running')
  operations.add(key)
  try {
    return await work()
  } finally {
    operations.delete(key)
  }
}
