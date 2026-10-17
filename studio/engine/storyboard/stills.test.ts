import { expect, it } from 'vitest'
import type { EpisodePlan, PlanFrame } from '../../shared/storyboard'
import { boardPage } from './board'
import { frameDispatch, moves } from './frames'
import { poseDispatch, poseMoment, poseProblems } from './stills'

const frame = (number: number, over: Partial<PlanFrame> = {}): PlanFrame => ({
  number,
  title: `Frame ${number}`,
  scene: `What frame ${number} shows`,
  voiceover: `Line ${number}.`,
  duration: 4,
  transition: 'cut',
  type: 'hook',
  persuasion: 'Before/after',
  beat: 'tension',
  narrativeRole: 'Shows it',
  keyMessage: 'It is so',
  ...over
})

const plan: EpisodePlan = {
  message: 'A request has a timer; a stream <does not>',
  audience: 'developers',
  structure: 'story-explainer',
  hook: 'Stakes / consequence',
  direction: { palette: 'ink', motion: 'reveal', held: 'none', never: 'none' },
  scenes: [
    {
      pageId: 'p1',
      build: 'faceless',
      buildReason: 'It explains',
      frames: [frame(1), frame(2, { voiceover: '', duration: 2.5 })]
    },
    {
      pageId: 'p2',
      build: 'camera',
      buildReason: 'The creator says it',
      frames: [frame(3)]
    }
  ]
}

const pose = (body: string) => `<template>
  <div id="root" data-composition-id="f01-frame-1" data-duration="4">
    <script>
      window.__timelines = window.__timelines || {};
      const tl = gsap.timeline({ paused: true });
      ${body}
      window.__timelines["f01-frame-1"] = tl;
    </script>
  </div>
</template>`

it('lays the board out the way Hyperframes finds it: scenes as acts, a frame per still', () => {
  const html = boardPage({ plan, durations: { 1: 3.2 } }, { p1: 'The limit' })
  expect(html.match(/<div class="frame">/g)).toHaveLength(3)
  expect(html).toContain('<section class="act">Scene 1: The limit</section>')
  // A page with no title falls back to how the scene is built.
  expect(html).toContain('<section class="act">Scene 2: On camera</section>')
  expect(html).toContain('<img src="stills/f01-frame-1.png"')
  expect(html).toContain('<div class="title">01: Frame 1</div>')
  // Measured lengths where the voice has set them; the plan's otherwise.
  expect(html).toContain('<div class="time">0.0 to 3.2s</div>')
  expect(html).toContain('<div class="time">3.2 to 5.7s</div>')
  expect(html).toContain('<p class="words">Line 1.</p>')
  // A silent frame has no words line, and the plan's text is escaped.
  expect(html.match(/class="words"/g)).toHaveLength(2)
  expect(html).toContain('a stream &lt;does not&gt;')
})

it('poses a frame still, with its stand-in, its neighbours and a note', () => {
  const first = poseDispatch({
    frameId: 'f03-frame-3',
    duration: 4,
    standIn: { kind: 'take', still: 'assets/standins/p2-take-abc.jpg' },
    direction: plan.direction,
    neighbours: [{ number: 2, title: 'Frame 2', scene: 'A diagram' }]
  })
  expect(first).toContain(
    '- Write: production/compositions/frames/f03-frame-3.html'
  )
  expect(first).toMatch(
    /Nothing moves\. Register the one paused timeline with no tweens/
  )
  expect(first).toContain(
    'Place the picture assets/standins/p2-take-abc.jpg as an <img>'
  )
  expect(first).toContain('frame 2 “Frame 2” (A diagram). Frame it differently')
  expect(first).toContain('- Captions: enabled')
  expect(first).toContain(
    '- Direction, for every frame of the episode: palette ink; held frames none; never none'
  )
  expect(first).not.toContain('The creator’s note')
  const waiting = poseDispatch({
    frameId: 'f03-frame-3',
    duration: 4,
    standIn: { kind: 'take' },
    neighbours: []
  })
  expect(waiting).toContain('labelled “Your take”')
  const capture = poseDispatch({
    frameId: 'f03-frame-3',
    duration: 4,
    standIn: { kind: 'capture' },
    neighbours: []
  })
  expect(capture).toContain('labelled “Screen capture”')
  const again = poseDispatch({
    frameId: 'f03-frame-3',
    duration: 4,
    neighbours: [],
    note: 'Make the number bigger'
  })
  expect(again).toContain('- Stand-in: none')
  expect(again).toContain('asked: “Make the number bigger”')
  expect(again).toContain(
    'its still is production/boards/stills/f03-frame-3.png'
  )
  expect(poseMoment(4)).toBe(2)
})

it('refuses a pose that moves; a placement is not motion', () => {
  expect(poseProblems(pose('tl.set("#a", { x: 10 });'), 'f01-frame-1')).toEqual(
    []
  )
  expect(
    poseProblems(pose('tl.from("#a", { opacity: 0 });'), 'f01-frame-1')
  ).toEqual([expect.stringMatching(/A pose does not move/)])
  expect(poseProblems('<div></div>', 'f01-frame-1')[0]).toMatch(
    /exactly one <template>/
  )
  // The same test keeps a build from handing back its pose unmoved.
  expect(moves(pose('tl.fromTo("#a", { y: 40 }, { y: 0 }, 0.2);'))).toBe(true)
  expect(moves(pose('gsap.set("#a", { y: 0 });'))).toBe(false)
})

it('starts a frame’s build from its approved still when it has one', () => {
  const built = frameDispatch({
    frameId: 'f01-frame-1',
    duration: 3.2,
    sketch: true,
    findings: ['contrast at 1.00 s: too low']
  })
  expect(built).toContain(
    "- Confirmed sketch: yes. The creator approved this frame's pose on the board"
  )
  expect(built).toContain(
    'its still is production/boards/stills/f01-frame-1.png'
  )
  expect(built).toContain('Never redraw it.')
  expect(built).toContain('- contrast at 1.00 s: too low')
  const fresh = frameDispatch({ frameId: 'f01-frame-1', duration: 3.2 })
  expect(fresh).toContain('- Confirmed sketch: none')
  // The lines keep their order: the shared canvas lines around the sketch.
  expect(fresh.split('\n').slice(6, 9)).toEqual([
    '- Canvas: 1920×1080',
    '- Captions: enabled. Keep every element above y = 900 (the bottom 17% is the caption band).',
    '- Confirmed sketch: none'
  ])
})
