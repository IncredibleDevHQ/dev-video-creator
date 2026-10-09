// The notebook's notes have a size limit. A long article the reader cut ends
// with a note saying so; that note is the studio's, so it is not counted.

export const NOTE_LIMIT = 24_000

// The note as the reader writes it, and as the editor's markdown escapes it.
const CUT = /\s*… \\?\[cut: [^\]]*?\\?\]\s*$/
// The editor's markdown puts a backslash before some characters; the
// creator sees one character there, so one is counted (review 6).
const ESCAPED = /\\([\\`*_{}[\]()#+\-.!|>~<])/g

/** How many characters of the notes count against the limit. */
export const notesLength = (text: string) =>
  text.replace(CUT, '').replace(ESCAPED, '$1').length
