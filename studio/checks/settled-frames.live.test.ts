import { expect, it } from 'vitest'
import { settledFrameProblems } from '../engine/creative/frame-checks'

// A real composition on the pinned runtime, played in a real browser: in
// m1 the actor slides half off the left edge and the label lands on the
// packet; in m2 both are put right.
const composition = `<!doctype html><html><head><meta charset="utf-8">
<style>html,body{margin:0} #scene{position:relative;width:1920px;height:1080px;overflow:hidden;background:#fff}</style>
</head><body>
<div id="scene" data-composition-id="check" data-start="0" data-width="1920" data-height="1080" data-duration="2">
  <svg width="1920" height="1080" viewBox="0 0 1920 1080">
    <g data-sketch-layer="actor"><circle id="actor" cx="400" cy="500" r="80" fill="#3a5fcd"/></g>
    <g data-sketch-layer="packet"><circle id="packet" cx="1000" cy="300" r="20" fill="#d64541"/></g>
    <g data-sketch-layer="labels"><text id="label" x="960" y="312" font-size="44" font-family="Helvetica" opacity="0">cap: five a second</text></g>
  </svg>
</div>
<script src="/runtime/gsap.min.js"></script>
<script src="/runtime/hyperframes.iife.js"></script>
<script>
  const tl = gsap.timeline({ paused: true })
  window.__timelines = window.__timelines || {}
  window.__timelines.check = tl
  tl.to('#actor', { attr: { cx: 20 }, duration: 0.6 }, 0)
  tl.to('#label', { opacity: 1, duration: 0.3 }, 0.2)
  tl.to('#actor', { attr: { cx: 400 }, duration: 0.5 }, 1)
  tl.to('#label', { attr: { y: 600 }, duration: 0.5 }, 1)
</script>
</body></html>`

it('refuses a settled frame that cuts an actor or puts words on a shape', async () => {
  const problems = await settledFrameProblems({ 'index.html': composition }, [
    { id: 'm1', start: 0, end: 1 },
    { id: 'm2', start: 1, end: 2 }
  ])
  expect(problems).toEqual([
    'At the end of m1, actor is cut by the left edge: keep it inside the frame, and its words at least 16 px from every edge, the camera’s framing included (if the scene shows a cut caption on purpose, wrap that depiction in data-intentional="why")',
    'At the end of m1, “cap: five a second” sits on packet: move the words into clear space beside it (or, when the scene shows that defect on purpose, wrap it in data-intentional="why")'
  ])
}, 60_000)

it('leaves alone a defect the scene shows on purpose', async () => {
  // The same frame, with the cut actor and the covered label marked as
  // the story's own depiction of the defect.
  const shown = composition
    .replace(
      '<g data-sketch-layer="actor">',
      '<g data-sketch-layer="actor" data-intentional="the cut-off frame the story is about">'
    )
    .replace(
      '<g data-sketch-layer="packet">',
      '<g data-sketch-layer="packet" data-intentional="the packet the covered label shows">'
    )
    .replace(
      '<g data-sketch-layer="labels">',
      '<g data-sketch-layer="labels" data-intentional="the covered label the story shows">'
    )
  expect(
    await settledFrameProblems({ 'index.html': shown }, [
      { id: 'm1', start: 0, end: 1 },
      { id: 'm2', start: 1, end: 2 }
    ])
  ).toEqual([])
  // Something else laid over the depiction still counts.
  const crowded = shown.replace(
    '</svg>',
    '<g data-sketch-layer="note"><text x="960" y="312" font-size="44" font-family="Helvetica">a real note</text></g></svg>'
  )
  expect(
    await settledFrameProblems({ 'index.html': crowded }, [
      { id: 'm1', start: 0, end: 1 },
      { id: 'm2', start: 1, end: 2 }
    ])
  ).toEqual([
    'At the end of m1, m2, “a real note” sits on packet: move the words into clear space beside it (or, when the scene shows that defect on purpose, wrap it in data-intentional="why")',
    'At the end of m1, “cap: five a second” overlaps “a real note”: move one of them'
  ])
}, 60_000)

it('reads words clipped by their card as cut', async () => {
  const clipped = composition.replace(
    '</svg>',
    '</svg><div style="position:absolute;left:300px;top:700px;width:240px;height:80px;overflow:hidden;border:2px solid #333"><span style="white-space:nowrap;font:40px Helvetica">FLAGGED: overlap and more</span></div>'
  )
  const problems = await settledFrameProblems({ 'index.html': clipped }, [
    { id: 'm2', start: 1, end: 2 }
  ])
  expect(problems).toEqual([
    'At the end of m2, “FLAGGED: overlap and more” is cut by the box that holds it: give the words room in their box, or make the box larger'
  ])
}, 60_000)
