// Line icons for the template gallery: one per group of stories, and the
// search field's glass. Drawn on a 24 grid; the stroke comes from CSS.
const PATHS: Record<string, string> = {
  all: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',
  explain:
    '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.4c.8.8 1 1.7 1 2.6h6c0-.9.2-1.8 1-2.6A6 6 0 0 0 12 3z"/>',
  teach:
    '<path d="M3 5.6C5.6 4 8.6 4 12 6c3.4-2 6.4-2 9-.4V19c-2.6-1.6-5.6-1.6-9 .4-3.4-2-6.4-2-9-.4z"/><path d="M12 6v13.4"/>',
  decide:
    '<path d="M12 3v18M7 21h10M4.5 7h15M6.5 7 3.5 13a3 3 0 0 0 6 0zM17.5 7l-3 6a3 3 0 0 0 6 0z"/>',
  'look-back':
    '<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1L3.5 8.5M3.5 3.5v5h5M12 7.5V12l3 2"/>',
  show: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10 9.4v5.2l4.4-2.6z"/>',
  announce:
    '<path d="M4 10v4h3l6.5 4V6L7 10zM16.8 9a4 4 0 0 1 0 6M7 14l1.6 5h2.6L10.4 15.6"/>',
  share:
    '<circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.4 2.7-6 6-6s6 2.6 6 6M15.5 4.6a3.5 3.5 0 0 1 0 6.8M18 14.2c1.9.8 3 2.8 3 5.8"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.4-4.4"/>'
}

/** An icon by name, sized and stroked by the stylesheet. */
export const galleryIcon = (name: string) =>
  `<svg class="tpl-icon" viewBox="0 0 24 24" aria-hidden="true">${PATHS[name] ?? PATHS.all}</svg>`
