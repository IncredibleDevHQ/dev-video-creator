import { describe, expect, it } from 'vitest'
import {
  compileProject,
  createDefaultBlockConfig,
  defaultBrand,
  estimateSpokenSeconds,
  generateSpeakerNotes,
  type ProjectDocumentV1,
  type TiptapNode,
} from './index'

const notesProject = (): ProjectDocumentV1 => {
  const heading: TiptapNode = {
    type: 'heading',
    attrs: { id: 'intro', level: 1 },
    content: [{ type: 'text', text: 'Ship human videos' }],
  }
  const list: TiptapNode = {
    type: 'bulletList',
    attrs: { id: 'points' },
    content: [
      {
        type: 'listItem',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Write in Markdown' }] },
        ],
      },
      {
        type: 'listItem',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Record on camera' }] },
        ],
      },
    ],
  }
  const code: TiptapNode = {
    type: 'codeBlock',
    attrs: { id: 'code' },
    content: [{ type: 'text', text: 'const a = 1\nconst b = a + 1' }],
  }
  return {
    version: 1,
    id: 'notes-project',
    title: 'Notes test',
    notebook: { type: 'doc', content: [heading, list, code] },
    fps: 30,
    width: 1920,
    height: 1080,
    blocks: {
      intro: createDefaultBlockConfig('intro', heading),
      points: createDefaultBlockConfig('points', list),
      code: createDefaultBlockConfig('code', code),
    },
    presenterTracks: {},
    brand: defaultBrand,
  }
}

describe('speaker notes', () => {
  it('estimates spoken time from word count', () => {
    expect(estimateSpokenSeconds('')).toBe(0)
    expect(estimateSpokenSeconds(Array(140).fill('word').join(' '))).toBe(60)
  })

  it('builds list notes with one beat per point and neighbour handoffs', () => {
    const notes = generateSpeakerNotes(notesProject(), 'points', 1)
    expect(notes).toContain('Point 1')
    expect(notes).toContain('Write in Markdown')
    expect(notes).toContain('Record on camera')
    expect(notes).toContain('Ship human videos')
    expect(notes).toContain('1 minute')
  })

  it('walks code line by line and deepens for longer targets', () => {
    const short = generateSpeakerNotes(notesProject(), 'code', 1)
    const long = generateSpeakerNotes(notesProject(), 'code', 4)
    expect(short).toContain('const a = 1')
    expect(long.length).toBeGreaterThan(short.length)
    expect(long).toContain('would break')
  })

  it('keeps speaker notes and target minutes through compilation', () => {
    const project = notesProject()
    project.blocks.points.speakerNotes = 'Talk about the workflow.'
    project.blocks.points.notesTargetMinutes = 3
    const compiled = compileProject(project)
    const scene = compiled.scenes.find(item => item.id === 'points')
    expect(scene?.config.speakerNotes).toBe('Talk about the workflow.')
    expect(scene?.config.notesTargetMinutes).toBe(3)
  })

  it('rejects notes for a missing block', () => {
    expect(() => generateSpeakerNotes(notesProject(), 'missing', 1)).toThrow()
  })
})
