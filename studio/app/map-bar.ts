// The bar under the canvas says what is selected and offers what can be done
// with it: copy, cut, paste, move, bring a copy up to date; what is used less
// waits behind "More". It also asks for a new episode, a new title, and a
// change to a page.
import type { MapCanvas } from './map-canvas'
import { colorOf } from './map-view'
import { escape } from './ui'

type Node = HTMLElement & { _html?: string }
const act = (action: string, label: string, kbd = '', primary = false) =>
  `<button type="button" class="${primary ? 'primary' : 'quiet'}" data-map="${action}">${escape(label)}${kbd ? `<kbd>${kbd}</kbd>` : ''}</button>`
const more = (menu: string) =>
  `<button type="button" class="quiet map-more" data-map="menu:${menu}" aria-label="More" title="More">⋯</button>`
const SEP = '<i class="map-sep"></i>'

const content = (map: MapCanvas) => {
  const { snapshot, view, sel, clip } = map
  if (!snapshot) return ''
  if (map.naming) {
    const chosen = map.naming.slides.length
    // With pages chosen it only needs a title; else the agent picks pages.
    return chosen
      ? `<form class="map-ask" data-map-form="episode"><label>New episode with ${chosen} page${chosen === 1 ? '' : 's'}<input name="title" maxlength="120" placeholder="Its title" autocomplete="off"></label><button type="submit" class="primary">Add episode</button><button type="button" class="quiet" data-map="cancel">Cancel</button></form>`
      : `<form class="map-ask" data-map-form="episode"><label>New episode<input name="title" maxlength="400" placeholder="What is this episode about?" autocomplete="off"></label><button type="submit" class="primary" disabled title="The agent chooses its pages from the map">Let the agent choose</button><button type="button" class="quiet" data-map="empty-episode">Start empty</button><button type="button" class="quiet" data-map="cancel">Cancel</button></form>`
  }
  if (map.changing) {
    const slide = snapshot.project.slides.find((s) => s.id === map.changing)
    return `<form class="map-ask" data-map-form="change"><label>Change “${escape(slide?.title || 'this page')}”<input name="instruction" maxlength="4000" placeholder="Say what to add, cut or fix" autocomplete="off"></label><button type="submit" class="primary">Send</button><button type="button" class="quiet" data-map="cancel">Cancel</button></form>`
  }
  if (map.renaming) {
    const what =
      map.renaming.kind === 'series'
        ? 'Rename the series'
        : 'Rename the episode'
    return `<form class="map-ask" data-map-form="rename"><label>${what}<input name="title" maxlength="120" value="${escape(map.renaming.title)}" autocomplete="off"></label><button type="submit" class="primary">Save</button><button type="button" class="quiet" data-map="cancel">Cancel</button></form>`
  }
  const clipped = clip
    ? `<small>${clip.mode === 'move' ? 'cut from its episode' : `page ${snapshot.project.slides.findIndex((s) => s.id === clip.slide) + 1} ${clip.mode === 'cut' ? 'cut' : 'copied'}`} · ⌘V to paste</small>`
    : ''
  if (sel?.t === 'page') {
    const index = snapshot.project.slides.findIndex((s) => s.id === sel.id)
    const slide = snapshot.project.slides[index]
    if (!slide) return ''
    const users = view?.usage[slide.id] || []
    const where = slide.aside
      ? 'set aside'
      : users.length && view
        ? `in ${users.map((id) => `Ep ${view.episodes.find((e) => e.notebook === id)?.number ?? '?'}`).join(', ')}`
        : 'unused'
    const series = Boolean(view?.series)
    const failed = snapshot.changes?.find(
      (change) => change.slideId === slide.id && change.state === 'failed'
    )
    return `<div class="map-info"><b>Page ${index + 1}</b> · ${escape(slide.title || 'Untitled')}<small>${failed ? escape(failed.message || 'its change failed') : where}</small>${clipped}</div>${
      failed ? act('resend', 'Send again', '', true) : ''
    }${series && slide.svg ? act('menu:copy-to', 'Copy to…') : ''}${act('change', 'Change…')}${more('page')}`
  }
  if (sel?.t === 'copy' && view) {
    const episode = map.episodeOf(sel.id)
    const index = episode?.copies.findIndex((c) => c.id === sel.id) ?? -1
    const copy = episode?.copies[index]
    if (!episode || !copy) return ''
    const page = copy.copyOf
      ? snapshot.project.slides.findIndex((s) => s.id === copy.copyOf!.slide) +
        1
      : 0
    const others = (copy.copyOf ? view.usage[copy.copyOf.slide] || [] : [])
      .filter((id) => id !== episode.notebook)
      .map(
        (id) =>
          `Ep ${view.episodes.find((e) => e.notebook === id)?.number ?? '?'}`
      )
    // Where it came from, as a link that shows the map page.
    const link = page
      ? `<button type="button" class="map-link" data-map="reveal:${copy.copyOf!.slide}">page ${page}</button>`
      : ''
    const note = copy.orphan
      ? 'the map page was deleted; this copy keeps it'
      : copy.stale
        ? `${link} changed since this copy`
        : page
          ? `from ${link}${others.length ? ` · also in ${others.join(', ')}` : ''}`
          : 'its own page'
    return `<div class="map-info"><b style="color:${colorOf(view, episode.notebook)}">Ep ${episode.number}</b> · ${index + 1} of ${episode.copies.length} · ${escape(copy.title)}<small>${note}</small>${clipped}</div>${
      copy.stale
        ? act('update', 'Update copy', '', true) +
          act('keep', 'Keep this version') +
          SEP
        : ''
    }${act('menu:move-to', 'Move to…')}${act('remove', 'Remove', '⌫')}${more('copy')}`
  }
  if (sel?.t === 'lane' && view) {
    const episode = view.episodes.find((e) => e.notebook === sel.id)
    if (!episode) return ''
    return `<div class="map-info"><b style="color:${colorOf(view, episode.notebook)}">Ep ${episode.number}</b> · ${escape(episode.title)}<small>${episode.copies.length} page${episode.copies.length === 1 ? '' : 's'}${episode.segues === 'failed' ? ' · segues failed' : ''}</small>${clipped}</div>${
      clip ? act('paste', 'Paste', '⌘V', true) : ''
    }${episode.picking?.state === 'failed' ? act(`pick:${episode.notebook}`, 'Pick pages again', '', true) : ''}${act('rename-episode', 'Rename')}${more('lane')}`
  }
  if (sel?.t === 'series' && view?.series)
    return `<div class="map-info"><b>Series</b> · ${escape(view.series.title)}<small>${view.episodes.length} episode${view.episodes.length === 1 ? '' : 's'}</small></div>${act('rename-series', 'Rename')}`
  if (clip)
    return `<div class="map-info">${clipped.replace(/<\/?small>/g, '')} · select an episode</div>${act('clear-clip', 'Clear')}`
  return ''
}

export const renderBar = (map: MapCanvas) => {
  const node = map.slot('bar') as Node | null
  if (!node) return
  const html = content(map)
  node.hidden = !html
  if (node._html === html) return
  // A form being typed in keeps its text while the map refreshes.
  if (
    node.querySelector('form') &&
    html.startsWith('<form') &&
    node._html?.slice(0, 60) === html.slice(0, 60)
  )
    return
  node.innerHTML = html
  node._html = html
}

export type MenuItem = {
  action: string
  label: string
  color?: string
  note?: string
  disabled?: boolean
  danger?: boolean
  /** A line above it, to set it apart. */
  sep?: boolean
}
/** Opens above the anchor when there is room, else below; inside the stage. */
const place = (menu: HTMLElement, anchor: HTMLElement, stage: Element) => {
  const box = stage.getBoundingClientRect()
  const at = anchor.getBoundingClientRect()
  const above = at.top - box.top - menu.offsetHeight - 8
  menu.style.left = `${Math.max(10, Math.min(at.left - box.left, box.width - menu.offsetWidth - 10))}px`
  menu.style.top = `${above >= 10 ? above : Math.max(10, Math.min(at.bottom - box.top + 8, box.height - menu.offsetHeight - 10))}px`
}
export const showMenu = (
  map: MapCanvas,
  anchor: HTMLElement,
  items: MenuItem[]
) => {
  const menu = map.slot('menu')
  const stage = map.root.querySelector('.map-stage')
  if (!menu || !stage) return
  menu.className = 'map-menu'
  menu.dataset.for = anchor.dataset.map || ''
  menu.innerHTML = items
    .map(
      (item) =>
        `${item.sep ? '<hr>' : ''}<button type="button" data-map="${item.action}"${item.disabled ? ' disabled' : ''}${item.danger ? ' class="is-danger"' : ''}>${item.color ? `<i style="--ep:${item.color}"></i>` : ''}<span>${escape(item.label)}</span>${item.note ? `<small>${escape(item.note)}</small>` : ''}</button>`
    )
    .join('')
  menu.hidden = false
  place(menu, anchor, stage)
}

export const hideMenu = (map: MapCanvas) => {
  const menu = map.slot('menu')
  if (menu) menu.hidden = true
}

/** The episodes a page or copy can go to, and a new one; an episode that
 * has the page already says so and cannot be chosen. */
export const episodeChoices = (
  map: MapCanvas,
  prefix: string,
  skip?: string,
  page?: string
): MenuItem[] => [
  ...(map.view?.episodes || [])
    .filter((episode) => episode.notebook !== skip)
    .map((episode) => {
      const has = Boolean(
        page && episode.copies.some((copy) => copy.copyOf?.slide === page)
      )
      return {
        action: `${prefix}:${episode.notebook}`,
        label: `Ep ${episode.number} · ${episode.title}`,
        color: colorOf(map.view!, episode.notebook),
        ...(has ? { note: 'has it', disabled: true } : {})
      }
    }),
  ...(prefix === 'copy-to'
    ? [{ action: 'copy-to:new', label: '+ New episode…', sep: true }]
    : [])
]

/** What waits behind "More" for a page, a copy or an episode. */
export const moreChoices = (map: MapCanvas, kind: string): MenuItem[] => {
  const { snapshot, view, sel } = map
  if (kind === 'page' && sel?.t === 'page') {
    const slide = snapshot?.project.slides.find((s) => s.id === sel.id)
    return [
      ...(view?.series && slide?.svg
        ? [
            { action: 'copy', label: 'Copy', note: '⌘C' },
            { action: 'cut', label: 'Cut, for one episode only', note: '⌘X' }
          ]
        : []),
      { action: 'open-page', label: 'Open in the Wireframe stage' },
      {
        action: slide?.aside ? 'bring-back' : 'aside',
        label: slide?.aside ? 'Bring back' : 'Set aside',
        note: slide?.aside ? '' : 'not to be used'
      },
      { action: 'delete-page', label: 'Delete page', danger: true, sep: true }
    ]
  }
  if (kind === 'copy' && sel?.t === 'copy')
    return [
      { action: 'cut-copy', label: 'Cut', note: '⌘X' },
      { action: 'open-copy', label: 'Open in the episode' }
    ]
  if (kind === 'lane' && sel?.t === 'lane' && view) {
    const episode = view.episodes.find((e) => e.notebook === sel.id)
    if (!episode) return []
    return [
      ...(episode.copies.length
        ? [
            {
              action: `segues:${episode.notebook}`,
              label: 'Rewrite segues'
            }
          ]
        : []),
      ...(episode.number > 1
        ? [{ action: 'order:-1', label: 'Move earlier' }]
        : []),
      ...(episode.number < view.episodes.length
        ? [{ action: 'order:1', label: 'Move later' }]
        : []),
      {
        action: 'remove-episode',
        label: 'Take out of the series',
        danger: true,
        sep: true
      }
    ]
  }
  return []
}

/** The posts the agent drafted for a made episode, each with Copy. */
export const showPosts = (
  map: MapCanvas,
  anchor: HTMLElement,
  episode: string
) => {
  const menu = map.slot('menu')
  const stage = map.root.querySelector('.map-stage')
  const posts = map.view?.episodes.find((e) => e.notebook === episode)?.posts
  if (!menu || !stage || !posts) return
  const channels = [
    ['x', 'X'],
    ['linkedin', 'LinkedIn'],
    ['youtube', 'YouTube']
  ] as const
  menu.className = 'map-menu is-posts'
  menu.dataset.for = anchor.dataset.map || ''
  menu.innerHTML = channels
    .map(
      ([key, name]) =>
        `<section><div class="map-post-head"><b>${name}</b><button type="button" class="quiet" data-map="copy-post:${episode}:${key}">Copy</button></div><p>${escape(posts[key])}</p></section>`
    )
    .join('')
  menu.hidden = false
  place(menu, anchor, stage)
}

const SHORTCUTS = [
  ['Drag a page onto an episode', 'copy it there'],
  ['Hold ⌥ while dragging', 'cut it: that episode only'],
  ['Drag a copy', 'reorder, or move it'],
  ['⌘C  ⌘X  ⌘V', 'copy, cut, paste into the selected episode'],
  ['⌫', 'remove the selected copy'],
  ['Double-click', 'zoom to a block'],
  ['Tab, then Enter', 'go through the cards and select'],
  ['Esc', 'clear the selection']
]
/** What the hands can do on the map: drag, keys, zoom. */
export const showHelp = (map: MapCanvas, anchor: HTMLElement) => {
  const menu = map.slot('menu')
  const stage = map.root.querySelector('.map-stage')
  if (!menu || !stage) return
  menu.className = 'map-menu is-help'
  menu.dataset.for = anchor.dataset.map || ''
  menu.innerHTML = `<dl>${SHORTCUTS.map(([keys, does]) => `<dt>${escape(keys)}</dt><dd>${escape(does)}</dd>`).join('')}</dl>`
  menu.hidden = false
  place(menu, anchor, stage)
}
