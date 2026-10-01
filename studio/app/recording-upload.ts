import type { RecordedPart, Snapshot } from '../shared/api'
import { requestJson } from './http'

/** Bound one upload attempt. Keep the browser take on failure; never retry a PUT. */
export async function uploadRecording(
  id: string,
  sceneId: string,
  parts: RecordedPart[],
  blob: Blob
): Promise<Snapshot> {
  const uploadId = crypto.randomUUID()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 120000)
  try {
    return await requestJson<Snapshot>(
      `/api/projects/${id}/scenes/${sceneId}/recordings`,
      {
        method: 'PUT',
        signal: controller.signal,
        headers: {
          'Content-Type': blob.type,
          'X-Studio-Parts': JSON.stringify(parts),
          'X-Studio-Upload-Id': uploadId
        },
        body: blob
      }
    )
  } catch (reason) {
    // A response can be lost after commit. Reconcile once without another upload.
    clearTimeout(timer)
    const check = new AbortController(),
      deadline = setTimeout(() => check.abort(), 5000)
    try {
      const saved = await requestJson<Snapshot>(`/api/projects/${id}`, {
        signal: check.signal
      })
      const scene = saved.project.video?.scenes.find(
        (scene) => scene.id === sceneId
      )
      if (
        parts.length &&
        parts.every((part) =>
          scene?.moments.some(
            (moment) =>
              moment.id === part.momentId &&
              moment.take?.uploadId === uploadId &&
              moment.take.recordingKey === part.recordingKey
          )
        )
      )
        return saved
    } catch {
      /* Keep the local blob when confirmation is unavailable. */
    } finally {
      clearTimeout(deadline)
    }
    if (controller.signal.aborted)
      throw new Error(
        'Saving took too long to confirm. Your take is still here. Check this scene before saving again.'
      )
    throw reason
  } finally {
    clearTimeout(timer)
  }
}
