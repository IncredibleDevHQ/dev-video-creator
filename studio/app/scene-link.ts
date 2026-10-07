// A wireframe and its video scene point at each other: each wireframe tile
// says whether its scene is in the video, the wireframe says where its scene
// stands and plays it picture-in-picture once made, with a way to the Video
// page (which has a way back), and a video can start with only some scenes.
import type { Snapshot } from '../shared/api'
import type { Scene, Slide } from '../shared/model'
import { sceneDisplay } from '../shared/state'
import { escape, button } from './ui'

export const sceneOfSlide = (snapshot: Snapshot, slideId?: string) =>
  slideId
    ? snapshot.project.video?.scenes.find((scene) => scene.slideId === slideId)
    : undefined

type SceneStatus = {
  kind: 'none' | 'ready' | 'working' | 'queued' | 'written' | 'failed'
  words: string
}

/** Where a wireframe's scene stands, from the engine's scene display. */
export const sceneStatus = (snapshot: Snapshot, scene: Scene): SceneStatus => {
  const display = sceneDisplay(snapshot, scene)
  if (display.inVideo === false) return { kind: 'none', words: 'No scene' }
  if (snapshot.views?.scenes[scene.id]?.produced)
    return { kind: 'ready', words: 'Scene ready' }
  if (display.failed) return { kind: 'failed', words: 'Scene stopped' }
  if (display.active) return { kind: 'working', words: 'Making scene' }
  if (display.queued) return { kind: 'queued', words: 'Scene queued' }
  return { kind: 'written', words: 'Scene written' }
}

const orbit = '<i class="activity-orbit" aria-hidden="true"></i>'

/**
 * The scene's state on a wireframe tile, for a scene in the video: a tile
 * without a badge has no scene, so no tile repeats "No scene".
 */
export const sceneBadge = (snapshot: Snapshot, slideId: string) => {
  const scene = sceneOfSlide(snapshot, slideId)
  if (!scene) return ''
  const status = sceneStatus(snapshot, scene)
  if (status.kind === 'none') return ''
  return `<span class="scene-badge is-${status.kind}">${
    status.kind === 'working' ? orbit : status.kind === 'ready' ? '▶ ' : ''
  }${escape(status.words)}</span>`
}

const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}`

const openScene = button('Open in Video →', 'open-scene')

/**
 * The wireframe's scene, under the wireframe: where it stands and what can be
 * done with it. Once the scene is made, it also plays picture-in-picture in
 * the wireframe's corner; before that, nothing covers the wireframe.
 */
export const sceneLink = (
  snapshot: Snapshot,
  index: number,
  pipOpen: boolean
): { line: string; pip: string } => {
  const slide = snapshot.project.slides[index]
  if (!slide?.svg || snapshot.status !== 'ready') return { line: '', pip: '' }
  const number = index + 1
  const scene = sceneOfSlide(snapshot, slide.id)
  const line = (words: string, actions: string, kind = 'none') => ({
    line: `<div class="scene-line is-${kind}" role="group" aria-label="Scene ${number} of the video"><span>${words}</span>${actions}</div>`,
    pip: ''
  })
  if (!scene)
    return line(
      'No video yet',
      button('Make a video of this one', 'make-video-one')
    )
  const status = sceneStatus(snapshot, scene)
  if (status.kind === 'none')
    return line(
      `Scene ${number} is not in the video`,
      `<button type="button" class="primary" data-action="make-scene" data-scene-id="${escape(
        scene.id
      )}">Make this scene</button>${openScene}`
    )
  if (status.kind === 'ready' && scene.produced) {
    const length = clock(scene.moments.at(-1)?.end || 0)
    return {
      line: `<div class="scene-line is-ready" role="group" aria-label="Scene ${number} of the video"><span>▶ Scene ${number} ready · ${length}</span>${openScene}</div>`,
      pip: pipOpen
        ? `<aside class="scene-pip" aria-label="Scene ${number}, picture-in-picture"><video class="scene-pip-video" src="/objects/${escape(
            scene.produced.objectKey
          )}" muted loop autoplay playsinline></video><div class="scene-pip-bar"><b>Scene ${number}</b><span>${length}</span>${button(
            'Open in Video →',
            'open-scene'
          )}<button type="button" class="scene-pip-close" data-action="pip-toggle" aria-expanded="true" aria-label="Hide the scene">×</button></div></aside>`
        : `<button type="button" class="scene-pip-chip" data-action="pip-toggle" aria-expanded="false">▶ Scene ${number}</button>`
    }
  }
  const display = sceneDisplay(snapshot, scene)
  return line(
    status.kind === 'working'
      ? `${orbit}Scene ${number}: ${escape(display.label)}`
      : status.kind === 'queued'
        ? `Scene ${number} is queued`
        : status.kind === 'failed'
          ? `Scene ${number}: ${escape(scene.error || 'needs attention')}`
          : `Scene ${number} is written; finish it on the Video page`,
    openScene,
    status.kind
  )
}

/**
 * Which scenes a new video makes: "All scenes" ticks or clears every one, and
 * each can be ticked on its own. All start ticked, or only the one asked for.
 */
export const sceneChoice = (
  slides: Slide[],
  selected: number | null,
  only: boolean,
  /** The wireframes that are done; the others' scenes start once drawn. */
  done?: Set<string>
) => {
  const ticked = only && selected !== null ? 1 : slides.length
  return `<fieldset class="scene-choice">
<legend>Scenes to make</legend>
<label class="scene-choice-all"><input type="checkbox" data-scene-all ${
    ticked === slides.length ? 'checked' : ''
  }><span>All scenes</span><span class="scene-choice-count">${ticked} of ${
    slides.length
  }</span></label>
<ul>${slides
    .map(
      (slide, index) =>
        `<li><label><input type="checkbox" name="scene" value="${escape(
          slide.id
        )}" data-scene-index="${index}" ${
          !only || index === selected ? 'checked' : ''
        }><span class="scene-choice-number">${String(index + 1).padStart(
          2,
          '0'
        )}</span>${escape(slide.title || 'Wireframe')}${
          done && !done.has(slide.id)
            ? '<small class="scene-choice-later">starts once drawn</small>'
            : ''
        }</label></li>`
    )
    .join('')}</ul>
<small>Scenes you leave out can be made later, from their wireframe or the Video page.</small>
</fieldset>`
}

/**
 * Keep "All scenes" and the scenes in step: it sets every scene, and the
 * scenes set it — ticked, clear, or part-ticked — with the count beside it.
 */
export const syncSceneChoice = (
  root: ParentNode,
  changed?: EventTarget | null
) => {
  const all = root.querySelector<HTMLInputElement>(
    '.scene-choice [data-scene-all]'
  )
  const boxes = [
    ...root.querySelectorAll<HTMLInputElement>(
      '.scene-choice input[name=scene]'
    )
  ]
  if (!all || !boxes.length) return
  if (changed === all) for (const box of boxes) box.checked = all.checked
  const ticked = boxes.filter((box) => box.checked).length
  all.checked = ticked === boxes.length
  all.indeterminate = ticked > 0 && ticked < boxes.length
  const count = root.querySelector('.scene-choice-count')
  if (count) count.textContent = `${ticked} of ${boxes.length}`
}
