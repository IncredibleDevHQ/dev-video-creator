import { join } from 'node:path'
export const dataRoot =
  process.env.MINIMAL_STUDIO_DATA_DIR ||
  join(process.cwd(), '.minimal-studio-data')
export type RemoteStorageConfig = {
  databaseUrl: string
  bucket: string
  endpoint?: string
  region: string
  forcePathStyle: boolean
  credentials?: {
    accessKeyId: string
    secretAccessKey: string
    sessionToken?: string
  }
  prefix: string
}
export const remoteStorageConfig = (
  env: NodeJS.ProcessEnv = process.env
): RemoteStorageConfig => {
  const databaseUrl = env.MINIMAL_STUDIO_DATABASE_URL
  const bucket = env.MINIMAL_STUDIO_S3_BUCKET
  if (!databaseUrl || !bucket)
    throw new Error('Configure PostgreSQL and the S3 bucket')
  if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket))
    throw new Error('Invalid S3 bucket')
  const endpoint = env.MINIMAL_STUDIO_S3_ENDPOINT || undefined
  if (endpoint) {
    const url = new URL(endpoint)
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password
    )
      throw new Error('Invalid S3 endpoint')
  }
  const accessKeyId = env.MINIMAL_STUDIO_S3_ACCESS_KEY_ID,
    secretAccessKey = env.MINIMAL_STUDIO_S3_SECRET_ACCESS_KEY
  if (Boolean(accessKeyId) !== Boolean(secretAccessKey))
    throw new Error(
      'Configure both S3 credentials or use the AWS credential chain'
    )
  const prefix = (env.MINIMAL_STUDIO_S3_PREFIX || 'notebooks').replace(
    /^\/+|\/+$/g,
    ''
  )
  if (!/^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(prefix))
    throw new Error('Invalid object prefix')
  return {
    databaseUrl,
    bucket,
    endpoint,
    region: env.MINIMAL_STUDIO_S3_REGION || 'us-east-1',
    forcePathStyle: env.MINIMAL_STUDIO_S3_FORCE_PATH_STYLE
      ? env.MINIMAL_STUDIO_S3_FORCE_PATH_STYLE === 'true'
      : Boolean(endpoint),
    credentials:
      accessKeyId && secretAccessKey
        ? {
            accessKeyId,
            secretAccessKey,
            ...(env.MINIMAL_STUDIO_S3_SESSION_TOKEN
              ? { sessionToken: env.MINIMAL_STUDIO_S3_SESSION_TOKEN }
              : {})
          }
        : undefined,
    prefix
  }
}
export const validObjectKey = (key: string) =>
  /^[a-zA-Z0-9_.-]+(?:\/[a-zA-Z0-9_.-]+)*$/.test(key) &&
  !key.split('/').some((part) => part === '.' || part === '..')
export const assetIdOf = (key: string) => key.split('/').at(-1)!.split('.')[0]
export const validStorageId = (id: string) => /^[a-zA-Z0-9_-]+$/.test(id)
