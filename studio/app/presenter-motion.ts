import type { Moment } from '../shared/model'
import { presenterSpans, presenterFrame } from '../shared/presenter-motion'
/** Paint layout from media time, so seeking and pausing produce identical frames. */
export function syncPresenterLayout(
  root: ParentNode,
  moments: Moment[],
  second: number
) {
  const stage = root.querySelector<HTMLElement>('.video-stage'),
    presenter = stage?.querySelector<HTMLElement>('.presenter-preview')
  if (!stage || !presenter) return
  const spans = presenterSpans(moments)
  const index = spans.findIndex(
    (span) => second >= span.start && second < span.end
  )
  if (index < 0) return
  const frame = presenterFrame(spans, index, second - spans[index].start)
  stage.classList.add('presenter-motion')
  for (const [name, rect] of Object.entries({
    content: frame.content,
    camera: frame.camera
  }))
    for (const [key, value] of Object.entries(rect))
      stage.style.setProperty(
        `--${name}-${key}`,
        `${(value / (key === 'x' || key === 'width' ? 1920 : 1080)) * 100}%`
      )
  presenter.style.opacity = String(frame.opacity)
}
