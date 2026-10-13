// The notebook's notes have a size limit. A long article the reader cut ends
// with a note saying so; that note is the studio's, so it is not counted.
import { outsideFences } from './fences'

export const NOTE_LIMIT = 24_000
// The most text one save or paste sends, its links and markup with it: past
// it the request itself is refused, so the studio says so first (review 6).
export const NOTE_SIZE_LIMIT = 500_000
export const TOO_LARGE = 'Shorten the notes; they are too large to send'

// The note as the reader writes it, and as the editor's markdown escapes it,
// or moves it inside a table or a code block it closes after the note.
// Matched from its first character, its words short and on one line, so
// no search runs far; the spaces before it go with the rest.
const CUT =
  /… \\?\[cut: [^\]\n]{0,200}?\\?\](?:\s*\|)*\s*(?:(?:`{3,}|~{3,})\s*)?$/
// The editor's markdown writes some characters as an entity (&amp;) or
// with a backslash before them (\_), and pads tables and breaks with
// spaces: the creator sees one character, or one space, so one is counted
// (review 6: a cut article read as over the limit after any edit).
const ENTITY = /&(amp|lt|gt|quot|#39|nbsp);/g
const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  '#39': "'",
  nbsp: ' '
}
const ESCAPED = /\\([\\`*_{}[\]()#+\-.!|>~<])/g
// It also widens a table's divider to its column (| --- | to | ------ |).
const DIVIDER_ROW = /^\s*\|?(?:\s*:?-{3,}:?\s*\|)+\s*(?::?-{3,}:?)?\s*$/
// And it writes every link as [its words](where it goes): a bare one as
// [www.x](http://www.x), a shared reference in full each time it is used.
// The creator sees the words, so they count, never where the link goes. A
// link starts after a space or a mark, never inside a word (handlers[n](e)
// is code), and its words hold no bracket, so a run of them is read once.
const LINK =
  /(?<![\w\\])!?\[([^[\]\n]{0,500})\]\((?:[^()\s]|\([^()\s]*\))*(?:\s+"[^"\n]*")?\)|<((?:https?|mailto):[^>\s]+)>/g
// A link's definition as markdown writes one: a label, where it goes (a web
// or mail address, a path, an anchor) and at most a title. A line that says
// more ("[Host]: Welcome back") is the creator's words, and so is a footnote.
const REFERENCE =
  /^ {0,3}\[(?!\^)[^\]\n]+\]:[ \t]*(?:<[^>\n]*>|(?:[a-z][a-z0-9+.-]*:|\.{0,2}\/|#|www\.)\S*)(?:[ \t]+(?:"[^"\n]*"|'[^'\n]*'|\([^)\n]*\)))?[ \t]*$/gim

// A table's row however the editor pads it: compact (|a|b|), padded to its
// widest cell, with outer pipes or without, it is one row of cells.
const TABLE_ROW = /\|/

/**
 * The notes as the creator sees them, padding and escapes taken away: what
 * counts against the limit, and the words to read when a part must do.
 */
export const compactNotes = (text: string) =>
  outsideFences(text.replace(CUT, ''), (words) =>
    // Definitions and links first, as typed: an escaped bracket is the
    // creator's own (\[Host\]: …, \[x\](y)), never a link.
    words
      .replace(REFERENCE, '')
      .replace(LINK, (_, label?: string, url?: string) => label ?? url ?? '')
      .replace(ENTITY, (_, name: string) => ENTITIES[name])
      .replace(ESCAPED, '$1')
  )
    // A run of spaces is one space, and a break one character; lines stay
    // lines, for the words read from them. Each run is read once, so a long
    // one costs no more than its length.
    .replace(/[^\S\n]+/g, ' ')
    .replace(/^.*$/gm, (line) =>
      DIVIDER_ROW.test(line)
        ? line
            .replace(/-{4,}/g, '---')
            .replace(/ ?\| ?/g, '|')
            .replace(/^\||\|$/g, '')
        : TABLE_ROW.test(line)
          ? line.replace(/ ?\| ?/g, '|').replace(/^\||\|$/g, '')
          : line
    )
    .replace(/ ?\n\s*/g, '\n')
    .trim()

/** How many characters of the notes count against the limit. */
export const notesLength = (text: string) => compactNotes(text).length

/** A code fence longer than any run of backticks in `code`, so the code
 * can't close its own block. */
export const codeFence = (code: string) => {
  let longest = 2
  for (const run of code.match(/`+/g) || [])
    longest = Math.max(longest, run.length)
  return '`'.repeat(longest + 1)
}
