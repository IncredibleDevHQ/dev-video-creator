import { documentHtml as html } from '../shared/html'
import type { Project, Scene } from '../shared/model'
import type { SketchFiles } from './types'
import { readAsset, validObjectKey } from '../engine/persistence'
const escape = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]!
  )
export const buildSceneBundle = async (
  project: Project,
  scene: Scene
): Promise<SketchFiles> => {
  const slide = project.slides.find((slide) => slide.id === scene.slideId)
  if (!slide?.svg || !scene.moments.length)
    throw new Error('The scene needs a slide and moments')
  const files: SketchFiles = {}
  const localMedia = async (key: string) => {
    if (!validObjectKey(key)) throw new Error('Invalid media key')
    const path = `media/${key}`
    if (!files[path])
      files[path] = {
        base64: (await readAsset(key)).toString('base64'),
        contentType: key.endsWith('.png')
          ? 'image/png'
          : key.endsWith('.jpg')
            ? 'image/jpeg'
            : key.endsWith('.webp')
              ? 'image/webp'
              : key.endsWith('.mp3')
                ? 'audio/mpeg'
                : key.endsWith('.wav')
                  ? 'audio/wav'
                  : key.endsWith('.mp4')
                    ? 'video/mp4'
                    : 'video/webm'
      }
    return path
  }
  let content = ''
  const script: string[] = []
  for (const [index, moment] of scene.moments.entries()) {
    if (
      !moment.audio ||
      moment.audio.inputKey !== moment.audioKey ||
      moment.media?.inputKey !== moment.audioKey
    )
      throw new Error('The scene sound is not current')
    const duration = moment.end - moment.start
    const audio = await localMedia(moment.audio.objectKey)
    content += `<section id="moment-${index}" class="moment" data-start="${moment.start}" data-duration="${duration}" data-track-index="${index}"><div class="slide ${moment.layout}">${slide.svg}</div>`
    for (const [clipIndex, clip] of moment.media.clips.entries()) {
      if (!clip.camera || !clip.videoKey) continue
      const video = await localMedia(clip.videoKey)
      content += `<video id="camera-${index}-${clipIndex}" class="presenter ${moment.layout}" src="${video}" muted playsinline data-start="${moment.start + clip.start}" data-duration="${clip.end - clip.start}" data-media-start="${clip.videoFrom || 0}" data-track-index="${100 + index * 12 + clipIndex}"></video>`
    }
    // Off camera the scene's own page carries its title; a title card would
    // sit on top of it (review 5).
    if (
      moment.overlay &&
      !(moment.overlay === 'title-card' && moment.camera === 'none')
    )
      content += `<div class="overlay ${moment.overlay}">${moment.overlay === 'title-card' ? escape(project.title) : moment.overlay === 'end-card' ? 'Thanks for watching' : escape(project.branding?.name || '')}</div>`
    if (moment.overlay === 'title-card' && project.branding?.name)
      content += `<div class="presenter-name">${escape(project.branding.name)}${project.branding.tagline ? `<small>${escape(project.branding.tagline)}</small>` : ''}</div>`
    content += `<audio src="${audio}" data-start="${moment.start}" data-duration="${duration}" data-track-index="${400 + index}"></audio></section>`
    script.push(
      `tl.set('#moment-${index}',{visibility:'visible'},${moment.start});tl.set('#moment-${index}',{visibility:'hidden'},${moment.end});`
    )
    // Subtle entrance on the actual slide; presenter cuts follow the router data.
    script.push(
      `tl.fromTo('#moment-${index} .slide',{opacity:0,y:18},{opacity:1,y:0,duration:${Math.min(0.35, duration / 4)},ease:'power2.out'},${moment.start});`
    )
  }
  const logo = project.branding?.logoKey
    ? `<img class="brand-logo" src="${await localMedia(project.branding.logoKey)}" alt="">`
    : ''
  const accent =
    project.branding?.useAccent &&
    /^#[a-f0-9]{6}$/i.test(project.branding.accent)
      ? project.branding.accent
      : '#527c60'
  const duration = scene.moments.at(-1)!.end
  files['index.html'] = html`<!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          html,
          body {
            margin: 0;
            width: 1920px;
            height: 1080px;
            overflow: hidden;
            background: #17231d;
            font-family: Arial, sans-serif;
          }
          #composition {
            position: relative;
            width: 1920px;
            height: 1080px;
            overflow: hidden;
          }
          .moment {
            position: absolute;
            inset: 0;
            visibility: hidden;
          }
          .slide {
            position: absolute;
            inset: 0;
          }
          .slide svg {
            display: block;
            width: 100%;
            height: 100%;
          }
          .slide.beside-slide {
            right: 620px;
          }
          .presenter {
            position: absolute;
            object-fit: cover;
          }
          .presenter.full-screen {
            inset: 0;
            width: 100%;
            height: 100%;
          }
          .presenter.corner {
            right: 70px;
            bottom: 70px;
            width: 400px;
            height: 400px;
            border-radius: 18px;
          }
          .presenter.beside-slide {
            right: 0;
            top: 0;
            width: 620px;
            height: 1080px;
          }
          .overlay {
            position: absolute;
            bottom: 100px;
            left: 90px;
            right: 90px;
            color: white;
            font-size: 64px;
            text-shadow: 0 3px 15px #0008;
            z-index: 5;
          }
          .brand-logo {
            position: absolute;
            left: 90px;
            top: 65px;
            max-width: 200px;
            max-height: 100px;
            z-index: 10;
          }
          .overlay.title-card {
            top: 150px;
            bottom: auto;
            font-size: 110px;
          }
          .presenter-name {
            position: absolute;
            left: 90px;
            bottom: 90px;
            background: #18251ddd;
            padding: 20px 30px;
            border-left: 8px solid ${accent};
            border-radius: 8px;
            font-size: 46px;
            color: white;
            z-index: 6;
          }
          .presenter-name small {
            display: block;
            font-size: 26px;
            margin-top: 10px;
          }
          .overlay.lower-third {
            border-left: 8px solid ${accent};
            font-size: 30px;
            background: #18251ddd;
            padding: 15px 25px;
            right: auto;
            border-radius: 8px;
          }
        </style>
        <script src="./runtime/gsap.min.js"></script>
        <script src="./runtime/hyperframes.iife.js"></script>
      </head>
      <body>
        <div
          id="composition"
          data-composition-id="${escape(scene.id)}"
          data-start="0"
          data-duration="${duration}"
          data-width="1920"
          data-height="1080"
        >
          ${content}${logo}
        </div>
        <script>
          const tl = gsap.timeline({ paused: true })
          ${script.join('')}tl.to(
            {},
            { duration: 0.001 },
            ${Math.max(0, duration - 0.001)}
          )
          window.__timelines = window.__timelines || {}
          window.__timelines[${JSON.stringify(scene.id)}] = tl
        </script>
      </body>
    </html>`
  return files
}
