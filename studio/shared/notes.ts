// The notebook's notes have a size limit. A long article the reader cut ends
// with a note saying so; that note is the studio's, so it is not counted.

export const NOTE_LIMIT = 24_000

const CUT = /\s*… \[cut: [^\]]*\]\s*$/

/** How many characters of the notes count against the limit. */
export const notesLength = (text: string) => text.replace(CUT, '').length
