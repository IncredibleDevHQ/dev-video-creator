import { describe, expect, it } from 'vitest'
import { takeAudioUrlFor } from './take-audio'
import type { RecordedBlockV1 } from 'markdown-composition'

const take = (over: Partial<RecordedBlockV1>): RecordedBlockV1 => ({
  blockId: 'b1',
  recordingId: 'r1',
  videoUrl: '/objects/composite.webm',
  durationMs: 4000,
  recordedAt: '2026-09-19T00:00:00.000Z',
  storage: 'minio',
  ...over,
})

describe('takeAudioUrlFor', () => {
  it('is empty without a take', () => {
    expect(takeAudioUrlFor(undefined)).toBe('')
    expect(takeAudioUrlFor(null)).toBe('')
  })

  it('aligns a plain camera take against its own file', () => {
    expect(takeAudioUrlFor(take({}))).toBe('/objects/composite.webm')
  })

  it('aligns a kept-plan take against the camera track that carries the voice', () => {
    expect(takeAudioUrlFor(take({ keepsPlan: true, cameraUrl: '/objects/camera.webm', cameraAssetId: 'a1' }))).toBe('/objects/camera.webm')
  })

  it('falls back to the composite when a kept-plan take has no camera track', () => {
    expect(takeAudioUrlFor(take({ keepsPlan: true }))).toBe('/objects/composite.webm')
  })
})
