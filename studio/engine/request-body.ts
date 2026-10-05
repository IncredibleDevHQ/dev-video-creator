import type { ChatRequest, SlideEdit } from '../shared/api'
import type { ChatAnchor } from '../shared/model'

export const requestObject = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Send a JSON object')
  return value as Record<string, unknown>
}
const stringField = (body: Record<string, unknown>, name: string) => {
  if (typeof body[name] !== 'string') throw new Error(`Missing ${name}`)
  return body[name]
}
export const numberField = (body: Record<string, unknown>, name: string) => {
  if (typeof body[name] !== 'number' || !Number.isFinite(body[name]))
    throw new Error(`Invalid ${name}`)
  return body[name]
}
export const chatRequest = (body: Record<string, unknown>): ChatRequest => {
  const raw = requestObject(body.anchor)
  let anchor: ChatAnchor
  if (raw.stage === 'notebook') anchor = { stage: 'notebook' }
  else if (raw.stage === 'presentation')
    anchor = { stage: 'presentation', slideId: stringField(raw, 'slideId') }
  else if (raw.stage === 'video')
    anchor = {
      stage: 'video',
      sceneId: stringField(raw, 'sceneId'),
      momentId: stringField(raw, 'momentId'),
      second: numberField(raw, 'second')
    }
  else throw new Error('Choose a notebook, slide or video moment')
  const request: ChatRequest = {
    anchor,
    instruction: stringField(body, 'instruction')
  }
  if (body.target !== undefined && anchor.stage === 'presentation') {
    const target = requestObject(body.target)
    const label = target.label === undefined ? '' : stringField(target, 'label')
    request.target = {
      id: stringField(target, 'id').slice(0, 120),
      label: label.slice(0, 200),
      kind: (target.kind === undefined
        ? ''
        : stringField(target, 'kind')
      ).slice(0, 40)
    }
  }
  return request
}
export const slideRequest = (body: Record<string, unknown>): SlideEdit => {
  const action = stringField(body, 'action')
  if (!['add', 'duplicate', 'delete', 'move', 'undo-delete'].includes(action))
    throw new Error('Choose a slide action')
  return {
    action: action as SlideEdit['action'],
    ...(body.slideId === undefined
      ? {}
      : { slideId: stringField(body, 'slideId') }),
    ...(body.index === undefined ? {} : { index: numberField(body, 'index') })
  }
}
export const extensionRequest = (body: Record<string, unknown>) => ({
  text: stringField(body, 'text'),
  recordingKey: stringField(body, 'recordingKey')
})
export const recordingParts = (
  value: unknown
): import('../shared/api').RecordedPart[] => {
  if (!Array.isArray(value)) throw new Error('Send recording parts')
  return value.map((item) => {
    const part = requestObject(item)
    return {
      momentId: stringField(part, 'momentId'),
      recordingKey: stringField(part, 'recordingKey'),
      from: numberField(part, 'from'),
      to: numberField(part, 'to')
    }
  })
}
