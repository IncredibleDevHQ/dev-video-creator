// The bar under the canvas says what is selected and offers what can be done
// with it: copy, cut, paste, move, set aside, bring a copy up to date. It
// also asks for a new episode's title and for a change to a page.
import type { MapCanvas } from './map-canvas'
import { colorOf } from './map-view'
import { escape } from './ui'

type Node = HTMLElement & { _html?: string }
const act = (action: string, label: string, kbd = '', primary = false) =>
  `<button type="button" class="${primary ? 'primary' : 'quiet'}" data-map="${action}">${escape(label)}${kbd ? `<kbd>${kbd}</kbd>` : ''}</button>`
const SEP = '<i class="map-sep"></i>'

const content = (map: MapCanvas) => {
  const { snapshot, view, sel, clip } = map
  if (!snapshot) return ''
  if (map.naming) {
    const chosen = map.naming.slides.length
    // With pages chosen it only needs a title; else the agent picks pages.
    return chosen
      ? `<form class="map-ask" data-map-form="episode"><label>New episode with ${chosen} page${chosen === 1 ? '' : 's'}<input name="title" maxlength="120" placeholder="Its title" autocomplete="off"></label><button type="submit" class="primary">Add episode</button><button type="button" class="quiet" data-map="cancel">Cancel</button></form>`
      : `<form class="map-ask" data-map-form="episode"><label>New episode<input name="title" maxlength="400" placeholder="What is it about? The agent picks the pages" autocomplete="off"></label><button type="submit" class="primary">Pick pages</button><button type="button" class="quiet" data-map="empty-episode">Empty episode</button><button type="button" class="quiet" data-map="cancel">Cancel</button></form>`
  }
  if (map.changing) {
    const slide = snapshot.project.slides.find((s) => s.id === map.changing)
    return `<form class="map-ask" data-map-form="change"><label>Change “${escape(slide?.title || 'this page')}”<input name="instruction" maxlength="4000" placeholder="Say what to add, cut or fix" autocomplete="off"></label><button type="submit" class="primary">Send</button><button type="button" class="quiet" data-map="cancel">Cancel</button></form>`
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
    return `<div class="map-info"><b>Page ${index + 1}</b> · ${escape(slide.title || 'Untitled')}<small>${where}</small>${clipped}</div>${
      series && slide.svg
        ? act('copy', 'Copy', '⌘C') +
          act('cut', 'Cut', '⌘X') +
          act('menu:copy-to', 'Copy to…') +
          SEP
        : ''
    }${act('change', 'Change…')}${act(slide.aside ? 'bring-back' : 'aside', slide.aside ? 'Bring back' : 'Set aside')}`
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
    const note = copy.orphan
      ? 'the map page was deleted; this copy keeps it'
      : copy.stale
        ? `page ${page} changed since this copy`
        : others.length
          ? `copy of page ${page} · also in ${others.join(', ')}`
          : page
            ? `copy of page ${page}`
            : 'its own page'
    return `<div class="map-info"><b style="color:${colorOf(view, episode.notebook)}">Ep ${episode.number}</b> · ${index + 1} of ${episode.copies.length} · ${escape(copy.title)}<small>${escape(note)}</small>${clipped}</div>${
      copy.stale
        ? act('update', 'Update copy', '', true) +
          act('keep', 'Keep this version') +
          SEP
        : ''
    }${act('cut-copy', 'Cut', '⌘X')}${act('menu:move-to', 'Move to…')}${act('remove', 'Remove', '⌫')}`
  }
  if (sel?.t === 'lane' && view) {
    const episode = view.episodes.find((e) => e.notebook === sel.id)
    if (!episode) return ''
    return `<div class="map-info"><b style="color:${colorOf(view, episode.notebook)}">Ep ${episode.number}</b> · ${escape(episode.title)}<small>${episode.copies.length} page${episode.copies.length === 1 ? '' : 's'}${episode.segues === 'failed' ? ' · segues failed' : ''}</small>${clipped}</div>${
      clip ? act('paste', 'Paste', '⌘V', true) : ''
    }${act(`open:${episode.notebook}`, episode.video ? 'Open episode' : 'Make…')}${episode.copies.length ? act(`segues:${episode.notebook}`, 'Write segues again') : ''}${
      view.episodes.length > 1 ? SEP : ''
    }${episode.number > 1 ? act('order:-1', 'Move up') : ''}${episode.number < view.episodes.length ? act('order:1', 'Move down') : ''}`
  }
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

export const showMenu = (
  map: MapCanvas,
  anchor: HTMLElement,
  items: Array<{ action: string; label: string; color?: string }>
) => {
  const menu = map.slot('menu')
  const stage = map.root.querySelector('.map-stage')
  if (!menu || !stage) return
  menu.innerHTML = items
    .map(
      (item) =>
        `<button type="button" data-map="${item.action}">${item.color ? `<i style="--ep:${item.color}"></i>` : ''}${escape(item.label)}</button>`
    )
    .join('')
  menu.hidden = false
  const box = stage.getBoundingClientRect()
  const at = anchor.getBoundingClientRect()
  menu.style.left = `${Math.min(at.left - box.left, box.width - menu.offsetWidth - 10)}px`
  menu.style.top = `${at.top - box.top - menu.offsetHeight - 8}px`
}

export const hideMenu = (map: MapCanvas) => {
  const menu = map.slot('menu')
  if (menu) menu.hidden = true
}

/** The episodes a page or copy can go to, and a new one. */
export const episodeChoices = (
  map: MapCanvas,
  prefix: string,
  skip?: string
) => [
  ...(map.view?.episodes || [])
    .filter((episode) => episode.notebook !== skip)
    .map((episode) => ({
      action: `${prefix}:${episode.notebook}`,
      label: `Ep ${episode.number} · ${episode.title}`,
      color: colorOf(map.view!, episode.notebook)
    })),
  ...(prefix === 'copy-to'
    ? [{ action: 'copy-to:new', label: 'New episode' }]
    : [])
]
