import { randomUUID } from 'node:crypto'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { Voice } from '../shared/model'
import type { VoiceChoice, VoiceClone } from '../shared/settings'
import { VOICE_SAMPLE } from '../shared/settings'
import {
  readAsset,
  deleteAsset,
  listRows,
  readRow,
  writeRow,
  loadSetting,
  saveSetting,
  storeAsset,
  withOperationLock
} from './persistence'
import { fingerprintOf } from './planning/fingerprint'
import {
  voiceProviderRequest as fish,
  voiceProviderAvailable
} from './model-gateway'
import {
  runCommand,
  probeSeconds,
  narrationClock,
  systemVoiceAvailable
} from './voice'
const active = new Map<string, Promise<void>>()
let systemChoices: Promise<VoiceChoice[]> | null = null
const localVoices = () =>
  (systemChoices ||= (async () => {
    if (!(await systemVoiceAvailable())) return []
    const output = await runCommand('/usr/bin/say', ['-v', '?'])
    const voices = output.split('\n').flatMap((line) => {
      const entry = line.match(/^(.+?)\s+(en_[A-Z]{2})\s+#/)
      return entry &&
        /^(Aman|Daniel|Karen|Moira|Rishi|Samantha|Tara)(?:\s|$)/.test(entry[1])
        ? [
            {
              id: `system:${entry[1].trim()}`,
              name: entry[1].trim(),
              provider: 'system' as const,
              language: entry[2].replace('_', '-')
            }
          ]
        : []
    })
    return [...new Map(voices.map((voice) => [voice.id, voice])).values()]
  })())
export const voiceCatalogue = async (refresh = false) => {
  const local = await localVoices()
  let remote = await readRow<{ choices: VoiceChoice[]; at: number }>(
    'voice-cache',
    'catalogue'
  )
  let error: string | null = null
  if (
    (await voiceProviderAvailable()) &&
    (refresh || !remote || Date.now() - remote.at > 3600000)
  ) {
    try {
      const result = (await (
        await fish(
          '/model?licensed=true&page_size=24&page_number=1&sort_by=score'
        )
      ).json()) as {
        items?: Array<{
          _id: string
          title: string
          state: string
          type: string
          languages?: string[]
          licensed?: boolean
        }>
      }
      const choices = (result.items || [])
        .filter(
          (model) =>
            model.type === 'tts' && model.state === 'trained' && model.licensed
        )
        .map((model) => ({
          id: `fish:${model._id}`,
          name: String(model.title).slice(0, 100),
          provider: 'fish' as const,
          language: (model.languages || []).join(', ')
        }))
      remote = { choices, at: Date.now() }
      await writeRow('voice-cache', 'catalogue', remote)
    } catch {
      error =
        'Could not load AI voices. Check your Fish Audio key and try again.'
    }
  }
  return {
    choices: [
      ...local,
      ...((await voiceProviderAvailable()) ? remote?.choices || [] : [])
    ],
    error
  }
}
export const selectedVoice = async (): Promise<Voice> => {
  const selected = (await loadSetting('selected-voice')) as Voice | null
  if (selected) return selected
  const clones = (
    await Promise.all(
      (await listRows('voice-clones')).map((id) =>
        readRow<VoiceClone>('voice-clones', id)
      )
    )
  )
    .filter((clone): clone is VoiceClone => clone?.state === 'ready')
    .sort((a, b) => b.consentAt.localeCompare(a.consentAt))
  return clones[0] ? { kind: 'clone', id: clones[0].id } : { kind: 'record' }
}
export const resolveVoice = async (
  voice: Voice
): Promise<{ referenceId?: string; systemVoice?: string }> => {
  if (voice.kind === 'record') return {}
  if (voice.kind === 'clone') {
    const clone = await readRow<VoiceClone>('voice-clones', voice.id)
    if (clone?.state !== 'ready' || !clone.referenceId)
      throw new Error(
        'Your voice clone is not ready. Choose a voice in Settings'
      )
    if (!(await voiceProviderAvailable()))
      throw new Error('Add your Fish Audio key in Settings')
    return { referenceId: clone.referenceId }
  }
  if (voice.id === 'default') return {}
  const { choices } = await voiceCatalogue()
  const choice = choices.find((choice) => choice.id === voice.id)
  if (!choice) throw new Error('Choose an available AI voice in Settings')
  return choice.provider === 'fish'
    ? { referenceId: choice.id.slice(5) }
    : { systemVoice: choice.name }
}
export const useVoice = async (voice: Voice) => {
  await resolveVoice(voice)
  await saveSetting('selected-voice', voice)
  return voice
}
export const previewVoice = async (voice: Voice) => {
  const options = await resolveVoice(voice)
  if (voice.kind === 'record')
    throw new Error('Choose a generated voice to hear its sample')
  if (voice.kind === 'clone')
    return (await readRow<VoiceClone>('voice-clones', voice.id))!.sampleKey!
  const id = fingerprintOf({ voice, text: VOICE_SAMPLE })
  const cached = await readRow<{ objectKey: string }>('voice-previews', id)
  if (cached) return cached.objectKey
  const sample = await narrationClock(
    [{ id: 'sample', text: VOICE_SAMPLE, estimate: 6 }],
    options
  )
  const asset = await storeAsset({
    body: sample.audio,
    contentType: 'audio/mpeg',
    extension: '.mp3',
    kind: 'voice-preview'
  })
  await writeRow('voice-previews', id, { objectKey: asset.objectKey })
  return asset.objectKey
}
const finishClone = async (clone: VoiceClone) => {
  const started = Date.parse(clone.attemptStartedAt || clone.consentAt)
  if (!Number.isFinite(started) || Date.now() - started >= 10 * 60 * 1000) {
    clone.state = 'failed'
    clone.error =
      'Voice creation has taken longer than 10 minutes. Your recording is kept. Try again to check the saved voice without creating another clone.'
    await writeRow('voice-clones', clone.id, clone)
    return
  }
  try {
    let model: { _id: string; state: string }
    if (clone.referenceId)
      model = (await (
        await fish(`/model/${encodeURIComponent(clone.referenceId)}`)
      ).json()) as typeof model
    else {
      if (!clone.recordingKey) throw new Error('Record your voice again')
      // Adopt a private model after an interrupted request instead of creating a duplicate.
      const title = `Studio voice ${clone.id}`
      const prior = (await (
        await fish(
          `/model?self=true&title=${encodeURIComponent(title)}&page_size=100`
        )
      ).json()) as { items?: Array<typeof model & { title: string }> }
      const existing = prior.items?.find((model) => model.title === title)
      if (existing) model = existing
      else {
        const form = new FormData()
        form.set('type', 'tts')
        form.set('title', title)
        form.set('visibility', 'private')
        form.set('train_mode', 'fast')
        form.set('generate_sample', 'false')
        form.set(
          'voices',
          new Blob([new Uint8Array(await readAsset(clone.recordingKey))], {
            type: 'audio/wav'
          }),
          'voice.wav'
        )
        model = (await (
          await fish('/model', { method: 'POST', body: form })
        ).json()) as typeof model
      }
      if (!model._id) throw new Error('No voice was created')
      clone.referenceId = model._id
      clone.state = 'training'
      await writeRow('voice-clones', clone.id, clone)
    }
    if (model.state === 'failed') throw new Error('Voice creation failed')
    if (model.state !== 'trained') {
      clone.state = 'training'
      await writeRow('voice-clones', clone.id, clone)
      return
    }
    const sample = await narrationClock(
      [{ id: 'sample', text: VOICE_SAMPLE, estimate: 6 }],
      { referenceId: clone.referenceId }
    )
    const asset = await storeAsset({
      body: sample.audio,
      contentType: 'audio/mpeg',
      extension: '.mp3',
      kind: 'clone-sample'
    })
    clone.state = 'ready'
    clone.sampleKey = asset.objectKey
    clone.error = null
    await writeRow('voice-clones', clone.id, clone)
  } catch {
    clone.state = 'failed'
    clone.error =
      'Could not make your voice clone. Check your voice API key and try again.'
    await writeRow('voice-clones', clone.id, clone)
  }
}
const scheduleClone = (clone: VoiceClone) => {
  if (active.has(clone.id)) return
  const work = withOperationLock(`voice-clone:${clone.id}`, async () => {
    const current = await readRow<VoiceClone>('voice-clones', clone.id)
    if (current && ['creating', 'training'].includes(current.state))
      await finishClone(current)
  }).finally(() => active.delete(clone.id))
  active.set(clone.id, work)
  void work.catch(() => {})
}
export const listClones = async () => {
  const clones = (
    await Promise.all(
      (await listRows('voice-clones')).map((id) =>
        readRow<VoiceClone>('voice-clones', id)
      )
    )
  ).filter((clone): clone is VoiceClone =>
    Boolean(clone && clone.state !== 'deleted')
  )
  for (const clone of clones)
    if (['creating', 'training'].includes(clone.state)) scheduleClone(clone)
  return clones
}
export const createClone = async (
  body: Buffer,
  contentType: string,
  consent: boolean
) => {
  if (!consent)
    throw new Error(
      'Confirm that this is your voice and you agree to create a clone'
    )
  if (!(await voiceProviderAvailable()))
    throw new Error('Add your Fish Audio key in Settings first')
  if (
    !body.length ||
    body.length > 25000000 ||
    !/^(audio|video)\/(webm|mp4|wav|mpeg|ogg)/.test(contentType)
  )
    throw new Error('Upload a voice recording')
  const dir = await mkdtemp(join(tmpdir(), 'minimal-voice-clone-'))
  try {
    const input = join(dir, 'recording')
    const output = join(dir, 'voice.wav')
    await writeFile(input, new Uint8Array(body))
    await runCommand('ffmpeg', [
      '-y',
      '-i',
      input,
      '-vn',
      '-ar',
      '44100',
      '-ac',
      '1',
      '-c:a',
      'pcm_s16le',
      output
    ])
    const duration = await probeSeconds(output)
    if (duration < 25 || duration > 90)
      throw new Error('Read the script for about 30 seconds, then try again')
    const asset = await storeAsset({
      body: await readFile(output),
      contentType: 'audio/wav',
      extension: '.wav',
      kind: 'voice-clone-read'
    })
    const clone: VoiceClone = {
      id: randomUUID(),
      name: 'My voice',
      state: 'creating',
      recordingKey: asset.objectKey,
      sampleKey: null,
      duration,
      consentAt: new Date().toISOString(),
      attemptStartedAt: new Date().toISOString(),
      error: null
    }
    await writeRow('voice-clones', clone.id, clone)
    scheduleClone(clone)
    return clone
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}
export const retryClone = async (id: string) => {
  const clone = await withOperationLock(`voice-clone:${id}`, async () => {
    const current = await readRow<VoiceClone>('voice-clones', id)
    if (!current || current.state !== 'failed')
      throw new Error('This clone does not need a retry')
    current.state = 'creating'
    current.error = null
    current.attemptStartedAt = new Date().toISOString()
    await writeRow('voice-clones', id, current)
    return current
  })
  scheduleClone(clone)
  return clone
}
const removeClone = async (id: string) => {
  const clone = await readRow<VoiceClone>('voice-clones', id)
  if (!clone || clone.state === 'deleted') return
  if (!clone.referenceId) {
    // Creation can succeed remotely before its response/reference is persisted.
    // Confirm the exact private Studio identity before removing local evidence.
    const title = `Studio voice ${clone.id}`
    const prior = (await (
      await fish(
        `/model?self=true&title=${encodeURIComponent(title)}&page_size=100`
      )
    ).json()) as { items?: Array<{ _id: string; title: string }> }
    const existing = prior.items?.find((model) => model.title === title)
    if (existing) {
      clone.referenceId = existing._id
      await writeRow('voice-clones', id, clone)
    }
  }
  if (clone.referenceId)
    await fish(
      `/model/${encodeURIComponent(clone.referenceId)}`,
      { method: 'DELETE' },
      true
    )
  for (const key of [clone.recordingKey, clone.sampleKey])
    if (key) await deleteAsset(key)
  clone.state = 'deleted'
  clone.recordingKey = null
  clone.sampleKey = null
  clone.error = null
  await writeRow('voice-clones', id, clone)
  const selected = await selectedVoice()
  if (selected.kind === 'clone' && selected.id === id)
    await saveSetting('selected-voice', { kind: 'record' })
}

export const deleteClone = async (id: string) => {
  if (active.has(id))
    throw new Error('Wait for the current voice operation to finish')
  const work = withOperationLock(`voice-clone:${id}`, () => removeClone(id))
  active.set(id, work)
  try {
    await work
  } finally {
    active.delete(id)
  }
}
