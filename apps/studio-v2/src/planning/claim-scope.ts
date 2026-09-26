// What a scene plan claims more strongly than its sources (B07 of the BoltDB
// review). The copy-on-write plan asked how readers and writers run "without
// locks" and said "nobody blocks anybody": the source had simplified, and the
// plan made the simplification a guarantee. After a direction asked for the
// narrower claim, the plan's last spoken line still made it.
//
// Nothing here judges what is true. It finds the absolute language in what
// the plan asks, says and shows, with whether the plan's own evidence says
// it as strongly; and any phrase the creator's direction asked to drop that
// the plan still says. They are shown with the plan, before it is approved.
import type { ExplanationBriefV1 } from './explanation-brief'
import type { SceneTreatmentV1 } from './scene-treatment'

export type ClaimFlag = {
  kind: 'absolute' | 'direction'
  // Where the plan says it: the question, the takeaway, or a moment's line
  // or on-screen text.
  where: string
  // The words that make the claim, and the sentence they are in.
  phrase: string
  text: string
  // The plan's evidence that says it too, when some does.
  evidence: string | null
}

// Universal claims: never, always, nobody, no locks, a guarantee — and the
// flat "does not block" of a concurrency mechanism, which holds only in the
// case a source simplified to.
const ABSOLUTE = /\b(?:never|always|nobody|no one|nothing can|no locks?|lock[- ]free|without (?:any )?(?:locks?|locking|waiting|blocking|coordination|contention)|no (?:waiting|blocking|contention)|guarantee[sd]?|impossible|at no point|under no circumstances|(?:(?:do|does|will|can)(?: not|n['’]t)|cannot) (?:ever )?(?:block|wait|lock|contend)\w*)\b/gi
const normal = (text: string) => text.toLowerCase().replace(/[‘’]/g, "'").replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim()

// The plan's texts a viewer hears or reads, with where each is.
const textsOf = (plan: SceneTreatmentV1) => [
  { where: 'the question', text: plan.question },
  { where: 'the takeaway', text: plan.takeaway },
  ...plan.moments.flatMap(moment => [
    ...(moment.narration?.guide ? [{ where: `moment ${moment.id}'s line`, text: moment.narration.guide }] : []),
    ...(moment.text?.content ? [{ where: `moment ${moment.id}'s on-screen text`, text: moment.text.content }] : []),
  ]),
]
const sentenceOf = (text: string, at: number) => {
  const start = Math.max(text.lastIndexOf('.', at - 1), text.lastIndexOf('!', at - 1), text.lastIndexOf('?', at - 1)) + 1
  const ends = ['.', '!', '?'].map(mark => text.indexOf(mark, at)).filter(index => index >= 0)
  return text.slice(start, ends.length ? Math.min(...ends) + 1 : text.length).trim()
}

// Phrases a direction asks to drop: quoted after "not", "never", "avoid",
// "drop", "remove" or "without" — `do not say "readers never block writers"`.
export const avoidedPhrasesOf = (direction: string) =>
  [...direction.matchAll(/\b(?:not|never|avoid|drop|remove|without|instead of|rather than)\b[^"“”'‘’]{0,40}["“‘']([^"“”’']{4,160})["”’']/gi)].map(match => match[1].trim())

export const claimFlagsOf = (plan: SceneTreatmentV1, brief: Pick<ExplanationBriefV1, 'evidence'> | null, direction = ''): ClaimFlag[] => {
  const refs = new Set([...(plan.evidenceRefs || []), ...plan.moments.flatMap(moment => moment.evidenceRefs || [])])
  const evidence = (brief?.evidence || []).filter(entry => refs.has(entry.id))
  const flags: ClaimFlag[] = []
  const seen = new Set<string>()
  for (const { where, text } of textsOf(plan)) {
    for (const match of text.matchAll(ABSOLUTE)) {
      const phrase = match[0]
      const key = `${where}|${normal(phrase)}`
      if (seen.has(key)) continue
      seen.add(key)
      const said = evidence.find(entry => normal(entry.text).includes(normal(phrase)))
      flags.push({ kind: 'absolute', where, phrase, text: sentenceOf(text, match.index ?? 0), evidence: said ? said.text : null })
    }
  }
  for (const phrase of avoidedPhrasesOf(direction)) {
    for (const { where, text } of textsOf(plan)) {
      if (!normal(text).includes(normal(phrase))) continue
      const at = text.toLowerCase().indexOf(phrase.toLowerCase())
      flags.push({ kind: 'direction', where, phrase, text: at >= 0 ? sentenceOf(text, at) : text.trim(), evidence: null })
    }
  }
  return flags
}

// A flag as the review says it.
export const claimFlagText = (flag: ClaimFlag) =>
  flag.kind === 'direction'
    ? `Your direction asked to drop “${flag.phrase}”, and ${flag.where} still says it: “${flag.text}”`
    : `${flag.where.charAt(0).toUpperCase()}${flag.where.slice(1)} claims “${flag.phrase}”: “${flag.text}” — ${flag.evidence ? `the source says it too (“${flag.evidence.slice(0, 140)}”), but check what it holds for` : 'its evidence does not say it; check what the source supports'}`
