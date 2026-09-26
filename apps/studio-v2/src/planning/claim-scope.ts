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

// ——— Claims, read as a creator reads them (F04 of the fix verification) ———
// One claim said in the question, the takeaway and two lines is one thing
// to check, not four warnings that each repeat a long sentence. Flags are
// grouped by what they claim — "no locks" and "without locking" are one
// claim — and by their basis: not in the plan's evidence, quoted from the
// source (its scope still to check), or said after the direction asked to
// drop it. Each group keeps the exact clause and where it is said; the full
// sentences and the source's words are there on demand.
export type ClaimBasis = 'unsupported' | 'direction' | 'quoted'
export type ClaimGroup = {
  basis: ClaimBasis
  // The words that make the claim, as the plan says them (each wording once).
  phrases: string[]
  // The clause it is said in, where it is first said.
  clause: string
  occurrences: Array<{ where: string; text: string }>
  evidence: string | null
}
const conceptOf = (phrase: string) => {
  const said = normal(phrase)
  if (/\b(?:no locks?|lock free|locking|locks?)\b/.test(said)) return 'locks'
  if (/\bblock/.test(said)) return 'blocking'
  if (/\bwait/.test(said)) return 'waiting'
  if (/\bcontend|contention/.test(said)) return 'contention'
  if (/^(?:nobody|no one)$/.test(said)) return 'nobody'
  if (/^guarantee/.test(said)) return 'guarantee'
  return said
}
// The clause a phrase is said in: a short sentence whole; a long one cut
// to the words around the phrase, up to the nearest break — a comma, a
// dash, a semicolon, "and", "but", "while", "so" — with an ellipsis where
// it was cut.
export const claimClauseOf = (text: string, phrase: string, most = 110) => {
  if (text.length <= most) return text.trim()
  const at = text.toLowerCase().indexOf(phrase.toLowerCase())
  if (at < 0) return `${text.slice(0, most - 1).trimEnd()}…`
  const breaks = /[,;:—–()]|\s(?:and|but|while|so|because|which)\s/gi
  let start = 0
  let end = text.length
  for (const match of text.matchAll(breaks)) {
    const index = match.index ?? 0
    if (index + match[0].length <= at) start = index + match[0].length
    else if (index >= at + phrase.length) {
      end = index
      break
    }
  }
  let clause = text.slice(start, end).trim()
  if (clause.length > most) {
    const inside = clause.toLowerCase().indexOf(phrase.toLowerCase())
    const from = Math.max(0, inside - Math.floor((most - phrase.length) / 2))
    clause = `${from > 0 ? '…' : ''}${clause.slice(from, from + most).trim()}${from + most < clause.length ? '…' : ''}`
  }
  return `${start > 0 ? '…' : ''}${clause.replace(/^…/, '')}${end < text.length && !clause.endsWith('…') ? '…' : ''}`
}
const BASIS_ORDER: Record<ClaimBasis, number> = { unsupported: 0, direction: 1, quoted: 2 }
export const claimGroupsOf = (flags: ClaimFlag[]): ClaimGroup[] => {
  const groups = new Map<string, ClaimGroup>()
  for (const flag of flags) {
    const basis: ClaimBasis = flag.kind === 'direction' ? 'direction' : flag.evidence ? 'quoted' : 'unsupported'
    const key = `${basis}|${flag.kind === 'direction' ? normal(flag.phrase) : conceptOf(flag.phrase)}`
    const group = groups.get(key) || { basis, phrases: [], clause: claimClauseOf(flag.text, flag.phrase), occurrences: [], evidence: flag.evidence }
    if (!group.phrases.some(phrase => normal(phrase) === normal(flag.phrase))) group.phrases.push(flag.phrase)
    if (!group.occurrences.some(entry => entry.where === flag.where)) group.occurrences.push({ where: flag.where, text: flag.text })
    groups.set(key, group)
  }
  return [...groups.values()].sort((a, b) => BASIS_ORDER[a.basis] - BASIS_ORDER[b.basis])
}
export const CLAIM_BASIS_TEXT: Record<ClaimBasis, string> = {
  unsupported: 'not in this scene’s evidence',
  direction: 'your direction asked to drop it',
  quoted: 'quoted from the source — check what it holds for',
}
// "2 claims to check · 1 not in its evidence · 1 quoted from the source".
export const claimSummaryOf = (groups: ClaimGroup[]) => {
  const count = (basis: ClaimBasis) => groups.filter(group => group.basis === basis).length
  return [
    count('unsupported') ? `${count('unsupported')} not in its evidence` : '',
    count('direction') ? `${count('direction')} your direction asked to drop` : '',
    count('quoted') ? `${count('quoted')} quoted from the source` : '',
  ].filter(Boolean).join(' · ')
}
// The direction that narrows a claim, in the words the next plan's check
// reads (avoidedPhrasesOf): a plan that still says it is flagged again.
export const narrowingDirectionOf = (group: ClaimGroup) =>
  `Do not say “${group.phrases[0]}”: say only what this scene shows.`
