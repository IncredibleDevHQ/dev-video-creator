// On-camera presence (R07 of the projects-first rereview): whether the
// creator appears on camera in a scene — decided apart from who speaks, so
// a scene can be narrated in the creator's voice with no one on camera.
//
//   off   no presenter on camera; the creator's voice, if theirs, is voice-over
//   low   the presenter appears only at the scene's end, for its takeaway or
//         the bridge to the next scene
//   high  the presenter opens and closes the scene, and may hand over between
//         its ideas where a new idea benefits — never a cut to the presenter
//         between every small animation
//
// The video has a default; a scene may override it. Until a take exists, a
// preview shows a labelled stand-in photo wherever the plan puts the
// presenter, so the layout can be judged without a camera.
export const PRESENCES = ['off', 'low', 'high'] as const
export type Presence = (typeof PRESENCES)[number]
export const isPresence = (value: unknown): value is Presence =>
  value === 'off' || value === 'low' || value === 'high'

export const PRESENCE_LABELS: Record<Presence, string> = {
  off: 'Off',
  low: 'Low',
  high: 'High'
}
export const PRESENCE_MEANING: Record<Presence, string> = {
  off: 'No one on camera. Your voice, if you present it, is voice-over.',
  low: 'The presenter appears only at the scene’s end, for its takeaway or bridge.',
  high: 'The presenter opens and closes the scene, and may hand over between its ideas.'
}

// A scene's presence: its own choice, else the video's default, else not
// decided yet.
export type PresenceChoice = {
  value: Presence | null
  from: 'scene' | 'video' | null
}
export const resolvePresence = (
  scene: unknown,
  video: unknown
): PresenceChoice =>
  isPresence(scene)
    ? { value: scene, from: 'scene' }
    : isPresence(video)
      ? { value: video, from: 'video' }
      : { value: null, from: null }

// The headshots bundled with the studio, any of which stands in for the
// presenter in previews.
export const STAND_INS = [
  { id: 'maya', name: 'Maya' },
  { id: 'arun', name: 'Arun' },
  { id: 'jin', name: 'Jin' },
  { id: 'theo', name: 'Theo' },
  { id: 'sofia', name: 'Sofia' }
] as const
export type StandInId = (typeof STAND_INS)[number]['id']
export const isStandIn = (value: unknown): value is StandInId =>
  STAND_INS.some((entry) => entry.id === value)
export const DEFAULT_STAND_IN: StandInId = 'maya'
// Where a preview's bundle holds the stand-in photo: the product supplies it.
export const STAND_IN_PATH = 'media/presenter-standin.jpg'
export const STAND_IN_LABEL = 'Presenter stand-in'

type PresenterMoment = { id: string; presenter: { visibility: string } | null }
const onCamera = (moment: PresenterMoment) =>
  moment.presenter?.visibility === 'full' ||
  moment.presenter?.visibility === 'shared'

// Which of a plan's moments show the presenter: what the policy is checked
// against, and what a preview's stand-in fills.
export const presenterMomentsOf = (moments: PresenterMoment[]) =>
  moments.filter(onCamera).map((moment) => moment.id)

// What a plan does against the scene's presence, in the planner's terms.
export const presenceProblems = (
  moments: PresenterMoment[],
  presence: Presence
): string[] => {
  const problems: string[] = []
  if (!moments.length) return problems
  const undecided = moments
    .filter((moment) => moment.presenter?.visibility === 'undecided')
    .map((moment) => moment.id)
  if (undecided.length)
    problems.push(
      `on-camera presence is ${PRESENCE_LABELS[presence]} for this scene, so every moment decides the presenter: ${undecided.join(', ')} ${undecided.length === 1 ? 'is' : 'are'} "undecided" — make each full, shared or hidden`
    )
  const shown = presenterMomentsOf(moments)
  const first = moments[0].id
  const last = moments[moments.length - 1].id
  if (presence === 'off' && shown.length) {
    problems.push(
      `on-camera presence is Off for this scene: no moment shows the presenter, but ${shown.join(', ')} ${shown.length === 1 ? 'does' : 'do'} — hide them; a voice the creator records is voice-over`
    )
  }
  if (presence === 'low') {
    const early = shown.filter((id) => id !== last)
    if (early.length)
      problems.push(
        `on-camera presence is Low for this scene: the presenter appears only in its closing moment (${last}), for the takeaway or the bridge — ${early.join(', ')} ${early.length === 1 ? 'shows' : 'show'} them earlier`
      )
    if (!shown.includes(last))
      problems.push(
        `on-camera presence is Low for this scene: its closing moment (${last}) shows the presenter, full or shared, for the takeaway or the bridge`
      )
  }
  if (presence === 'high') {
    if (!shown.includes(first))
      problems.push(
        `on-camera presence is High for this scene: the presenter opens it — its first moment (${first}) shows them, full or shared`
      )
    if (!shown.includes(last))
      problems.push(
        `on-camera presence is High for this scene: the presenter closes it — its last moment (${last}) shows them, full or shared`
      )
  }
  return problems
}

// The video's opening scene shows the video's actual title (U02 of the
// projects-first rereview): read in its first or second moment's text.
const plainOf = (text: string) =>
  text
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[^\p{L}\p{N}']+/gu, ' ')
    .trim()
// The first moment whose text reads the title, or -1.
export const titleMomentOf = (
  moments: Array<{ text: { content: string } | null }>,
  title: string
) => {
  const wanted = plainOf(title)
  return wanted
    ? moments.findIndex((moment) =>
        Boolean(moment.text && plainOf(moment.text.content).includes(wanted))
      )
    : -1
}
export const showsTitle = (
  moments: Array<{ text: { content: string } | null }>,
  title: string
) => {
  if (!plainOf(title)) return true
  const at = titleMomentOf(moments, title)
  return at === 0 || at === 1
}
