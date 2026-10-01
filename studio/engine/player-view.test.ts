import { parseHTML } from 'linkedom'
import { expect, it, vi } from 'vitest'
import { replacePlayerView } from '../app/player-view'
it('keeps the loaded player and every ancestor connected while updating surrounding controls', () => {
  const { document, Element } = parseHTML(
    '<html><body><div id="app"><header>Old</header><main><section><video data-scene-player src="scene.mp4"></video><button>Old</button></section></main></div></body></html>'
  )
  vi.stubGlobal('document', document)
  vi.stubGlobal('Element', Element)
  try {
    const root = document.querySelector('#app') as unknown as HTMLElement
    const player = root.querySelector('video')!
    const parents = [player, parentOf(player), parentOf(parentOf(player))]
    const removals = parents.map((node) => vi.spyOn(node, 'remove'))
    const attributes = vi.spyOn(player, 'setAttribute')
    expect(
      replacePlayerView(
        root,
        '<header>Updated</header><main><section><p>New status</p><video data-scene-player src="scene.mp4" controls></video><button>Updated</button></section></main>',
        player
      )
    ).toBe(true)
    expect(root.querySelector('video')).toBe(player)
    expect(player.isConnected).toBe(true)
    expect(root.textContent).toBe('UpdatedNew statusUpdated')
    expect(player.hasAttribute('controls')).toBe(true)
    expect(attributes).not.toHaveBeenCalledWith('src', 'scene.mp4')
    for (const removal of removals) expect(removal).not.toHaveBeenCalled()
  } finally {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  }
})
function parentOf(node: Element) {
  return node.parentElement!
}

it('keeps a reviewing take connected across live progress and save-state updates', () => {
  const { document, Element } = parseHTML(
    '<html><body><div id="app"><main><section><video data-take-player src="blob:take"></video><p>Review your take</p></section><button>Save take</button></main></div></body></html>'
  )
  vi.stubGlobal('document', document)
  vi.stubGlobal('Element', Element)
  try {
    const root = document.querySelector('#app') as unknown as HTMLElement,
      player = root.querySelector('video')!
    const remove = vi.spyOn(player.parentElement!, 'remove'),
      attributes = vi.spyOn(player, 'setAttribute')
    expect(
      replacePlayerView(
        root,
        '<main><section><video data-take-player src="blob:take" controls></video><p>Saving your recording</p></section><button disabled>Saving…</button></main>',
        player
      )
    ).toBe(true)
    expect(root.querySelector('video')).toBe(player)
    expect(player.isConnected).toBe(true)
    expect(attributes).not.toHaveBeenCalledWith('src', 'blob:take')
    expect(remove).not.toHaveBeenCalled()
    expect(root.textContent).toContain('Saving your recording')
  } finally {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  }
})

it('keeps a saved presenter take connected when notebook activity arrives', () => {
  const { document, Element } = parseHTML(
    '<html><body><div id="app"><main><div class="video-stage"><svg></svg><div class="presenter-preview beside-slide"><video data-saved-presenter src="/objects/take.webm" controls></video><small>Saved recording</small></div></div></main></div></body></html>'
  )
  vi.stubGlobal('document', document)
  vi.stubGlobal('Element', Element)
  try {
    const root = document.querySelector('#app') as unknown as HTMLElement,
      player = root.querySelector('video')!
    const remove = vi.spyOn(player.parentElement!, 'remove'),
      attributes = vi.spyOn(player, 'setAttribute')
    expect(
      replacePlayerView(
        root,
        '<main><p>Recording saved</p><div class="video-stage"><svg></svg><div class="presenter-preview beside-slide"><video data-saved-presenter src="/objects/take.webm" controls></video><small>Saved recording</small></div></div></main>',
        player
      )
    ).toBe(true)
    expect(root.querySelector('video')).toBe(player)
    expect(player.isConnected).toBe(true)
    expect(remove).not.toHaveBeenCalled()
    expect(attributes).not.toHaveBeenCalledWith('src', '/objects/take.webm')
  } finally {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  }
})

it('retains the stand-in animation decoder across activity updates', () => {
  const { document, Element } = parseHTML(
    '<html><body><div id="app"><section><video data-rehearsal-animation src="animation.mp4"></video><img alt="Presenter stand-in"></section></div></body></html>'
  )
  vi.stubGlobal('document', document)
  vi.stubGlobal('Element', Element)
  try {
    const root = document.querySelector('#app') as unknown as HTMLElement,
      player = root.querySelector('video')!
    const remove = vi.spyOn(player, 'remove')
    expect(
      replacePlayerView(
        root,
        '<section><video data-rehearsal-animation src="animation.mp4"></video><img alt="Presenter stand-in"><p>Updated activity</p></section>',
        player
      )
    ).toBe(true)
    expect(root.querySelector('video')).toBe(player)
    expect(player.isConnected).toBe(true)
    expect(remove).not.toHaveBeenCalled()
  } finally {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  }
})
