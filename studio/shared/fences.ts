// Fenced code in markdown, read line by line closely enough for notes: what
// the cut must close, and what the count must leave as typed (review 6).
// A fence is three or more backticks or tildes, indented under four spaces,
// or under four past a list item's text (on the item's own line too). It is
// closed by the same mark, at least as long, where the block's own fence
// stands; a block in a list item also ends when the item does.

type Open = { char: string; length: number; indent: number; inItem: number }

const widthOf = (lead: string) => lead.replace(/\t/g, '    ').length

/** A reader of lines: `read` says whether each line is code (its fences
 * included); `open` is the block still open, by its fence as it stands. */
export const fenceReader = () => {
  let open: (Open & { fence: string }) | null = null
  // Where a list item's text starts, while the list goes on.
  let item: number | null = null
  const opens = (lead: string, indent: number, mark: string, rest: string) =>
    (indent < 4 || (item !== null && indent >= item && indent - item < 4)) &&
    // A backtick fence's words hold no backtick: "```a```" is inline code.
    (mark[0] === '~' || !rest.includes('`'))
      ? (open = {
          char: mark[0],
          length: mark.length,
          indent,
          inItem: item !== null && indent >= item ? item : 0,
          fence: lead + mark
        })
      : null
  return {
    read(line: string) {
      const lead = /^[ \t]*/.exec(line)![0]
      const indent = widthOf(lead)
      const found = /^[ \t]*(`{3,}|~{3,})(.*)$/.exec(line)
      if (open) {
        // The item its block is in ended: so did the block.
        if (line.trim() && indent < open.inItem) open = null
        else {
          if (
            found &&
            found[1][0] === open.char &&
            found[1].length >= open.length &&
            !found[2].trim() &&
            Math.abs(indent - open.indent) < 4
          )
            open = null
          return true
        }
      }
      const marker = /^([ \t]*(?:[-*+]|\d{1,9}[.)])[ \t]+)(.*)$/.exec(line)
      if (marker) {
        item = widthOf(marker[1])
        // A block that starts on the item's own line.
        const inline = /^(`{3,}|~{3,})(.*)$/.exec(marker[2])
        return Boolean(
          inline && opens(' '.repeat(item), item, inline[1], inline[2])
        )
      }
      if (line.trim() && !indent) item = null
      return Boolean(found && opens(lead, indent, found[1], found[2]))
    },
    get open() {
      return open?.fence || ''
    }
  }
}

/** The fence of the code block still open at the end of `text`, as it
 * stands, if any. */
export const openFence = (text: string) => {
  const reader = fenceReader()
  for (const line of text.split('\n')) reader.read(line)
  return reader.open
}

/** `text` with `change` made to what lies outside fenced code; the code is
 * kept as typed. */
export const outsideFences = (
  text: string,
  change: (part: string) => string
) => {
  const reader = fenceReader()
  const out: string[] = []
  let words: string[] = []
  const flush = () => {
    if (words.length) out.push(change(words.join('\n')))
    words = []
  }
  for (const line of text.split('\n'))
    if (reader.read(line)) {
      flush()
      out.push(line)
    } else words.push(line)
  flush()
  return out.join('\n')
}
