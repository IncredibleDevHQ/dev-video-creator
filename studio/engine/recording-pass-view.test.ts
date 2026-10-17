import { expect, it } from 'vitest'
import { recordingRecovery } from '../app/recording-setup'
import { recordingPlan } from '../app/recording-target'
import {
  countdownOverlay,
  recordActions,
  recordLabel,
  recordLight,
  recordPlace
} from '../app/record-view'
import type { Recording } from '../app/recording'
import type { Moment, Scene } from '../shared/model'
const moment = {
  id: 'a',
  title: 'Opening',
  lines: 'A short line',
  camera: 'full'
} as Moment
const moments = ['a', 'b', 'c', 'd'].map(
  (id) => ({ ...moment, id, camera: id === 'c' ? 'none' : 'full' }) as Moment
)
const needs = (entry: Moment) => entry.camera !== 'none'
it('records what Play plays: the whole scene, or one moment', () => {
  const plan = (open: string[], options: { whole: boolean; here: boolean }) =>
    recordingPlan(moments, open, 1, { ...options, needs }).map((m) => m.id)
  // The whole scene: the moments still waiting for a take.
  expect(plan(['a', 'b', 'd'], { whole: true, here: true })).toEqual([
    'a',
    'b',
    'd'
  ])
  expect(plan(['d'], { whole: true, here: false })).toEqual(['d'])
  // Every take is in: the whole scene again.
  expect(plan([], { whole: true, here: false })).toEqual(['a', 'b', 'd'])
  // One moment: the one on show in practice, even with a take...
  expect(plan([], { whole: false, here: true })).toEqual(['b'])
  // ...or, from the page, the next one waiting for a take.
  expect(plan(['d'], { whole: false, here: false })).toEqual(['d'])
  const scene = { moments } as Scene
  expect(recordLabel(scene, moments)).toBe('Record scene')
  expect(recordLabel(scene, moments.slice(0, 2))).toBe('Record 2 moments')
  expect(recordLabel(scene, [moments[3]])).toBe('Record moment 4')
})
it('gets ready in place: camera and level live, then a countdown on the stage', () => {
  const capture = (phase: Recording['phase'], many = false) =>
    ({
      phase,
      moments: many ? moments : [moment],
      current: 1,
      countdown: 2
    }) as Recording
  expect(recordActions(capture('preparing'))).toContain(
    'Allow camera and microphone access'
  )
  expect(recordActions(capture('preparing'))).toContain('disabled')
  const ready = recordActions(capture('ready', true))
  expect(ready).toContain('data-action="record-begin"')
  expect(ready).toContain('data-mic-meter')
  expect(ready).toContain('4 moments · 3-second countdown · Enter to start')
  expect(countdownOverlay(capture('countdown'))).toContain('<b>2</b>')
  expect(countdownOverlay(capture('recording'))).toBe('')
  expect(recordActions(capture('recording', true))).toContain('Next moment')
  expect(recordActions(capture('recording'))).toContain(
    'data-action="record-stop"'
  )
  expect(recordLight(capture('recording'))).toContain('class="recording-clock"')
  expect(recordPlace(capture('recording', true), 1, 3)).toBe(
    'Scene 1 · Moment 3 · 2 of 4'
  )
})
it('gives a focused permission recovery choice without restarting capture', () => {
  const html = recordingRecovery(
    new Error('Microphone access was denied. <blocked>')
  )
  expect(html).toContain('Microphone access was denied. &lt;blocked&gt;')
  expect(html).toContain('data-action="recording-retry"')
  expect(html).toContain('data-action="practice"')
  expect(html).not.toContain('id="recording-setup"')
  expect(html).toContain('does not enable your devices automatically')
})
