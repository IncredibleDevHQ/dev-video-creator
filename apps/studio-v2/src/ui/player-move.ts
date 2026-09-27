// The stage's player moves between the Scenes view and the notebook's canvas
// (the one stage layout) by moveBefore, which keeps a moved element and its
// frame alive — but only an element that can take the move. One without a
// connectedMoveCallback is disconnected and connected again, and the
// Hyperframes player then loads its composition again from the start. A
// definition reads its callbacks once, when it is defined, so the player is
// given the callback before its module defines it: a scene moved between the
// views keeps its place.
export const keepPlaceOnMove = (registry: CustomElementRegistry, names: readonly string[]) => {
  const define = registry.define.bind(registry)
  registry.define = (name, constructor, options) => {
    if (names.includes(name) && !('connectedMoveCallback' in constructor.prototype)) {
      // Moved, it has nothing to set up again: its frame, its listeners and
      // its place in the composition stay as they were.
      Object.defineProperty(constructor.prototype, 'connectedMoveCallback', { configurable: true, writable: true, value: () => undefined })
    }
    define(name, constructor, options)
  }
}

keepPlaceOnMove(customElements, ['hyperframes-player'])
