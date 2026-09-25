// What a notebook's export will sound like, block by block (F9 of the
// Perplexity review). A scene's words are not its voice: a block speaks in
// an export only when it has a take, or a voice track — recorded or
// generated. A block with words and neither is silent, and says so; one the
// creator made silent is silent by choice; one with no words has nothing
// to say.
import type { ProjectDocumentV1 } from './types'

export type BlockAudioState = 'produced' | 'take' | 'recorded-voice' | 'generated-voice' | 'silent-by-choice' | 'missing' | 'no-words'
export type BlockAudio = { block: string; title: string; state: BlockAudioState }

export const AUDIO_STATE_LABELS: Record<BlockAudioState, string> = {
  produced: 'produced scene, with its voice',
  take: 'recorded take',
  'recorded-voice': 'recorded voice',
  'generated-voice': 'generated voice',
  'silent-by-choice': 'silent by choice',
  missing: 'no audio — its words have no voice or take',
  'no-words': 'no words to speak',
}

const wordsOf = (project: ProjectDocumentV1, block: string) => {
  const node = (project.notebook?.content || []).find(entry => String(entry.attrs?.id || '') === block)
  const script = String((node?.attrs as { script?: unknown } | undefined)?.script || '').trim()
  return script || String(project.blocks?.[block]?.speakerNotes || '').trim()
}

export const blockAudioOf = (project: ProjectDocumentV1, block: string, silent: ReadonlySet<string> = new Set()): BlockAudioState => {
  // A produced scene's render carries its voice — or none, silent by choice.
  const produced = project.producedScenes?.[block]
  if (produced?.videoUrl) return produced.voiced ? 'produced' : 'silent-by-choice'
  const tracks = project.presenterTracks?.[block] || []
  const voice = tracks.find(track => track.kind === 'narration' && track.audioUrl)
  if (voice) return voice.audioKind === 'generated' ? 'generated-voice' : 'recorded-voice'
  const camera = tracks.find(track => track.kind === 'human-camera' && track.audioUrl && track.audioKind !== 'none')
  if (camera && camera.kind === 'human-camera') return camera.audioKind === 'generated' ? 'generated-voice' : 'recorded-voice'
  if (project.recordedBlocks?.[block]) return 'take'
  if (silent.has(block)) return 'silent-by-choice'
  return wordsOf(project, block) ? 'missing' : 'no-words'
}

// Every block the export includes, in order, with what it will sound like.
export const audioReadinessOf = (project: ProjectDocumentV1, options: { include?: string[]; silent?: string[] } = {}) => {
  const silent = new Set(options.silent || [])
  const include = options.include ? new Set(options.include) : null
  const blocks: BlockAudio[] = (project.notebook?.content || [])
    .filter(node => typeof node.attrs?.id === 'string' && node.attrs.id && (!include || include.has(String(node.attrs.id))))
    .map(node => {
      const block = String(node.attrs!.id)
      return { block, title: String(node.attrs?.title || node.type), state: blockAudioOf(project, block, silent) }
    })
  const voiced = blocks.filter(entry => entry.state === 'produced' || entry.state === 'take' || entry.state === 'recorded-voice' || entry.state === 'generated-voice').length
  const missing = blocks.filter(entry => entry.state === 'missing')
  return { blocks, voiced, missing: missing.length, silentByChoice: blocks.filter(entry => entry.state === 'silent-by-choice').length, silentDraft: voiced === 0 && blocks.length > 0 }
}
