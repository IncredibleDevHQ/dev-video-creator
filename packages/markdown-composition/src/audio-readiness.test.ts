import { describe, expect, it } from 'vitest'
import { audioReadinessOf } from './audio-readiness'
import type { ProjectDocumentV1 } from './types'

// F9 of the Perplexity review: a scene with a generated-delivery choice and
// a script was exported with no audio stream, and Publish never said so.
const project = (): ProjectDocumentV1 =>
  ({
    version: 1,
    id: 'p',
    title: 'Voices',
    notebook: {
      type: 'doc',
      content: [
        { type: 'scene', attrs: { id: 'taken', title: 'Taken', script: 'I said this.' } },
        { type: 'scene', attrs: { id: 'narrated', title: 'Narrated', script: 'A voice says this.' } },
        { type: 'scene', attrs: { id: 'camera', title: 'Camera', script: 'On camera.' } },
        { type: 'scene', attrs: { id: 'scripted', title: 'Scripted only', script: 'Written, never voiced.' } },
        { type: 'scene', attrs: { id: 'quiet', title: 'Quiet', script: 'Left silent.' } },
        { type: 'paragraph', attrs: { id: 'para' } },
      ],
    },
    blocks: {},
    presenterTracks: {
      narrated: [{ kind: 'narration', audioUrl: '/voice.mp3', audioKind: 'generated' }],
      camera: [{ kind: 'human-camera', videoUrl: '/cam.webm', audioUrl: '/cam.webm', audioKind: 'recorded-mic' }],
    },
    recordedBlocks: { taken: { blockId: 'taken', recordingId: 'r1', videoUrl: '/take.webm', durationMs: 4000, recordedAt: '', storage: 'local' } },
  }) as unknown as ProjectDocumentV1

describe('what an export will sound like', () => {
  it('tells a voiced block from one whose words were never voiced', () => {
    const readiness = audioReadinessOf(project(), { silent: ['quiet'] })
    expect(readiness.blocks.map(entry => [entry.block, entry.state])).toEqual([
      ['taken', 'take'],
      ['narrated', 'generated-voice'],
      ['camera', 'recorded-voice'],
      ['scripted', 'missing'],
      ['quiet', 'silent-by-choice'],
      ['para', 'no-words'],
    ])
    expect(readiness).toMatchObject({ voiced: 3, missing: 1, silentByChoice: 1, silentDraft: false })
  })

  it('calls an export with no voice at all a silent draft, and counts only what it includes', () => {
    const silent = project()
    silent.presenterTracks = {}
    delete silent.recordedBlocks
    expect(audioReadinessOf(silent)).toMatchObject({ voiced: 0, missing: 5, silentDraft: true })
    expect(audioReadinessOf(project(), { include: ['scripted', 'para'] })).toMatchObject({ voiced: 0, missing: 1, silentDraft: true })
  })
})
