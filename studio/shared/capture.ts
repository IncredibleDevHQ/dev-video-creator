// A product demo's steps, one a line, as the agent drafts them and the
// creator edits them: "click Sign up", "type #email ada@example.com",
// "scroll 600", "wait 1000", "goto /pricing".
import type { CaptureStep, ProductCapture } from './release'

export const MAX_STEPS = 12

export const formatSteps = (steps: CaptureStep[]) =>
  steps
    .map((step) =>
      step.do === 'goto'
        ? `goto ${step.url}`
        : step.do === 'click'
          ? `click ${step.target}`
          : step.do === 'type'
            ? `type ${step.target} ${step.text}`
            : step.do === 'scroll'
              ? `scroll ${step.y}`
              : `wait ${step.ms}`
    )
    .join('\n')

/** Steps from lines; a line that is not a step says which, and why. */
export const parseSteps = (text: string) => {
  const steps: CaptureStep[] = []
  const problems: string[] = []
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  for (const [index, line] of lines.entries()) {
    const [verb, ...rest] = line.split(/\s+/)
    const tail = line.slice(verb.length).trim()
    const at = `Line ${index + 1}`
    if (verb === 'goto' && tail) steps.push({ do: 'goto', url: tail })
    else if (verb === 'click' && tail) steps.push({ do: 'click', target: tail })
    else if (verb === 'type' && rest.length >= 2)
      steps.push({
        do: 'type',
        target: rest[0],
        text: tail.slice(rest[0].length).trim()
      })
    else if (verb === 'scroll' && /^-?\d{1,5}$/.test(tail))
      steps.push({ do: 'scroll', y: Number(tail) })
    else if (verb === 'wait' && /^\d{1,4}$/.test(tail))
      steps.push({ do: 'wait', ms: Math.min(5000, Number(tail)) })
    else
      problems.push(
        `${at}: write goto, click, type, scroll or wait, then what to act on`
      )
  }
  if (!steps.length) problems.push('Write at least one step')
  if (steps.length > MAX_STEPS) problems.push(`Keep to ${MAX_STEPS} steps`)
  return { steps: steps.slice(0, MAX_STEPS), problems }
}

/** For the scene planner and producer: what the capture shows, in words. */
export const captureNote = (capture: ProductCapture) =>
  `A ${capture.seconds}s capture of ${capture.url}: ${formatSteps(capture.steps).replace(/\n/g, '; ')}`

/** The capture a scene uses: this one when ready, else the last good one. */
export const readyCapture = (
  capture: ProductCapture | undefined
): (ProductCapture & { objectKey: string; seconds: number }) | null =>
  capture?.state === 'ready' && capture.objectKey
    ? (capture as ProductCapture & { objectKey: string; seconds: number })
    : capture?.last
      ? { ...capture.last, state: 'ready' }
      : null
