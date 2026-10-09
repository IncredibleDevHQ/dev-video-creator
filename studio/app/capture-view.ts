// A page's product demo: where it is captured from, the steps, and the
// capture itself once it is made. Shown when the page asks for a demo, its
// scene is a product capture, or a capture exists.
import type { Snapshot } from '../shared/api'
import { formatSteps } from '../shared/capture'
import type { Slide } from '../shared/model'
import { escape } from './ui'

const host = (url: string) => {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

const form = (
  snapshot: Snapshot,
  slide: Slide,
  editable: boolean,
  label: string
) => {
  const capture = slide.capture
  const url = capture?.url || snapshot.project.productUrls?.[0] || ''
  return `<form class="capture-form" data-capture-slide="${escape(slide.id)}">
<label for="capture-url-${escape(slide.id)}">Product page</label>
<input id="capture-url-${escape(slide.id)}" name="url" value="${escape(url)}" placeholder="https://your-product.example" required autocomplete="off" ${editable ? '' : 'disabled'}>
<label for="capture-steps-${escape(slide.id)}">Steps <small>one a line; leave empty and the agent drafts them</small></label>
<textarea id="capture-steps-${escape(slide.id)}" name="steps" rows="3" placeholder="click Pricing&#10;scroll 600" ${editable ? '' : 'disabled'}>${escape(capture ? formatSteps(capture.steps) : '')}</textarea>
<button ${editable ? '' : 'disabled'}>${label}</button>
</form>`
}

export const captureBlock = (
  snapshot: Snapshot,
  slide: Slide,
  editable: boolean
) => {
  const capture = slide.capture
  const scene = snapshot.project.video?.scenes.find(
    (item) => item.slideId === slide.id
  )
  const wanted =
    capture ||
    slide.needs?.some((need) => need.kind === 'demo') ||
    scene?.shot === 'product-capture'
  if (!wanted) return ''
  const body =
    capture?.state === 'planning'
      ? `<p class="capture-state" role="status">Drafting the steps from ${escape(host(capture.url))}…</p>`
      : capture?.state === 'capturing'
        ? `<p class="capture-state" role="status">Capturing ${escape(host(capture.url))}…</p>`
        : capture?.state === 'ready' && capture.objectKey
          ? `<video class="capture-video" src="/objects/${escape(capture.objectKey)}" muted controls playsinline preload="metadata"></video>
<p class="capture-state">${capture.seconds}s of ${escape(host(capture.url))}</p>
<details class="capture-again"><summary>Change the steps</summary>${form(snapshot, slide, editable, 'Capture again')}</details>`
          : `${capture?.state === 'failed' ? `<p class="capture-failed">${escape(capture.error || 'The capture did not finish')}</p>` : ''}${form(snapshot, slide, editable, capture ? 'Try again' : 'Capture the demo')}`
  // While a new capture is made, or after one fails, the last good one
  // still plays in the scene: say so, and show it.
  const kept =
    capture?.last && capture.state !== 'ready'
      ? `<video class="capture-video" src="/objects/${escape(capture.last.objectKey)}" muted controls playsinline preload="metadata"></video>
<p class="capture-state">The scene keeps this ${capture.last.seconds}s capture until the new one is ready.</p>`
      : ''
  return `<div class="capture-block"><h3>Demo</h3>${body}${kept}</div>`
}
