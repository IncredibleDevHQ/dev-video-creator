import { gsap } from 'gsap'
import { MotionPathPlugin } from 'gsap/MotionPathPlugin'
import { animateStoryPresenter } from './story-presenter'
import { animateRollingHeadline } from './rolling-headline'

gsap.registerPlugin(MotionPathPlugin)

/** A single clock keeps the source, diagram, presenter and controls in sync. */
const createTimeline = (story: HTMLElement, mobile: boolean) => {
  const select = gsap.utils.selector(story)
  const timeline = gsap.timeline({
    repeat: -1,
    defaults: { ease: 'power2.inOut' }
  })
  const startX = mobile ? 0 : 150
  gsap.set(select('.story-board'), { x: startX })
  gsap.set(select('.story-progress i:first-child'), { opacity: 1 })
  gsap.set(select('.story-playback i'), { scaleX: 0 })
  gsap.set(select('.story-playback'), {
    left: mobile ? 18 : 168,
    right: mobile ? 18 : 168,
    top: 474
  })
  gsap.set(select('.network-signal'), { autoAlpha: 0 })
  for (const path of story.querySelectorAll<SVGPathElement>(
    '.network-wires path'
  )) {
    const length = path.getTotalLength()
    gsap.set(path, { strokeDasharray: length, strokeDashoffset: length })
  }

  timeline
    .fromTo(
      select('.story-composition'),
      { opacity: 0 },
      { opacity: 1, duration: 0.6 },
      0
    )
    .fromTo(
      select('.story-pointer'),
      { x: 40, y: 24 },
      { x: 0, y: 0, duration: 1 },
      0.4
    )
    .to(
      select('.story-paste-shortcut'),
      { scale: 0.9, duration: 0.16, repeat: 1, yoyo: true },
      1.5
    )
    .to(select('.story-paste'), { autoAlpha: 0, y: -6, duration: 0.35 }, 1.9)
    .fromTo(
      select('.story-content'),
      { y: 12, autoAlpha: 0 },
      { y: 0, autoAlpha: 1, duration: 0.65 },
      2.2
    )
    .fromTo(
      select('.story-notes > div'),
      { y: 8, opacity: 0 },
      { y: 0, opacity: 1, stagger: 0.18, duration: 0.5 },
      2.55
    )

  // The notes become a slide before the video and presenter are introduced.
  timeline
    .to(
      select('.story-notes, .story-file, .stage-notes'),
      { autoAlpha: 0, duration: 0.4 },
      5.8
    )
    .to(
      select('.story-board'),
      {
        backgroundColor: '#123d2d',
        color: '#eaf4df',
        borderColor: '#38634c',
        duration: 0.8
      },
      6
    )
    .to(select('.story-title'), { y: -5, fontSize: 34, duration: 0.8 }, 6)
    .to(
      select('.stage-slides, .story-slide-footer, .story-diagram'),
      { autoAlpha: 1, duration: 0.65 },
      6.4
    )
    .fromTo(
      select('.network-token'),
      { y: 8, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.55, stagger: 0.12 },
      6.7
    )
    .to(
      select('.network-wires path'),
      { strokeDashoffset: 0, duration: 1, stagger: 0.16 },
      7
    )
    .fromTo(
      select('.network-projection, .network-matrix, .network-context'),
      { opacity: 0 },
      { opacity: 1, stagger: 0.18, duration: 0.65 },
      7.4
    )
    .fromTo(
      select('.story-deck'),
      { y: 10, autoAlpha: 0 },
      { y: 0, autoAlpha: 1, duration: 0.65 },
      8
    )
    .to(
      select('.story-progress i:first-child'),
      { opacity: 0.25, duration: 0.4 },
      6
    )
    .to(
      select('.story-progress i:nth-child(2)'),
      { opacity: 1, duration: 0.4 },
      6
    )

  // First let the motion graphics tell the story on their own.
  timeline
    .to(
      select('.story-deck, .stage-slides'),
      { autoAlpha: 0, duration: 0.35 },
      11.7
    )
    .to(
      select('.stage-video, .story-playback, .story-motion-note'),
      { autoAlpha: 1, duration: 0.6 },
      12.1
    )
    .to(
      select('.story-progress i:nth-child(2)'),
      { opacity: 0.25, duration: 0.4 },
      12
    )
    .to(
      select('.story-progress i:nth-child(3)'),
      { opacity: 1, duration: 0.4 },
      12
    )
    .to(
      select('.story-playback i'),
      { scaleX: 1, ease: 'none', duration: 6.8 },
      12.7
    )

  // Only step four adds the creator and their voice to the same video.
  timeline
    .to(select('.stage-video'), { autoAlpha: 0, duration: 0.3 }, 19.8)
    .to(
      select('.story-board'),
      {
        x: mobile ? 0 : 10,
        scale: mobile ? 1 : 0.93,
        duration: 1.35,
        ease: 'power3.inOut'
      },
      20
    )
    .to(select('.stage-presenter'), { autoAlpha: 1, duration: 0.5 }, 20.6)
    .fromTo(
      select('.story-person'),
      { x: 32, y: 12, scale: 0.94, autoAlpha: 0 },
      {
        x: 0,
        y: 0,
        scale: 1,
        autoAlpha: 1,
        duration: 1.1,
        ease: 'back.out(1.25)'
      },
      20.3
    )
    .to(select('.story-narration'), { autoAlpha: 1, duration: 0.6 }, 21.2)
    .to(
      select('.story-progress i:nth-child(3)'),
      { opacity: 0.25, duration: 0.4 },
      20
    )
    .to(
      select('.story-progress i:nth-child(4)'),
      { opacity: 1, duration: 0.4 },
      20
    )
    .to(
      select('.story-playback'),
      { left: 18, right: 18, top: mobile ? 688 : 474, duration: 1.35 },
      20
    )
    .to(select('.playback-motion'), { autoAlpha: 0, duration: 0.3 }, 20)
    .to(select('.playback-voice'), { autoAlpha: 1, duration: 0.5 }, 20.6)
    .set(select('.story-playback i'), { scaleX: 0 }, 20)
    .to(
      select('.story-playback i'),
      { scaleX: 1, ease: 'none', duration: 10.2 },
      21.5
    )

  animateStoryPresenter(timeline, story)
  const waves = select('.story-wave i')
  waves.forEach((wave: HTMLElement, index: number) => {
    timeline.fromTo(
      wave,
      { scaleY: 0.25 },
      {
        scaleY: 1,
        duration: 0.26 + (index % 4) * 0.05,
        repeat: 23,
        yoyo: true,
        ease: 'sine.inOut'
      },
      21.4 + (index % 5) * 0.09
    )
  })
  for (const at of [12.7, 16.2, 22, 25.5, 29]) {
    timeline
      .to(select('.motion-note-value'), { autoAlpha: 0, duration: 0.2 }, at)
      .to(select('.motion-note-query'), { autoAlpha: 1, duration: 0.2 }, at)
      .to(
        select('.network-token rect'),
        {
          fill: '#2e6147',
          duration: 0.3,
          stagger: 0.12,
          repeat: 1,
          yoyo: true
        },
        at
      )
      .set(select('.signal-query'), { autoAlpha: 1, x: 112, y: 110 }, at)
      .to(
        select('.signal-query'),
        {
          motionPath: {
            path: [
              { x: 112, y: 110 },
              { x: 229, y: 110 },
              { x: 229, y: 46 },
              { x: 337, y: 46 },
              { x: 337, y: 92 },
              { x: 409, y: 92 }
            ],
            curviness: 0
          },
          duration: 1.35,
          ease: 'none'
        },
        at
      )
      .to(select('.signal-query'), { autoAlpha: 0, duration: 0.2 }, at + 1.35)
      .to(
        select('.network-matrix rect'),
        { opacity: 0.4, duration: 0.2, stagger: 0.04, repeat: 1, yoyo: true },
        at + 1.1
      )
      .set(select('.signal-value'), { autoAlpha: 1, x: 309, y: 174 }, at + 1.3)
      .to(
        select('.signal-value'),
        {
          motionPath: {
            path: [
              { x: 309, y: 174 },
              { x: 480, y: 174 },
              { x: 480, y: 126 },
              { x: 552, y: 126 }
            ],
            curviness: 0
          },
          duration: 1.05,
          ease: 'none'
        },
        at + 1.3
      )
      .to(select('.signal-value'), { autoAlpha: 0, duration: 0.2 }, at + 2.35)
      .to(
        select('.network-context rect'),
        { fill: '#b1ec88', duration: 0.35, repeat: 1, yoyo: true },
        at + 2.1
      )
      .to(
        select('.motion-note-query'),
        { autoAlpha: 0, duration: 0.25 },
        at + 1.6
      )
      .to(
        select('.motion-note-value'),
        { autoAlpha: 1, duration: 0.25 },
        at + 1.85
      )
  }
  timeline.to(
    select('.story-composition'),
    { opacity: 0, duration: 0.65 },
    32.2
  )
  return timeline
}

export const animateBrandStory = (
  story: HTMLElement,
  icon: (playing: boolean) => string
) => {
  const media = gsap.matchMedia()
  const viewport = story.querySelector<HTMLElement>('.story-viewport')!
  const film = story.querySelector<HTMLElement>('.story-film')!
  const button = story.querySelector<HTMLButtonElement>('[data-story-motion]')!
  const headlineElement =
    story.parentElement?.querySelector<HTMLElement>('.rolling-headline')
  const headline = headlineElement
    ? animateRollingHeadline(headlineElement)
    : undefined
  let timeline: gsap.core.Timeline | undefined
  let progress = 0
  let userPaused = false
  const fit = () => {
    const mobile = window.innerWidth <= 600
    const width = mobile ? 700 : 1000
    const height = mobile ? 700 : 500
    const top = viewport.getBoundingClientRect().top + window.scrollY
    const space = Math.max(220, window.innerHeight - top - 62)
    // Mobile prioritizes legibility; desktop also fits the available screen height.
    const scale = mobile
      ? viewport.clientWidth / width
      : Math.min(viewport.clientWidth / width, space / height)
    film.style.setProperty('--story-scale', String(scale))
  }
  const syncPlayback = () => {
    timeline?.paused(userPaused || document.hidden)
    headline?.pause(userPaused || document.hidden)
    story.dataset.motion = userPaused ? 'paused' : 'playing'
    const label = userPaused ? 'Play animation' : 'Pause animation'
    button.setAttribute('aria-label', label)
    button.title = label
    button.innerHTML = icon(!userPaused)
  }
  media.add(
    {
      mobile: '(max-width: 600px)',
      desktop: '(min-width: 601px)',
      reduce: '(prefers-reduced-motion: reduce)'
    },
    (context) => {
      const { mobile, reduce } = context.conditions!
      timeline = createTimeline(story, mobile)
      timeline.progress(progress)
      timeline.eventCallback('onUpdate', () => {
        progress = timeline?.progress() || 0
      })
      fit()
      if (reduce) {
        timeline.seek(31.8).pause()
        headline?.pause(true)
        gsap.set(story.querySelectorAll('.network-signal'), { autoAlpha: 0 })
      } else syncPlayback()
      return () => {
        timeline = undefined
      }
    },
    story
  )
  const toggle = () => {
    userPaused = !userPaused
    syncPlayback()
  }
  const visibility = () => {
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches)
      syncPlayback()
  }
  button.addEventListener('click', toggle)
  const resize = new ResizeObserver(fit)
  resize.observe(viewport)
  const source = story.parentElement?.querySelector('#source')
  if (source) resize.observe(source)
  if (headlineElement) resize.observe(headlineElement)
  window.addEventListener('resize', fit)
  document.addEventListener('visibilitychange', visibility)
  return () => {
    headline?.dispose()
    media.revert()
    resize.disconnect()
    button.removeEventListener('click', toggle)
    window.removeEventListener('resize', fit)
    document.removeEventListener('visibilitychange', visibility)
  }
}
