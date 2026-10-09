import type { Snapshot } from '../shared/api'
import { loadProject } from './projects'
import { withProgress } from './progress'
import { watchNotebook } from './notebook-events'

type Listener = (snapshot: Snapshot) => void
// One refresh per changed notebook, regardless of its number of viewers.
const streams = new Map<
  string,
  {
    listeners: Set<Listener>
    stop: () => void
    latest?: Snapshot
    refresh: () => Promise<void>
  }
>()
export const watchSnapshots = (id: string, listener: Listener) => {
  let stream = streams.get(id)
  const opening = !stream
  if (!stream) {
    let running = false,
      pending = false,
      previous = ''
    const listeners = new Set<Listener>()
    const refresh = async () => {
      if (running) {
        pending = true
        return
      }
      running = true
      try {
        do {
          pending = false
          const snapshot = await withProgress(await loadProject(id))
          if (!snapshot) continue
          const serialized = JSON.stringify(snapshot)
          if (serialized === previous) continue
          previous = serialized
          entry.latest = snapshot
          for (const client of listeners) client(snapshot)
        } while (pending && listeners.size)
      } finally {
        running = false
      }
    }
    const entry = {
      listeners,
      refresh,
      stop: watchNotebook(id, () => {
        void refresh().catch(() => {})
      }),
      latest: undefined as Snapshot | undefined
    }
    stream = entry
    streams.set(id, entry)
  }
  stream.listeners.add(listener)
  if (stream.latest) listener(stream.latest)
  else if (opening) void stream.refresh().catch(() => {})
  return () => {
    stream!.listeners.delete(listener)
    if (!stream!.listeners.size) {
      stream!.stop()
      streams.delete(id)
    }
  }
}
