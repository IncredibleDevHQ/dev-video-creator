// The thumbnail's picture, as YouTube takes one: 1280×720, JPEG. A
// storyboard frame's still is read from its production; a second of the
// made video, or its poster, is taken without the caption band the video
// burns its words into, the rest filling the picture (review 8, round 2:
// either could show "How do"). The title can be set over it. Kept for a
// while, so the dialog's choices and the bundle never make one twice.
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Project } from '../shared/model'
import type { Branding } from '../shared/settings'
import {
  chosenCover,
  coverChoices,
  coverTitled,
  coverWords,
  frameHeld,
  type CoverChoice
} from '../shared/release-cover'
import { frameId } from '../shared/storyboard'
import { readAsset } from './persistence'
import { Refusal } from './refusal'
import { stillFile } from './storyboard/board'
import { INTER, productionDir } from './storyboard/workspace'
import { BAND_TOP } from './teaser-framing'
import { runCommand } from './voice'

const made = new Map<string, Buffer>()
const keep = (key: string, bytes: Buffer) => {
  made.delete(key)
  made.set(key, bytes)
  // The oldest go first: a few dozen pictures of 50–150 KB each.
  while (made.size > 48) made.delete(made.keys().next().value!)
  return bytes
}

/** The share of the made video above its captions: a storyboard episode
 * keeps its lowest sixth for them, an older video its lowest fifth. */
const aboveCaptions = (project: Project) =>
  project.video?.storyboard?.plan ? BAND_TOP : 0.8

/**
 * A picture at 1280×720, from an image or a video's second. With `share`
 * under 1, only its top share is used, the caption band left out: fitted
 * whole over itself blown up and blurred, so nothing is cropped from its
 * sides and no bars show.
 */
const fitted = async (source: Buffer, name: string, at?: number, share = 1) => {
  const dir = await mkdtemp(join(tmpdir(), 'studio-cover-'))
  try {
    await writeFile(join(dir, name), source)
    await runCommand('ffmpeg', [
      '-y',
      '-v',
      'error',
      ...(at === undefined ? [] : ['-ss', String(at)]),
      '-i',
      join(dir, name),
      '-frames:v',
      '1',
      '-filter_complex',
      share < 1
        ? `[0:v]crop=iw:trunc(ih*${share.toFixed(4)}/2)*2:0:0,split[b][f];[b]scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,gblur=sigma=28[g];[f]scale=1280:720:force_original_aspect_ratio=decrease[k];[g][k]overlay=(W-w)/2:(H-h)/2,setsar=1`
        : '[0:v]scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1',
      '-q:v',
      '3',
      join(dir, 'cover.jpg')
    ])
    return await readFile(join(dir, 'cover.jpg'))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

const escapeHtml = (text: string) =>
  text.replace(/[&<>"]/g, (char) => `&#${char.charCodeAt(0)};`)

/**
 * The title set over a picture: the episode's title large on the left over
 * a shade that keeps it readable at the size YouTube lists it, its number
 * in a series above it, the picture showing on the right. Drawn by a
 * browser, as the teasers' captions are.
 */
/** How bright a #rrggbb colour is, 0–255. */
const brightness = (hex: string) => {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!match) return 0
  const n = parseInt(match[1], 16)
  return (
    0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)
  )
}

/** The brand on a titled cover: its display face (from its own files, else
 * the studio's Inter) and its accent for the kicker when that reads on the
 * dark shade (round 2: system fonts and a fixed yellow, whatever the brand). */
export const coverLook = async (branding?: Branding) => {
  const name = String(branding?.fonts?.display || '')
    .split(',')[0]
    .replace(/['"]/g, '')
    .trim()
  const faces: string[] = []
  for (const file of (branding?.fontFiles || []).filter(
    (item) => item.family === name
  )) {
    try {
      const data = (await readAsset(file.objectKey)).toString('base64')
      const weight = [file.weight].flat().join(' ')
      faces.push(
        `@font-face{font-family:"${name.replace(/['"]/g, '')}";src:url(data:font/${file.format};base64,${data});font-weight:${weight};font-style:${file.style}}`
      )
    } catch {
      // A face that can't be read falls back to Inter.
    }
  }
  if (existsSync(INTER))
    faces.push(
      `@font-face{font-family:"Inter";src:url(data:font/woff2;base64,${(await readFile(INTER)).toString('base64')});font-weight:100 900}`
    )
  const accent = branding?.useAccent ? branding.accent : ''
  return {
    faces: faces.join(''),
    // Single quotes: the stack goes into a style attribute.
    font: `${name ? `'${name.replace(/['"]/g, '')}',` : ''}Inter,-apple-system,'Segoe UI',Arial,sans-serif`,
    accent: accent && brightness(accent) >= 110 ? accent : '#ffd84d'
  }
}

export const titledCover = async (
  picture: Buffer,
  words: { title: string; kicker: string },
  look?: { faces: string; font: string; accent: string }
) => {
  const { default: puppeteer } = await import('puppeteer')
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox'],
    handleSIGINT: false,
    handleSIGTERM: false,
    handleSIGHUP: false
  })
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 1280, height: 720 })
    const font = look?.font || "-apple-system,'Segoe UI',Inter,Arial,sans-serif"
    await page.setContent(
      (look?.faces ? `<style>${look.faces}</style>` : '') +
        '<body style="margin:0;width:1280px;height:720px;position:relative;overflow:hidden;background:#000">' +
        `<img src="data:image/jpeg;base64,${picture.toString('base64')}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">` +
        '<div style="position:absolute;inset:0;background:linear-gradient(90deg,rgba(0,0,0,.86) 0%,rgba(0,0,0,.7) 46%,rgba(0,0,0,0) 74%)"></div>' +
        '<div style="position:absolute;left:64px;top:56px;bottom:56px;width:660px;display:flex;flex-direction:column;justify-content:center;color:#fff">' +
        (words.kicker
          ? `<div style="font:700 30px/1.2 ${font};letter-spacing:.08em;text-transform:uppercase;color:${look?.accent || '#ffd84d'};margin-bottom:18px">${escapeHtml(words.kicker)}</div>`
          : '') +
        `<div id="title" style="font:800 88px/1.04 ${font};letter-spacing:-.02em;text-wrap:balance">${escapeHtml(words.title)}</div></div></body>`
    )
    await page.evaluate('document.fonts.ready.then(() => true)')
    // A long title comes down a size at a time until it fits.
    await page.evaluate(
      "(() => { const title = document.getElementById('title'); let size = 88; while (title.scrollHeight > 470 && size > 44) { size -= 4; title.style.fontSize = size + 'px' } })()"
    )
    return Buffer.from(await page.screenshot({ type: 'jpeg', quality: 90 }))
  } finally {
    await browser.close().catch(() => {})
  }
}

/** One choice's picture. */
export const coverPicture = async (project: Project, choice: CoverChoice) => {
  const video = project.video
  if (choice.frame !== undefined) {
    const storyboard = video?.storyboard
    const frame = storyboard?.plan?.scenes
      .flatMap((scene) => scene.frames)
      .find((item) => item.number === choice.frame)
    const path =
      storyboard && frame?.still
        ? join(
            productionDir(project.id, storyboard.id),
            stillFile(frameId(frame))
          )
        : ''
    if (!path || !existsSync(path)) throw new Refusal('That frame has no still')
    const key = `${path}:${(await stat(path)).mtimeMs}`
    return (
      made.get(key) ||
      keep(key, await fitted(await readFile(path), 'still.png'))
    )
  }
  // From the made video, its caption band left out.
  const produced = video?.produced
  const share = aboveCaptions(project)
  if (choice.poster && produced?.posterKey) {
    const key = `${produced.posterKey}:poster`
    const poster = await readAsset(produced.posterKey)
    return (
      made.get(key) ||
      keep(key, await fitted(poster, 'poster.jpg', undefined, share))
    )
  }
  if (!produced || choice.at === undefined)
    throw new Refusal('Produce the video first')
  const key = `${produced.objectKey}:${choice.at}`
  return (
    made.get(key) ||
    keep(
      key,
      await fitted(
        await readAsset(produced.objectKey),
        'video.mp4',
        choice.at,
        share
      )
    )
  )
}

/** A choice's picture, settled: a still gone from disk gives way to that
 * frame's last picture in the video. */
const settledPicture = async (project: Project, choice: CoverChoice) => {
  try {
    return await coverPicture(project, choice)
  } catch (error) {
    if (choice.frame === undefined) throw error
    return coverPicture(project, {
      ...choice,
      frame: undefined,
      at: frameHeld(project, choice.frame)
    })
  }
}

/** A choice's picture as the thumbnail shows it: settled, and titled when
 * the title is set over it. */
const coverOf = async (
  project: Project,
  choice: CoverChoice,
  titled: boolean
) => {
  const picture = await settledPicture(project, choice)
  if (!titled) return picture
  const words = coverWords(project)
  const look = await coverLook(project.branding)
  const key = `${createHash('sha1').update(picture).digest('hex')}:${words.kicker}/${words.title}:${look.font}/${look.accent}`
  return made.get(key) || keep(key, await titledCover(picture, words, look))
}

/**
 * The thumbnail the bundle and the upload carry: the creator's choice, else
 * the hook's still, settled as above and titled if they set the title over
 * it. The poster is a choice only when there is no other, never a stand-in
 * for a choice that failed (round 2: it was the video at 1 s, captioned).
 */
export const coverImage = async (project: Project) => {
  const chosen = chosenCover(project)
  if (!chosen) throw new Refusal('The video has no picture for a thumbnail yet')
  return coverOf(project, chosen, coverTitled(project))
}

/** A choice's picture for the dialog, when it is one of the choices: the
 * same picture the bundle would carry for it (review 8, round 1: a still
 * gone from disk showed a broken image while the bundle used the video). */
export const coverFor = (project: Project, query: URLSearchParams) => {
  if (!query.has('frame') && !query.has('at') && !query.has('poster'))
    return coverImage(project)
  const frame = query.has('frame') ? Number(query.get('frame')) : undefined
  const at = query.has('at') ? Number(query.get('at')) : undefined
  const choice = coverChoices(project).find(
    (item) =>
      (frame !== undefined && item.frame === frame) ||
      (at !== undefined && item.at === at) ||
      (query.has('poster') && item.poster)
  )
  if (!choice) throw new Refusal('That is not one of the thumbnails')
  return coverOf(project, choice, query.get('title') === '1')
}
