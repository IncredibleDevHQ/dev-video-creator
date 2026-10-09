// The notebook's notes have a size limit. A long article the reader cut ends
// with a note saying so; that note is the studio's, so it is not counted.

export const NOTE_LIMIT = 24_000

// The note as the reader writes it, and as the editor's markdown escapes it,
// or moves it inside a table or a code block it closes after the note.
const CUT = /\s*… \\?\[cut: [^\]]*?\\?\](?:\s*\|)*\s*(?:(?:`{3,}|~{3,})\s*)?$/
// The editor's markdown writes some characters as an entity (&amp;) or
// with a backslash before them (\_), and pads tables and breaks with
// spaces: the creator sees one character, or one space, so one is counted
// (review 6: a cut article read as over the limit after any edit).
const ENTITY = /&(?:amp|lt|gt|quot|#39|nbsp);/g
const ESCAPED = /\\([\\`*_{}[\]()#+\-.!|>~<])/g
// It also widens a table's divider to its column (| --- | to | ------ |) and
// writes a bare link as [link](link): the creator wrote neither, so each
// counts as the reader wrote it.
const DIVIDER_ROW = /^\s*\|?(?:\s*:?-{3,}:?\s*\|)+\s*(?::?-{3,}:?)?\s*$/
const BARE_LINK = /\[([^\]\n]+)\]\(\1\)|<(https?:\/\/[^>\s]+)>/g

/** How many characters of the notes count against the limit. */
export const notesLength = (text: string) =>
  text
    .replace(CUT, '')
    .replace(ENTITY, '&')
    .replace(ESCAPED, '$1')
    .replace(BARE_LINK, (_, text: string, url: string) => text || url)
    .replace(/^.*$/gm, (line) =>
      DIVIDER_ROW.test(line) ? line.replace(/-{4,}/g, '---') : line
    )
    .replace(/\s+/g, ' ')
    .trim().length
