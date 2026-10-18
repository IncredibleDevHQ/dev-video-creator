/** Navigation can get out of the way without remounting a draft or document. */
export class WorkspaceFocus {
  private hidden = false
  constructor(private root: HTMLElement) {
    try {
      this.hidden =
        localStorage.getItem('incredible-navigation-hidden') === 'true'
    } catch {
      /* optional preference */
    }
    root.classList.toggle('workspace-focus', this.hidden)
    root.addEventListener(
      'click',
      (event) => {
        const button = (event.target as Element).closest(
          '[data-research-action="toggle-sidebar"]'
        )
        if (!button || matchMedia('(max-width: 700px)').matches) return
        event.preventDefault()
        event.stopPropagation()
        this.hidden = !this.hidden
        root.classList.toggle('workspace-focus', this.hidden)
        try {
          localStorage.setItem(
            'incredible-navigation-hidden',
            String(this.hidden)
          )
        } catch {
          /* keep in memory */
        }
        this.update()
      },
      true
    )
    matchMedia('(max-width: 700px)').addEventListener('change', () =>
      this.update()
    )
  }
  update() {
    const mobile = matchMedia('(max-width: 700px)').matches
    this.root
      .querySelectorAll<HTMLButtonElement>(
        '[data-research-action="toggle-sidebar"]'
      )
      .forEach((button) => {
        const label = mobile
          ? 'Toggle project navigation'
          : this.hidden
            ? 'Show project navigation'
            : 'Hide project navigation'
        button.setAttribute('aria-label', label)
        button.setAttribute(
          'aria-expanded',
          String(
            mobile
              ? button
                  .closest('.project-workspace')
                  ?.classList.contains('sidebar-open')
              : !this.hidden
          )
        )
        button.title = label
      })
  }
}
