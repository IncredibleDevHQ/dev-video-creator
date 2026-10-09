import type { TokenUsage } from '../../../shared/usage'
export type UsageState = {
  messages?: Map<string, TokenUsage>
  streamMessageId?: string
}
const parse = (value: unknown, final: boolean): TokenUsage | null => {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  if (
    ![
      'input_tokens',
      'output_tokens',
      'cache_read_input_tokens',
      'cache_creation_input_tokens'
    ].some(
      (k) =>
        typeof raw[k] === 'number' &&
        Number.isSafeInteger(raw[k]) &&
        (raw[k] as number) >= 0
    )
  )
    return null
  const count = (key: string) =>
    typeof raw[key] === 'number' &&
    Number.isSafeInteger(raw[key]) &&
    raw[key] >= 0
      ? (raw[key] as number)
      : 0
  return {
    input: count('input_tokens'),
    output: count('output_tokens'),
    cacheRead: count('cache_read_input_tokens'),
    cacheWrite: count('cache_creation_input_tokens'),
    final
  }
}
export const claudeUsage = (
  message: Record<string, unknown>,
  state: UsageState
): TokenUsage | null => {
  if (message.type === 'result') return parse(message.usage, true)
  let assistant = message.message as Record<string, unknown> | undefined
  if (message.type === 'stream_event') {
    const event = message.event as Record<string, unknown> | undefined
    if (event?.type === 'message_start') {
      assistant = event.message as Record<string, unknown> | undefined
      state.streamMessageId =
        typeof assistant?.id === 'string' ? assistant.id : undefined
    } else if (event?.type === 'message_delta' && state.streamMessageId) {
      const previous = state.messages?.get(state.streamMessageId)
      const partial = parse(event.usage, false)
      if (!partial) return null
      // Stream deltas report cumulative output for the current message. Preserve
      // input/cache counts supplied by message_start; never count a delta twice.
      assistant = {
        id: state.streamMessageId,
        usage: {
          input_tokens: previous?.input || 0,
          output_tokens: partial.output,
          cache_read_input_tokens: previous?.cacheRead || 0,
          cache_creation_input_tokens: previous?.cacheWrite || 0
        }
      }
    } else if (event?.type === 'message_stop') {
      state.streamMessageId = undefined
      return null
    } else return null
  } else if (message.type !== 'assistant') return null
  if (typeof assistant?.id !== 'string') return null
  const usage = parse(assistant.usage, false)
  if (!usage) return null
  state.messages ||= new Map()
  const previous = state.messages.get(assistant.id)
  if (previous)
    for (const k of ['input', 'output', 'cacheRead', 'cacheWrite'] as const)
      usage[k] = Math.max(previous[k], usage[k])
  state.messages.set(assistant.id, usage)
  return [...state.messages.values()].reduce(
    (a, b) => ({
      input: a.input + b.input,
      output: a.output + b.output,
      cacheRead: a.cacheRead + b.cacheRead,
      cacheWrite: a.cacheWrite + b.cacheWrite,
      final: false
    }),
    { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, final: false }
  )
}
