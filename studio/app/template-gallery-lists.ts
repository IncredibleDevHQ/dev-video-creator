// The gallery's lists: every group with its stories as tiles, one group with
// its stories and their templates, one story, and what a search finds. A
// search field heads every list.
import { escape, html } from './ui'
import { galleryIcon } from './template-icons'
import {
  lowerFirst,
  storyStage,
  templateCard,
  type GalleryState
} from './template-gallery-parts'
import {
  STORY_GROUPS,
  TEMPLATE_STORIES,
  VIDEO_TEMPLATES,
  groupById,
  storyById,
  storyTemplates,
  type StoryGroup,
  type TemplateStory,
  type VideoTemplate
} from '../shared/video-templates'

/** Searches offered under the field, one click each. */
const TRIES = ['incident', 'captions', 'quickstart', 'no one on camera']

/** All the words a template can be found by. */
const searchText = (template: VideoTemplate) => {
  const story = storyById(template.story)
  return [
    groupById(story.group)?.name,
    story.name,
    story.line,
    story.audience,
    template.name,
    template.tagline,
    template.purpose,
    ...template.slots.map((slot) => `${slot.role} ${slot.move}`)
  ]
    .join(' ')
    .toLowerCase()
}

/**
 * The templates a search finds: those with the whole phrase, else those
 * with every one of its words.
 */
export const findTemplates = (query: string) => {
  const phrase = query.trim().toLowerCase()
  if (!phrase) return []
  const texts = VIDEO_TEMPLATES.map((item) => [item, searchText(item)] as const)
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
      placeholder="Search ${VIDEO_TEMPLATES.length} templates by story, word or shot"
      aria-label="Search templates"
      autocomplete="off"
      spellcheck="false"
      value="${escape(state.query)}"
    /><kbd aria-hidden="true">/</kbd>
  </label>`

const tries = `<div class="tpl-suggest"><span>Try</span>${TRIES.map(
  (words) => `<button type="button" data-tpl-try="${words}">${words}</button>`
).join('')}</div>`

const cards = (story: TemplateStory, current?: string) =>
  `<div class="tpl-grid">${storyTemplates(story.id)
    .map((item) => templateCard(item, current))
    .join('')}</div>`

const storySection = (story: TemplateStory, current?: string) =>
  html`<section
    class="tpl-story"
    id="tpl-story-${story.id}"
    data-story="${story.id}"
  >
    <div class="tpl-story-head">
      <h2>
        <button type="button" data-tpl-story="${story.id}">
          ${escape(story.name)}
        </button>
      </h2>
      <p>${escape(story.line)}</p>
    </div>
    ${cards(story, current)}
  </section>`

/** A story as one tile, moving through its ways of telling it. */
const storyTile = (story: TemplateStory) => {
  const variants = storyTemplates(story.id)
  return html`<article class="tpl-card tpl-story-tile">
    <button
      type="button"
      class="tpl-card-open"
      data-tpl-story="${story.id}"
      aria-label="${escape(
        `${story.name}: ${variants.length} ways to tell it`
      )}"
    >
      ${storyStage(variants[0])}
    </button>
    <div class="tpl-card-body">
      <h3>${escape(story.name)}</h3>
      <p>${variants.length} ways · ${escape(story.line)}</p>
    </div>
  </article>`
}

const groupSection = (group: StoryGroup) =>
  html`<section class="tpl-group" data-group="${group.id}">
    <div class="tpl-story-head">
      <h2>
        <button type="button" data-tpl-group="${group.id}">
          ${galleryIcon(group.id)}${escape(group.name)}
        </button>
      </h2>
      <p>${escape(group.line)}</p>
    </div>
    <div class="tpl-grid">
      ${TEMPLATE_STORIES.filter((story) => story.group === group.id)
        .map(storyTile)
        .join('')}
    </div>
  </section>`

/** What the list shows with no search: a head, a line under it, a body. */
const listView = (state: GalleryState) => {
  const story = TEMPLATE_STORIES.find((item) => item.id === state.story)
  if (story) {
    const group = groupById(story.group)
    return {
      head: html`<button
          type="button"
          class="tpl-crumb"
          data-tpl-group="${story.group}"
        >
          ‹ ${escape(group?.name || 'All templates')}
        </button>
        <h1>${escape(story.name)}</h1>
        <p>
          ${escape(story.line)} For ${escape(lowerFirst(story.audience))}.
        </p>`,
      after: '',
      body: cards(story, state.current)
    }
  }
  const group = STORY_GROUPS.find((item) => item.id === state.group)
  if (group) {
    const stories = TEMPLATE_STORIES.filter((item) => item.group === group.id)
    return {
      head: html`<h1>${escape(group.name)}</h1>
        <p>${escape(group.line)}</p>`,
      after: `<nav class="tpl-jump" aria-label="${escape(`Stories in ${group.name}`)}">${stories
        .map(
          (item) =>
            `<button type="button" data-tpl-jump="${item.id}">${escape(item.name)}</button>`
        )
        .join('')}</nav>`,
      body: stories.map((item) => storySection(item, state.current)).join('')
    }
  }
  return {
    head: html`<h1>Templates</h1>
      <p>
        Pick the story your blog tells, then a way to tell it. Your scenes take
        the template’s slots in order.
      </p>`,
    after: tries,
    body: STORY_GROUPS.map(groupSection).join('')
  }
}

/** The list's body: what a search finds, or the list itself. */
export const templateResults = (state: GalleryState) => {
  if (!state.query.trim()) return listView(state).body
  const found = findTemplates(state.query)
  return found.length
    ? `<p class="tpl-count">${found.length} ${found.length === 1 ? 'template' : 'templates'} for “${escape(state.query.trim())}”</p><div class="tpl-grid">${found
        .map((item) => templateCard(item, state.current, true))
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
