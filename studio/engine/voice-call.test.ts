import { createServer } from 'node:http'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { WebSocket, WebSocketServer } from 'ws'
import type { Snapshot } from '../shared/api'
import {
  VOICE_TOOLS,
  type VoiceReading,
  type VoiceServerMessage
} from '../shared/voice'
import {
  gate,
  instructionsFor,
  readingFrom,
  sessionUpdate,
  toolDefinitions
} from './voice-agent'
import { stopVoiceSessions, voiceDeps, voiceUpgrade } from './voice-relay'
import { writeRow } from './persistence'
// The Realtime service and Jev are stand-ins here: these checks prove the
// relay's plumbing and the gate's rule, not what a model hears or says.

const reading = (
  intent: VoiceReading['intent'],
  act: number,
  yes = 0,
  probabilities: VoiceReading['probabilities'] = {}
): VoiceReading => ({
  intent,
  act,
  yes,
  probabilities: { [intent]: 0.8, ...probabilities }
})

describe('the session and the gate', () => {
  it('asks for audio both ways, semantic turns, a transcript and every tool', () => {
    const update = sessionUpdate('Map “Streamline”: 2 cards.')
    const session = update.session
    expect(update.type).toBe('session.update')
    expect(session.audio.input.format).toEqual({
      type: 'audio/pcm',
      rate: 24000
    })
    expect(session.audio.output.format).toEqual({
      type: 'audio/pcm',
      rate: 24000
    })
    expect(session.audio.input.turn_detection).toMatchObject({
      type: 'semantic_vad',
      create_response: true,
      interrupt_response: true
    })
    expect(session.audio.input.transcription.model).toBe(
      'gpt-4o-mini-transcribe'
    )
    expect(session.instructions).toContain('Map “Streamline”: 2 cards.')
    expect(session.tools.map((tool) => tool.name).sort()).toEqual(
      Object.keys(VOICE_TOOLS).sort()
    )
    for (const tool of toolDefinitions()) {
      const { properties, required } = tool.parameters
      for (const key of required) expect(Object.keys(properties)).toContain(key)
    }
    expect(instructionsFor('')).toContain('(loading)')
  })

  it('reads Jev’s answers, or nothing when one is missing', () => {
    expect(
      readingFrom({
        intent: {
          type: 'choice',
          choice: 'episode',
          probabilities: { episode: 0.7, question: 0.2, bogus: 0.1 },
          confidence: 0.7
        },
        act: { type: 'noul', noul: 1.4 },
        yes: { type: 'noul', noul: 0.1 }
      })
    ).toEqual({
      intent: 'episode',
      probabilities: { episode: 0.7, question: 0.2 },
      act: 1,
      yes: 0.1
    })
    expect(readingFrom({ act: { type: 'noul', noul: 1 } })).toBeNull()
    expect(
      readingFrom({
        intent: {
          type: 'choice',
          choice: 'dance',
          probabilities: {},
          confidence: 1
        },
        act: { type: 'noul', noul: 1 },
        yes: { type: 'noul', noul: 1 }
      })
    ).toBeNull()
  })

  it('lets a change run only when the creator’s words ask for it', () => {
    const heard = (text: string, r: VoiceReading | null) => ({
      text,
      reading: r
    })
    // Looking always may; a change needs words first.
    expect(gate('look', { target: 'e1' }, null)).toEqual({ run: true })
    expect(gate('copy_card', {}, null)).toMatchObject({ run: false })
    // Without Jev's reading a change runs.
    expect(gate('copy_card', {}, heard('put it in', null))).toEqual({
      run: true
    })
    // A question is answered, not acted on, and the reason says what Jev heard.
    const asked = gate(
      'add_direction',
      { text: 'x' },
      heard('What does episode two teach?', reading('question', 0.1))
    )
    expect(asked).toMatchObject({ run: false })
    expect(!asked.run && asked.why).toContain('a question')
    // A change of another kind is held; a mixed request carries both.
    expect(
      gate('copy_card', {}, heard('plan it again', reading('plan', 0.9)))
    ).toMatchObject({ run: false })
    expect(
      gate(
        'copy_card',
        {},
        heard(
          'plan it and move that card',
          reading('plan', 0.9, 0, { episode: 0.3 })
        )
      )
    ).toEqual({ run: true })
    // A big change needs the AI to have asked, and the creator's yes.
    expect(
      gate('plan_series', {}, heard('plan', reading('plan', 0.9)))
    ).toMatchObject({
      run: false
    })
    expect(
      gate(
        'plan_series',
        { confirmed: true },
        heard('plan it', reading('plan', 0.9, 0.2))
      )
    ).toMatchObject({ run: false })
    expect(
      gate(
        'plan_series',
        { confirmed: true },
        heard('yes, go', reading('plan', 0.9, 0.95))
      )
    ).toEqual({ run: true })
    expect(gate('dance', {}, heard('dance', null))).toMatchObject({
      run: false
    })
  })
})

describe('the voice socket', () => {
  const realtime = new WebSocketServer({ port: 0, host: '127.0.0.1' })
  const studio = createServer((_request, response) => {
    response.writeHead(404)
    response.end()
  })
  studio.on('upgrade', (request, socket, head) => {
    if (!voiceUpgrade(request, socket, head)) socket.destroy()
  })
  const upstream: Array<Record<string, any>> = []
  let service: WebSocket | null = null
  let authorization = ''
  realtime.on('connection', (socket, request) => {
    authorization = String(request.headers.authorization || '')
    service = socket
    socket.on('message', (data) => upstream.push(JSON.parse(String(data))))
    socket.send(JSON.stringify({ type: 'session.created' }))
  })
  const toService = (event: Record<string, unknown>) =>
    service!.send(JSON.stringify(event))
  const said: Record<string, VoiceReading> = {
    'Put the deploy card into episode two': reading('episode', 0.93),
    'What does episode two teach?': reading('question', 0.08),
    'Plan the series again': reading('plan', 0.9, 0.05),
    'Yes, go ahead': reading('plan', 0.92, 0.97)
  }
  const classify = vi.fn(
    async (state: unknown) => said[(state as { latest: string }).latest] ?? null
  )
  let port = 0
  const map = 'voice-map'
  const until = async (check: () => unknown, ms = 3000) => {
    const end = Date.now() + ms
    while (!check()) {
      if (Date.now() > end) throw new Error('Timed out')
      await new Promise((resolve) => setTimeout(resolve, 10))
    }
  }
  const open = (origin: string, id = map) =>
    new Promise<{ page: WebSocket; heard: VoiceServerMessage[] }>(
      (resolve, reject) => {
        const page = new WebSocket(
          `ws://127.0.0.1:${port}/api/projects/${id}/voice`,
          {
            headers: { origin }
          }
        )
        const heard: VoiceServerMessage[] = []
        page.on('message', (data) => heard.push(JSON.parse(String(data))))
        page.on('open', () => resolve({ page, heard }))
        page.on('error', reject)
      }
    )

  beforeAll(async () => {
    if (!realtime.address())
      await new Promise<void>((resolve) => realtime.on('listening', resolve))
    await new Promise<void>((resolve) => studio.listen(0, '127.0.0.1', resolve))
    port = (studio.address() as { port: number }).port
    const realtimePort = (realtime.address() as { port: number }).port
    voiceDeps.key = async () => 'sk-test-0123456789abcdef'
    voiceDeps.url = () =>
      `ws://127.0.0.1:${realtimePort}/v1/realtime?model=test`
    voiceDeps.jev = () => true
    voiceDeps.classify = classify
    const snapshot: Snapshot = {
      project: {
        id: map,
        title: 'Streamline',
        source: '',
        slides: [],
        video: null
      },
      status: 'ready',
      error: null,
      events: []
    }
    await writeRow('projects', map, snapshot)
  })
  afterAll(async () => {
    stopVoiceSessions()
    for (const client of realtime.clients) client.terminate()
    await new Promise<void>((resolve) => realtime.close(() => resolve()))
    await new Promise<void>((resolve) => studio.close(() => resolve()))
  })

  it('refuses a page from another site, and a map that is not there', async () => {
    await expect(open('http://elsewhere.example')).rejects.toThrow(/403/)
    await expect(
      open(`http://127.0.0.1:${port}`, 'no-such-map')
    ).rejects.toThrow(/404/)
  })

  it('relays a call: the key stays in the engine, Jev reads each turn, tools are gated', async () => {
    const { page, heard } = await open(`http://127.0.0.1:${port}`)
    page.send(
      JSON.stringify({ type: 'context', text: 'Map “Streamline”: 3 cards.' })
    )
    await until(() => upstream.some((e) => e.type === 'session.update'))
    expect(authorization).toBe('Bearer sk-test-0123456789abcdef')
    const update = upstream.find((e) => e.type === 'session.update')!
    expect(update.session.instructions).toContain('Map “Streamline”: 3 cards.')
    toService({ type: 'session.updated' })
    await until(() => heard.some((m) => m.type === 'ready'))
    expect(JSON.stringify(heard)).not.toContain('sk-test')

    // The microphone goes up as base64 PCM.
    page.send(Buffer.from([1, 2, 3, 4]))
    await until(() =>
      upstream.some((e) => e.type === 'input_audio_buffer.append')
    )
    expect(
      upstream.find((e) => e.type === 'input_audio_buffer.append')!.audio
    ).toBe(Buffer.from([1, 2, 3, 4]).toString('base64'))

    // A request for a change: read by Jev, then the tool goes to the page.
    toService({ type: 'input_audio_buffer.committed', item_id: 'u1' })
    toService({ type: 'response.created' })
    toService({
      type: 'response.output_item.done',
      item: {
        type: 'function_call',
        call_id: 'call-1',
        name: 'copy_card',
        arguments: '{"card":"c1","episode":"e2"}'
      }
    })
    toService({ type: 'response.done' })
    toService({
      type: 'conversation.item.input_audio_transcription.completed',
      item_id: 'u1',
      transcript: 'Put the deploy card into episode two'
    })
    await until(() => heard.some((m) => m.type === 'tool'))
    expect(heard.find((m) => m.type === 'reading')).toMatchObject({
      item: 'u1',
      reading: { intent: 'episode' }
    })
    expect(heard.find((m) => m.type === 'tool')).toMatchObject({
      call: 'call-1',
      name: 'copy_card',
      args: { card: 'c1', episode: 'e2' }
    })
    page.send(
      JSON.stringify({
        type: 'context',
        text: 'Map “Streamline”: 3 cards, one copied.'
      })
    )
    page.send(
      JSON.stringify({
        type: 'tool_result',
        call: 'call-1',
        output: { ok: true, did: 'Copied it' }
      })
    )
    await until(() => upstream.some((e) => e.type === 'response.create'))
    const output = upstream.find((e) => e.type === 'conversation.item.create')!
    expect(output.item).toMatchObject({
      type: 'function_call_output',
      call_id: 'call-1'
    })
    expect(JSON.parse(output.item.output)).toEqual({
      ok: true,
      did: 'Copied it'
    })
    // The canvas as it is now went up before the outcome.
    const order = upstream.map((e) => e.type)
    expect(order.lastIndexOf('session.update')).toBeLessThan(
      order.indexOf('conversation.item.create')
    )

    // A question: the change the AI tries is held, and it is told why.
    upstream.length = 0
    toService({ type: 'input_audio_buffer.committed', item_id: 'u2' })
    toService({
      type: 'conversation.item.input_audio_transcription.completed',
      item_id: 'u2',
      transcript: 'What does episode two teach?'
    })
    toService({ type: 'response.created' })
    toService({
      type: 'response.output_item.done',
      item: {
        type: 'function_call',
        call_id: 'call-2',
        name: 'add_direction',
        arguments: '{"text":"x"}'
      }
    })
    toService({ type: 'response.done' })
    await until(() => upstream.some((e) => e.type === 'response.create'))
    expect(heard.find((m) => m.type === 'held')).toMatchObject({
      call: 'call-2'
    })
    expect(heard.some((m) => m.type === 'tool' && m.call === 'call-2')).toBe(
      false
    )
    const held = upstream.find((e) => e.type === 'conversation.item.create')!
    expect(JSON.parse(held.item.output).error).toMatch(/^Held: Jev read/)

    // A big change waits for the creator's yes.
    const plan = (call: string, item: string, transcript: string) => {
      toService({ type: 'input_audio_buffer.committed', item_id: item })
      toService({
        type: 'conversation.item.input_audio_transcription.completed',
        item_id: item,
        transcript
      })
      toService({
        type: 'response.output_item.done',
        item: {
          type: 'function_call',
          call_id: call,
          name: 'plan_series',
          arguments: '{"confirmed":true}'
        }
      })
    }
    plan('call-3', 'u3', 'Plan the series again')
    await until(() =>
      heard.some((m) => m.type === 'held' && m.call === 'call-3')
    )
    plan('call-4', 'u4', 'Yes, go ahead')
    await until(() =>
      heard.some((m) => m.type === 'tool' && m.call === 'call-4')
    )
    page.send(
      JSON.stringify({
        type: 'tool_result',
        call: 'call-4',
        output: { ok: true, did: 'Planning' }
      })
    )

    // Its voice and words come down; talking over it truncates what was heard.
    toService({
      type: 'response.output_audio.delta',
      item_id: 'a1',
      delta: 'AAAA'
    })
    toService({
      type: 'response.output_audio_transcript.done',
      item_id: 'a1',
      transcript: 'Done.'
    })
    await until(() => heard.some((m) => m.type === 'ai' && m.final))
    expect(heard.find((m) => m.type === 'audio')).toMatchObject({
      item: 'a1',
      data: 'AAAA'
    })
    page.send(JSON.stringify({ type: 'played', item: 'a1', ms: 840.4 }))
    await until(() =>
      upstream.some((e) => e.type === 'conversation.item.truncate')
    )
    expect(
      upstream.find((e) => e.type === 'conversation.item.truncate')
    ).toMatchObject({
      item_id: 'a1',
      content_index: 0,
      audio_end_ms: 840
    })

    // Typed words are read at once and answered.
    toService({ type: 'response.done' })
    upstream.length = 0
    page.send(
      JSON.stringify({
        type: 'say',
        text: 'Put the deploy card into episode two'
      })
    )
    await until(() => upstream.some((e) => e.type === 'response.create'))
    expect(upstream[0]).toMatchObject({
      type: 'conversation.item.create',
      item: { type: 'message', role: 'user', content: [{ type: 'input_text' }] }
    })
    page.send(JSON.stringify({ type: 'stop' }))
    await until(() => heard.some((m) => m.type === 'closed'))
  })

  it('says so when there is no key, and never dials out', async () => {
    voiceDeps.key = async () => ''
    const { heard } = await open(`http://127.0.0.1:${port}`)
    await until(() => heard.some((m) => m.type === 'closed'))
    expect(heard.find((m) => m.type === 'error')).toMatchObject({
      message: expect.stringContaining('OPENAI_API_KEY')
    })
  })
})
