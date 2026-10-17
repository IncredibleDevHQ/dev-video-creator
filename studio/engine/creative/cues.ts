// When each phrase of a moment is said, on the build's clock. A scene is
// built on its planned lengths and stretched to the voice afterwards, moment
// by moment, so a phrase placed by its share of the moment's words lands
// about where the voice says it. Without these the producer knew only when a
// moment starts, and put everything there (seen live: each change made in
// the first second, then a frozen frame while the voice went on).

export type SpokenCue = { at: number; says: string }

const words = (text: string) => text.split(/\s+/).filter(Boolean).length

/** A moment's lines as phrases: sentences, split again at a dash or colon. */
export const phrasesOf = (lines: string[]) => {
  const phrases: string[] = []
  // A fragment of a few words is said with the phrase after it.
  let carry = ''
  for (const line of lines)
    for (const part of line
      .split(/(?<=[.!?;:])\s+|\s+[—–]\s+|(?<=\S)[—–](?=\S)/)
      .map((piece) => piece.trim())
      .filter(Boolean)) {
      const phrase = carry ? `${carry} ${part}` : part
      if (words(phrase) < 4) carry = phrase
      else {
        phrases.push(phrase)
        carry = ''
      }
    }
  if (carry && phrases.length) phrases[phrases.length - 1] += ` ${carry}`
  else if (carry) phrases.push(carry)
  return phrases
}

/** Each phrase with the time it starts being said, start to end. */
export const spokenCues = (
  lines: string[],
  start: number,
  end: number
): SpokenCue[] => {
  const phrases = phrasesOf(lines)
  const weight = (text: string) => text.replace(/[^\p{L}\p{N}]/gu, '').length
  const total = phrases.reduce((sum, phrase) => sum + weight(phrase), 0)
  if (!total || !(end > start)) return []
  let said = 0
  return phrases.map((phrase) => {
    const at = start + (said / total) * (end - start)
    said += weight(phrase)
    return { at: Math.round(at * 10) / 10, says: phrase }
  })
}
