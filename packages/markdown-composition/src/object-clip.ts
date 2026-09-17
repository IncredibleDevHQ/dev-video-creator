// An object that plays.
//
// Rich artwork can carry its own animation — a token sinking as it is spent, an
// indicator working while a call is served. That animation must never run on a
// clock of its own: the composition has one clock, and every frame the renderer
// captures has to be reproducible from a time, forwards or backwards.
//
// So a clip is taken hold of rather than played: its own timeline is paused at
// load, and the driver seeks it to a local time whenever it draws. A one-shot
// behaviour clamps to its final state; nothing loops back to a fuller state
// than the story says it has.

export type ObjectClip = {
  /** The element whose animation this is. */
  node: Element
  /** How long its own timeline runs, in milliseconds. */
  durationMs: number
  /** Show this clip at that local time. Clamped: past the end stays ended. */
  seek: (localMs: number) => void
  /** Where its ink is at the moment, animation included. */
  bounds: () => { x: number; y: number; width: number; height: number } | null
  /** Give the element back its own timeline. */
  dispose: () => void
}

type Animatable = Element & { getAnimations?: (options?: { subtree?: boolean }) => Animation[] }

const animationsOf = (node: Element): Animation[] => {
  const host = node as Animatable
  if (typeof host.getAnimations !== 'function') return []
  try {
    return host.getAnimations({ subtree: true })
  } catch {
    return host.getAnimations() || []
  }
}

const endOf = (animation: Animation) => {
  const timing = animation.effect?.getComputedTiming?.()
  const duration = Number(timing?.duration) || 0
  const delay = Number(timing?.delay) || 0
  const iterations = Number(timing?.iterations) || 1
  // An endless clip has no end to clamp to; it is sampled on its own phase.
  if (!Number.isFinite(iterations)) return delay + duration
  return delay + duration * iterations
}

/**
 * Take hold of whatever the artwork animates inside this element.
 *
 * Nothing plays after this: the element is drawn at whatever local time the
 * caller asks for, which is what makes a rendered frame reproducible.
 */
export const holdObjectClip = (node: Element): ObjectClip => {
  const animations = animationsOf(node)
  animations.forEach(animation => {
    try {
      animation.pause()
      animation.currentTime = 0
    } catch {
      // An animation that refuses to be paused is left alone; seeking it
      // simply does nothing, which is better than a half-driven clip.
    }
  })
  const durationMs = animations.reduce((longest, animation) => Math.max(longest, endOf(animation)), 0)
  return {
    node,
    durationMs,
    seek: (localMs: number) => {
      const at = Math.max(0, localMs)
      animations.forEach(animation => {
        try {
          animation.currentTime = Math.min(at, endOf(animation))
        } catch {
          // Ignore: a clip that cannot be seeked stays where it was.
        }
      })
    },
    bounds: () => {
      const box = (node as SVGGraphicsElement).getBBox?.()
      return box && box.width && box.height ? { x: box.x, y: box.y, width: box.width, height: box.height } : null
    },
    dispose: () => {
      animations.forEach(animation => {
        try {
          animation.cancel()
        } catch {
          // Already gone.
        }
      })
    },
  }
}

/** Every animated object under a root, held the same way. */
export const holdObjectClips = (root: Element): Map<string, ObjectClip> => {
  const held = new Map<string, ObjectClip>()
  const candidates = [root, ...Array.from(root.querySelectorAll('[data-part], [data-appearance-for]'))]
  candidates.forEach(node => {
    if (!node.id) return
    const clip = holdObjectClip(node)
    if (clip.durationMs > 0) held.set(node.id, clip)
  })
  return held
}
