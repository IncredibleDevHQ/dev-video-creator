// Persistence emits only after a successful write. Runs and notebook mutations
// share this channel so the stream never needs to poll either store.
const listeners = new Map<string, Set<() => void>>()
export const notifyNotebook = (id: string) =>
  listeners.get(id)?.forEach((listener) => listener())
// Catch up after a database subscription reconnects; missed notifications do
// not need an idle polling loop.
export const refreshWatchedNotebooks = () => {
  for (const id of listeners.keys()) notifyNotebook(id)
}
export const watchNotebook = (id: string, listener: () => void) => {
  const set = listeners.get(id) || new Set()
  set.add(listener)
  listeners.set(id, set)
  return () => {
    set.delete(listener)
    if (!set.size) listeners.delete(id)
  }
}
