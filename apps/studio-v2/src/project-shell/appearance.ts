// The studio's appearance (the Open Slide pass): light, dark, or the
// system's. It is the studio's own: what the studio makes — a slide, a
// generated SVG, the player, an exported video — keeps its colours in both.
// The choice is a view preference, kept in this browser's storage (which the
// desktop app keeps between runs); index.html applies it before the first
// paint, and this keeps it applied as the choice or the system changes.
export type Appearance = 'system' | 'light' | 'dark'
export const APPEARANCE_KEY = 'incredible-studio-v2-appearance'

export const appearanceOf = (value: string | null | undefined): Appearance => (value === 'light' || value === 'dark' ? value : 'system')
// What the studio is drawn in for a choice, given the system's.
export const shownAppearance = (choice: Appearance, systemDark: boolean): 'light' | 'dark' =>
  choice === 'system' ? (systemDark ? 'dark' : 'light') : choice

export const createAppearance = (onChange?: (choice: Appearance, shown: 'light' | 'dark') => void) => {
  const media = window.matchMedia?.('(prefers-color-scheme: dark)')
  let choice: Appearance = 'system'
  try {
    choice = appearanceOf(window.localStorage.getItem(APPEARANCE_KEY))
  } catch {
    choice = 'system'
  }
  const apply = () => {
    const shown = shownAppearance(choice, Boolean(media?.matches))
    document.documentElement.dataset.appearance = shown
    onChange?.(choice, shown)
  }
  media?.addEventListener('change', apply)
  apply()
  return {
    choice: () => choice,
    set: (next: Appearance) => {
      choice = next
      try {
        if (next === 'system') window.localStorage.removeItem(APPEARANCE_KEY)
        else window.localStorage.setItem(APPEARANCE_KEY, next)
      } catch {
        // Unsaved, the choice lasts until the studio is next opened.
      }
      apply()
    },
  }
}
