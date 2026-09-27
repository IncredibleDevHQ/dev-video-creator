// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { keepPlaceOnMove } from './player-move'

describe('a player that keeps its place when moved', () => {
  it('is given a move callback before it is defined, and nothing else is', () => {
    const defined = new Map<string, CustomElementConstructor>()
    const registry = { define: (name: string, constructor: CustomElementConstructor) => { defined.set(name, constructor) } } as unknown as CustomElementRegistry
    keepPlaceOnMove(registry, ['test-player'])
    class Player extends HTMLElement {}
    class Other extends HTMLElement {}
    registry.define('test-player', Player)
    registry.define('test-other', Other)
    expect(defined.get('test-player')).toBe(Player)
    expect(typeof (Player.prototype as unknown as { connectedMoveCallback?: unknown }).connectedMoveCallback).toBe('function')
    expect('connectedMoveCallback' in Other.prototype).toBe(false)
  })

  it('leaves a move callback the player already has', () => {
    const registry = { define: () => undefined } as unknown as CustomElementRegistry
    keepPlaceOnMove(registry, ['test-player'])
    class Player extends HTMLElement {
      connectedMoveCallback() {
        return 'own'
      }
    }
    const own = Player.prototype.connectedMoveCallback
    registry.define('test-player', Player)
    expect(Player.prototype.connectedMoveCallback).toBe(own)
  })
})
