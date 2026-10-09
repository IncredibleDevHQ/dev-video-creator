// A product demo, captured: a browser on this computer opens the product
// page, follows the steps with a visible cursor, and the frames become an
// MP4 for the page's product-capture shot. The agent drafts the steps from
// the page's own buttons and fields; the creator can change them.
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseSteps, readyCapture } from '../shared/capture'
import type { CaptureStep, ProductCapture } from '../shared/release'
import { addEvent } from './activity'
import { runValidatedJsonStage } from './creative/stage'
import { detectedHarness } from './notebook-intake'
import { storeAsset } from './persistence'
import { fingerprintOf } from './planning/fingerprint'
import { changeProject, loadProject } from './projects'
import { Refusal } from './refusal'
import { runCommand } from './voice'

type Page = import('puppeteer').Page
const SIZE = { width: 1280, height: 720 }
const LIMIT_MS = 60_000

/** An http(s) address, and only that. */
export const captureUrl = (raw: unknown) => {
  try {
    const url = new URL(String(raw || '').trim())
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error()
    return url.href
  } catch {
    throw new Refusal('Give the product page’s address, starting with https://')
  }
}

// A cursor the viewer can follow, and a ripple where it clicks.
const CURSOR = `(() => {
  const add = () => {
    if (document.getElementById('__capture-cursor')) return
    const style = document.createElement('style')
    style.textContent = [
      '#__capture-cursor{position:fixed;z-index:2147483647;left:0;top:0;width:22px;height:22px;margin:-3px 0 0 -3px;pointer-events:none;transition:transform .05s linear}',
      '#__capture-cursor svg{filter:drop-shadow(0 1px 2px rgba(0,0,0,.4))}.__capture-ripple{position:fixed;z-index:2147483646;width:36px;height:36px;margin:-18px 0 0 -18px;border-radius:50%;border:3px solid #e11d48;pointer-events:none;animation:__ripple .5s ease-out forwards}',
      '@keyframes __ripple{from{transform:scale(.3);opacity:1}to{transform:scale(1.4);opacity:0}}'
    ].join('')
    document.head.append(style)
    const cursor = document.createElement('div')
    cursor.id = '__capture-cursor'
    cursor.innerHTML = '<svg width="22" height="22" viewBox="0 0 22 22"><path d="M3 2l15 9-7 1.5L8 20z" fill="#fff" stroke="#111" stroke-width="1.5"/></svg>'
    document.body.append(cursor)
    addEventListener('mousemove', (event) => { cursor.style.transform = 'translate(' + event.clientX + 'px,' + event.clientY + 'px)' }, true)
    addEventListener('mousedown', (event) => {
      const ring = document.createElement('div')
      ring.className = '__capture-ripple'
      ring.style.left = event.clientX + 'px'
      ring.style.top = event.clientY + 'px'
      document.body.append(ring)
      setTimeout(() => ring.remove(), 600)
    }, true)
  }
  document.readyState === 'loading' ? addEventListener('DOMContentLoaded', add) : add()
})()`

// Code that runs in the page is a string: the engine runs under tsx, whose
// function names (__name) do not exist in the browser.
const FIND = (wanted: string) => `(() => {
  const wanted = ${JSON.stringify(wanted)}
  const visible = (element) => {
    const box = element.getBoundingClientRect()
    return box.width > 0 && box.height > 0
  }
  if (/^[#.[]/.test(wanted) || /^[a-z]+[#.[]/i.test(wanted)) {
    const found = document.querySelector(wanted)
    return found && visible(found) ? found : null
  }
  const words = wanted.toLowerCase()
  const candidates = [...document.querySelectorAll(
    'a,button,input,textarea,select,label,[role=button],[role=tab],[role=link],[role=menuitem]'
  )].filter(visible)
  const text = (element) => (element.innerText || element.getAttribute('aria-label') ||
    element.placeholder || element.value || '').trim().toLowerCase()
  return candidates.find((element) => text(element) === words) ||
    candidates.find((element) => text(element).includes(words)) || null
})()`

/** The element a step names: a CSS selector, or the words on it. */
const find = async (page: Page, target: string) => {
  const handle = await page.evaluateHandle(FIND(target))
  const element = handle.asElement() as
    | import('puppeteer').ElementHandle<Element>
    | null
  if (!element) throw new Refusal(`Could not find “${target}” on the page`)
  return element
}

const act = async (page: Page, step: CaptureStep, origin: string) => {
  if (step.do === 'goto') {
    const next = new URL(step.url, page.url())
    if (next.origin !== origin)
      throw new Refusal('A demo stays on the product’s own site')
    await page.goto(next.href, { waitUntil: 'networkidle2', timeout: 20_000 })
    return
  }
  if (step.do === 'wait')
    return new Promise((done) => setTimeout(done, step.ms))
  if (step.do === 'scroll') {
    await page.evaluate(
      (y: number) => scrollBy({ top: y, behavior: 'smooth' }),
      step.y
    )
    return new Promise((done) => setTimeout(done, 800))
  }
  const element = await find(page, step.target)
  if (
    step.do === 'type' &&
    (await element.evaluate((node) => node.getAttribute('type') === 'password'))
  )
    throw new Refusal('A demo never types into a password field')
  await element.evaluate((node) =>
    node.scrollIntoView({
      block: 'center',
      behavior: 'instant' as ScrollBehavior
    })
  )
  const box = await element.boundingBox()
  if (!box) throw new Refusal(`“${step.target}” is not on screen`)
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, {
    steps: 24
  })
  await new Promise((done) => setTimeout(done, 300))
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  if (step.do === 'type') await page.keyboard.type(step.text, { delay: 60 })
  await new Promise((done) => setTimeout(done, 700))
}

/** Records the steps as an MP4: frames with their times, then joined. */
export const recordSteps = async (url: string, steps: CaptureStep[]) => {
  const dir = await mkdtemp(join(tmpdir(), 'studio-capture-'))
  const { default: puppeteer } = await import('puppeteer')
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', `--window-size=${SIZE.width},${SIZE.height}`],
    handleSIGINT: false,
    handleSIGTERM: false,
    handleSIGHUP: false
  })
  try {
    const page = await browser.newPage()
    await page.setViewport(SIZE)
    await page.evaluateOnNewDocument(CURSOR)
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30_000 })
    const origin = new URL(page.url()).origin
    await page.mouse.move(SIZE.width / 2, SIZE.height / 2)
    const frames: number[] = []
    let recording = true
    const started = Date.now()
    // A failed frame stops the loop and is rethrown after the steps: never
    // left unhandled, which would end the engine with every job in it.
    let failure: unknown = null
    const loop = (async () => {
      while (recording && Date.now() - started < LIMIT_MS) {
        const shot = await page.screenshot({ type: 'jpeg', quality: 82 })
        frames.push(Date.now())
        await writeFile(
          join(dir, `f${String(frames.length).padStart(5, '0')}.jpg`),
          shot
        )
      }
    })().catch((error: unknown) => {
      failure = error
      recording = false
    })
    try {
      await new Promise((done) => setTimeout(done, 1000))
      for (const step of steps) await act(page, step, origin)
      await new Promise((done) => setTimeout(done, 1500))
    } finally {
      recording = false
      await loop
    }
    if (failure) throw new Error('The capture lost its page')
    if (frames.length < 2) throw new Error('The capture took no frames')
    // Each frame lasts until the next was taken: the timing stays true.
    const list = frames
      .map((time, index) => {
        const name = `f${String(index + 1).padStart(5, '0')}.jpg`
        const next = frames[index + 1] ?? time + 100
        return `file '${name}'\nduration ${((next - time) / 1000).toFixed(3)}`
      })
      .concat(`file 'f${String(frames.length).padStart(5, '0')}.jpg'`)
      .join('\n')
    await writeFile(join(dir, 'frames.txt'), list)
    const out = join(dir, 'capture.mp4')
    await runCommand('ffmpeg', [
      '-y',
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      join(dir, 'frames.txt'),
      '-vf',
      'fps=30,format=yuv420p',
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-movflags',
      '+faststart',
      out
    ])
    return {
      bytes: await readFile(out),
      seconds: Math.round((frames.at(-1)! - frames[0]) / 100) / 10
    }
  } finally {
    await browser.close().catch(() => {})
    await rm(dir, { recursive: true, force: true })
  }
}

const ELEMENTS = `[...document.querySelectorAll(
  'a,button,input,textarea,select,[role=button],[role=tab],[role=link]'
)].filter((element) => {
  const box = element.getBoundingClientRect()
  return box.width > 0 && box.height > 0
}).slice(0, 150).map((element) => ({
  tag: element.tagName.toLowerCase(),
  type: element.type || null,
  id: element.id || null,
  text: (element.innerText || element.getAttribute('aria-label') || element.placeholder || '').trim().slice(0, 80),
  href: element.getAttribute('href')
}))`

/** The page's buttons, links and fields, for the agent to draft steps from. */
export const pageElements = async (url: string) => {
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
    await page.setViewport(SIZE)
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30_000 })
    return (await page.evaluate(ELEMENTS)) as Array<{
      tag: string
      type: string | null
      id: string | null
      text: string
      href: string | null
    }>
  } finally {
    await browser.close().catch(() => {})
  }
}

const setCapture = (id: string, slideId: string, capture: ProductCapture) =>
  changeProject(id, (current) => {
    const slide = current.project.slides.find((item) => item.id === slideId)
    if (!slide) throw new Refusal('Wireframe not found')
    slide.capture = capture
    const urls = new Set([capture.url, ...(current.project.productUrls || [])])
    current.project.productUrls = [...urls].slice(0, 6)
  })

/** The agent's steps for a page's demo, from the product page itself. */
const planSteps = async (id: string, slideId: string, url: string) => {
  const snapshot = (await loadProject(id))!
  const slide = snapshot.project.slides.find((item) => item.id === slideId)!
  const elements = await pageElements(url)
  const demo = {
    url,
    page: { title: slide.title, idea: slide.idea, narration: slide.narration },
    needs: (slide.needs || []).filter((need) => need.kind === 'demo')
  }
  const planned = await runValidatedJsonStage<{ steps: string }>({
    projectId: id,
    inputKey: fingerprintOf({ demo, elements }),
    checkpoint: 'capture-steps',
    stage: 'story',
    route: 'Plan Capture',
    stageContext: { demo },
    file: 'story/capture.json',
    tool: 'story_submit_capture',
    packet: {
      'packet/DEMO.json': JSON.stringify(demo, null, 1),
      'packet/ELEMENTS.json': JSON.stringify(elements, null, 1)
    },
    selection: snapshot.project.harness ?? (await detectedHarness()),
    origin:
      process.env.MINIMAL_STUDIO_HARNESS_ORIGIN ||
      `http://127.0.0.1:${process.env.MINIMAL_STUDIO_PORT || 4320}`,
    validate: (raw) => {
      const text = String((raw as { steps?: unknown })?.steps ?? '')
      const { problems } = parseSteps(text)
      return {
        ok: !problems.length,
        problems,
        warnings: [],
        value: { steps: text }
      }
    }
  })
  return parseSteps(planned.steps).steps
}

/**
 * Captures a page's demo in the background. Without steps, the agent
 * drafts them first; with them, they are followed as written.
 */
export const captureDemo = async (id: string, raw: unknown) => {
  const value = (raw ?? {}) as Record<string, unknown>
  const slideId = String(value.slideId || '')
  const url = captureUrl(value.url)
  const written = String(value.steps || '').trim()
  const parsed = written ? parseSteps(written) : null
  if (parsed?.problems.length) throw new Refusal(parsed.problems[0])
  const snapshot = await loadProject(id)
  if (!snapshot?.project.slides.some((item) => item.id === slideId))
    throw new Refusal('Wireframe not found')
  const at = () => new Date().toISOString()
  // The last good capture stays until the new one is ready.
  const kept = readyCapture(
    snapshot.project.slides.find((item) => item.id === slideId)?.capture
  )
  const last = kept
    ? {
        url: kept.url,
        steps: kept.steps,
        objectKey: kept.objectKey,
        seconds: kept.seconds,
        at: kept.at
      }
    : undefined
  const started = await setCapture(id, slideId, {
    ...(last ? { last } : {}),
    url,
    steps: parsed?.steps || [],
    state: parsed ? 'capturing' : 'planning',
    at: at()
  })
  void (async () => {
    const steps = parsed?.steps || (await planSteps(id, slideId, url))
    if (!parsed)
      await setCapture(id, slideId, {
        ...(last ? { last } : {}),
        url,
        steps,
        state: 'capturing',
        at: at()
      })
    const { bytes, seconds } = await recordSteps(url, steps)
    const asset = await storeAsset({
      body: bytes,
      contentType: 'video/mp4',
      extension: '.mp4',
      kind: 'product-capture',
      projectId: id
    })
    await setCapture(id, slideId, {
      url,
      steps,
      state: 'ready',
      objectKey: asset.objectKey,
      seconds,
      at: at()
    })
    await changeProject(id, (current) =>
      addEvent(
        current,
        'slide',
        `Captured a ${seconds}s demo of ${new URL(url).host}`
      )
    )
  })().catch((error: Error) =>
    setCapture(id, slideId, {
      ...(last ? { last } : {}),
      url,
      steps: parsed?.steps || [],
      state: 'failed',
      error:
        error instanceof Refusal ? error.message : 'The capture did not finish',
      at: at()
    }).catch(() => {})
  )
  return started
}
