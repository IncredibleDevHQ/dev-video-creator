import type { Pool, PoolClient } from 'pg'
import { notifyNotebook, refreshWatchedNotebooks } from '../notebook-events'

/** One PostgreSQL subscription per worker, independent of open browser tabs. */
export const listenForNotebookWrites = async (database: Pool) => {
  let client: PoolClient | undefined
  let reconnect: ReturnType<typeof setTimeout> | undefined
  let closed = false
  const connect = async () => {
    const connection = await database.connect()
    if (closed) {
      connection.release()
      return
    }
    client = connection
    let listening = false
    const lost = () => {
      if (client !== connection) return
      client = undefined
      connection.release(true)
      if (!closed && listening) retry()
    }
    connection.on('error', lost)
    connection.on('end', lost)
    connection.on('notification', (event) => {
      if (
        !closed &&
        client === connection &&
        event.channel === 'minimal_studio_notebook' &&
        event.payload
      ) {
        notifyNotebook(event.payload)
      }
    })
    try {
      await connection.query('LISTEN minimal_studio_notebook')
      if (client !== connection)
        throw new Error('Notebook subscription disconnected')
      listening = true
      if (!closed) refreshWatchedNotebooks()
    } catch (error) {
      if (client === connection) {
        client = undefined
        connection.release(true)
      }
      throw error
    }
  }
  const retry = () => {
    clearTimeout(reconnect)
    reconnect = setTimeout(() => {
      if (!closed)
        void connect().catch(() => {
          if (!closed) retry()
        })
    }, 2000)
    reconnect.unref()
  }
  await connect()
  return () => {
    closed = true
    clearTimeout(reconnect)
    const connection = client
    client = undefined
    connection?.release(true)
  }
}
