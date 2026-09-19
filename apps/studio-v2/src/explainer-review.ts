// Used by the local harness's review window and the editor import. The same
// compiler and driver render the candidate, editor preview and export.
import { instantiateMotionDriver, type MotionDriverInstance } from 'markdown-composition'
import { atomizeSlideSvg, flattenUnits } from './slide-atoms'
import { compileSceneProgram, sanitizeSceneProgram, type SceneProgram } from './scene-program'

let driver: MotionDriverInstance | null = null
let caption: HTMLElement | null = null
let lines: string[] = []

export const reviewExplainer = async (svg: string, raw: SceneProgram) => {
  const errors: string[] = []
  const warnings: string[] = []
  const parsed = new DOMParser().parseFromString(svg, 'image/svg+xml')
  const root = parsed.documentElement
  if (parsed.querySelector('parsererror') || root.tagName !== 'svg') return { errors: ['Invalid SVG'], warnings, frames: [] }
  if (root.querySelector('script,foreignObject,image') || /\son\w+\s*=/i.test(svg) || /(?:href|url\()\s*=?\s*["']?https?:/i.test(svg)) return { errors: ['Scenes must be self-contained editable SVG without scripts or remote assets'], warnings, frames: [] }
  if (root.getAttribute('data-scene-mode') !== 'explainer') errors.push('Declare data-scene-mode="explainer" on the SVG root')
  if (root.querySelector('[data-role="footer"]') || /SHEET\s+\d/i.test(root.textContent || '')) errors.push('Remove presentation footers from the video composition')
  const atomized = atomizeSlideSvg(svg)
  const program = sanitizeSceneProgram(raw, atomized.units)
  if (!program) return { errors: [...errors, 'No scene program'], warnings, frames: [] }
  const inputEvents = raw.beats.flatMap(b => [b, ...(b.then || [])]).flatMap(b => b.events || [])
  const events = program.beats.flatMap(b => [b, ...(b.then || [])]).flatMap(b => b.events || [])
  if (inputEvents.length !== events.length) errors.push(`Only ${events.length} of ${inputEvents.length} events resolved. Check actor/action names and the limit of 64 events per beat; no events may silently disappear.`)
  const known = new Set(flattenUnits(atomized.units).flatMap(unit => [unit.id, ...unit.ids, ...Object.keys(unit.appearance?.parts || {}).map(part => `${unit.id}.${part}`)]))
  for (const event of inputEvents) {
    if (!event.actor || !known.has(event.actor)) errors.push(`Event ${event.id || event.action}: actor "${event.actor || '(missing)'}" is not a scene object or named part`)
    if (['spend', 'refill'].includes(event.action) && !program.cast.some(actor => actor.id === event.actor && actor.quantity)) errors.push(`Event ${event.id}: put quantity:{of,value,max,shownOn,counted} on cast actor "${event.actor || '(missing)'}", and use actor/action/amount on the event`)
  }
  for (const actor of raw.cast || []) {
    if (!actor.quantity) continue
    for (const name of ['shownOn', 'counted'] as const) {
      const binding = actor.quantity[name]
      if (binding && !known.has(binding)) errors.push(`Quantity on ${actor.id}: ${name} "${binding}" does not resolve. Give its element an id and data-part under the same semantic node.`)
    }
    if (!actor.quantity.shownOn && !actor.quantity.counted) errors.push(`Quantity on ${actor.id} has no visible binding`)
  }
  if (program.beats.some(b => /\b(?:row\s*#?\s*["“]?\d|the title is|its circle follows)\b/i.test(b.say))) errors.push('Narration describes the presentation; explain the mechanism instead')
  if (root.getAttribute('data-explainer-kind') !== 'summary' && !events.some(e => ['travel', 'pass', 'reject', 'spend', 'refill', 'perform', 'become'].includes(e.action))) errors.push('A mechanism scene needs observable actions, not only reveals and highlights')
  for (const beat of program.beats) {
    const seen = new Set<string>()
    for (const e of beat.events || []) {
      if (e.after && !seen.has(e.after)) errors.push(`Unknown or forward dependency ${e.after}`)
      if (e.id) seen.add(e.id)
      if (e.action === 'perform' && (!e.clip || e.clip.toMs <= e.clip.fromMs)) errors.push('A performance needs a positive local clip range')
    }
  }
  const compiled = compileSceneProgram(program, atomized.units, { viewBox: atomized.viewBox })
  if (!compiled) return { errors: [...errors, 'Could not compile the story'], warnings, frames: [] }
  document.body.replaceChildren()
  document.body.style.cssText = 'margin:0;background:#101827;overflow:hidden;'
  const host = document.createElement('div')
  host.style.cssText = 'position:relative;width:1600px;height:900px;'
  host.innerHTML = svg
  const live = host.querySelector('svg')!
  live.style.cssText = 'width:1600px;height:900px;display:block;'
  document.body.append(host)
  await document.fonts.ready
  const scale = atomized.viewBox.width / 1600
  const objects = Array.from(live.querySelectorAll('[data-appearance-key]'))
  if (!objects.length && root.getAttribute('data-explainer-kind') !== 'summary') errors.push('No reusable Quiver artwork is used in this mechanism scene')
  for (const object of objects) {
    const rect = object.getBoundingClientRect()
    const minimum = object.closest('[data-actor]') ? 36 : 110
    if (Math.min(rect.width, rect.height) * scale < minimum) errors.push(`Artwork ${object.id || object.getAttribute('data-appearance-key')} is too small to perform its role (minimum ${minimum} px)`)
  }
  const largestObject = Math.max(0, ...objects.map(o => Math.max(o.getBoundingClientRect().width, o.getBoundingClientRect().height) * scale))
  if (objects.length && largestObject < 240) errors.push(`The largest visible artwork is ${Math.round(largestObject)} px; give the main object at least 240 px of stage space. Scale the actual paths, not just their surrounding viewport.`)
  live.querySelectorAll('text').forEach(text => {
    if ((text.textContent || '').trim() && parseFloat(getComputedStyle(text).fontSize) < 20) warnings.push(`Small text: ${text.textContent?.slice(0, 50)}`)
  })
  for (const action of compiled.plan.steps.flatMap(b => b.actions).filter(a => a.op === 'clip')) {
    for (const id of action.targets) {
      const clip = live.querySelector(`#${CSS.escape(id)}`)
      if (!clip?.matches('svg[data-object-clip]') && !clip?.getAnimations({ subtree: true }).length) errors.push(`Performance ${id} has no authored animation`)
      if (clip?.matches('svg[data-object-clip]') && Number(action.value?.to) > Number(clip.getAttribute('data-duration-ms'))) errors.push(`Performance ${id} exceeds its authored clip duration`)
    }
  }
  live.querySelectorAll('svg[data-object-clip]').forEach(clip => {
    if (!clip.querySelector('animate,animateTransform,animateMotion') || !(Number(clip.getAttribute('data-duration-ms')) > 0)) errors.push(`Clip ${clip.id} needs animation and data-duration-ms`)
    clip.querySelectorAll('animate,animateTransform,animateMotion').forEach(a => {
      if (!/^\d+(?:\.\d+)?(?:ms|s)$/.test(a.getAttribute('dur') || '') || !/^\d*(?:\.\d+)?(?:ms|s)?$/.test(a.getAttribute('begin') || '0s') || a.getAttribute('repeatCount') === 'indefinite') errors.push(`Clip ${clip.id} must use finite numeric timings, no autonomous loops`)
    })
  })
  driver = instantiateMotionDriver(live, compiled.plan)
  caption = document.createElement('div')
  caption.style.cssText = 'position:absolute;bottom:18px;left:120px;right:120px;text-align:center;color:white;background:#101827ee;padding:8px 18px;font:24px system-ui;border-radius:8px;'
  host.append(caption)
  lines = program.beats.map(b => b.say)
  const frames = compiled.plan.steps.flatMap((beat, i) => {
    const offset = driver!.offsets[i]
    const span = beat.motionWindowMs + beat.holdMs
    return [...new Set([offset, offset + span / 2, offset + span - 1, ...beat.actions.filter(a => ['move', 'level', 'clip', 'morph'].includes(a.op)).map(a => offset + a.startMs + a.durationMs / 2)])].map(ms => Math.round(ms))
  }).sort((a, b) => a - b)
  return { errors: [...new Set(errors)], warnings: [...new Set(warnings)], frames, durationMs: driver.durationMs, program, plan: compiled.plan, windows: compiled.windows, units: flattenUnits(atomized.units).length }
}

export const explainerFrame = (ms: number) => {
  if (!driver) throw new Error('Review a scene first')
  driver.draw(ms)
  let beat = 0
  driver.offsets.forEach((at, i) => { if (at <= ms) beat = i })
  if (caption) caption.textContent = lines[beat] || ''
  return { ms, beat }
}
