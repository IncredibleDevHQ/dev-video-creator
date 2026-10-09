import { createServer as tcpServer, type Socket } from 'node:net'
import { createServer as httpServer } from 'node:http'
import { once } from 'node:events'
import { it, expect } from 'vitest'
import { HeadBucketCommand } from '@aws-sdk/client-s3'
import { createStorageClients } from './clients'
const config = {
  databaseUrl: 'postgres://fixture:fixture@127.0.0.1:1/fixture',
  bucket: 'fixture-bucket',
  endpoint: 'http://127.0.0.1:1',
  region: 'us-east-1',
  forcePathStyle: true,
  credentials: { accessKeyId: 'fixture', secretAccessKey: 'fixture' },
  prefix: 'notebooks'
}
const limits = { connectMs: 100, queryMs: 100, requestMs: 100, idleMs: 100 }
it('terminates a PostgreSQL connection that accepts TCP but never answers', async () => {
  const sockets = new Set<Socket>(),
    server = tcpServer((socket) => {
      sockets.add(socket)
      socket.on('close', () => sockets.delete(socket))
    })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const port = (server.address() as { port: number }).port
  const { database, objects } = createStorageClients(
    {
      ...config,
      databaseUrl: `postgres://fixture:fixture@127.0.0.1:${port}/fixture`
    },
    limits
  )
  try {
    await expect(database.query('select 1')).rejects.toThrow(/timeout/i)
  } finally {
    objects.destroy()
    for (const socket of sockets) socket.destroy()
    server.close()
    await database.end()
  }
})
it('terminates an S3 request that accepts the connection but never responds', async () => {
  let requests = 0
  const sockets = new Set<Socket>(),
    server = httpServer(() => {
      requests++
    })
  server.on('connection', (socket) => {
    sockets.add(socket)
    socket.on('close', () => sockets.delete(socket))
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const port = (server.address() as { port: number }).port
  const { database, objects } = createStorageClients(
    { ...config, endpoint: `http://127.0.0.1:${port}` },
    limits
  )
  try {
    await expect(
      objects.send(new HeadBucketCommand({ Bucket: config.bucket }))
    ).rejects.toThrow(/timeout|timed out/i)
    expect(requests).toBeGreaterThan(0)
    expect(requests).toBeLessThanOrEqual(2)
  } finally {
    objects.destroy()
    for (const socket of sockets) socket.destroy()
    server.close()
    await database.end()
  }
})
