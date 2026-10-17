// What a release is cut from: the teaser's moments (the hook, then the
// strongest beat), its captions, and the YouTube chapters taken from the
// beats. Pure, so the engine and the page agree.
import { plannedPages, sceneNarrative } from './narratives'
import type { BeatFunction } from './narratives/model'
import type { Project } from './model'
import { TEASER_SECONDS } from './release'
import { videoClock } from './video-clock'

/** Which beat a teaser reaches for first: the one that pays off. */
const STRENGTH: BeatFunction[] = [
  'payoff',
  'turn',
  'resolution',
  'evidence',
  'problem',
  'explain',
  'hook',
  'context',
  'action'
]

/** A part of the produced video: its place, what is said in it, and the
 * story's beats it carries. */
export type SceneTime = {
  index: number
  scene: { moments: Array<{ start: number; end: number; lines: string }> }
  title?: string
  start: number
  end: number
  beats: Array<{ function: BeatFunction; name?: string }>
}

// A storyboard frame's kind, as the beat a teaser reaches for.
const FRAME_BEATS: Record<string, BeatFunction> = {
  hook: 'hook',
  pain_point: 'problem',
  product_intro: 'explain',
  feature_showcase: 'explain',
  benefit_highlight: 'payoff',
  social_proof: 'evidence',
  branding: 'context',
  cta: 'action'
}

/** A storyboard episode's scenes, timed by its frames as voiced, end to end
 * as the film runs them (the Jev series run: no teaser could be cut from a
 * storyboard episode, the older scenes' clock having nothing to time). */
const storyboardTimes = (project: Project): SceneTime[] => {
  let at = 0
  return (project.video?.storyboard?.plan?.scenes || []).map((entry, index) => {
    const start = at
    const moments = entry.frames.map((frame) => {
      const moment = {
        start: at - start,
        end: at - start + frame.duration,
        lines: frame.voiceover
      }
      at += frame.duration
      return moment
    })
    const kinds = entry.frames.map((frame) => FRAME_BEATS[frame.type])
    return {
      index,
      scene: { moments },
      title: project.slides.find((slide) => slide.id === entry.pageId)?.title,
      start,
      end: at,
      beats: [...new Set(kinds.filter(Boolean))].map((fn) => ({
        function: fn
      }))
    }
  })
}

/** Each scene's place in the produced video, with its beats. */
export const sceneTimes = (project: Project): SceneTime[] => {
  const video = project.video
  if (!video?.produced) return []
  // A storyboard episode is timed by its own frames.
  if (video.storyboard?.plan) return storyboardTimes(project)
  const pages = plannedPages(project)
  return videoClock(project).flatMap((interval, index) => {
    const scene = video.scenes.find((item) => item.id === interval.sceneId)
    if (!scene) return []
    const beats =
      sceneNarrative(video, scene.id, pages)?.beats.map((plan) => plan.beat) ||
      []
    return [
      {
        index,
        scene,
        title: project.slides.find((slide) => slide.id === scene.slideId)
          ?.title,
        start: interval.start,
        end: interval.start + interval.duration,
        beats
      }
    ]
  })
}

const round = (value: number) => Math.round(value * 10) / 10

/**
 * A teaser's cuts: the first seconds of the video (its hook), then the
 * strongest beat, or the moment the creator pointed at, to 15–30 s.
 */
export const teaserSegments = (project: Project, moment?: number) => {
  const scenes = sceneTimes(project)
  if (!scenes.length) return []
  const end = scenes.at(-1)!.end
  const [shortest, longest] = TEASER_SECONDS
  if (end <= longest) return [{ from: 0, to: round(end) }]
  const hook = { from: 0, to: round(Math.min(4, scenes[0].end)) }
  // The beat runs to the end of its scene, the moment's when one was given.
  const target =
    moment === undefined
      ? STRENGTH.map((fn) =>
          scenes.find(
            (scene, index) =>
              index > 0 && scene.beats.some((beat) => beat.function === fn)
          )
        ).find(Boolean) || scenes[Math.min(1, scenes.length - 1)]
      : scenes.find((scene) => scene.start <= moment && moment < scene.end) ||
        scenes.at(-1)!
  const from = round(Math.max(hook.to, moment ?? target.start))
  const length = Math.min(
    longest - hook.to,
    Math.max(shortest - hook.to, target.end - from)
  )
  const to = round(Math.min(end, from + length))
  return from >= to ? [hook] : [hook, { from, to }]
}

/** The words spoken in a span of the video, a few at a time, with times. */
export const captionCues = (
  project: Project,
  segments: Array<{ from: number; to: number }>,
  wordsPerCue = 6
) => {
  const cues: Array<{ start: number; end: number; text: string }> = []
  let offset = 0
  for (const segment of segments) {
    for (const timed of sceneTimes(project))
      for (const moment of timed.scene.moments) {
        const start = timed.start + moment.start
        const finish = timed.start + moment.end
        const words = moment.lines.split(/\s+/).filter(Boolean)
        if (!words.length || finish <= segment.from || start >= segment.to)
          continue
        const chunks = Math.ceil(words.length / wordsPerCue)
        const each = (finish - start) / chunks
        for (let index = 0; index < chunks; index++) {
          const from = start + index * each
          const to = from + each
          if (to <= segment.from || from >= segment.to) continue
          cues.push({
            start: round(Math.max(from, segment.from) - segment.from + offset),
            end: round(Math.min(to, segment.to) - segment.from + offset),
            text: words
              .slice(index * wordsPerCue, (index + 1) * wordsPerCue)
              .join(' ')
          })
        }
      }
    offset += segment.to - segment.from
  }
  return cues.filter((cue) => cue.end > cue.start)
}

/** The captions a teaser adds: none over a storyboard episode, which says
 * its own words on screen (the Jev series run showed both at once, and the
 * blurred fill a third time). */
export const teaserCues = (
  project: Project,
  segments: Array<{ from: number; to: number }>
) => (project.video?.storyboard ? [] : captionCues(project, segments))

const stamp = (seconds: number) => {
  const whole = Math.floor(seconds)
  const hours = Math.floor(whole / 3600)
  const minutes = Math.floor((whole % 3600) / 60)
  const rest = String(whole % 60).padStart(2, '0')
  return hours
    ? `${hours}:${String(minutes).padStart(2, '0')}:${rest}`
    : `${minutes}:${rest}`
}

/**
 * YouTube chapters from the beats: a chapter where the beat changes, from
 * 0:00, each at least ten seconds. YouTube wants three or more; fewer and
 * there are none.
 */
export const chapters = (project: Project) => {
  const marks: Array<{ start: number; title: string }> = []
  for (const timed of sceneTimes(project)) {
    const title = timed.beats[0]?.name || timed.title || 'Part'
    if (marks.at(-1)?.title === title) continue
    if (marks.length && timed.start - marks.at(-1)!.start < 10) continue
    marks.push({ start: marks.length ? timed.start : 0, title })
  }
  return marks.length >= 3
    ? marks.map((mark) => `${stamp(mark.start)} ${mark.title}`)
    : []
}

/** The video's title on YouTube: an episode says its series and number,
 * in the bundle and the upload alike. */
export const youtubeTitle = (project: Project, series?: string | null) =>
  (series && project.episode
    ? `${project.title} | ${series}, episode ${project.episode.number}`
    : project.title
  ).slice(0, 100)

/** The description's words, then its chapters. */
export const youtubeDescription = (project: Project, words?: string) => {
  const lines = chapters(project)
  const opening =
    words?.trim() ||
    [project.title, project.slides[0]?.narration || project.slides[0]?.idea]
      .filter(Boolean)
      .join('\n\n')
  return lines.length ? `${opening}\n\n${lines.join('\n')}` : opening
}
