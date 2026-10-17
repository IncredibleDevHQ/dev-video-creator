// One deck-changing step at a time per notebook, in a module of its own: the
// copies that follow a map's card wait for it too (review 8), and the
// wireframe changes and the copies need not import each other for it.
const decks = new Map<string, Promise<void>>()
/**
 * One deck-changing step at a time per notebook: a page being redrawn, a
 * note's new pages going in, or a card's copies following it. A note waits
 * for the redraw instead of moving the pages under it, which would fail
 * that change.
 */
export const withDeck = async <T>(id: string, work: () => Promise<T>) => {
  const before = decks.get(id) || Promise.resolve()
  let release!: () => void
  const mine = new Promise<void>((done) => {
    release = done
  })
  const chained = before.then(() => mine)
  decks.set(id, chained)
  await before
  try {
    return await work()
  } finally {
    release()
    if (decks.get(id) === chained) decks.delete(id)
  }
}
