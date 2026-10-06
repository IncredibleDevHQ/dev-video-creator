import { expect, it } from 'vitest'
import {
  videoSettingsEffect,
  videoSettingsPreview
} from '../app/video-settings-preview'
import type { Project } from '../shared/model'
const project = {
  video: {
    settings: { presence: 'off', voice: { kind: 'ai', id: 'first' } },
    scenes: [
      { presence: null, moments: [] },
      { presence: 'low', moments: [] },
      { presence: null, moments: [{ take: { id: 'saved' } }] }
    ]
  }
} as unknown as Project
it('previews only inherited scenes for a camera change and preserves custom camera choices', () => {
  const next = {
    presence: 'high' as const,
    voice: { kind: 'ai' as const, id: 'first' }
  }
  expect(videoSettingsEffect(project, next)).toEqual({
    replanned: [1, 3],
    voiceChanged: false,
    templateChanged: false,
    changed: true,
    custom: 1,
    recordings: 1
  })
  expect(videoSettingsPreview(project, next)).toContain('scenes 1, 3')
  expect(videoSettingsPreview(project, next)).toContain('own camera setting')
})
it('distinguishes a voice update from replanning and a no-op', () => {
  const next = {
    presence: 'off' as const,
    voice: { kind: 'ai' as const, id: 'second' }
  }
  expect(videoSettingsEffect(project, next).replanned).toEqual([])
  expect(videoSettingsPreview(project, next)).toContain(
    'saved animations can be reused'
  )
  expect(videoSettingsPreview(project, project.video!.settings)).not.toContain(
    'confirm-video-settings'
  )
})
it('explains a default change when every scene has an override', () => {
  const custom = structuredClone(project)
  custom.video!.scenes.forEach((scene) => {
    scene.presence = 'low'
  })
  const next = {
    presence: 'high' as const,
    voice: { kind: 'ai' as const, id: 'first' }
  }
  expect(videoSettingsEffect(custom, next).replanned).toEqual([])
  expect(videoSettingsPreview(custom, next)).toContain(
    'keep their custom camera choices'
  )
})
it('plans every scene again when the template changes', () => {
  const next = {
    presence: 'off' as const,
    voice: { kind: 'ai' as const, id: 'first' },
    template: 'launch-demo'
  }
  expect(videoSettingsEffect(project, next)).toMatchObject({
    replanned: [1, 2, 3],
    templateChanged: true,
    changed: true
  })
  expect(videoSettingsPreview(project, next)).toContain(
    'Shape the video as Launch demo. Every scene is planned again in the new shape.'
  )
  expect(videoSettingsPreview(project, next)).toContain('Apply and re-plan')
})
