import { categorise } from '../provider-errors'
import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'
import type { HarnessEvent, HarnessOperation } from '../types'

// Classify provider text in memory; never persist raw RPC diagnostics.
export const acpFailureMessage = (error: {
  code?: unknown
  message?: unknown
}) => {
  const category = categorise(
    typeof error.message === 'string' ? error.message : ''
  )
  const safe: Record<string, string> = {
    quota: 'Harness quota or usage limit reached',
    auth: 'Harness authentication failed',
    model: 'Harness model not available for your account',
    'rate-limit': 'Harness rate limit reached',
    network: 'Harness network request failed',
    unavailable: 'Harness is not available'
  }
  return (
    safe[category] ||
    `Harness request failed (${typeof error.code === 'number' ? error.code : 'protocol error'})`
  )
}
// ACP streams thoughts and tool arguments before a complete assistant message.
// Record only a throttled activity signal, never reasoning or raw tool output.
export const acpEvents = (
  emit: (event: HarnessEvent) => void,
  now = Date.now
) => {
  const calls = new Set<string>()
  let lastActivity = 0
  return (update: Record<string, any>) => {
    const ts = now(),
      kind = update.sessionUpdate
    if (
      ![
        'agent_thought_chunk',
        'agent_message_chunk',
        'tool_call',
        'tool_call_update'
      ].includes(kind)
    )
      return
    if (ts - lastActivity >= 5000) {
      emit({ type: 'activity', ts })
      lastActivity = ts
    }
    if (
      kind === 'tool_call' &&
      typeof update.toolCallId === 'string' &&
      !calls.has(update.toolCallId)
    ) {
      calls.add(update.toolCallId)
      const operation: HarnessOperation =
        (
          {
            read: 'read',
            edit: 'edit',
            search: 'search',
            execute: 'run'
          } as const
        )[update.kind as 'read' | 'edit' | 'search' | 'execute'] || 'tool'
      emit({
        type: 'tool',
        ts,
        tool: String(update.title || 'tool').slice(0, 120),
        operation
      })
    }
  }
}
export const runAcp = async (input: {
  command: string
  args: string[]
  cwd: string
  env?: Record<string, string>
  model?: string
  resumeId?: string
  task: string
  onEvent: (event: HarnessEvent) => void
  signal: AbortSignal
}) => {
  if (input.signal.aborted) return { exitCode: 130 }
  const child = spawn(input.command, input.args, {
    cwd: input.cwd,
    env: { ...process.env, ...input.env },
    detached: process.platform !== 'win32',
    stdio: ['pipe', 'pipe', 'pipe']
  })
  const pending = new Map<
    number,
    {
      resolve: (value: any) => void
      reject: (error: Error) => void
      timer?: NodeJS.Timeout
    }
  >()
  let next = 0,
    closed = false,
    sessionId = input.resumeId
  const rejectAll = (error: Error) => {
    for (const p of pending.values()) {
      clearTimeout(p.timer)
      p.reject(error)
    }
    pending.clear()
  }
  const kill = (signal: NodeJS.Signals) => {
    try {
      if (process.platform !== 'win32' && child.pid)
        process.kill(-child.pid, signal)
      else child.kill(signal)
    } catch {}
  }
  let escalation: NodeJS.Timeout | undefined
  const stop = () => {
    kill('SIGTERM')
    escalation = setTimeout(() => kill('SIGKILL'), 3000)
    escalation.unref()
  }
  const abort = () => {
    rejectAll(new Error('Run interrupted'))
    stop()
  }
  const ended = new Promise<void>((resolve) => {
    child.once('close', () => {
      closed = true
      rejectAll(new Error('Harness connection closed'))
      resolve()
    })
  })
  child.once('error', (error) => rejectAll(error))
  child.stdin.on('error', (error) => rejectAll(error))
  // Drain diagnostics without persisting potentially private provider output.
  child.stderr.resume()
  const send = (message: unknown) => {
    if (closed) throw new Error('Harness connection closed')
    child.stdin.write(JSON.stringify(message) + '\n')
  }
  const request = (method: string, params: unknown, timeoutMs = 15000) =>
    new Promise<any>((resolve, reject) => {
      const id = ++next
      const timer = timeoutMs
        ? setTimeout(() => {
            pending.delete(id)
            reject(new Error(`Harness ${method} timed out`))
          }, timeoutMs)
        : undefined
      pending.set(id, { resolve, reject, timer })
      try {
        send({ jsonrpc: '2.0', id, method, params })
      } catch (error) {
        clearTimeout(timer)
        pending.delete(id)
        reject(error)
      }
    })
  const emit = acpEvents(input.onEvent)
  const lines = createInterface({ input: child.stdout })
  lines.on('line', (line) => {
    let message: any
    try {
      message = JSON.parse(line)
    } catch {
      return
    }
    if (!message || typeof message !== 'object') return
    if (
      message.method === 'session/update' &&
      message.params?.sessionId === sessionId
    ) {
      emit(message.params.update || {})
      return
    }
    if (message.method && message.id !== undefined) {
      // Auto mode covers authorized workspace work. Any remaining permission
      // request is refused rather than silently overriding a CLI safety gate.
      send(
        message.method === 'session/request_permission'
          ? {
              jsonrpc: '2.0',
              id: message.id,
              result: { outcome: { outcome: 'cancelled' } }
            }
          : {
              jsonrpc: '2.0',
              id: message.id,
              error: { code: -32601, message: 'Client method unavailable' }
            }
      )
      return
    }
    const waiting = pending.get(message.id)
    if (!waiting) return
    pending.delete(message.id)
    clearTimeout(waiting.timer)
    if (message.error)
      waiting.reject(new Error(acpFailureMessage(message.error)))
    else waiting.resolve(message.result)
  })
  input.signal.addEventListener('abort', abort, { once: true })
  try {
    if (input.signal.aborted) throw new Error('Run interrupted')
    await request('initialize', {
      protocolVersion: 1,
      clientCapabilities: {},
      clientInfo: { name: 'incredible-studio', version: '0.1.0' }
    })
    const session = await request(sessionId ? 'session/load' : 'session/new', {
      cwd: input.cwd,
      mcpServers: [],
      ...(sessionId ? { sessionId } : {})
    })
    sessionId = session.sessionId || sessionId
    if (!sessionId) throw new Error('Harness did not create a session')
    if (input.model)
      await request('session/set_model', { sessionId, modelId: input.model })
    if (!session.modes?.availableModes?.some((mode: any) => mode.id === 'auto'))
      throw new Error('Harness has no non-interactive mode')
    await request('session/set_mode', { sessionId, modeId: 'auto' })
    input.onEvent({ type: 'session', ts: Date.now(), model: input.model })
    if (input.signal.aborted) throw new Error('Run interrupted')
    const result = await request(
      'session/prompt',
      { sessionId, prompt: [{ type: 'text', text: input.task }] },
      0
    )
    return {
      resumeId: sessionId,
      exitCode: result.stopReason === 'end_turn' ? 0 : 1
    }
  } catch (error) {
    if (input.signal.aborted) return { resumeId: sessionId, exitCode: 130 }
    throw error
  } finally {
    input.signal.removeEventListener('abort', abort)
    if (!closed) stop()
    await ended
    lines.close() /* Escalation remains armed for surviving tool children. */
  }
}
