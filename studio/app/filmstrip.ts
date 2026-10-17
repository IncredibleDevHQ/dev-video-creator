// Frames of a scene's animation for the timeline's filmstrip. Each frame is
// drawn once, in a hidden player of its own (the stage's player keeps
// playing), and kept: zooming or drawing the page again reuses them.
const drawn = new Map<string, string>()
// The times drawn for each animation, to find the nearest frame drawn so far.
const times = new Map<string, number[]>()
// Who waits for each frame, and whether they still show it.
type Waiter = { resolve: (url: string) => void; wanted: () => boolean }
const waiting = new Map<string, Waiter[]>()
const queues = new Map<string, Array<{ key: string; time: number }>>()
const players = new Map<string, HTMLVideoElement>()
const busy = new Set<string>()

const frameKey = (src: string, time: number) => `${src}#${time.toFixed(2)}`

/** A frame already drawn, if there is one. */
export const drawnFrame = (src: string, time: number) =>
  drawn.get(frameKey(src, time))

/**
 * The drawn frame nearest a time, to stand in while that frame is drawn:
 * zooming shows a picture at once and sharpens it, never a dark gap.
 */
export const nearestFrame = (src: string, time: number) => {
  let best: number | undefined
  for (const at of times.get(src) || [])
    if (best === undefined || Math.abs(at - time) < Math.abs(best - time))
      best = at
  return best === undefined ? undefined : drawn.get(frameKey(src, best))
}

/** Wait for a media event, or give up after a while. */
const settle = (media: HTMLMediaElement, name: string) =>
  new Promise<void>((resolve, reject) => {
    const done = (error?: Error) => {
      clearTimeout(timer)
      media.removeEventListener(name, ok)
      media.removeEventListener('error', failed)
      if (error) reject(error)
      else resolve()
    }
    const ok = () => done()
    const failed = () => done(new Error('The animation could not be read'))
    const timer = setTimeout(
      () => done(new Error('The animation took too long')),
      4000
    )
    media.addEventListener(name, ok)
    media.addEventListener('error', failed)
  })

async function draw(src: string) {
  if (busy.has(src)) return
  busy.add(src)
  let current = ''
  try {
    let player = players.get(src)
    if (!player) {
      player = document.createElement('video')
      player.muted = true
      player.playsInline = true
      player.preload = 'auto'
      player.src = src
      players.set(src, player)
    }
    if (player.readyState < 2) await settle(player, 'loadeddata')
    const canvas = document.createElement('canvas')
    canvas.width = 192
    canvas.height = 108
    const pen = canvas.getContext('2d')
    if (!pen) throw new Error('Frames cannot be drawn here')
    const queue = queues.get(src) || []
    while (queue.length) {
      const { key, time } = queue.shift()!
      if (drawn.has(key)) continue
      // A frame no tile shows any more (the timeline was zoomed or drawn
      // again) is not drawn: the tiles on show come first.
      const waiters = (waiting.get(key) || []).filter((waiter) =>
        waiter.wanted()
      )
      if (!waiters.length) {
        waiting.delete(key)
        continue
      }
      waiting.set(key, waiters)
      current = key
      player.currentTime = Math.max(
        0,
        Math.min(time, (player.duration || time) - 0.05)
      )
      await settle(player, 'seeked')
      pen.drawImage(player, 0, 0, canvas.width, canvas.height)
      const url = canvas.toDataURL('image/jpeg', 0.75)
      drawn.set(key, url)
      times.set(src, [...(times.get(src) || []), time])
      waiting.get(key)?.forEach((waiter) => waiter.resolve(url))
      waiting.delete(key)
    }
  } catch {
    // Frames that cannot be drawn leave their tiles plain; a later request
    // starts again with a fresh player.
    waiting.delete(current)
    for (const { key } of queues.get(src) || []) waiting.delete(key)
    queues.delete(src)
    players.get(src)?.removeAttribute('src')
    players.delete(src)
  } finally {
    busy.delete(src)
    if (queues.get(src)?.length) void draw(src)
  }
}

/**
 * Draw the animation's frame at a time; resolves with an image to show.
 * `wanted` says whether it is still needed when its turn comes.
 */
export function drawFrame(
  src: string,
  time: number,
  wanted: () => boolean = () => true
): Promise<string> {
  const key = frameKey(src, time),
    done = drawn.get(key)
  if (done) return Promise.resolve(done)
  return new Promise((resolve) => {
    const list = waiting.get(key)
    if (list) {
      list.push({ resolve, wanted })
      return
    }
    waiting.set(key, [{ resolve, wanted }])
    const queue = queues.get(src) || []
    queue.push({ key, time })
    queues.set(src, queue)
    void draw(src)
  })
}
