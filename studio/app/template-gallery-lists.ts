// The gallery's lists: every group with its templates, one group, and what a
// search finds. A search field heads every list.
import { escape, html } from './ui'
import { galleryIcon } from './template-icons'
import { narrativeCard, type GalleryState } from './template-gallery-parts'
import {
  NARRATIVES,
  STORY_GROUPS,
  groupById,
  groupNarratives,
  type Narrative,
  type StoryGroup,
  narrativeById
} from '../shared/narratives'

/** Searches offered under the field, one click each. */
const TRIES = ['incident', 'demo', 'code', 'customers']

/** All the words a template can be found by. */
const searchText = (narrative: Narrative) =>
  [
    groupById(narrative.group)?.name,
    narrative.name,
    narrative.line,
    narrative.audience,
    ...narrative.rules,
    ...narrative.needs,
    ...narrative.beats.map((beat) => `${beat.name} ${beat.know}`)
  ]
    .join(' ')
    .toLowerCase()

/**
 * The templates a search finds: those with the whole phrase, else those
 * with every one of its words.
 */
export const findTemplates = (query: string) => {
  const phrase = query.trim().toLowerCase()
  if (!phrase) return []
  const texts = NARRATIVES.map((item) => [item, searchText(item)] as const)
  const exact = texts.filter(([, text]) => text.includes(phrase))
  const words = phrase.split(/\s+/)
  return (
    exact.length
      ? exact
      : texts.filter(([, text]) => words.every((word) => text.includes(word)))
  ).map(([item]) => item)
}

const searchBox = (state: GalleryState) =>
  html`<label class="tpl-search">
    ${galleryIcon('search')}<input
      type="search"
      data-tpl-search
      placeholder="Search ${NARRATIVES.length} templates by story, beat or word"
      aria-label="Search templates"
      autocomplete="off"
      spellcheck="false"
      value="${escape(state.query)}"
    /><kbd aria-hidden="true">/</kbd>
  </label>`

const tries = `<div class="tpl-suggest"><span>Try</span>${TRIES.map(
  (words) => `<button type="button" data-tpl-try="${words}">${words}</button>`
).join('')}</div>`

const cards = (narratives: Narrative[], state: GalleryState) =>
  `<div class="tpl-grid">${narratives
    .map((item) => narrativeCard(item, state.current.narrative))
    .join('')}</div>`

const groupSection = (group: StoryGroup, state: GalleryState) =>
  html`<section class="tpl-group" data-group="${group.id}">
    <div class="tpl-story-head">
      <h2>
        <button type="button" data-tpl-group="${group.id}">
          ${galleryIcon(group.id)}${escape(group.name)}
        </button>
      </h2>
      <p>${escape(group.line)}</p>
    </div>
    ${cards(groupNarratives(group.id), state)}
  </section>`

/** The templates suggested for this post, first, before the groups. */
const suggestedSection = (state: GalleryState) => {
  const found = (state.suggested || [])
    .map((id) => narrativeById(id))
    .filter((item): item is Narrative => Boolean(item))
  return found.length
    ? html`<section class="tpl-group tpl-suggested" data-group="suggested">
        <div class="tpl-story-head">
          <h2>Suggested for this post</h2>
          <p>The stories your notes tell best, best first.</p>
        </div>
        ${cards(found, state)}
      </section>`
    : ''
}

/** What the list shows with no search: a head, a line under it, a body. */
const listView = (state: GalleryState) => {
  const group = STORY_GROUPS.find((item) => item.id === state.group)
  if (group)
    return {
      head: html`<h1>${escape(group.name)}</h1>
        <p>${escape(group.line)}</p>`,
      after: '',
      body: cards(groupNarratives(group.id), state)
    }
  return {
    head: html`<h1>Templates</h1>
      <p>
        Pick the story your post tells, then how to tell it: its length, its
        drama and how much you are on camera.
      </p>`,
    // With a suggestion, it leads; the generic tries are for no post.
    after: state.suggested?.length ? '' : tries,
    body:
      suggestedSection(state) +
      STORY_GROUPS.map((item) => groupSection(item, state)).join('')
  }
}

/** The list's body: what a search finds, or the list itself. */
export const templateResults = (state: GalleryState) => {
  if (!state.query.trim()) return listView(state).body
  const found = findTemplates(state.query)
  return found.length
    ? `<p class="tpl-count">${found.length} ${found.length === 1 ? 'template' : 'templates'} for “${escape(state.query.trim())}”</p><div class="tpl-grid">${found
        .map((item) =>
          narrativeCard(
            item,
            state.current.narrative,
            groupById(item.group)?.name
          )
        )
        .join('')}</div>`
    : `<p class="tpl-count">No template matches “${escape(state.query.trim())}”. Try a story, such as incident or launch.</p>`
}

export const listPage = (state: GalleryState) => {
  const view = listView(state)
  return html`<div class="tpl-head">
      ${view.head}${searchBox(state)}${view.after}
    </div>
    <div class="tpl-results">${templateResults(state)}</div>`
}
