// The checks' findings in the creator's words. The checker writes for the
// producer (moment ids, then the fix to make); a stopped scene and the
// activity say what it found plainly: "Moment 3 needs one more visible
// change" (review 6: the scene said only that time ran out).
import { SECONDS_PER_CHANGE } from './motion-checks'

/** How an accepted build with a finding is said, in the activity and on the scene. */
export const ACCEPTED_WITH_WARNING = 'Accepted with a warning: '

const NUMBERS = ['no', 'one', 'two', 'three', 'four', 'five', 'six']
const many = (count: number, thing: string) =>
  `${NUMBERS[count] ?? count} ${thing}${count === 1 ? '' : 's'}`

/** What a finding found: the words before its first colon outside quotes
 * (a label such as “Step 1: Retrieve” stays whole); how to fix it follows. */
const finding = (problem: string) => {
  let quoted = 0
  for (let at = 0; at < problem.length - 1; at++) {
    if (problem[at] === '“') quoted++
    else if (problem[at] === '”') quoted = Math.max(0, quoted - 1)
    else if (!quoted && problem[at] === ':' && problem[at + 1] === ' ')
      return problem.slice(0, at)
  }
  return problem
}

/** A check's finding in a few plain words, its moments by number. */
export const plainCheck = (problem: string, moments: Array<{ id: string }>) => {
  let said = finding(problem).trim()
  moments.forEach((moment, index) => {
    said = said.split(moment.id).join(`moment ${index + 1}`)
  })
  said = said.replace(/\S+-moment-[0-9a-f]+\b/g, 'a moment')
  const sparse =
    /^moment (\d+) changes its picture (?:once|(\d+) times) in ([\d.]+) s$/.exec(
      said
    )
  if (sparse) {
    const made = sparse[2] === undefined ? 1 : Number(sparse[2])
    const short = Math.max(
      1,
      Math.floor(Number(sparse[3]) / SECONDS_PER_CHANGE) - made
    )
    return `Moment ${sparse[1]} needs ${many(short, 'more visible change')}`
  }
  const still = /^moment (\d+) holds one still frame for ([\d.]+ s)/.exec(said)
  if (still) return `Moment ${still[1]} holds one picture still for ${still[2]}`
  const empty = /^moment (\d+) shows an empty frame for ([\d.]+ s)/.exec(said)
  if (empty) return `Moment ${empty[1]} shows an empty frame for ${empty[2]}`
  const cut = /^moment (\d+) cuts (“[^”]*”) at the frame’s edge/.exec(said)
  if (cut) return `Moment ${cut[1]} cuts ${cut[2]} at the frame’s edge`
  // A finding about the frames names its moments; one about the code does
  // not, and is the producer's to fix, so it is said as that.
  if (!/\bmoments?\b/i.test(said))
    return 'Its code had a fault the producer was still fixing'
  const text = said.length > 140 ? `${said.slice(0, 139)}…` : said
  return text.charAt(0).toUpperCase() + text.slice(1)
}
