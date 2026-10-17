import { afterEach, expect, it, vi } from 'vitest'
import { uploadRecording } from '../app/recording-upload'
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})
it('ends a stalled save once without sending another upload', async () => {
  vi.useFakeTimers()
  const fetch = vi.fn(
    (_: string, options: RequestInit) =>
      new Promise((_, reject) =>
        options.signal!.addEventListener('abort', () =>
          reject(new Error('Aborted'))
        )
      )
  )
  vi.stubGlobal('fetch', fetch)
  const pending = uploadRecording(
    'p',
    's',
    [],
    new Blob(['take'], { type: 'video/webm' })
  )
  const failure = expect(pending).rejects.toThrow('Your take is still here')
  await vi.advanceTimersByTimeAsync(125000)
  await failure
  expect(fetch).toHaveBeenCalledTimes(2)
  expect(vi.getTimerCount()).toBe(0)
})
it('bounds a stalled response body as well as the upload request', async () => {
  vi.useFakeTimers()
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_: string, options: RequestInit) => ({
      ok: true,
      json: () =>
        new Promise((_, reject) =>
          options.signal!.addEventListener('abort', () =>
            reject(new Error('Aborted'))
          )
        )
    }))
  )
  const pending = uploadRecording('p', 's', [], new Blob(['take']))
  const failure = expect(pending).rejects.toThrow(
    'Saving took too long to confirm'
  )
  await vi.advanceTimersByTimeAsync(125000)
  await failure
  expect(vi.getTimerCount()).toBe(0)
})
it('clears its deadline when saving succeeds', async () => {
  vi.useFakeTimers()
  const snapshot = { project: { id: 'p' } }
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => snapshot }))
  )
  expect(await uploadRecording('p', 's', [], new Blob(['take']))).toEqual(
    snapshot
  )
  expect(vi.getTimerCount()).toBe(0)
})

it('recovers a committed take after the upload response is lost without another PUT', async () => {
  let uploadId = ''
  const snapshot: any = {
    project: {
      id: 'p',
      video: {
        scenes: [
          {
            id: 's',
            moments: [{ id: 'm', take: { uploadId: '', recordingKey: 'k' } }]
          }
        ]
      }
    }
  }
  const fetch = vi.fn(async (_: string, options?: RequestInit) => {
    if (options?.method === 'PUT') {
      uploadId = (options.headers as Record<string, string>)[
        'X-Studio-Upload-Id'
      ]
      throw new Error('Response lost')
    }
    snapshot.project.video.scenes[0].moments[0].take.uploadId = uploadId
    return { ok: true, json: async () => snapshot }
  })
  vi.stubGlobal('fetch', fetch)
  expect(
    await uploadRecording(
      'p',
      's',
      [{ momentId: 'm', recordingKey: 'k', from: 0, to: 1 }],
      new Blob(['take'])
    )
  ).toEqual(snapshot)
  expect(
    fetch.mock.calls.filter(([, options]) => options?.method === 'PUT')
  ).toHaveLength(1)
})
