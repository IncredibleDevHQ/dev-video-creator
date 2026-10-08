import { expect, it } from 'vitest'
import { settledFrameProblems } from '../engine/creative/frame-checks'

// A real 10 s moment on the pinned runtime, played in a real browser. The
// slideshow puts its three cards up in the first second and holds; the
// developing one brings a card in on each of its phrases.
const scene = (
  timeline: string
) => `<!doctype html><html><head><meta charset="utf-8">
<style>html,body{margin:0} #scene{position:relative;width:1920px;height:1080px;overflow:hidden;background:#fff}
.card{position:absolute;top:420px;width:400px;height:200px;border-radius:16px;background:#ebeffa;opacity:0;font:44px Helvetica;padding:24px;box-sizing:border-box}</style>
</head><body>
<div id="scene" data-composition-id="motion" data-start="0" data-width="1920" data-height="1080" data-duration="10">
  <div class="card" id="a" style="left:160px">Moment</div>
  <div class="card" id="b" style="left:760px">Seek point</div>
  <div class="card" id="c" style="left:1360px">Settled frame</div>
</div>
<script src="/runtime/gsap.min.js"></script>
<script src="/runtime/hyperframes.iife.js"></script>
<script>
  const tl = gsap.timeline({ paused: true })
  window.__timelines = window.__timelines || {}
  window.__timelines.motion = tl
  ${timeline}
  tl.set({}, {}, 10)
</script>
</body></html>`

const moments = [{ id: 'm1', start: 0, end: 10 }]

it('refuses a moment that arrives at once and then holds while the voice goes on', async () => {
  const slideshow = scene(
    `tl.to('.card', { opacity: 1, duration: 0.6, stagger: 0.1 }, 0)`
  )
  const problems = await settledFrameProblems(
    { 'index.html': slideshow },
    moments,
    { skip: [] }
  )
  expect(problems.map((problem) => problem.split(':')[0])).toEqual([
    'm1 holds one still frame for 8.5 s (1 s to 9.5 s into the moment)',
    'm1 changes its picture once in 10 s'
  ])
}, 120_000)

it('accepts a moment whose picture develops on its phrases', async () => {
  const developing = scene(`
  tl.fromTo('#a', { opacity: 0, x: -80 }, { opacity: 1, x: 0, duration: 0.8 }, 0.5)
  tl.fromTo('#b', { opacity: 0, y: 60 }, { opacity: 1, y: 0, duration: 0.8 }, 3)
  tl.fromTo('#c', { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1, duration: 0.8 }, 5.5)
  tl.to('#a', { y: 280, duration: 1.2 }, 7.5)`)
  expect(
    await settledFrameProblems({ 'index.html': developing }, moments, {
      skip: []
    })
  ).toEqual([])
  // Without the motion option the check measures settled frames only.
  const slideshow = scene(`tl.to('.card', { opacity: 1, duration: 0.6 }, 0)`)
  expect(
    await settledFrameProblems({ 'index.html': slideshow }, moments)
  ).toEqual([])
}, 120_000)
