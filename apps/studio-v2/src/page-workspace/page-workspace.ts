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
import { stageKeyOf, stageKeysFree, type StageKey } from '../ui/keys'
import { createOverview, folio } from '../ui/overview'
import { createWheelPager, type PageEntry } from './pages'

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
  const button = h('button', { type: 'button', class: 'pw-icon-button', 'aria-label': label, title: key ? `${label} (${key})` : label, 'data-stage-keys': '' })
  button.append(icon(name))
  if (key) button.setAttribute('aria-keyshortcuts', key)
  return button
}

const STATE_ICONS: Record<NonNullable<PageEntry['state']>['tone'], IconName> = { good: 'palette', busy: 'loader-circle', warn: 'square-dashed' }

export const createPageWorkspace = (host: PageWorkspaceHost) => {
  const root = document.getElementById('page-workspace') as HTMLElement
  let view: PagesView = savedPagesView()
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
  // A page still waiting for its design has a stage of its own, not its
  // wireframe at full size looking like the slide (F03 of the component
  // review); the wireframe is there as a reference, named as one.
  const waitingTitle = h('strong', { class: 'pw-waiting-title' })
  const waitingState = h('p', { class: 'pw-waiting-state' })
  const waitingDetail = h('p', { class: 'pw-waiting-detail' })
  const showReference = h('button', { type: 'button', class: 'button', text: 'Show the wireframe reference' })
  const waiting = h('div', { class: 'pw-waiting', hidden: true }, h('span', { class: 'pw-waiting-mark', 'aria-hidden': 'true' }, icon('loader-circle')), waitingTitle, waitingState, waitingDetail, showReference)
  const hideReference = h('button', { type: 'button', class: 'button small pw-reference-hide', hidden: true, text: 'Hide the reference' })
  const references = new Set<string>()
  const stage = h('figure', { class: 'pw-stage', 'aria-live': 'polite' }, picture, waiting, badge, hideReference)
  const empty = h('div', { class: 'pw-empty', hidden: true })
  const stageArea = h('div', { class: 'pw-stage-area' }, stage, empty)
  const previous = iconButton('chevron-left', 'Previous page', '←')
  const next = iconButton('chevron-right', 'Next page', '→')
  const counter = h('span', { class: 'pw-folio', 'aria-live': 'polite' })
  const caption = h('span', { class: 'pw-stage-title' })
  const overviewTool = h('button', { type: 'button', class: 'pw-tool ui-tool', title: 'All pages at once (O)', 'aria-keyshortcuts': 'O', 'data-stage-keys': '' }, icon('grid-2x2'), h('span', { text: 'All pages' }))
  const fullscreenTool = h('button', { type: 'button', class: 'pw-tool ui-tool', title: 'The page on the whole screen (F)', 'aria-keyshortcuts': 'F', 'data-stage-keys': '' }, icon('maximize-2'), h('span', { text: 'Full screen' }))
  const stageRow = h('div', { class: 'pw-stage-row' }, h('div', { class: 'pw-pager' }, previous, counter, next), caption, h('div', { class: 'pw-stage-tools' }, overviewTool, fullscreenTool))
  const centre = h('section', { class: 'pw-centre', 'aria-label': 'Page on show' }, notices, stageArea, stageRow)

  const inspectorHead = h('header', { class: 'pw-inspector-head' })
  const panel = h('div', { class: 'sw-panel pw-panel' })
  const inspector = h('aside', { class: 'sw-inspector pw-inspector', 'aria-label': 'About this page' }, inspectorHead, panel)

  const overview = createOverview({
    heading: 'All pages',
    noun: 'Page',
    onPick: id => {
      const index = pages().findIndex(page => page.id === id)
      if (index >= 0) go(index)
      railItems.get(currentId())?.button.focus({ preventScroll: true })
    },
    onClose: () => railItems.get(currentId())?.button.focus({ preventScroll: true }),
  })

  const layout = h('div', { class: 'pw-layout' }, rail, centre, inspector)
  root.replaceChildren(layout, overview.element)

  // ——— Which page is on show ———
  const pages = () => host.pages()
  const currentId = (list: PageEntry[] = pages()) => {
    const selected = host.selectedPage()
    if (list.some(page => page.id === selected)) return selected
    const saved = savedPage()
    if (list.some(page => page.id === saved)) return saved
    return list[0]?.id || ''
  }
  const go = (key: StageKey | number) => {
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
    const button = h('button', { type: 'button', class: 'pw-page', 'data-page': id, 'data-stage-keys': '' }, h('span', { class: 'pw-page-meta' }, number, flag), h('span', { class: 'pw-page-thumb' }, image))
    button.addEventListener('click', () => {
      const all = pages()
      const index = all.findIndex(page => page.id === id)
      if (index >= 0) go(index)
    })
    // The rail is a list the arrows walk: the page follows the keyboard.
    button.addEventListener('keydown', event => {
      const key = stageKeyOf(event, { space: false })
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
    const pending = page.state?.tone === 'busy'
    const referenced = pending && references.has(page.id)
    picture.hidden = pending && !referenced
    waiting.hidden = !pending || referenced
    hideReference.hidden = !referenced
    if (pending && page.state) {
      waitingTitle.textContent = page.title
      waitingState.textContent = page.state.label
      waitingDetail.textContent = page.state.detail
    }
    badge.hidden = !page.state || page.state.tone === 'good' || (pending && !referenced)
    if (page.state) {
      badge.textContent = referenced ? 'Wireframe reference · not the designed slide' : page.state.label
      badge.className = `pw-stage-badge is-${referenced ? 'warn' : page.state.tone}`
      badge.title = page.state.detail
    }
    counter.textContent = `${folio(index + 1)} / ${folio(all.length)}`
    counter.setAttribute('aria-label', `Page ${index + 1} of ${all.length}`)
    caption.textContent = page.title
    previous.disabled = index <= 0
    next.disabled = index >= all.length - 1
  }
  // The reference is asked for, and put away, page by page; the focus stays
  // on the button that does the other.
  showReference.addEventListener('click', () => {
    references.add(currentId())
    render()
    hideReference.focus({ preventScroll: true })
  })
  hideReference.addEventListener('click', () => {
    references.delete(currentId())
    render()
    showReference.focus({ preventScroll: true })
  })
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
  const overviewItems = (all: PageEntry[]) => all.map(page => ({ id: page.id, title: page.title, picture: host.pictureOf(page.id), note: page.state?.label, tone: page.state?.tone }))
  const openOverview = () => {
    const all = pages()
    overview.show(overviewItems(all), currentId(all))
  }
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
    if (root.hidden || overview.isOpen() || !stageKeysFree(event)) return
    const onOwnButton = event.target instanceof Element && Boolean(event.target.closest('[data-stage-keys]'))
    const key = stageKeyOf(event, { space: !onOwnButton })
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
      overview.hide(false)
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
    overview.render(overviewItems(all), current)
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
