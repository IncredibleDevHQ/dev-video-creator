// The dialogue as every page block's card shows it: the windows of
// attention with their heroes, and whether the motion currently follows
// them. Shared by scene and slide blocks so the notebook reads the same way
// wherever a page is animated. Returns Tiptap DOM specs (renderHTML shape).
// Tiptap's DOMOutputSpec shape, typed loosely (it is recursive).
type DomSpec = unknown

type CardWindow = { say?: string; hero?: string; heroLabel?: string; layout?: string; parts?: string[] }
type CardBeat = { explanation?: string; motionWindowMs?: number; holdMs?: number }

const normalize = (text: string) => text.replace(/\s+/g, ' ').trim()

export const dialogueState = (attrs: Record<string, unknown>) => {
  const windows = (Array.isArray(attrs.windows) ? attrs.windows : []) as CardWindow[]
  const motion = attrs.motion && typeof attrs.motion === 'object' ? (attrs.motion as { steps?: CardBeat[] }) : null
  const beats = Array.isArray(motion?.steps) ? motion!.steps : []
  // Older blocks carry their narration only as steps: that is the draft.
  const steps = (Array.isArray(attrs.steps) ? attrs.steps : []) as Array<{ title?: string; explanation?: string }>
  const script =
    String(attrs.script || '').trim() ||
    steps.map(step => String(step.explanation || '').trim()).filter(Boolean).join('\n\n')
  const seconds = beats.length ? Math.round(beats.reduce((sum, beat) => sum + (beat.motionWindowMs || 0) + (beat.holdMs || 0), 0) / 100) / 10 : 0
  const inSync =
    windows.length > 0 &&
    beats.length === windows.length &&
    windows.every((window, index) => normalize(String(window.say || '')) === normalize(String(beats[index]?.explanation || '')))
  const status: 'none' | 'draft' | 'legacy' | 'unplanned' | 'stale' | 'synced' = !windows.length
    ? beats.length && script ? 'legacy' : script ? 'draft' : 'none'
    : !beats.length
      ? 'unplanned'
      : inSync ? 'synced' : 'stale'
  // Against the director's length brief (read from the picture): a draft
  // under sixty percent of it was kept short.
  const brief = attrs.lengthBrief && typeof attrs.lengthBrief === 'object' ? (attrs.lengthBrief as { seconds?: number }) : null
  const spoken = seconds || (script ? Math.round(script.split(/\s+/).filter(Boolean).length / 2.5) : 0)
  const thin = Boolean(brief && Number(brief.seconds) > 0 && spoken > 0 && spoken < Number(brief.seconds) * 0.6)
  return { windows, script, seconds, status, brief: brief && Number(brief.seconds) > 0 ? { seconds: Number(brief.seconds) } : null, spoken, thin }
}

const STATUS_TEXT: Record<ReturnType<typeof dialogueState>['status'], string> = {
  none: 'no dialogue yet',
  draft: 'drafted — open it to plan the motion',
  legacy: 'motion planned from the words — open it to edit as windows',
  unplanned: 'in windows, motion not planned yet',
  stale: 'changed since the motion was planned — re-plan',
  synced: 'the motion follows it',
}

export const dialogueSection = (attrs: Record<string, unknown>): DomSpec => {
  const { windows, script, seconds, status, brief, spoken, thin } = dialogueState(attrs)
  const head: DomSpec = [
    'div',
    { class: 'block-dialogue-head' },
    ['span', { class: 'block-dialogue-label' }, 'Dialogue'],
    [
      'span',
      { class: `block-dialogue-state is-${status}${thin ? ' is-thin' : ''}` },
      `${status === 'synced' ? `${windows.length} window${windows.length === 1 ? '' : 's'} · ${seconds}s · the motion follows it` : STATUS_TEXT[status]}${thin && brief ? ` · kept short: ${spoken}s of the ${brief.seconds}s the page deserves` : ''}`,
    ],
    [
      'button',
      { type: 'button', class: 'block-dialogue-edit', 'data-slide-action': 'edit' },
      status === 'none' ? 'Write the dialogue' : 'Edit dialogue & motion',
    ],
  ]
  if (!windows.length) {
    return [
      'section',
      { class: `block-dialogue is-${status}` },
      head,
      script
        ? ['p', { class: 'block-dialogue-draft' }, script.length > 420 ? `${script.slice(0, 420)}…` : script]
        : ['p', { class: 'block-dialogue-empty' }, 'What you say over this page. Write it, or let the writer draft it with the page in front of it — the motion is planned from it.'],
    ]
  }
  return [
    'section',
    { class: `block-dialogue is-${status}` },
    head,
    [
      'ol',
      { class: 'block-dialogue-windows' },
      ...windows.map((window, index): DomSpec => [
        'li',
        { class: 'block-dialogue-window' },
        ['span', { class: 'block-dialogue-num' }, String(index + 1)],
        [
          'div',
          { class: 'block-dialogue-body' },
          ['p', {}, String(window.say || '')],
          [
            'span',
            { class: 'block-dialogue-meta' },
            window.layout === 'me'
              ? 'on you'
              : window.heroLabel
                ? `★ ${window.heroLabel}${(window.parts?.length || 0) > 1 ? ` +${(window.parts?.length || 1) - 1}` : ''}`
                : window.parts?.length
                  ? `${window.parts.length} part${window.parts.length === 1 ? '' : 's'}`
                  : 'names nothing on the page',
          ],
        ],
      ]),
    ],
  ]
}

export const dialogueCaption = (attrs: Record<string, unknown>) => {
  const { windows, seconds, status } = dialogueState(attrs)
  if (status === 'synced') return `${windows.length} windows · ${seconds}s of motion`
  if (status === 'stale') return `${windows.length} windows · motion out of date`
  if (status === 'unplanned') return `${windows.length} windows · not planned`
  if (status === 'legacy') return `${seconds}s of motion · dialogue not in windows yet`
  if (status === 'draft') return 'dialogue drafted'
  return 'no dialogue'
}
