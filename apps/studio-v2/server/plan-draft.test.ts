import { describe, expect, it } from 'vitest'
import { validateDraft } from './plan-draft'

describe('a plan section published as a draft', () => {
  it('keeps a complete question and takeaway, as plain text', () => {
    expect(validateDraft('explanation', { question: '  What does the\nlimiter do?  ', takeaway: 'It turns excess away.' })).toEqual({ ok: true, section: 'explanation', draft: { question: 'What does the limiter do?', takeaway: 'It turns excess away.' } })
    expect(validateDraft('explanation', { question: 'Only half' })).toEqual({ ok: false, problems: ['takeaway is required'] })
    expect(validateDraft('explanation', { question: 7, takeaway: { html: '<b>x</b>' } })).toEqual({ ok: false, problems: ['question is required', 'takeaway is required'] })
  })

  it('keeps each moment identified, titled and bounded', () => {
    const ok = validateDraft('moments', { moments: [{ id: 'm1', title: 'Requests arrive', summary: 'The bucket fills.' }, { id: 'm2', title: 'The limit bites', summary: '' }] })
    expect(ok).toEqual({ ok: true, section: 'moments', draft: { moments: [{ id: 'm1', title: 'Requests arrive', summary: 'The bucket fills.' }, { id: 'm2', title: 'The limit bites', summary: '' }] } })
    expect(validateDraft('moments', { moments: [{ id: 'm1', title: 'A' }, { id: 'm1', title: 'B' }] })).toEqual({ ok: false, problems: ['moment 2: id "m1" is used twice'] })
    expect(validateDraft('moments', { moments: [{ id: '../x', title: 'A' }, { id: 'm2', title: '' }] })).toEqual({ ok: false, problems: ['moment 1: id must be 1–40 letters, digits, - or _', 'moment 2: title is required'] })
    expect(validateDraft('moments', { moments: [] })).toMatchObject({ ok: false })
    expect(validateDraft('moments', { moments: Array.from({ length: 25 }, (_, index) => ({ id: `m${index}`, title: 'x' })) })).toEqual({ ok: false, problems: ['at most 24 moments'] })
  })

  it('bounds what it keeps, and refuses other sections', () => {
    const long = validateDraft('explanation', { question: 'q'.repeat(900), takeaway: 't'.repeat(900) })
    expect(long.ok && 'question' in long.draft ? [long.draft.question.length, long.draft.takeaway.length] : null).toEqual([300, 600])
    expect(validateDraft('code', {})).toEqual({ ok: false, problems: ['section must be "explanation" or "moments"'] })
  })
})
