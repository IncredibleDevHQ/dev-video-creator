import { expect, it } from 'vitest'
import {
  requestObject,
  chatRequest,
  extensionRequest,
  numberField,
  slideRequest
} from './request-body'

it.each([null, [], 'text', 3])(
  'rejects a non-object JSON body: %j',
  (value) => {
    expect(() => requestObject(value)).toThrow('JSON object')
  }
)
it('keeps chat anchors discriminated and rejects malformed fields before dispatch', () => {
  expect(
    chatRequest({
      anchor: { stage: 'video', sceneId: 's', momentId: 'm', second: 1.5 },
      instruction: 'Move me left'
    })
  ).toEqual({
    anchor: { stage: 'video', sceneId: 's', momentId: 'm', second: 1.5 },
    instruction: 'Move me left'
  })
  expect(() =>
    chatRequest({
      anchor: { stage: 'video', sceneId: 's', momentId: 'm', second: '1' },
      instruction: 'Move'
    })
  ).toThrow('second')
  expect(() =>
    chatRequest({ anchor: { stage: 'other' }, instruction: 'Move' })
  ).toThrow('Choose')
  expect(() =>
    chatRequest({
      anchor: { stage: 'notebook' },
      instruction: { text: 'Move' }
    })
  ).toThrow('instruction')
})
it('validates slide actions and numeric fields rather than casting the body', () => {
  expect(slideRequest({ action: 'move', slideId: 's', index: 2 })).toEqual({
    action: 'move',
    slideId: 's',
    index: 2
  })
  expect(() => slideRequest({ action: 'destroy' })).toThrow('slide action')
  expect(() => slideRequest({ action: 'move', index: '2' })).toThrow('index')
  expect(() => numberField({ seconds: Infinity }, 'seconds')).toThrow('seconds')
})
it('requires an extension string and its concurrency key', () => {
  expect(extensionRequest({ text: 'Keep talking', recordingKey: 'r' })).toEqual(
    { text: 'Keep talking', recordingKey: 'r' }
  )
  expect(() => extensionRequest({ text: null, recordingKey: 'r' })).toThrow(
    'text'
  )
  expect(() => extensionRequest({ text: 'Keep talking' })).toThrow(
    'recordingKey'
  )
})
it('rejects malformed recording metadata before handing bytes to the engine', async () => {
  const { recordingParts } = await import('./request-body')
  expect(
    recordingParts([{ momentId: 'm', recordingKey: 'r', from: 0, to: 4 }])
  ).toEqual([{ momentId: 'm', recordingKey: 'r', from: 0, to: 4 }])
  expect(() => recordingParts({})).toThrow('recording parts')
  expect(() =>
    recordingParts([{ momentId: 'm', recordingKey: 'r', from: '0', to: 4 }])
  ).toThrow('from')
})
