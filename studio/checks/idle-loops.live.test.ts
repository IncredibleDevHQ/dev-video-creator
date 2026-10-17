import { expect, it } from 'vitest'
import { settledFrameProblems } from '../engine/creative/frame-checks'

// A real 10 s moment on the pinned runtime, played in a real browser: a card
// and a drawn lamp arrive at once and hold. The lamp blinks on its idle loop,
// as the app puts it in a drawing, or on the scene's own CSS animation.
const scene = (
  style: string
) => `<!doctype html><html><head><meta charset="utf-8">
<style>html,body{margin:0} #scene{position:relative;width:1920px;height:1080px;overflow:hidden;background:#fff}
.card{position:absolute;left:160px;top:420px;width:400px;height:200px;border-radius:16px;background:#ebeffa;font:44px Helvetica;padding:24px;box-sizing:border-box}</style>
</head><body>
<div id="scene" data-composition-id="idle" data-start="0" data-width="1920" data-height="1080" data-duration="10">
  <div class="card">Rate limiter</div>
  <div data-artwork="lamp" style="position:absolute;left:1000px;top:340px;width:400px;height:400px">
    <svg viewBox="0 0 100 100" width="100%" height="100%">${style}@keyframes lamp-blink { 50% { opacity: .1; } } .lamp-blink { animation: lamp-blink 1s linear 999; }</style><g class="lamp-blink" data-idle=""><circle cx="50" cy="50" r="40" fill="#f5b041"/></g></svg>
  </div>
</div>
<script src="/runtime/gsap.min.js"></script>
<script src="/runtime/hyperframes.iife.js"></script>
<script>
  const tl = gsap.timeline({ paused: true })
  window.__timelines = window.__timelines || {}
  window.__timelines.idle = tl
  tl.set({}, {}, 10)
</script>
</body></html>`

const moments = [{ id: 'm1', start: 0, end: 10 }]
const frozen = (problems: string[]) =>
  problems.some((problem) => problem.includes('holds one still frame'))

it('measures drawings at rest, so an idle loop cannot hide a frozen picture', async () => {
  // The app's loop: the check takes it out and finds the picture held.
  expect(
    frozen(
      await settledFrameProblems(
        { 'index.html': scene('<style data-idle-loop="">') },
        moments,
        { skip: [] }
      )
    )
  ).toBe(true)
  // The same blink as the scene's own animation is the scene's motion.
  expect(
    frozen(
      await settledFrameProblems({ 'index.html': scene('<style>') }, moments, {
        skip: []
      })
    )
  ).toBe(false)
}, 120_000)
