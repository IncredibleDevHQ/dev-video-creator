// What reads as a link on the start screen: a full http(s) address, a www.
// address, or a bare domain with or without a path. The hint and the engine
// use the same test, so what the hint calls a link is read as one.

const BARE = /^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}(:\d+)?(\/\S*)?$/i

/** The address to read, with https:// added when it was left out; null
 * when the text is not a link. */
export const sourceLink = (text: string): string | null => {
  const value = text.trim()
  if (!value || /\s/.test(value)) return null
  if (/^https?:\/\/\S+$/i.test(value)) return value
  if (/^www\.\S+$/i.test(value) || BARE.test(value)) return `https://${value}`
  return null
}
