import { describe, expect, it } from 'vitest'
import { resumeBlockFor } from './explainer-resume'

const scenes = [
  { id: 'blk-a', revision: 'rev-a' },
  { id: 'blk-b', revision: 'rev-b' },
]

describe('resumeBlockFor', () => {
  it('names the prior run, its accepted scenes and its waiting checkpoints', () => {
    const resume = resumeBlockFor({
      run: { id: 'run-1', status: 'waiting', projectDir: '/projects/nb/runs/run-1' },
      stages: [
        { stage: 'preview', subject: '01-a', status: 'succeeded' },
        { stage: 'align-take', subject: '02-b', status: 'needs-input', detail: { scene: '02-b', review: [{ beat: 2, note: 'The take skips the second sentence.' }] } },
      ],
      receipt: { applied: { 'blk-a': 'rev-a', 'blk-b': 'rev-b-old' } },
      scenes,
    })
    expect(resume).toEqual({
      runId: 'run-1',
      projectDir: '/projects/nb/runs/run-1',
      // Only the scene still carrying exactly what the run applied is
      // accepted; blk-b changed since, so it is fresh work for the new run.
      accepted: ['blk-a'],
      waiting: [
        { stage: 'align-take', subject: '02-b', scene: '02-b', review: [{ beat: 2, note: 'The take skips the second sentence.' }] },
      ],
    })
  })

  it('never resumes a finished or live run', () => {
    for (const status of ['done', 'running', 'gate']) {
      expect(resumeBlockFor({ run: { id: 'run-1', status, projectDir: '/x' }, stages: [], receipt: null, scenes })).toBeNull()
    }
  })

  it('never resumes without the prior run directory', () => {
    expect(resumeBlockFor({ run: { id: 'run-1', status: 'error' }, stages: [], receipt: null, scenes })).toBeNull()
    expect(resumeBlockFor({ run: null, stages: [], receipt: null, scenes })).toBeNull()
  })

  it('accepts nothing when the run never applied (or the scene drifted)', () => {
    const resume = resumeBlockFor({
      run: { id: 'run-1', status: 'cancelled', projectDir: '/x' },
      stages: [],
      receipt: { applied: { 'blk-a': 'rev-other' } },
      scenes,
    })
    expect(resume?.accepted).toEqual([])
    expect(resume?.waiting).toEqual([])
  })
})
