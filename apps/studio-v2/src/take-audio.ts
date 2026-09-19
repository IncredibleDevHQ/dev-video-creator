// Which stored object the take aligner should listen to (§5.8a): a kept-plan
// take's composite video may not carry the voice at all — the camera track
// does. Everything else aligns against the take's own file.
import type { RecordedBlockV1 } from 'markdown-composition'

export const takeAudioUrlFor = (recording: RecordedBlockV1 | undefined | null): string => {
  if (!recording) return ''
  if (recording.keepsPlan && recording.cameraUrl) return recording.cameraUrl
  return recording.videoUrl || ''
}
