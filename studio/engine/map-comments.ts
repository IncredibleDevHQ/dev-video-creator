// Comments on the content map, said or typed, pinned to a card, an episode,
// a direction, a gap, the series or a spot. A said comment keeps its
// recording, is written down by OpenAI's transcription, and is read by Jev
// for what kind it is (a direction, material, a question, a remark), so it
// can offer its one next step. Kept in a row of their own per map.
import { randomUUID } from 'node:crypto'
import { askJev, jevConfigured } from './jev'
import { openAiKey } from './model-gateway'
import { deleteAsset, readRow, storeAsset, writeRow } from './persistence'
import { loadProject } from './projects'
import { Refusal } from './refusal'
import { TRANSCRIBE_MODEL } from './voice-agent'
import {
  COMMENT_KINDS,
  COMMENT_SECONDS,
  type CommentEntry,
  type CommentKind,
  type CommentTarget,
  type MapComment
} from '../shared/voice'

type CommentsRow = { projectId: string; comments: MapComment[] }
const ID = /^[a-zA-Z0-9_-]{1,80}$/
const TARGETS = ['page', 'copy', 'lane', 'direction', 'gap'] as const

export const loadComments = async (map: string) =>
  ID.test(map)
    ? (await readRow<CommentsRow>('map-comments', map))?.comments || []
    : []

const queues = new Map<string, Promise<unknown>>()
/** One change at a time per map. */
const changeComments = <T>(
  map: string,
  update: (comments: MapComment[]) => T | Promise<T>
): Promise<T> => {
  const next = (queues.get(map) || Promise.resolve())
    .catch(() => {})
    .then(async () => {
      const row = (await readRow<CommentsRow>('map-comments', map)) || {
        projectId: map,
        comments: []
      }
      const result = await update(row.comments)
      await writeRow('map-comments', map, row)
      return result
    })
  queues.set(map, next)
  return next
}

const words = (raw: unknown, limit = 2000) =>
  String(raw ?? '')
    .trim()
    .slice(0, limit)

/** Where a comment is pinned, checked. */
export const targetOf = (raw: unknown): CommentTarget => {
  const value = (raw && typeof raw === 'object' ? raw : {}) as Record<
    string,
    unknown
  >
  if (value.kind === 'series') return { kind: 'series' }
  if (value.kind === 'spot') {
    const x = Number(value.x)
    const y = Number(value.y)
    if (![x, y].every((n) => Number.isFinite(n) && Math.abs(n) < 1e6))
      throw new Refusal('Choose where the comment goes')
    return { kind: 'spot', x: Math.round(x), y: Math.round(y) }
  }
  const kind = TARGETS.find((name) => name === value.kind)
  if (!kind || typeof value.id !== 'string' || !ID.test(value.id))
    throw new Refusal('Choose what the comment is about')
  return { kind, id: value.id }
}

const mapOf = async (map: string) => {
  if (!ID.test(map) || !(await loadProject(map)))
    throw new Refusal('Map not found')
}

/** What kind of comment it is, as Jev reads it; nothing without Jev. */
export const readKind = async (
  text: string,
  about = ''
): Promise<{ kind?: CommentKind; sure?: number }> => {
  if (!jevConfigured() || !text) return {}
  try {
    const answers = await askJev(
      {
        setting:
          'A creator left a comment on their content map, where cards are planned into a series of episodes that become videos.',
        on: about.slice(0, 200),
        comment: text
      },
      {
        kind: {
          type: 'choice',
          instructions: 'What kind of comment is this?',
          criteria: { ...COMMENT_KINDS }
        }
      },
      { retries: 1 }
    )
    const answer = answers.kind
    if (answer?.type !== 'choice' || !(answer.choice in COMMENT_KINDS))
      return {}
    return { kind: answer.choice as CommentKind, sure: answer.confidence }
  } catch {
    return {}
  }
}

const AUDIO: Record<string, string> = {
  'audio/webm': '.webm',
  'audio/ogg': '.ogg',
  'audio/mp4': '.m4a',
  'audio/mpeg': '.mp3',
  'audio/wav': '.wav',
  'audio/x-wav': '.wav'
}
const audioType = (contentType: string) => {
  const mime = contentType.split(';')[0].trim().toLowerCase()
  return AUDIO[mime] ? { mime, extension: AUDIO[mime] } : null
}

/** A recording, written down by OpenAI's transcription. */
export const transcribe = async (
  bytes: Buffer,
  type: { mime: string; extension: string }
) => {
  const key = await openAiKey()
  if (!key) throw new Error('No OpenAI key')
  const form = new FormData()
  form.append('model', TRANSCRIBE_MODEL)
  form.append(
    'file',
    new Blob([new Uint8Array(bytes)], { type: type.mime }),
    `comment${type.extension}`
  )
  const base =
    process.env.STUDIO_OPENAI_URL?.trim() || 'https://api.openai.com/v1'
  const response = await fetch(`${base}/audio/transcriptions`, {
    method: 'POST',
    headers: { authorization: `Bearer ${key}` },
    body: form,
    signal: AbortSignal.timeout(60_000)
  })
  if (!response.ok) throw new Error(`Transcription answered ${response.status}`)
  const body = (await response.json()) as { text?: unknown }
  return words(body.text, 4000)
}

const entry = (
  text: string,
  by: 'creator' | 'ai',
  extra: Partial<CommentEntry> = {}
): CommentEntry => ({
  id: randomUUID(),
  at: new Date().toISOString(),
  by,
  text,
  ...extra
})

/** A said comment, or a said reply: kept, written down, read for its kind. */
export const addVoiceComment = async (
  map: string,
  bytes: Buffer,
  contentType: string,
  meta: Record<string, unknown>
) => {
  await mapOf(map)
  const type = audioType(contentType)
  if (!type) throw new Refusal('Record the comment as WebM, Ogg, MP4 or WAV')
  if (bytes.length < 200) throw new Refusal('The recording is empty')
  const reply = typeof meta.reply === 'string' ? meta.reply : ''
  const target = reply ? null : targetOf(meta.target)
  // Nothing is kept for a reply to a comment that has gone.
  if (reply && !(await loadComments(map)).some((c) => c.id === reply))
    throw new Refusal('That comment is gone')
  const seconds = Math.min(
    COMMENT_SECONDS + 2,
    Math.max(0, Number(meta.seconds) || 0)
  )
  const stored = await storeAsset({
    body: bytes,
    contentType: type.mime,
    projectId: map,
    kind: 'voice-comment',
    extension: type.extension
  })
  const said = await transcribe(bytes, type).catch((error: unknown) => {
    console.error(
      `A voice comment was kept but not written down: ${error instanceof Error ? error.message : 'unknown'}`
    )
    return ''
  })
  const heard = entry(said, 'creator', {
    audio: { objectKey: stored.objectKey, seconds: Math.round(seconds) },
    ...(said ? {} : { unheard: true })
  })
  if (reply)
    return changeComments(map, (comments) => {
      const parent = comments.find((comment) => comment.id === reply)
      if (!parent) throw new Refusal('That comment is gone')
      parent.replies.push(heard)
      return comments
    })
  const kind = await readKind(said, words(meta.about, 200))
  return changeComments(map, (comments) => {
    comments.push({
      ...heard,
      target: target!,
      state: 'open',
      replies: [],
      ...kind
    })
    return comments
  })
}

/** The typed actions: add, reply, resolve, reopen, remove. */
export const changeComment = async (
  map: string,
  body: Record<string, unknown>
) => {
  await mapOf(map)
  const action = String(body.action || 'add')
  const by = body.by === 'ai' ? 'ai' : 'creator'
  if (action === 'add') {
    const text = words(body.text)
    if (!text) throw new Refusal('Write the comment first')
    const target = targetOf(body.target)
    const kind = by === 'creator' ? await readKind(text, words(body.about)) : {}
    return changeComments(map, (comments) => {
      comments.push({
        ...entry(text, by),
        target,
        state: 'open',
        replies: [],
        ...kind
      })
      return comments
    })
  }
  const id = String(body.id || '')
  let removed: MapComment | undefined
  const comments = await changeComments(map, (comments) => {
    const index = comments.findIndex((comment) => comment.id === id)
    const comment = comments[index]
    if (!comment) throw new Refusal('That comment is gone')
    if (action === 'reply') {
      const text = words(body.text)
      if (!text) throw new Refusal('Write the reply first')
      comment.replies.push(entry(text, by))
    } else if (action === 'resolve') {
      comment.state = 'resolved'
      const outcome = words(body.outcome, 120)
      if (outcome) comment.outcome = outcome
    } else if (action === 'reopen') {
      comment.state = 'open'
      delete comment.outcome
    } else if (action === 'remove') {
      removed = comments.splice(index, 1)[0]
    } else throw new Refusal('Unknown comment action')
    return comments
  })
  // A removed comment's recordings go with it.
  for (const said of removed ? [removed, ...removed.replies] : [])
    if (said.audio)
      await Promise.resolve(said.audio.objectKey)
        .then(deleteAsset)
        .catch(() => {})
  return comments
}
