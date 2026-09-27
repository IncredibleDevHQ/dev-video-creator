// The page view (the one stage layout): a wireframe's or a presentation's
// pages around one stage, laid out as a video's Scenes view is — a rail of
// numbered pages, the page on show large in the middle, what it explains
// and its notes beside it. What it borrows from Open Slide is how it moves:
// the arrow keys and the wheel turn the pages, O shows them all at once, F
// fills the screen, and every control says what it does.
//
// Nothing here owns a page: the pages are the notebook's scene blocks, read
// again whenever the notebook changes, and the notebook stays one click away
// (Pages · Notebook). What this view keeps for itself — the view and the
// page on show — is a local preference.
import './page-workspace.css'
import { icon, type IconName } from '../ui/icons'
import { createWheelPager, folio, pageKeyOf, type PageEntry, type PageKey } from './pages'

export type PagesView = 'pages' | 'notebook'

export type PageWorkspaceHost = {
  projectId: () => string
  // Whether the open notebook shows pages: a wireframe, a presentation, or
  // a base made from a source.
  on: () => boolean
  pages: () => PageEntry[]
  pictureOf: (pageId: string) => string
  // The one selection, shared with the notebook.
  selectedPage: () => string
  selectPage: (pageId: string) => void
  // What the notebook says about work on its pages — the design run, the
  // wireframe being made — shown above the stage while this view shows.
  notices: () => HTMLElement[]
  viewChanged: (view: PagesView) => void
}

const VIEW_KEY = 'incredible-studio-v2-pages-view'
const PREFS_KEY = 'incredible-studio-v2-pages-'

export const savedPagesView = (): PagesView => {
  try {
    return window.localStorage.getItem(VIEW_KEY) === 'notebook' ? 'notebook' : 'pages'
  } catch {
    return 'pages'
  }
}

const h = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attributes: Record<string, string | boolean | undefined> = {},
  ...children: Array<Node | string | null | undefined | false>
): HTMLElementTagNameMap[K] => {
  const element = document.createElement(tag)
  for (const [key, value] of Object.entries(attributes)) {
    if (value === undefined || value === false) continue
    if (key === 'text') element.textContent = String(value)
    else if (value === true) element.setAttribute(key, '')
    else element.setAttribute(key, value)
  }
  for (const child of children) if (child !== null && child !== undefined && child !== false) element.append(child)
  return element
}

// An icon-only control: its name is its label and its tooltip, with the key
// that does the same.
const iconButton = (name: IconName, label: string, key = '') => {
  const button = h('button', { type: 'button', class: 'pw-icon-button', 'aria-label': label, title: key ? `${label} (${key})` : label, 'data-pw-keys': '' })
  button.append(icon(name))
  if (key) button.setAttribute('aria-keyshortcuts', key)
  return button
}

const STATE_ICONS: Record<NonNullable<PageEntry['state']>['tone'], IconName> = { good: 'palette', busy: 'loader-circle', warn: 'square-dashed' }

// A key typed into a field, or meant for a control that uses the arrows
// itself — a menu, a list, tabs, a radio group, a dialog — is never a page
// turn. The page view's own buttons pass the page keys on.
const typingTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || target.matches('input, textarea, select'))
const controlTarget = (target: EventTarget | null) =>
  target instanceof Element && !target.closest('[data-pw-keys]') && Boolean(target.closest('button, a, summary, [role="dialog"], [role="menu"], [role="listbox"], [role="tablist"], [role="radiogroup"], dialog'))
const modalOpen = () => Boolean(document.querySelector('dialog[open]:modal'))

export const createPageWorkspace = (host: PageWorkspaceHost) => {
  const root = document.getElementById('page-workspace') as HTMLElement
  let view: PagesView = savedPagesView()
  let overviewOpen = false
  let shownPage = ''
  let shownPicture = ''
  let shownInspector = ''
  let scrolledTo = ''
  let savedTo = ''
  // The page last on show comes back once, when the notebook is opened again.
  let restoredFor = ''
  const homes = new Map<HTMLElement, { parent: Node; next: Node | null }>()

  const prefsKey = () => `${PREFS_KEY}${host.projectId()}`
  const savedPage = () => {
    try {
      return (JSON.parse(window.localStorage.getItem(prefsKey()) || '{}') as { page?: string }).page || ''
    } catch {
      return ''
    }
  }
  const savePage = (page: string) => {
    try {
      window.localStorage.setItem(prefsKey(), JSON.stringify({ page }))
    } catch {
      // Kept for this session only.
    }
  }

  // ——— The skeleton, built once ———
  const railCount = h('span', { class: 'sw-rail-count' })
  const railOverview = iconButton('grid-2x2', 'All pages', 'O')
  railOverview.classList.add('pw-rail-overview')
  const list = h('ol', { class: 'pw-pages', 'aria-label': 'Pages' })
  const rail = h('nav', { class: 'sw-rail pw-rail', 'aria-label': 'Pages' }, h('div', { class: 'sw-rail-head' }, h('span', { class: 'sw-rail-title', text: 'Pages' }), railCount, railOverview), list)

  const notices = h('div', { class: 'pw-notices' })
  const picture = h('img', { class: 'pw-slide', alt: '', draggable: 'false' })
  const badge = h('span', { class: 'pw-stage-badge', hidden: true })
  const stage = h('figure', { class: 'pw-stage', 'aria-live': 'polite' }, picture, badge)
  const empty = h('div', { class: 'pw-empty', hidden: true })
  const stageArea = h('div', { class: 'pw-stage-area' }, stage, empty)
  const previous = iconButton('chevron-left', 'Previous page', '←')
  const next = iconButton('chevron-right', 'Next page', '→')
  const counter = h('span', { class: 'pw-folio', 'aria-live': 'polite' })
  const caption = h('span', { class: 'pw-stage-title' })
  const overviewTool = h('button', { type: 'button', class: 'pw-tool', title: 'All pages at once (O)', 'aria-keyshortcuts': 'O', 'data-pw-keys': '' }, icon('grid-2x2'), h('span', { text: 'All pages' }))
  const fullscreenTool = h('button', { type: 'button', class: 'pw-tool', title: 'The page on the whole screen (F)', 'aria-keyshortcuts': 'F', 'data-pw-keys': '' }, icon('maximize-2'), h('span', { text: 'Full screen' }))
  const stageRow = h('div', { class: 'pw-stage-row' }, h('div', { class: 'pw-pager' }, previous, counter, next), caption, h('div', { class: 'pw-stage-tools' }, overviewTool, fullscreenTool))
  const centre = h('section', { class: 'pw-centre', 'aria-label': 'Page on show' }, notices, stageArea, stageRow)

  const inspectorHead = h('header', { class: 'pw-inspector-head' })
  const panel = h('div', { class: 'sw-panel pw-panel' })
  const inspector = h('aside', { class: 'sw-inspector pw-inspector', 'aria-label': 'About this page' }, inspectorHead, panel)

  const overviewGrid = h('ol', { class: 'pw-overview-grid' })
  const overviewClose = iconButton('x', 'Close all pages', 'Esc')
  const overviewCount = h('span', { class: 'pw-folio' })
  const overview = h('div', { class: 'pw-overview', role: 'dialog', 'aria-label': 'All pages', hidden: true }, h('header', { class: 'pw-overview-head' }, h('strong', { text: 'All pages' }), overviewCount, overviewClose), overviewGrid)

  const layout = h('div', { class: 'pw-layout' }, rail, centre, inspector)
  root.replaceChildren(layout, overview)

  // ——— Which page is on show ———
  const pages = () => host.pages()
  const currentId = (list: PageEntry[] = pages()) => {
    const selected = host.selectedPage()
    if (list.some(page => page.id === selected)) return selected
    const saved = savedPage()
    if (list.some(page => page.id === saved)) return saved
    return list[0]?.id || ''
  }
  const go = (key: PageKey | number) => {
    const all = pages()
    if (!all.length) return
    const at = Math.max(0, all.findIndex(page => page.id === currentId(all)))
    const to = typeof key === 'number' ? key : key === 'next' ? at + 1 : key === 'previous' ? at - 1 : key === 'first' ? 0 : key === 'last' ? all.length - 1 : at
    const target = all[Math.min(all.length - 1, Math.max(0, to))]
    if (!target || target.id === all[at]?.id) return
    savePage(target.id)
    host.selectPage(target.id)
    render()
  }

  // ——— The rail: one numbered picture per page ———
  type RailItem = { li: HTMLLIElement; button: HTMLButtonElement; number: HTMLSpanElement; flag: HTMLSpanElement; image: HTMLImageElement; tone: string }
  const railItems = new Map<string, RailItem>()
  const railItem = (id: string): RailItem => {
    const number = h('span', { class: 'pw-page-number' })
    const flag = h('span', { class: 'pw-page-flag' })
    const image = h('img', { alt: '', loading: 'lazy', draggable: 'false' })
    const button = h('button', { type: 'button', class: 'pw-page', 'data-page': id, 'data-pw-keys': '' }, h('span', { class: 'pw-page-meta' }, number, flag), h('span', { class: 'pw-page-thumb' }, image))
    button.addEventListener('click', () => {
      const all = pages()
      const index = all.findIndex(page => page.id === id)
      if (index >= 0) go(index)
    })
    // The rail is a list the arrows walk: the page follows the keyboard.
    button.addEventListener('keydown', event => {
      const key = pageKeyOf(event, { space: false })
      if (!key || key === 'overview' || key === 'fullscreen') return
      event.preventDefault()
      event.stopPropagation()
      go(key)
      railItems.get(currentId())?.button.focus({ preventScroll: true })
    })
    return { li: h('li', {}, button), button, number, flag, image, tone: '' }
  }
  const syncRail = (all: PageEntry[], current: string) => {
    const seen = new Set<string>()
    all.forEach((page, index) => {
      let item = railItems.get(page.id)
      if (!item) {
        item = railItem(page.id)
        railItems.set(page.id, item)
      }
      if (list.children[index] !== item.li) list.insertBefore(item.li, list.children[index] || null)
      const on = page.id === current
      item.number.textContent = folio(index + 1)
      item.button.classList.toggle('is-current', on)
      if (on) item.button.setAttribute('aria-current', 'page')
      else item.button.removeAttribute('aria-current')
      item.button.tabIndex = on ? 0 : -1
      const state = page.state ? ` — ${page.state.label}` : ''
      item.button.setAttribute('aria-label', `Page ${index + 1}: ${page.title}${state}`)
      item.button.title = `${index + 1}. ${page.title}${state}`
      const tone = page.state?.tone || ''
      if (tone !== item.tone) {
        item.tone = tone
        item.flag.className = `pw-page-flag${tone ? ` is-${tone}` : ''}`
        item.flag.replaceChildren(...(page.state ? [icon(STATE_ICONS[page.state.tone], 'ui-icon pw-flag-icon')] : []))
      }
      item.flag.title = page.state ? `${page.state.label}: ${page.state.detail}` : ''
      const src = host.pictureOf(page.id)
      if (item.image.getAttribute('src') !== src) {
        if (src) item.image.src = src
        else item.image.removeAttribute('src')
      }
      seen.add(page.id)
    })
    for (const [id, item] of railItems) {
      if (seen.has(id)) continue
      item.li.remove()
      railItems.delete(id)
    }
    railCount.textContent = String(all.length)
  }

  // ——— The stage: the page on show, as large as the room allows ———
  const syncStage = (all: PageEntry[], current: string) => {
    const index = all.findIndex(page => page.id === current)
    const page = all[index]
    stage.hidden = !page
    empty.hidden = Boolean(page)
    if (!page) {
      empty.replaceChildren(h('strong', { text: 'No pages yet' }), h('span', { text: 'Pages appear here as they are made. The notebook keeps everything else.' }))
      counter.textContent = ''
      caption.textContent = ''
      previous.disabled = true
      next.disabled = true
      overviewTool.disabled = true
      fullscreenTool.disabled = true
      railOverview.disabled = true
      shownPage = ''
      return
    }
    overviewTool.disabled = false
    fullscreenTool.disabled = false
    railOverview.disabled = false
    const src = host.pictureOf(page.id)
    if (page.id !== shownPage || src !== shownPicture) {
      // A new page comes in with a short fade; the same page redrawn does not.
      const turned = page.id !== shownPage
      shownPage = page.id
      shownPicture = src
      if (src) picture.src = src
      else picture.removeAttribute('src')
      picture.alt = page.title
      if (turned && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
        picture.classList.remove('is-entering')
        void picture.offsetWidth
        picture.classList.add('is-entering')
      }
    }
    badge.hidden = !page.state || page.state.tone === 'good'
    if (page.state) {
      badge.textContent = page.state.label
      badge.className = `pw-stage-badge is-${page.state.tone}`
      badge.title = page.state.detail
    }
    counter.textContent = `${folio(index + 1)} / ${folio(all.length)}`
    counter.setAttribute('aria-label', `Page ${index + 1} of ${all.length}`)
    caption.textContent = page.title
    previous.disabled = index <= 0
    next.disabled = index >= all.length - 1
  }
  // The stage takes the page's own proportions once its picture is read.
  picture.addEventListener('load', () => {
    if (picture.naturalWidth && picture.naturalHeight) root.style.setProperty('--pw-aspect', String(picture.naturalWidth / picture.naturalHeight))
  })

  // ——— The inspector: what the page explains, its notes, its source ———
  const section = (label: string, iconName: IconName | null, ...content: Array<Node | null>) =>
    h('section', { class: 'pw-section' }, h('h3', { class: 'pw-section-label' }, iconName ? icon(iconName) : null, label), ...content)
  const syncInspector = (all: PageEntry[], current: string) => {
    const index = all.findIndex(page => page.id === current)
    const page = all[index]
    const key = JSON.stringify(page ? [page, all.length] : null)
    if (key === shownInspector) return
    shownInspector = key
    if (!page) {
      inspectorHead.replaceChildren(h('span', { class: 'sw-eyebrow', text: 'Pages' }), h('h2', { text: 'No page yet' }))
      panel.replaceChildren(h('p', { class: 'review-muted', text: 'What a page explains and its notes show here once it is made.' }))
      return
    }
    inspectorHead.replaceChildren(h('span', { class: 'sw-eyebrow', text: `Page ${index + 1} of ${all.length}` }), h('h2', { text: page.title }))
    panel.replaceChildren(
      ...[
        page.idea ? section('What this page explains', null, h('p', { class: 'pw-idea', text: page.idea })) : null,
        section('Notes', 'notebook-pen', ...(page.notes.length ? page.notes.map(paragraph => h('p', { class: 'pw-note', text: paragraph })) : [h('p', { class: 'pw-empty-note', text: 'No notes for this page yet.' })])),
        page.passages.length ? section('From the source', 'quote', h('ul', { class: 'pw-passages' }, ...page.passages.map(passage => h('li', { text: passage })))) : null,
        page.state ? section('How it was made', STATE_ICONS[page.state.tone], h('p', { class: `pw-made is-${page.state.tone}` }, h('strong', { text: page.state.label }), ` — ${page.state.detail}`)) : null,
      ].filter((part): part is HTMLElement => Boolean(part)),
    )
    panel.scrollTop = 0
  }

  // ——— All pages at once ———
  const columns = () => {
    const first = overviewGrid.children[0] as HTMLElement | undefined
    if (!first) return 1
    const top = first.offsetTop
    let count = 0
    for (const child of Array.from(overviewGrid.children) as HTMLElement[]) {
      if (child.offsetTop !== top) break
      count += 1
    }
    return Math.max(1, count)
  }
  // Drawn again only when its pages change; the page that had the keyboard keeps it.
  let overviewKey = ''
  const renderOverview = (all: PageEntry[], current: string) => {
    overviewCount.textContent = `${folio(Math.max(1, all.findIndex(page => page.id === current) + 1))} / ${folio(all.length)}`
    const key = JSON.stringify([current, all.map(page => [page.id, page.title, host.pictureOf(page.id).length])])
    if (key === overviewKey) return
    overviewKey = key
    const focused = document.activeElement instanceof HTMLElement ? document.activeElement.closest('.pw-overview-page')?.getAttribute('data-page') || '' : ''
    overviewGrid.replaceChildren(
      ...all.map((page, index) => {
        const src = host.pictureOf(page.id)
        const button = h('button', { type: 'button', class: `pw-overview-page${page.id === current ? ' is-current' : ''}`, 'data-page': page.id, 'aria-label': `Page ${index + 1}: ${page.title}`, 'aria-current': page.id === current ? 'page' : undefined },
          h('span', { class: 'pw-page-thumb' }, src ? Object.assign(h('img', { alt: '', loading: 'lazy', draggable: 'false' }), { src }) : null),
          h('span', { class: 'pw-overview-label' }, h('span', { class: 'pw-page-number', text: folio(index + 1) }), h('span', { class: 'pw-overview-title', text: page.title })),
        )
        button.addEventListener('click', () => {
          closeOverview(false)
          go(index)
        })
        return h('li', {}, button)
      }),
    )
    if (focused) overviewGrid.querySelector<HTMLElement>(`[data-page="${CSS.escape(focused)}"]`)?.focus({ preventScroll: true })
  }
  const openOverview = () => {
    const all = pages()
    if (!all.length || overviewOpen) return
    overviewOpen = true
    overviewKey = ''
    renderOverview(all, currentId(all))
    overview.hidden = false
    overviewGrid.querySelector<HTMLElement>('.is-current')?.focus({ preventScroll: false })
  }
  const closeOverview = (restore = true) => {
    if (!overviewOpen) return
    overviewOpen = false
    overview.hidden = true
    if (restore) railItems.get(currentId())?.button.focus({ preventScroll: true })
  }
  overview.addEventListener('keydown', event => {
    if (event.key === 'Escape' || ((event.key === 'o' || event.key === 'O') && !event.metaKey && !event.ctrlKey && !event.altKey)) {
      event.preventDefault()
      event.stopPropagation()
      closeOverview()
      return
    }
    const moves: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: columns(), ArrowUp: -columns() }
    if (!(event.key in moves)) return
    const buttons = Array.from(overviewGrid.querySelectorAll<HTMLButtonElement>('button'))
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement)
    const to = Math.min(buttons.length - 1, Math.max(0, (at < 0 ? 0 : at) + moves[event.key]))
    event.preventDefault()
    event.stopPropagation()
    buttons[to]?.focus()
  })
  overviewClose.addEventListener('click', () => closeOverview())
  overviewTool.addEventListener('click', openOverview)
  railOverview.addEventListener('click', openOverview)

  // ——— Full screen: the stage alone ———
  const toggleFullscreen = () => {
    if (document.fullscreenElement === stage) void document.exitFullscreen?.()
    else if (!stage.hidden) void stage.requestFullscreen?.().catch(() => undefined)
  }
  fullscreenTool.addEventListener('click', toggleFullscreen)
  document.addEventListener('fullscreenchange', () => {
    const full = document.fullscreenElement === stage
    fullscreenTool.replaceChildren(icon(full ? 'minimize-2' : 'maximize-2'), h('span', { text: full ? 'Exit full screen' : 'Full screen' }))
    fullscreenTool.setAttribute('aria-pressed', String(full))
  })
  previous.addEventListener('click', () => go('previous'))
  next.addEventListener('click', () => go('next'))

  // ——— The keys and the wheel ———
  document.addEventListener('keydown', event => {
    if (root.hidden || overviewOpen || event.defaultPrevented || event.isComposing) return
    if (typingTarget(event.target) || controlTarget(event.target) || modalOpen()) return
    const onOwnButton = event.target instanceof Element && Boolean(event.target.closest('[data-pw-keys]'))
    const key = pageKeyOf(event, { space: !onOwnButton })
    if (!key) return
    event.preventDefault()
    if (key === 'overview') openOverview()
    else if (key === 'fullscreen') toggleFullscreen()
    else go(key)
  })
  const wheel = createWheelPager()
  stageArea.addEventListener('wheel', event => {
    if (event.ctrlKey) return
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? stageArea.clientHeight : 1
    const turn = wheel(event.deltaY * unit, event.deltaX * unit, performance.now())
    event.preventDefault()
    if (turn > 0) go('next')
    else if (turn < 0) go('previous')
  }, { passive: false })

  // ——— The view, and what moves in with it ———
  const syncTabs = () => {
    const on = host.on()
    const pagesTab = document.getElementById('workspace-tab-pages')
    const notebookTab = document.getElementById('workspace-tab-notebook')
    if (pagesTab) {
      pagesTab.hidden = !on
      pagesTab.classList.toggle('active', on && view === 'pages')
      pagesTab.setAttribute('aria-pressed', String(on && view === 'pages'))
    }
    if (notebookTab && on) {
      notebookTab.classList.toggle('active', view === 'notebook')
      notebookTab.setAttribute('aria-pressed', String(view === 'notebook'))
    }
  }
  const mountNotices = () => {
    for (const element of host.notices()) {
      if (element.parentNode === notices) continue
      if (element.parentNode) homes.set(element, { parent: element.parentNode, next: element.nextSibling })
      notices.append(element)
    }
  }
  const unmountNotices = () => {
    for (const [element, home] of homes) {
      if (element.parentNode !== notices) continue
      home.parent.insertBefore(element, home.next && home.next.parentNode === home.parent ? home.next : null)
    }
    homes.clear()
  }
  const apply = () => {
    const on = host.on() && view === 'pages'
    const changed = root.hidden === on
    root.hidden = !on
    document.body.classList.toggle('is-page-workspace', on)
    document.body.classList.toggle('has-page-view', host.on())
    syncTabs()
    if (on) mountNotices()
    else {
      unmountNotices()
      closeOverview(false)
      if (document.fullscreenElement === stage) void document.exitFullscreen?.()
    }
    if (changed) host.viewChanged(on ? 'pages' : 'notebook')
    shownInspector = ''
    if (on) render()
  }
  const show = (next: PagesView) => {
    view = next
    try {
      window.localStorage.setItem(VIEW_KEY, next)
    } catch {
      // Kept for this session only.
    }
    apply()
  }
  document.getElementById('workspace-tab-pages')?.addEventListener('click', () => show('pages'))
  document.getElementById('workspace-tab-notebook')?.addEventListener('click', () => {
    if (host.on()) show('notebook')
  })

  const render = () => {
    if (root.hidden) return
    const all = pages()
    if (all.length && restoredFor !== host.projectId()) {
      restoredFor = host.projectId()
      const saved = savedPage()
      if (saved && saved !== host.selectedPage() && all.some(page => page.id === saved)) host.selectPage(saved)
    }
    const current = currentId(all)
    if (current && current !== savedTo) {
      savedTo = current
      savePage(current)
    }
    if (current && current !== host.selectedPage()) host.selectPage(current)
    syncRail(all, current)
    syncStage(all, current)
    syncInspector(all, current)
    if (overviewOpen) {
      if (all.length) renderOverview(all, current)
      else closeOverview(false)
    }
    // The page on show stays in view in the rail when it changes, not on every redraw.
    if (current !== scrolledTo) {
      scrolledTo = current
      railItems.get(current)?.li.scrollIntoView({ block: 'nearest' })
    }
  }

  return {
    // Called when a notebook opens, and whenever it starts or stops showing pages.
    start: () => apply(),
    render,
    show,
    view: () => (host.on() ? view : 'notebook'),
    active: () => !root.hidden,
    go,
  }
}
