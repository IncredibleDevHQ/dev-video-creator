// A notebook's local draft keeps edits the store has not acknowledged yet.
// It outranks the store's copy when the notebook opens — but only while it
// holds such edits. A draft that matches the copy it started from, or the
// store's copy now, holds none: letting it win would put back an older
// notebook over an edit made elsewhere (another window, or a tool that
// stamps the notebook on the server).

// The store keeps documents as jsonb, which reorders object keys: two copies
// of one notebook compare equal only in a canonical key order.
export const canonicalJson = (value: unknown): string =>
  JSON.stringify(value, (_key, entry: unknown) =>
    entry && typeof entry === 'object' && !Array.isArray(entry)
      ? Object.fromEntries(Object.entries(entry as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : entry,
  )

export const sameDocument = (a: unknown, b: unknown) => a !== null && a !== undefined && b !== null && b !== undefined && canonicalJson(a) === canonicalJson(b)

// Whether a draft still holds edits of its own: it differs both from the
// copy it was based on and from the store's copy now.
export const draftHoldsEdits = (draft: unknown, base: unknown, stored: unknown) =>
  draft !== null && draft !== undefined && !sameDocument(draft, base) && !sameDocument(draft, stored)
