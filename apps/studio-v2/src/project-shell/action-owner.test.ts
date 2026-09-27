import { describe, expect, it } from 'vitest'
import { nextStepOwner, type StepOwnerInput } from './action-owner'

const input = (change: Partial<StepOwnerInput> = {}): StepOwnerInput => ({ video: true, stepScene: 's1', workspace: false, ...change })

describe('who draws the next step', () => {
  it('a notebook that is not a video: the context row', () => {
    expect(nextStepOwner(input({ video: false }))).toBe('context')
    expect(nextStepOwner(input({ video: false, workspace: true }))).toBe('context')
  })
  it('in the Scenes view, a scene step is the workspace\'s own', () => {
    expect(nextStepOwner(input({ workspace: true }))).toBe('workspace')
  })
  it('the brief and the export belong to no scene: the context row, in either view', () => {
    expect(nextStepOwner(input({ stepScene: null }))).toBe('context')
    expect(nextStepOwner(input({ stepScene: null, workspace: true }))).toBe('context')
  })
  it('in the notebook, the context row leads the selected scene', () => {
    expect(nextStepOwner(input())).toBe('context')
  })
})
