import { describe, expect, it } from 'vitest'
import { outlineSceneOf, pageIdeaOf, pageObjectiveOf } from './page-objective'

// F4 of the fresh end-to-end review: the Presentation brief's "Idea" showed
// the director's layout advice, because animating a page rewrote the notes
// the idea had been kept in. The objective is read from the outline.
const outline = [
  { nodeId: 'b1', title: 'Container recovery', idea: 'A dead container is replaced while the brain keeps running', kind: 'diagram', seconds: 20 },
  { nodeId: 'b2', title: 'Latency', idea: 'Time to first token falls at every percentile', kind: 'numbers', seconds: 12 },
]
const made = { id: 'b1', title: 'Container recovery', pageOrigin: { kind: 'designed' }, directorNotes: outline[0].idea }
// What animating the page leaves behind: the first notes as the seed, and
// the director's own staging in their place.
const staging = 'Open on you. The diagram traces 4 connections (beat 2), and a traced flow needs the whole frame — you become a chip.'
const animated = { ...made, directorSeed: { directorNotes: made.directorNotes }, directorAuto: { directorNotes: staging }, directorNotes: staging }

describe('a page keeps what it teaches apart from how it was staged', () => {
  it('reads the objective from the outline, before and after the page is animated', () => {
    expect(pageObjectiveOf(made, outline)).toEqual({ objective: outline[0].idea, layoutGuidance: '' })
    expect(pageObjectiveOf(animated, outline)).toEqual({ objective: outline[0].idea, layoutGuidance: staging })
    expect(pageIdeaOf(animated, outline)).toBe(outline[0].idea)
  })

  it('finds the outline scene by page id, by the base page a video scene came from, and by title for older outlines', () => {
    expect(outlineSceneOf(outline, { id: 'b2', title: 'Renamed' })?.idea).toBe(outline[1].idea)
    expect(outlineSceneOf(outline, { id: 'video-x-s01', title: 'Container recovery', origin: { notebook: 'base', scene: 'b1', scenes: ['b1'] } })?.nodeId).toBe('b1')
    const older = outline.map(({ nodeId: _dropped, ...scene }) => scene)
    expect(outlineSceneOf(older, { id: 'b9', title: 'Latency' })?.idea).toBe(outline[1].idea)
    // An outline that names its pages is not matched by title to another page.
    expect(outlineSceneOf(outline, { id: 'b9', title: 'Latency' })).toBeUndefined()
  })

  it('falls back to the first notes of a page made from an outline, and never offers generated staging as an idea', () => {
    expect(pageObjectiveOf(animated, [])).toEqual({ objective: outline[0].idea, layoutGuidance: staging })
    // A hand-made page: its notes are its author's, shown as notes, not as an objective.
    const handMade = { id: 'h1', title: 'Hand made', directorNotes: 'Linger on the arrow.' }
    expect(pageObjectiveOf(handMade, [])).toEqual({ objective: '', layoutGuidance: 'Linger on the arrow.' })
    expect(pageIdeaOf(handMade, [])).toBe('Linger on the arrow.')
    // Generated staging with no objective anywhere is not an idea.
    expect(pageIdeaOf({ id: 'h2', title: 'x', directorNotes: staging, directorAuto: { directorNotes: staging } }, [])).toBe('')
  })
})
