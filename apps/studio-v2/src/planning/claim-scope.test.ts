import { describe, expect, it } from 'vitest'
import { avoidedPhrasesOf, claimClauseOf, claimFlagsOf, claimFlagText, claimGroupsOf, claimSummaryOf, narrowingDirectionOf } from './claim-scope'
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

// F04 of the project-flow fix verification: five flags that each repeated
// the whole takeaway read as a wall. One claim is one item, with its clause,
// where it is said, and why it is flagged; the rest on demand.
describe('claims, read as a creator reads them', () => {
  const takeaway = 'Copy-on-write lets a writer build the next version of the tree while readers keep reading the old one with no locks, so nobody ever waits on anybody else in the whole database.'
  const r1 = plan('How do readers and writers run without locks?', takeaway, ['A writer copies the leaf.', 'Readers do not block writers.', 'Writers do not block readers either.'])
  it('groups one claim wherever it is said, and keeps the exact clause', () => {
    const groups = claimGroupsOf(claimFlagsOf(r1, brief))
    expect(groups.map(group => [group.basis, group.phrases, group.occurrences.map(entry => entry.where)])).toEqual([
      ['unsupported', ['without locks', 'no locks'], ['the question', 'the takeaway']],
      ['unsupported', ['nobody'], ['the takeaway']],
      ['unsupported', ['do not block'], ["moment m2's line", "moment m3's line"]],
    ])
    // A short sentence whole; the long takeaway cut to the clause it is in.
    expect(groups[0].clause).toBe('How do readers and writers run without locks?')
    expect(groups[1].clause).toBe('…nobody ever waits on anybody else in the whole database.')
    expect(groups.every(group => group.clause.length <= 112)).toBe(true)
    expect(claimSummaryOf(groups)).toBe('3 not in its evidence')
  })
  it('tells a claim the source makes from one it does not, and a direction the plan ignored', () => {
    const cited = { ...plan('What does a reader see?', 'Its snapshot.', ['Readers never block writers.']), evidenceRefs: ['ev-other'] } as SceneTreatmentV1
    cited.moments[0].evidenceRefs = ['ev-other']
    const quoted = claimGroupsOf(claimFlagsOf(cited, brief))
    expect(quoted).toEqual([{ basis: 'quoted', phrases: ['never'], clause: 'Readers never block writers.', occurrences: [{ where: "moment m1's line", text: 'Readers never block writers.' }], evidence: 'Readers never block writers.' }])
    const direction = 'Do not say "readers do not block writers".'
    const both = claimGroupsOf(claimFlagsOf(plan('What stays whole?', 'The snapshot.', ['So readers do not block writers.']), brief, direction))
    expect(both.map(group => group.basis)).toEqual(['unsupported', 'direction'])
    expect(claimSummaryOf(both)).toBe('1 not in its evidence · 1 your direction asked to drop')
    expect(claimSummaryOf(quoted)).toBe('1 quoted from the source')
  })
  it('narrows a claim in words the next plan\'s check reads', () => {
    const [group] = claimGroupsOf(claimFlagsOf(r1, brief))
    const direction = narrowingDirectionOf(group)
    expect(direction).toBe('Do not say “without locks”: say only what this scene shows.')
    expect(avoidedPhrasesOf(direction)).toEqual(['without locks'])
  })
  it('cuts a long clause around its claim', () => {
    const long = `${'The writer walks the tree from the root, '.repeat(4)}and no reader is ever made to wait for it at any point in the whole operation from start to finish.`
    const clause = claimClauseOf(long, 'ever made to wait', 60)
    expect(clause.startsWith('…')).toBe(true)
    expect(clause).toContain('ever made to wait')
    expect(clause.length).toBeLessThanOrEqual(64)
  })
})
