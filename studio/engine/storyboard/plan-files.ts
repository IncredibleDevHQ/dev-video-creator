// The plan as Hyperframes' own files: STORYBOARD.md (storyboard-format.md,
// with story-design's narrative fields, the studio's build and page keys,
// and, once designed, each frame's time-coded shot) and SCRIPT.md
// (script-format.md: the locked spoken lines, one per spoken frame). The
// studio writes them from the checked plan; the scripts parse them.
import {
  frameId,
  type EpisodePlan,
  type FrameShot,
  type FrameStatus
} from '../../shared/storyboard'

export type StoryboardFiles = {
  /** '1920x1080', '1080x1920' or '1080x1080'. */
  format: string
  /** Seconds the episode is expected to run. */
  target?: number
  shots?: Record<number, FrameShot>
  /** Measured seconds per frame, once the voice exists. */
  durations?: Record<number, number>
  statuses?: Record<number, FrameStatus>
  /** collaborative or autonomous (brief-contract.md § 1). */
  mode?: 'collaborative' | 'autonomous'
  /** Per frame: real media the frame plays (a take, a capture). */
  media?: Record<number, string>
}

const one = (value: string) => value.replace(/\s+/g, ' ').trim()
const quoted = (value: string) => `"${one(value)}"`
const seconds = (value: number) => `${Math.round(value * 1000) / 1000}s`

export const frameSrc = (frame: { number: number; title: string }) =>
  `compositions/frames/${frameId(frame)}.html`

const shotLines = (shot: FrameShot) => [
  `- blueprint: ${one(shot.blueprint)}`,
  `- focal: ${one(shot.focal)}`,
  `- roles: ${one(shot.roles)}`,
  '',
  ...(shot.adapt ? [`Adapt: ${one(shot.adapt)}`] : []),
  ...shot.windows.map(
    (window, index) =>
      `Scene ${index + 1} (${window.from.toFixed(1)}–${window.to.toFixed(1)}s): ${one(window.text)}`
  )
]

/** STORYBOARD.md for the episode: frontmatter, `## Video direction`, frames. */
export const renderStoryboard = (plan: EpisodePlan, files: StoryboardFiles) => {
  const lines = [
    '---',
    `format: ${files.format}`,
    ...(files.target ? [`duration: ${Math.round(files.target)}s`] : []),
    `message: ${quoted(plan.message)}`,
    `arc: ${one(plan.structure)}`,
    `audience: ${quoted(plan.audience)}`,
    `mode: ${files.mode || 'collaborative'}`,
    'music: none',
    `hook: ${one(plan.hook)}`,
    '---',
    '',
    `This video tells ${one(plan.audience)} that ${one(plan.message)}`,
    '',
    ...(plan.continuity ? [`Continuity: ${one(plan.continuity)}`, ''] : []),
    '## Video direction',
    '',
    `- palette: ${one(plan.direction.palette)}`,
    `- motion: ${one(plan.direction.motion)}`,
    `- held frames: ${one(plan.direction.held)}`,
    `- never: ${one(plan.direction.never)}`,
    ''
  ]
  for (const scene of plan.scenes)
    for (const frame of scene.frames) {
      const shot = files.shots?.[frame.number]
      const duration = files.durations?.[frame.number] ?? frame.duration
      lines.push(
        `## Frame ${frame.number} — ${one(frame.title)}`,
        '',
        `- scene: ${one(frame.scene)}`,
        `- voiceover: ${quoted(frame.voiceover)}`,
        `- duration: ${seconds(duration)}`,
        `- transition_in: ${frame.transition}`,
        `- status: ${files.statuses?.[frame.number] === 'failed' ? 'outline' : files.statuses?.[frame.number] || 'outline'}`,
        `- src: ${frameSrc(frame)}`,
        `- type: ${frame.type}`,
        `- persuasion: ${one(frame.persuasion)}`,
        `- beat: ${one(frame.beat)}`,
        `- build: ${scene.build}`,
        `- page: ${scene.pageId}`,
        ...(files.media?.[frame.number]
          ? [`- media: ${files.media[frame.number]}`]
          : []),
        ...(shot
          ? shotLines(shot)
          : frame.blueprint
            ? [`- blueprint: ${frame.blueprint}`]
            : []),
        '',
        `narrativeRole: ${one(frame.narrativeRole)}`,
        `keyMessage: ${one(frame.keyMessage)}`,
        ''
      )
    }
  return lines.join('\n')
}

/** SCRIPT.md: the locked narration, one line per spoken frame. */
export const renderScript = (
  plan: EpisodePlan,
  voice: { name: string; direction?: string },
  durations?: Record<number, number>
) => {
  const lines = [
    `# SCRIPT — ${one(plan.message)}`,
    '',
    `**Voice:** ${one(voice.name)}`,
    `**Voice direction:** ${one(voice.direction || 'Clear and warm, the pace of someone explaining to a colleague.')}`,
    '',
    '---',
    ''
  ]
  let at = 0
  for (const scene of plan.scenes)
    for (const frame of scene.frames) {
      const length = durations?.[frame.number] ?? frame.duration
      if (frame.voiceover)
        lines.push(
          `## Line ${frame.number} — ${one(frame.title)} (Frame ${frame.number})`,
          '',
          `**Time:** ${at.toFixed(1)} – ${(at + length).toFixed(1)}s`,
          `**Delivery:** ${one(frame.beat)}`,
          '',
          `    ${one(frame.voiceover)}`,
          ''
        )
      at += length
    }
  return lines.join('\n')
}

/** The frames in order, with their scene's build and page. */
export const planFrames = (plan: EpisodePlan) =>
  plan.scenes.flatMap((scene) =>
    scene.frames.map((frame) => ({
      ...frame,
      build: scene.build,
      pageId: scene.pageId
    }))
  )
