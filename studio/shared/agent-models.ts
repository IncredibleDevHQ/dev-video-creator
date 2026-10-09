// The models Claude Code can run, by the names the creator sees. Claude Code
// has no command that lists them; a model newer than the CLI is marked
// unavailable by the engine. An alias says what it is in a tooltip.
export const CLAUDE_MODELS: Array<{
  id: string
  label: string
  hint?: string
  minVersion?: string
}> = [
  // Named, so a run is the model chosen: on Claude Code 2.1.278 the opus
  // alias ran claude-opus-5, and Opus 5.5 needs 2.1.280 (seen 8 Oct).
  { id: 'claude-opus-5-5', label: 'Opus 5.5', minVersion: '2.1.280' },
  { id: 'opus', label: 'Opus', hint: 'The CLI’s opus alias: its newest Opus' },
  {
    id: 'sonnet',
    label: 'Sonnet',
    hint: 'The CLI’s sonnet alias: its newest Sonnet'
  },
  {
    id: 'haiku',
    label: 'Haiku',
    hint: 'The CLI’s haiku alias: its newest Haiku'
  }
]

/** A model's name for the creator: the picker's label when it is listed,
 * else its own short name ("kimi-code/k3" → "K3"). */
export const modelName = (model?: string) => {
  if (!model) return ''
  const listed = CLAUDE_MODELS.find((item) => item.id === model)
  if (listed) return listed.label
  const name = model.split('/').pop() || model
  return name.length <= 4 ? name.toUpperCase() : name
}
