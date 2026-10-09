import { it, expect } from 'vitest'
import { remoteStorageConfig, validObjectKey } from './config'
const base = {
  MINIMAL_STUDIO_DATABASE_URL: 'postgres://fixture@localhost/fixture',
  MINIMAL_STUDIO_S3_BUCKET: 'fixture-bucket'
}
it('uses explicit MinIO endpoint and credentials without tying the adapter to MinIO', () => {
  const config = remoteStorageConfig({
    ...base,
    MINIMAL_STUDIO_S3_ENDPOINT: 'http://127.0.0.1:9000',
    MINIMAL_STUDIO_S3_ACCESS_KEY_ID: 'fixture',
    MINIMAL_STUDIO_S3_SECRET_ACCESS_KEY: 'fixture-secret'
  })
  expect(config.endpoint).toBe('http://127.0.0.1:9000')
  expect(config.forcePathStyle).toBe(true)
  expect(config.credentials?.accessKeyId).toBe('fixture')
})
it('supports AWS regional endpoints and workload credentials by omission', () => {
  const config = remoteStorageConfig({
    ...base,
    MINIMAL_STUDIO_S3_REGION: 'ap-south-1'
  })
  expect(config.endpoint).toBeUndefined()
  expect(config.credentials).toBeUndefined()
  expect(config.forcePathStyle).toBe(false)
  expect(config.region).toBe('ap-south-1')
})
it('rejects credentials embedded in the endpoint and partial credential pairs', () => {
  expect(() =>
    remoteStorageConfig({
      ...base,
      MINIMAL_STUDIO_S3_ENDPOINT: 'https://user:password@example.com'
    })
  ).toThrow('Invalid S3 endpoint')
  expect(() =>
    remoteStorageConfig({ ...base, MINIMAL_STUDIO_S3_ACCESS_KEY_ID: 'fixture' })
  ).toThrow('both S3 credentials')
  expect(validObjectKey('notebooks/id/scenes/scene/voice/a.mp3')).toBe(true)
  expect(validObjectKey('notebooks/id/../../secret')).toBe(false)
})
