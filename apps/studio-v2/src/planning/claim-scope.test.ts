import { describe, expect, it } from 'vitest'
import { avoidedPhrasesOf, claimFlagsOf, claimFlagText } from './claim-scope'
import type { SceneTreatmentV1 } from './scene-treatment'

// B07 of the BoltDB review: the copy-on-write plan, as r1 and r2 said it.
const moment = (id: string, guide: string, text: string | null = null) => ({ id, title: id, purpose: '', observation: '', narration: { job: 'Say it', guide }, objects: null, text: text ? { content: text, role: 'takeaway' as const } : null, presenter: null, camera: null, audio: null, attention: '', recipes: [], evidenceRefs: ['ev-cow'], estimateSeconds: 4 })
const plan = (question: string, takeaway: string, lines: string[]) => ({ question, takeaway, evidenceRefs: ['ev-cow'], moments: lines.map((line, index) => moment(`m${index + 1}`, line)) }) as unknown as SceneTreatmentV1
const brief = { evidence: [{ id: 'ev-cow', kind: 'source' as const, text: 'A writer copies the pages it changes; readers keep reading the old tree until they finish.', locator: '¶14' }, { id: 'ev-other', kind: 'source' as const, text: 'Readers never block writers.', locator: '¶2' }] }

describe('what a plan claims more strongly than its sources', () => {
  it('names absolute language its evidence does not state', () => {
    const r1 = plan('How do readers and writers run without locks?', 'Nobody blocks anybody.', ['A writer copies the leaf.', 'Readers do not block writers, and writers do not block readers.'])
    const flags = claimFlagsOf(r1, brief)
    expect(flags.map(flag => [flag.where, flag.phrase])).toEqual([['the question', 'without locks'], ['the takeaway', 'Nobody'], ["moment m2's line", 'do not block']])
    expect(flags.every(flag => flag.kind === 'absolute' && flag.evidence === null)).toBe(true)
    expect(claimFlagText(flags[0])).toBe('The question claims “without locks”: “How do readers and writers run without locks?” — its evidence does not say it; check what the source supports')
  })

  it('says so when the evidence says it too — the source may simplify', () => {
    const cited = { ...plan('What does a reader see?', 'Its snapshot.', ['Readers never block writers.']), evidenceRefs: ['ev-other'] } as SceneTreatmentV1
    cited.moments[0].evidenceRefs = ['ev-other']
    const [flag] = claimFlagsOf(cited, brief)
    expect(flag).toMatchObject({ kind: 'absolute', phrase: 'never', evidence: 'Readers never block writers.' })
    expect(claimFlagText(flag)).toMatch(/— the source says it too \(“Readers never block writers\.”\), but check what it holds for$/)
  })

  it('names a phrase the direction asked to drop that the plan still says', () => {
    const direction = 'Teach the snapshot, with one writer at a time. Do not say "readers do not block writers" — remapping can make them wait.'
    expect(avoidedPhrasesOf(direction)).toEqual(['readers do not block writers'])
    const r2 = plan('What stays whole while a writer builds a new tree?', 'The old snapshot stays intact while one writer builds the next.', ['The writer copies the path.', 'So readers do not block writers.'])
    const flags = claimFlagsOf(r2, brief, direction).filter(flag => flag.kind === 'direction')
    expect(flags).toEqual([{ kind: 'direction', where: "moment m2's line", phrase: 'readers do not block writers', text: 'So readers do not block writers.', evidence: null }])
    expect(claimFlagText(flags[0])).toBe('Your direction asked to drop “readers do not block writers”, and moment m2\'s line still says it: “So readers do not block writers.”')
  })

  it('finds nothing in a plan that claims only what it shows', () => {
    const scoped = plan('What stays whole while a writer builds a new tree?', 'The old snapshot stays intact while one writer builds the next.', ['The writer copies the leaf, then its parent.', 'Readers that started earlier finish on the old tree.'])
    expect(claimFlagsOf(scoped, brief, 'Do not say "nobody blocks anybody".')).toEqual([])
  })
})
