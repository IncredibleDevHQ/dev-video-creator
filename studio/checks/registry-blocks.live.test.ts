import { expect, it } from 'vitest'
import { measureSettledFrames } from '../engine/creative/frame-checks'
import { registryInstall } from '../engine/creative/registry-install'
import { renderProductionBundle } from '../render/production-render'

// An installed registry component, mounted in a real composition on the
// pinned runtime: the settled-frame browser sees inside it, and the
// renderer renders it.
it('mounts an installed component where the checks and the renderer see it', async () => {
  const { seed } = await registryInstall([
    { id: 'count-up', catalog: 'component' }
  ])
  const files: Record<string, string> = {
    'compositions/components/count-up.html': String(
      seed['production/compositions/components/count-up.html']
    ),
    'index.html': `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0}
#scene{position:relative;width:1920px;height:1080px;overflow:hidden;background:#fff;--accent:#3a5fcd;--fg:#1f2328}
.mount{position:absolute;left:460px;top:300px;width:1000px;height:480px;container-type:size}</style></head><body>
<div id="scene" data-composition-id="mounted" data-start="0" data-width="1920" data-height="1080" data-duration="3">
  <div class="mount clip" data-composition-id="count-up" data-composition-src="./compositions/components/count-up.html"
    data-variable-values='{"start":0,"end":30,"suffix":"%","accent":"blue"}' data-start="0" data-duration="3" data-track-index="0" data-width="1000" data-height="480"></div>
</div>
<script src="/runtime/gsap.min.js"></script>
<script src="/runtime/hyperframes.iife.js"></script>
<script>window.__timelines = window.__timelines || {}; window.__timelines.mounted = gsap.timeline({ paused: true }); window.__timelines.mounted.set({}, {}, 3)</script>
</body></html>`
  }
  const { frames } = await measureSettledFrames(files, [
    { id: 'm1', start: 0, end: 2.6 }
  ])
  expect(frames[0].measure.texts.map((text) => text.text).join(' ')).toMatch(
    /30/
  )
  const video = await renderProductionBundle(files, { fps: 30 })
  expect(video.length).toBeGreaterThan(10_000)
}, 180_000)
