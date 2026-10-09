type Theme = 'light' | 'dark'
const storageKey = 'incredible-studio-theme'
const isTheme = (value: unknown): value is Theme =>
  value === 'light' || value === 'dark'
let preference: Theme = 'light'
const icons: Record<Theme, string> = {
  light:
    '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  dark: '<path d="M20.5 13a9 9 0 0 1-9.5-9.5A9 9 0 1 0 20.5 13Z"/>'
}
export const themeControl = () =>
  `<div class="theme-control" role="group" aria-label="Appearance">${(
    ['light', 'dark'] as const
  )
    .map((mode) => {
      const label = mode[0].toUpperCase() + mode.slice(1)
      return `<button type="button" data-theme-choice="${mode}" aria-label="${label} theme" title="${label} theme" aria-pressed="${preference === mode}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[mode]}</svg></button>`
    })
    .join('')}</div>`

export const installAppearance = () => {
  const deviceTheme = (): Theme =>
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  preference = deviceTheme()
  try {
    const saved = localStorage.getItem(storageKey)
    if (isTheme(saved)) preference = saved
  } catch {
    /* Appearance still works when browser storage is unavailable. */
  }
  const apply = () => {
    document.documentElement.dataset.theme = preference
    document.documentElement.style.colorScheme = preference
    document
      .querySelectorAll<HTMLButtonElement>('[data-theme-choice]')
      .forEach((button) => {
        button.setAttribute(
          'aria-pressed',
          String(button.dataset.themeChoice === preference)
        )
      })
  }
  apply()
  document.addEventListener('click', (event) => {
    const button =
      event.target instanceof Element
        ? event.target.closest<HTMLElement>('[data-theme-choice]')
        : null
    const mode = button?.dataset.themeChoice
    if (!isTheme(mode)) return
    preference = mode
    try {
      localStorage.setItem(storageKey, mode)
    } catch {
      /* Keep this session's choice. */
    }
    apply()
  })
  window.addEventListener('storage', (event) => {
    if (event.key !== storageKey && event.key !== null) return
    preference = isTheme(event.newValue) ? event.newValue : deviceTheme()
    apply()
  })
}
