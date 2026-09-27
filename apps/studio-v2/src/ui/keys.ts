// The keys of the one stage layout, shared by the page view and the Scenes
// view (as Open Slide moves through a deck): the arrows, PageUp and
// PageDown, Home and End move through the pages or scenes; O shows them all;
// F asks for the whole screen.

export type StageKey = 'next' | 'previous' | 'first' | 'last' | 'forward' | 'back' | 'overview' | 'fullscreen'
type KeyLike = { key: string; altKey?: boolean; ctrlKey?: boolean; metaKey?: boolean }

// A key that moves through them, bare only, so the browser's own
// combinations (⌘F, Ctrl+P…) are never taken. Space moves on only where it
// does not press a button. Where the stage has moments of its own (a video's
// scene), ← and → move along them instead of between scenes.
export const stageKeyOf = (event: KeyLike, { space = true, sideways = 'pages' as 'pages' | 'moments' } = {}): StageKey | null => {
  if (event.altKey || event.ctrlKey || event.metaKey) return null
  switch (event.key) {
    case 'ArrowDown':
    case 'PageDown':
      return 'next'
    case 'ArrowUp':
    case 'PageUp':
      return 'previous'
    case 'ArrowRight':
      return sideways === 'moments' ? 'forward' : 'next'
    case 'ArrowLeft':
      return sideways === 'moments' ? 'back' : 'previous'
    case ' ':
      return space && sideways === 'pages' ? 'next' : null
    case 'Home':
      return 'first'
    case 'End':
      return 'last'
    case 'o':
    case 'O':
      return 'overview'
    case 'f':
    case 'F':
      return 'fullscreen'
    default:
      return null
  }
}

// A key typed into a field, or meant for a control that uses the arrows
// itself — a menu, a list, tabs, a radio group, a dialog — is never a move.
// The stage's own controls ([data-stage-keys]) pass the keys on.
export const typingTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || target.matches('input, textarea, select'))
export const controlTarget = (target: EventTarget | null) =>
  target instanceof Element && !target.closest('[data-stage-keys]') && Boolean(target.closest('button, a, summary, [role="dialog"], [role="menu"], [role="listbox"], [role="tablist"], [role="radiogroup"], dialog'))
export const modalOpen = () => Boolean(document.querySelector('dialog[open]:modal'))
export const stageKeysFree = (event: KeyboardEvent) =>
  !event.defaultPrevented && !event.isComposing && !typingTarget(event.target) && !controlTarget(event.target) && !modalOpen()
