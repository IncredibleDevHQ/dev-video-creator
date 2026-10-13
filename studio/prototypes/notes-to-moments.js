// Notes to moments: a prototype of the project canvas and the moment strip
// (design: ~/Downloads/notes-to-moments.html). Sample data lives in memory;
// nothing is saved, sent, generated or recorded.
'use strict'

const $ = (selector, root = document) => root.querySelector(selector)
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)]
const esc = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  )
const icon = (name) => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`
let serial = 100
const uid = (prefix) => `${prefix}${serial++}`

const SOURCES = {
  p1: 'Post · Why agents fail in prod',
  p2: 'Post · Retries without tears',
  t1: 'Talk · Observability for agents',
  paste: 'Pasted just now'
}
const ACCENTS = ['#4dba72', '#e2552b', '#5b8def', '#d9a53a']

const state = {
  view: 'canvas',
  notes: {
    n1: { text: 'Demos run once; production runs a thousand times.', source: 'p1' },
    n2: { text: 'Most agent failures are timeouts, not wrong answers.', source: 'p1' },
    n3: { text: 'A tool call can succeed twice when a retry fires.', source: 'p2' },
    n4: { text: 'An idempotency key makes a retried request safe.', source: 'p2' },
    n5: { text: 'Stripe keeps idempotency keys for 24 hours.', source: 'p2' },
    n6: { text: 'Backoff with jitter keeps retries from stampeding.', source: 'p2' },
    n7: { text: 'Trace every tool call with its inputs and outputs.', source: 't1' },
    n8: { text: "Log the model's plan before it acts.", source: 't1' },
    n9: { text: 'Alert on the retry rate, not only on errors.', source: 't1' },
    n10: { text: 'Cost per task drifts up as prompts grow.', source: 'p1' },
    n11: { text: 'A dashboard nobody opens is not observability.', source: 't1' },
    n12: { text: 'Users forgive slowness more than double charges.', source: 'p2' }
  },
  cards: [
    { id: 'c1', title: 'Why agents fail in prod', x: 40, y: 56, notes: ['n1', 'n2', 'n10'] },
    { id: 'c2', title: 'Retries and idempotency', x: 360, y: 56, notes: ['n3', 'n4', 'n5'] }
  ],
  suggestions: [{ id: 's1', title: 'Observability', x: 680, y: 56, notes: ['n7', 'n8', 'n9'] }],
  storyline: { title: 'From demo to production', cards: ['c1', 'c2'] },
  episodes: [
    { id: 'e1', title: 'Why agents fail', cards: ['c1'], status: 'Published', made: 'YouTube, Short' },
    { id: 'e2', title: 'Retries and idempotency', cards: ['c2'], status: 'Producing', made: 'YouTube' },
    { id: 'e3', title: 'Observability', cards: [], status: 'Draft', made: '' }
  ],
  cam: { x: 40, y: 64, k: 1 },
  selectedCard: null,
  renaming: null,
  notesOpen: false,
  brand: { name: 'Studio dark', accent: '#4dba72' },
  scenes: [],
  selected: '2.2',
  narration: null
}

const moment = (id, title, start, status, fields) => ({
  id,
  title,
  start,
  status,
  locked: false,
  reason: null,
  variants: ['A', 'B', 'C'],
  active: 'B',
  sketches: 3,
  comments: 0,
  ...fields
})
state.scenes = [
  {
    id: 'sc1',
    title: 'The incident',
    start: 0,
    moments: [
      moment('1.1', 'Cold open', 0, 'built', {
        kind: 'type', role: 'Hook', technique: 'cold open', feeling: 'unease',
        why: 'Opens on the night the charges doubled.', card: 'c1',
        cues: [[0, 'At 2:14 a.m., checkout went quiet.'], [2.6, 'Then the refunds started.']],
        blueprint: 'Kinetic type beats, reproduced', hero: 'the time, 2:14 a.m.'
      }),
      moment('1.2', 'The alert', 6, 'built', {
        kind: 'count', role: 'Problem', technique: 'concretization', feeling: 'alarm',
        why: 'Puts a number on the damage.', card: 'c2',
        cues: [[0, 'Four hundred customers'], [1.8, 'charged twice.']],
        blueprint: 'Count-up, adapted', hero: 'the count, 400'
      }),
      moment('1.3', 'Two receipts', 12, 'approved', {
        kind: 'receipts', role: 'Evidence', technique: 'worked example', feeling: 'disbelief',
        why: 'One order, two receipts: the failure made concrete.', card: 'c2',
        cues: [[0, 'One order.'], [1.2, 'Two receipts.'], [2.9, 'Same minute.']],
        blueprint: 'Split comparison, reproduced', hero: 'the second receipt'
      })
    ]
  },
  {
    id: 'sc2',
    title: 'The retry',
    start: 19,
    moments: [
      moment('2.1', 'Request', 19, 'approved', {
        kind: 'flow', role: 'Mechanism', technique: 'progressive disclosure', feeling: 'focus',
        why: 'Shows the normal path before it breaks.', card: 'c2',
        cues: [[0, 'The client asks the server to charge.'], [2.4, 'The server says yes.']],
        blueprint: 'Spatial pan stations, adapted', hero: 'the request arrow'
      }),
      moment('2.2', 'Charged again', 26, 'approved', {
        kind: 'compare', role: 'Evidence', technique: 'worked example', feeling: 'alarm',
        why: 'Shows the double charge the message warns about.', card: 'c2',
        cues: [[0, 'The client retries…'], [1.4, '…and charges again.'], [3.1, 'Two receipts.']],
        blueprint: 'Before and after, adapted', hero: 'the second receipt', comments: 1
      }),
      moment('2.3', 'Why it happens', 33, 'sketched', {
        kind: 'hub', role: 'Mechanism', technique: 'cause and effect', feeling: 'understanding',
        why: 'Names the cause: the first answer was lost, not refused.', card: 'c2',
        cues: [[0, 'The first answer never arrived.'], [2.2, 'So the client asked again.']],
        blueprint: 'Constellation hub, adapted', hero: 'the lost response'
      }),
      moment('2.4', 'The gap', 38, 'sketching', {
        kind: 'clock', role: 'Problem', technique: 'contrast', feeling: 'tension',
        why: 'Shows the window where a retry is unsafe.', card: 'c2',
        cues: [[0, 'Between the charge and the reply'], [1.9, 'there is a gap.']],
        blueprint: 'Timeline, composed', hero: 'the gap on the timeline'
      })
    ]
  },
  {
    id: 'sc3',
    title: 'The key',
    start: 41,
    moments: [
      moment('3.1', 'One key', 41, 'waiting', {
        kind: 'code', role: 'Concept', technique: 'naming', feeling: 'clarity',
        why: 'Names the fix: one key per charge, sent with every try.', card: 'c2',
        cues: [[0, 'Give every charge a key.'], [2.1, 'Send it on every try.']],
        blueprint: 'Code reveal, adapted', hero: 'the Idempotency-Key header'
      }),
      moment('3.2', 'Same key, same answer', 46.2, 'waiting', {
        kind: 'compare', role: 'Mechanism', technique: 'before and after', feeling: 'relief',
        why: 'Replays the retry from scene 2, now with the key.', card: 'c2',
        cues: [[0, 'The retry arrives with the same key…'], [2.4, '…and gets the first answer back.']],
        blueprint: 'Before and after, reproduced', hero: 'the single receipt'
      }),
      moment('3.3', "Stripe's approach", 51.4, 'waiting', {
        kind: 'list', role: 'Evidence', technique: 'authority', feeling: 'trust',
        why: 'Shows a payments company already works this way.', card: 'c2',
        cues: [[0, 'Stripe does exactly this.'], [1.9, 'Keys live for a day.']],
        blueprint: 'Grid card assemble, adapted', hero: 'the 24-hour window'
      }),
      moment('3.4', '24 hours', 56.6, 'waiting', {
        kind: 'clock', role: 'Mechanism', technique: 'contrast', feeling: 'confidence',
        why: 'Closes the gap from 2.4: the window is now covered.', card: 'c2',
        cues: [[0, 'Inside the window, retries are safe.']],
        blueprint: 'Timeline, composed', hero: 'the covered gap'
      })
    ]
  },
  {
    id: 'sc4',
    title: 'Payoff',
    start: 62,
    moments: [
      moment('4.1', 'What to check today', 62, 'waiting', {
        kind: 'list', role: 'Takeaway', technique: 'checklist', feeling: 'confidence',
        why: 'Turns the episode into three things to check.', card: 'c2',
        cues: [[0, 'Check three things today.'], [1.8, 'Keys, timeouts, retry rate.']],
        blueprint: 'Grid card assemble, reproduced', hero: 'the checklist'
      }),
      moment('4.2', 'Close', 68.5, 'waiting', {
        kind: 'type', role: 'Call to action', technique: 'callback', feeling: 'resolve',
        why: 'Calls back to the cold open: checkout stays quiet.', card: 'c1',
        cues: [[0, 'At 2:14 a.m., nothing happens.'], [2.5, "That's the point."]],
        blueprint: 'Kinetic type beats, reproduced', hero: 'the time, 2:14 a.m.'
      })
    ]
  }
]
const END = 75
const allMoments = () => state.scenes.flatMap((scene) => scene.moments)
const findMoment = (id) => allMoments().find((item) => item.id === id)
const cardById = (id) => state.cards.find((card) => card.id === id)
const sortedIds = () => new Set(state.cards.flatMap((card) => card.notes))
const suggestedIds = () => new Set(state.suggestions.flatMap((card) => card.notes))
const clock = (seconds) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`

/* Toasts and popovers */
let toastTimer = 0
const toast = (text) => {
  const el = $('#toast')
  el.textContent = text
  el.classList.add('is-on')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => el.classList.remove('is-on'), 3200)
}
const popover = $('#popover')
let popAnchor = null
let popAction = null
const closePopover = () => {
  if (popover.hidden) return
  popover.hidden = true
  popAnchor?.focus?.()
  popAnchor = null
}
const openPopover = (anchor, html, onAction) => {
  popover.innerHTML = html
  popover.hidden = false
  popAnchor = anchor
  popAction = onAction
  const box = anchor.getBoundingClientRect()
  const width = popover.offsetWidth
  const left = Math.min(Math.max(12, box.right - width), window.innerWidth - width - 12)
  const below = box.bottom + 8
  const top = below + popover.offsetHeight > window.innerHeight - 12 ? Math.max(12, box.top - popover.offsetHeight - 8) : below
  popover.style.left = `${left}px`
  popover.style.top = `${top}px`
  popover.querySelector('textarea, button')?.focus()
}
popover.addEventListener('click', (event) => {
  const target = event.target.closest('[data-act]')
  if (target && popAction) popAction(target.dataset.act, target)
})
document.addEventListener('pointerdown', (event) => {
  if (!popover.hidden && !popover.contains(event.target) && !popAnchor?.contains(event.target)) closePopover()
})
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closePopover()
})

/* Theme */
const applyTheme = (theme) => {
  document.documentElement.dataset.theme = theme
  $$('[data-theme-choice]').forEach((button) =>
    button.setAttribute('aria-pressed', String(button.dataset.themeChoice === theme))
  )
  try {
    localStorage.setItem('notes-to-moments-theme', theme)
  } catch {
    /* The theme still applies without storage. */
  }
}
let savedTheme = null
try {
  savedTheme = localStorage.getItem('notes-to-moments-theme')
} catch {
  savedTheme = null
}
applyTheme(savedTheme === 'dark' || savedTheme === 'light' ? savedTheme : matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
$$('[data-theme-choice]').forEach((button) => (button.onclick = () => applyTheme(button.dataset.themeChoice)))

/* Views */
const setView = (view) => {
  state.view = view
  $$('[data-view]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.view === view)))
  $('#canvas-view').hidden = view !== 'canvas'
  $('#moments-view').hidden = view !== 'moments'
  closePopover()
  if (view === 'canvas') renderCanvas()
  else renderMoments()
}
document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-view]')
  if (button) setView(button.dataset.view)
})

/* ---------- Project canvas ---------- */

// Splits pasted text into one note per idea. The product would ask the agent;
// the prototype splits lines and sentences.
const splitIdeas = (text) =>
  text
    .split(/\n+/)
    .flatMap((line) => line.replace(/^\s*([-*•]|\d+[.)])\s+/, '').split(/(?<=[.!?])\s+(?=[A-Z0-9"“])/))
    .map((part) => part.trim())
    .filter((part) => part.length >= 12)
    .map((part) => (part.length > 160 ? `${part.slice(0, 157).trimEnd()}…` : part))

const THEMES = [
  { title: 'Observability', words: ['trace', 'log', 'alert', 'dashboard', 'observ', 'monitor', 'metric'] },
  { title: 'Retries', words: ['retry', 'retries', 'idempot', 'backoff', 'twice', 'double', 'dedupe'] },
  { title: 'Cost', words: ['cost', 'price', 'token', 'budget', 'spend'] },
  { title: 'Reliability', words: ['timeout', 'fail', 'error', 'crash', 'outage'] }
]

const renderRail = () => {
  const sorted = sortedIds()
  const suggested = suggestedIds()
  const unsorted = Object.keys(state.notes).filter((id) => !sorted.has(id))
  $('#rail').innerHTML = `
    <div class="rail-section composer">
      <h2>Add notes</h2>
      <label class="sr-only" for="paste">Paste a post or type notes</label>
      <textarea id="paste" placeholder="Paste a post, or type. Each idea becomes a note."></textarea>
      <div class="composer-row">
        <p class="hint">Split by sentence in this prototype</p>
        <button type="button" class="primary" id="add-notes">Add notes</button>
      </div>
    </div>
    <div class="rail-section is-flush">
      <h2>Unsorted <span>${unsorted.length}</span>
        <button type="button" class="ghost chip-button" id="suggest">
          ${icon('sparkle')} Suggest cards
        </button>
      </h2>
    </div>
    <div class="unsorted" data-drop="unsorted" aria-label="Unsorted notes">
      ${
        unsorted.length
          ? unsorted
              .map((id) => {
                const note = state.notes[id]
                const inSuggestion = state.suggestions.find((card) => card.notes.includes(id))
                return `<div class="note${suggested.has(id) ? ' is-suggested' : ''}" data-note="${id}" data-drag-note="${id}" title="Drag onto a card">
                  <span class="grip">${icon('grip')}</span>
                  <div class="note-body">
                    <p>${esc(note.text)}</p>
                    <span class="source">${esc(SOURCES[note.source] || note.source)}${
                      inSuggestion ? ` · suggested for ${esc(inSuggestion.title)}` : ''
                    }</span>
                  </div>
                  <button type="button" class="add-to" data-add-note="${id}" aria-label="Add this note to a card">Add to</button>
                </div>`
              })
              .join('')
          : '<p class="empty">Everything is sorted. Paste more above.</p>'
      }
    </div>`
}

const cardHtml = (card, suggestion) => {
  const sources = new Set(card.notes.map((id) => state.notes[id]?.source))
  const title =
    state.renaming === card.id
      ? `<input value="${esc(card.title)}" data-rename="${card.id}" aria-label="Card title" />`
      : esc(card.title)
  return `<article class="card${suggestion ? ' is-suggestion' : ''}${state.selectedCard === card.id ? ' is-selected' : ''}"
      data-card="${card.id}" data-drop="card" style="left:${card.x}px;top:${card.y}px" aria-label="${suggestion ? 'Suggested card' : 'Card'}: ${esc(card.title)}">
    ${suggestion ? `<span class="eyebrow">${card.mergeInto ? 'Suggested: add these to your card' : 'Suggested by the AI'}</span>` : ''}
    <div class="card-head" data-drag-card="${card.id}">
      <span class="grip">${icon('grip')}</span>
      <div class="card-title">${title}</div>
      ${
        suggestion
          ? `<button type="button" class="icon-button" data-dismiss="${card.id}" aria-label="Dismiss suggestion">${icon('close')}</button>`
          : `<button type="button" class="icon-button" data-card-menu="${card.id}" aria-label="Card actions">${icon('more')}</button>`
      }
    </div>
    <ul class="card-notes">
      ${card.notes
        .map(
          (id) => `<li data-drag-note="${id}" data-from="${card.id}">
            <span>${esc(state.notes[id].text)}</span>
            <button type="button" data-remove-note="${id}" data-from="${card.id}" aria-label="Take this note out">${icon('close')}</button>
          </li>`
        )
        .join('')}
    </ul>
    <div class="card-foot">
      <span>${card.notes.length} note${card.notes.length === 1 ? '' : 's'} · ${sources.size} source${sources.size === 1 ? '' : 's'}</span>
      ${
        suggestion
          ? `<span class="actions">
              ${card.mergeInto ? '' : `<button type="button" class="ghost" data-rename-start="${card.id}">Rename</button>`}
              <button type="button" class="primary" data-accept="${card.id}">${card.mergeInto ? 'Add' : 'Accept'}</button>
            </span>`
          : ''
      }
    </div>
  </article>`
}

const refHtml = (cardId, where, removable = true) => {
  const card = cardById(cardId)
  if (!card) return ''
  return `<span class="ref${state.selectedCard === cardId ? ' is-related' : ''}" data-ref="${cardId}" data-where="${where}">
    ${esc(card.title)}
    ${removable ? `<button type="button" data-remove-ref="${cardId}" data-where="${where}" aria-label="Remove ${esc(card.title)}">${icon('close')}</button>` : ''}
  </span>`
}

const renderWorld = () => {
  const world = $('#world')
  const story = state.storyline.cards
  world.innerHTML = `
    <div class="block-label" style="left:40px;top:24px">Cards</div>
    ${state.cards.map((card) => cardHtml(card, false)).join('')}
    ${state.suggestions.map((card) => cardHtml(card, true)).join('')}
    <section class="lane-block is-dashed" id="story-block" style="left:40px;width:960px">
      <header>Storyline <span class="meta">${esc(state.storyline.title)}</span></header>
      <div class="story-row" data-drop="storyline" aria-label="Storyline: drop cards here">
        <span class="start-dot" title="Start"></span>
        ${story
          .map((id, i) => `${i ? `<span class="ref-arrow">${icon('arrow')}</span>` : ''}${refHtml(id, 'storyline')}`)
          .join('')}
        <span class="drop-hint">Drag a card here</span>
      </div>
    </section>
    <section class="lane-block" id="series-block" style="left:40px;width:960px">
      <header>Series <span class="meta">Agents in production</span><span class="tag">Default destination: YouTube</span></header>
      ${state.episodes
        .map(
          (episode, i) => `<div class="episode-row" data-drop="episode" data-episode="${episode.id}">
            <div class="episode-name">Episode ${i + 1}<small>${esc(episode.title)}</small></div>
            <div class="episode-refs">
              ${episode.cards.map((id) => refHtml(id, episode.id)).join('') || '<span class="drop-hint">Drag cards here</span>'}
            </div>
            <span class="status${episode.status === 'Producing' ? ' is-live' : ''}">${esc(episode.status)}</span>
            ${
              episode.id === 'e2'
                ? `<button type="button" class="primary chip-button" data-view="moments">Open</button>`
                : ''
            }
          </div>`
        )
        .join('')}
    </section>`
  layoutBlocks()
  applyCam()
  const input = $('[data-rename]', world)
  if (input) {
    input.focus()
    input.select()
  }
}

// Lays the storyline and series out below the lowest card.
const layoutBlocks = () => {
  const bottoms = $$('.card', $('#world')).map((el) => el.offsetTop + el.offsetHeight)
  const right = Math.max(1000, ...$$('.card', $('#world')).map((el) => el.offsetLeft + el.offsetWidth))
  const storyTop = Math.max(320, ...bottoms) + 40
  const story = $('#story-block')
  const series = $('#series-block')
  story.style.top = `${storyTop}px`
  story.style.width = `${right - 40}px`
  series.style.top = `${storyTop + story.offsetHeight + 28}px`
  series.style.width = `${right - 40}px`
}

const renderCanvas = () => {
  renderRail()
  renderWorld()
  $('#canvas-view').classList.toggle('is-notes-open', state.notesOpen)
  $('#notes-toggle').setAttribute('aria-expanded', String(state.notesOpen))
}

/* Pan and zoom */
const applyCam = () => {
  const { x, y, k } = state.cam
  $('#world').style.transform = `translate(${x}px, ${y}px) scale(${k})`
  $('#zoom-level').textContent = `${Math.round(k * 100)}%`
}
const zoomAt = (factor, cx, cy) => {
  const { x, y, k } = state.cam
  const next = Math.min(2, Math.max(0.3, k * factor))
  state.cam = { k: next, x: cx - ((cx - x) * next) / k, y: cy - ((cy - y) * next) / k }
  applyCam()
}
const fitAll = () => {
  const items = $$('.card, .lane-block', $('#world'))
  if (!items.length) return
  const left = Math.min(...items.map((el) => el.offsetLeft)) - 30
  const top = Math.min(...items.map((el) => el.offsetTop)) - 50
  const right = Math.max(...items.map((el) => el.offsetLeft + el.offsetWidth)) + 30
  const bottom = Math.max(...items.map((el) => el.offsetTop + el.offsetHeight)) + 30
  const box = $('#canvas').getBoundingClientRect()
  const fit = Math.min(1, box.width / (right - left), (box.height - 52) / (bottom - top))
  // On a phone, stay readable and pan sideways rather than shrink everything.
  const narrow = box.width < 640
  const k = narrow ? Math.max(0.62, fit) : fit
  // Centred across (left-aligned on a phone), aligned to the top under the tools.
  state.cam = { k, x: narrow ? 12 - left * k : (box.width - (right - left) * k) / 2 - left * k, y: 52 - top * k }
  applyCam()
}
$$('[data-zoom]').forEach(
  (button) =>
    (button.onclick = () => {
      const box = $('#canvas').getBoundingClientRect()
      if (button.dataset.zoom === 'fit') fitAll()
      else zoomAt(button.dataset.zoom === 'in' ? 1.2 : 1 / 1.2, box.width / 2, box.height / 2)
    })
)
$('#canvas').addEventListener(
  'wheel',
  (event) => {
    event.preventDefault()
    const box = $('#canvas').getBoundingClientRect()
    if (event.ctrlKey || event.metaKey) zoomAt(Math.exp(-event.deltaY * 0.01), event.clientX - box.left, event.clientY - box.top)
    else {
      state.cam.x -= event.deltaX
      state.cam.y -= event.deltaY
      applyCam()
    }
  },
  { passive: false }
)
$('#canvas').addEventListener('pointerdown', (event) => {
  const onBackground = event.target === $('#canvas') || event.target === $('#world') || event.target.classList.contains('block-label')
  if (!onBackground) return
  if (state.notesOpen) {
    state.notesOpen = false
    renderCanvas()
  }
  if (state.selectedCard) {
    state.selectedCard = null
    renderWorld()
  }
  const start = { x: event.clientX, y: event.clientY, cx: state.cam.x, cy: state.cam.y }
  $('#canvas').classList.add('is-panning')
  const move = (e) => {
    state.cam.x = start.cx + e.clientX - start.x
    state.cam.y = start.cy + e.clientY - start.y
    applyCam()
  }
  const up = () => {
    $('#canvas').classList.remove('is-panning')
    window.removeEventListener('pointermove', move)
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up, { once: true })
})

/* Drag and drop: notes onto cards, cards onto the storyline and episodes */
let drag = null
const accepts = (target, item) => {
  const kind = target.dataset.drop
  if (item.kind === 'note') return kind === 'card' || (kind === 'unsorted' && item.from)
  if (item.kind === 'card') return !item.suggestion && (kind === 'storyline' || kind === 'episode')
  if (item.kind === 'ref') return kind === 'storyline' && item.where === 'storyline'
  return false
}
const dropTargetAt = (x, y) => {
  const target = document.elementFromPoint(x, y)?.closest('[data-drop]')
  if (!target || !drag) return null
  if (drag.item.kind === 'card' && target.dataset.card === drag.item.id) return null
  return accepts(target, drag.item) ? target : null
}
const beginDrag = (event, item, element) => {
  if (event.button !== 0) return
  event.preventDefault()
  drag = { item, element, start: { x: event.clientX, y: event.clientY }, moved: false, over: null }
  if (item.kind === 'card') {
    const card = (item.suggestion ? state.suggestions : state.cards).find((c) => c.id === item.id)
    drag.origin = { x: card.x, y: card.y }
  }
  window.addEventListener('pointermove', dragMove)
  window.addEventListener('pointerup', dragEnd, { once: true })
}
const dragMove = (event) => {
  if (!drag) return
  const dx = event.clientX - drag.start.x
  const dy = event.clientY - drag.start.y
  if (!drag.moved && Math.hypot(dx, dy) < 5) return
  if (!drag.moved) {
    drag.moved = true
    closePopover()
    if (drag.item.kind !== 'card') {
      drag.ghost = document.createElement('div')
      drag.ghost.className = 'drag-ghost'
      drag.ghost.textContent = drag.item.kind === 'ref' ? cardById(drag.item.id).title : state.notes[drag.item.id].text
      document.body.append(drag.ghost)
    } else drag.element.classList.add('is-dragging')
  }
  if (drag.item.kind === 'card') {
    drag.element.style.left = `${drag.origin.x + dx / state.cam.k}px`
    drag.element.style.top = `${drag.origin.y + dy / state.cam.k}px`
  } else {
    drag.ghost.style.left = `${event.clientX}px`
    drag.ghost.style.top = `${event.clientY}px`
  }
  const over = dropTargetAt(event.clientX, event.clientY)
  if (over !== drag.over) {
    drag.over?.classList.remove('is-over')
    over?.classList.add('is-over')
    drag.over = over
  }
}
const dragEnd = (event) => {
  window.removeEventListener('pointermove', dragMove)
  if (!drag) return
  const { item, moved, over } = drag
  drag.ghost?.remove()
  drag.over?.classList.remove('is-over')
  const finished = drag
  drag = null
  if (!moved) return
  // The click that may follow this release belongs to the drag, not to a button.
  suppressClick = true
  setTimeout(() => (suppressClick = false), 0)
  if (item.kind === 'card') {
    const list = item.suggestion ? state.suggestions : state.cards
    const card = list.find((c) => c.id === item.id)
    const onLanes = document.elementFromPoint(event.clientX, event.clientY)?.closest('.lane-block')
    if (over || onLanes) Object.assign(card, finished.origin)
    else {
      card.x = Math.round(finished.origin.x + (event.clientX - finished.start.x) / state.cam.k)
      card.y = Math.round(finished.origin.y + (event.clientY - finished.start.y) / state.cam.k)
    }
    if (!over && onLanes)
      toast(item.suggestion ? 'Accept the suggestion first, then add it to the storyline or an episode.' : 'Drop it on the storyline row or an episode row.')
  }
  if (over) dropOn(over, item, event.clientX)
  renderCanvas()
}
let suppressClick = false
document.addEventListener(
  'click',
  (event) => {
    if (suppressClick) {
      suppressClick = false
      event.stopPropagation()
      event.preventDefault()
    }
  },
  true
)

const addNoteToCard = (noteId, cardId, from) => {
  const list = [...state.cards, ...state.suggestions]
  const card = list.find((c) => c.id === cardId)
  if (!card || card.notes.includes(noteId)) return
  if (from && from !== cardId) {
    const source = list.find((c) => c.id === from)
    if (source) source.notes = source.notes.filter((id) => id !== noteId)
  }
  // A note moved into an accepted card leaves any suggestion that held it.
  if (cardById(cardId)) state.suggestions.forEach((s) => (s.notes = s.notes.filter((id) => id !== noteId)))
  card.notes.push(noteId)
  toast(`Added to “${card.title}”`)
}
const addCardTo = (cardId, where) => {
  const card = cardById(cardId)
  const list = where === 'storyline' ? state.storyline.cards : state.episodes.find((e) => e.id === where).cards
  if (list.includes(cardId)) return toast(`“${card.title}” is already there`)
  list.push(cardId)
  const name = where === 'storyline' ? 'the storyline' : `episode ${state.episodes.findIndex((e) => e.id === where) + 1}`
  toast(`“${card.title}” added to ${name}. It is a reference: the card stays where it is.`)
}
const dropOn = (target, item, pointerX) => {
  const kind = target.dataset.drop
  if (item.kind === 'note' && kind === 'card') addNoteToCard(item.id, target.dataset.card, item.from)
  if (item.kind === 'note' && kind === 'unsorted' && item.from) {
    const card = [...state.cards, ...state.suggestions].find((c) => c.id === item.from)
    card.notes = card.notes.filter((id) => id !== item.id)
    toast('Back in Unsorted')
  }
  if (item.kind === 'card' && kind === 'storyline') addCardTo(item.id, 'storyline')
  if (item.kind === 'card' && kind === 'episode') addCardTo(item.id, target.dataset.episode)
  if (item.kind === 'ref' && kind === 'storyline') {
    const order = state.storyline.cards.filter((id) => id !== item.id)
    const refs = $$('.story-row .ref').filter((el) => el.dataset.ref !== item.id)
    const index = refs.findIndex((el) => {
      const box = el.getBoundingClientRect()
      return pointerX < box.left + box.width / 2
    })
    order.splice(index < 0 ? order.length : index, 0, item.id)
    state.storyline.cards = order
  }
}

$('#canvas-view').addEventListener('pointerdown', (event) => {
  if (event.target.closest('button, input, textarea')) return
  const noteHandle = event.target.closest('[data-drag-note]')
  if (noteHandle) return beginDrag(event, { kind: 'note', id: noteHandle.dataset.dragNote, from: noteHandle.dataset.from || null }, noteHandle)
  const ref = event.target.closest('.story-row .ref')
  if (ref) return beginDrag(event, { kind: 'ref', id: ref.dataset.ref, where: 'storyline' }, ref)
  const head = event.target.closest('[data-drag-card]')
  if (head) {
    const id = head.dataset.dragCard
    beginDrag(event, { kind: 'card', id, suggestion: !cardById(id) }, head.closest('.card'))
  }
})

const cardMenu = (cardId, anchor) => {
  const card = cardById(cardId)
  openPopover(
    anchor,
    `<h4>${esc(card.title)}</h4>
     <ul>
       <li><button type="button" data-act="rename">Rename</button></li>
       <li><button type="button" data-act="storyline">Add to the storyline</button></li>
       ${state.episodes
         .map((e, i) => `<li><button type="button" data-act="episode:${e.id}">Add to episode ${i + 1}: ${esc(e.title)}</button></li>`)
         .join('')}
       <li class="menu-sep" role="separator"></li>
       <li><button type="button" class="is-danger" data-act="delete">Delete card (its notes stay)</button></li>
     </ul>`,
    (act) => {
      closePopover()
      if (act === 'rename') state.renaming = cardId
      if (act === 'storyline') addCardTo(cardId, 'storyline')
      if (act.startsWith('episode:')) addCardTo(cardId, act.slice(8))
      if (act === 'delete') {
        state.cards = state.cards.filter((c) => c.id !== cardId)
        state.storyline.cards = state.storyline.cards.filter((id) => id !== cardId)
        state.episodes.forEach((e) => (e.cards = e.cards.filter((id) => id !== cardId)))
        if (state.selectedCard === cardId) state.selectedCard = null
        toast(`Deleted “${card.title}”. Its ${card.notes.length} notes are back in Unsorted.`)
      }
      renderCanvas()
    }
  )
}

const noteMenu = (noteId, anchor) => {
  const targets = [...state.cards, ...state.suggestions]
  openPopover(
    anchor,
    `<h4>Add to a card</h4>
     <ul>${targets
       .map((c) => `<li><button type="button" data-act="${c.id}">${esc(c.title)}${cardById(c.id) ? '' : ' (suggested)'}</button></li>`)
       .join('')}</ul>`,
    (act) => {
      closePopover()
      addNoteToCard(noteId, act, null)
      renderCanvas()
    }
  )
}

const suggestCards = () => {
  const taken = new Set([...sortedIds(), ...suggestedIds()])
  const free = Object.keys(state.notes).filter((id) => !taken.has(id))
  let made = 0
  THEMES.forEach((theme) => {
    const hits = free.filter((id) => {
      const text = state.notes[id].text.toLowerCase()
      return !taken.has(id) && theme.words.some((word) => text.includes(word))
    })
    if (hits.length < 2) return
    hits.forEach((id) => taken.add(id))
    // A group that matches a card you already have offers to add to it.
    const pending = state.suggestions.find((c) => c.title.toLowerCase().includes(theme.title.toLowerCase()))
    if (pending) {
      pending.notes.push(...hits)
      made++
      return
    }
    const existing = state.cards.find((c) => c.title.toLowerCase().includes(theme.title.toLowerCase()))
    const right = Math.max(40, ...[...state.cards, ...state.suggestions].map((c) => c.x + 320))
    state.suggestions.push({ id: uid('s'), title: existing ? existing.title : theme.title, mergeInto: existing?.id, x: right, y: 56, notes: hits })
    made++
  })
  toast(made ? `${made} suggestion${made > 1 ? 's' : ''} ready. Accept ${made > 1 ? 'them' : 'it'}, or drag notes to correct ${made > 1 ? 'them' : 'it'}.` : 'Nothing groups yet. Add a few more notes first.')
  renderCanvas()
  if (made) fitAll()
}

const commitRename = (input) => {
  const card = [...state.cards, ...state.suggestions].find((c) => c.id === input.dataset.rename)
  const value = input.value.trim()
  if (card && value) card.title = value
  state.renaming = null
  renderCanvas()
}

$('#canvas-view').addEventListener('click', (event) => {
  const t = event.target
  const button = t.closest('button')
  if (button?.id === 'add-notes') {
    const text = $('#paste').value
    const ideas = splitIdeas(text)
    if (!ideas.length) return toast('Paste or type a few sentences first')
    ideas.forEach((idea) => (state.notes[uid('n')] = { text: idea, source: 'paste' }))
    $('#paste').value = ''
    toast(`${ideas.length} note${ideas.length > 1 ? 's' : ''} added to Unsorted`)
    return renderCanvas()
  }
  if (button?.id === 'suggest') return suggestCards()
  if (button?.id === 'notes-toggle') {
    state.notesOpen = !state.notesOpen
    return renderCanvas()
  }
  if (button?.dataset.addNote) return noteMenu(button.dataset.addNote, button)
  if (button?.dataset.cardMenu) return cardMenu(button.dataset.cardMenu, button)
  if (button?.dataset.removeNote) {
    const card = [...state.cards, ...state.suggestions].find((c) => c.id === button.dataset.from)
    card.notes = card.notes.filter((id) => id !== button.dataset.removeNote)
    toast('Back in Unsorted')
    return renderCanvas()
  }
  if (button?.dataset.removeRef) {
    const where = button.dataset.where
    const list = where === 'storyline' ? state.storyline : state.episodes.find((e) => e.id === where)
    list.cards = list.cards.filter((id) => id !== button.dataset.removeRef)
    return renderCanvas()
  }
  if (button?.dataset.accept) {
    const suggestion = state.suggestions.find((s) => s.id === button.dataset.accept)
    state.suggestions = state.suggestions.filter((s) => s !== suggestion)
    const target = cardById(suggestion.mergeInto)
    if (target) {
      suggestion.notes.forEach((id) => target.notes.includes(id) || target.notes.push(id))
      toast(`${suggestion.notes.length} notes added to “${target.title}”`)
    } else {
      const { mergeInto, ...card } = suggestion
      state.cards.push({ ...card, id: uid('c') })
      toast(`“${suggestion.title}” is a card now. Its notes left Unsorted.`)
    }
    return renderCanvas()
  }
  if (button?.dataset.dismiss) {
    state.suggestions = state.suggestions.filter((s) => s.id !== button.dataset.dismiss)
    toast('Suggestion dismissed. Its notes stay in Unsorted.')
    return renderCanvas()
  }
  if (button?.dataset.renameStart) {
    state.renaming = button.dataset.renameStart
    return renderCanvas()
  }
  const ref = t.closest('[data-ref]')
  const card = t.closest('[data-card]')
  const id = ref?.dataset.ref || (card && cardById(card.dataset.card) ? card.dataset.card : null)
  if (id && !t.closest('input')) {
    state.selectedCard = state.selectedCard === id && !ref ? null : id
    renderWorld()
  }
})
$('#canvas-view').addEventListener('keydown', (event) => {
  const input = event.target.closest('[data-rename]')
  if (!input) return
  if (event.key === 'Enter') commitRename(input)
  if (event.key === 'Escape') {
    state.renaming = null
    renderCanvas()
  }
})
$('#canvas-view').addEventListener('focusout', (event) => {
  const input = event.target.closest?.('[data-rename]')
  if (input && state.renaming) commitRename(input)
})

/* ---------- Moment strip ---------- */

// A still sketch in the episode's brand: plain shapes where the build will
// put real content. The variant letter shifts the layout a little.
const sketch = (kind, variant = 'A') => {
  const v = Math.max(0, 'ABCDEFGH'.indexOf(variant))
  const shift = [0, 14, -10, 20, -16, 8, -4, 12][v]
  const shapes = {
    type: `<rect class="sk-ink" x="${22 + shift}" y="30" width="96" height="11" rx="2"/>
      <rect class="sk-dim" x="${22 + shift}" y="48" width="70" height="6" rx="3"/>
      <rect class="sk-acc" x="${22 + shift}" y="61" width="28" height="3" rx="1.5"/>`,
    count: `<circle class="sk-ring" cx="${80 + shift}" cy="45" r="22"/>
      <rect class="sk-ink" x="${66 + shift}" y="38" width="28" height="14" rx="2"/>
      <rect class="sk-dim" x="${22 + shift / 2}" y="76" width="116" height="4" rx="2"/>`,
    receipts: `<rect class="sk-paper" x="${36 + shift / 2}" y="16" width="38" height="58" rx="3"/>
      <rect class="sk-paper" x="${86 + shift / 2}" y="16" width="38" height="58" rx="3"/>
      <rect class="sk-acc" x="${93 + shift / 2}" y="54" width="24" height="9" rx="2"/>`,
    flow: `<rect class="sk-dim" x="${18 + shift / 2}" y="30" width="38" height="30" rx="4"/>
      <rect class="sk-dim" x="${104 + shift / 2}" y="30" width="38" height="30" rx="4"/>
      <rect class="sk-acc" x="${60 + shift / 2}" y="44" width="40" height="3" rx="1.5"/>`,
    compare: `<rect class="sk-dim" x="16" y="18" width="58" height="46" rx="4"/>
      <rect class="sk-dim" x="86" y="18" width="58" height="46" rx="4"/>
      <rect class="sk-acc" x="${92 + shift / 3}" y="70" width="46" height="5" rx="2"/>`,
    hub: `<circle class="sk-acc" cx="${80 + shift}" cy="45" r="9"/>
      ${[0, 1, 2, 3, 4].map((i) => `<circle class="sk-dim" cx="${80 + shift + Math.cos(i * 1.26) * 30}" cy="${45 + Math.sin(i * 1.26) * 26}" r="6"/>`).join('')}`,
    clock: `<rect class="sk-dim" x="18" y="44" width="124" height="3" rx="1.5"/>
      <rect class="sk-acc" x="${62 + shift}" y="38" width="34" height="15" rx="3"/>
      <rect class="sk-ink" x="${18 + shift / 2}" y="22" width="44" height="7" rx="2"/>`,
    code: `<rect class="sk-panel" x="18" y="14" width="124" height="62" rx="4"/>
      ${[0, 1, 2, 3].map((i) => `<rect class="${i === 1 ? 'sk-acc' : 'sk-dim'}" x="28" y="${24 + i * 12}" width="${[70, 92, 56, 80][i]}" height="5" rx="2"/>`).join('')}`,
    list: [0, 1, 2]
      .map((i) => `<circle class="sk-acc" cx="${28 + shift / 2}" cy="${28 + i * 17}" r="3.5"/>
        <rect class="sk-ink" x="${38 + shift / 2}" y="${25 + i * 17}" width="${[80, 64, 90][i]}" height="6" rx="2"/>`)
      .join('')
  }
  return `<svg class="sketch" viewBox="0 0 160 90" aria-hidden="true"><rect class="sk-ground" width="160" height="90"/>${shapes[kind] || shapes.type}</svg>`
}

const STATUS = {
  waiting: { label: 'not yet', badge: '' },
  sketching: { label: 'sketching', badge: '' },
  sketched: { label: 'sketched, needs your look', badge: '' },
  approved: { label: 'approved', badge: 'check' },
  built: { label: 'built', badge: 'play' },
  changed: { label: 'changed since approval', badge: 'refresh' }
}

const tileHtml = (m) => {
  const playing = state.narration?.at === m.id
  const frame =
    m.status === 'waiting'
      ? '<div class="frame is-empty"></div>'
      : m.status === 'sketching'
        ? '<div class="frame"><div class="sketching">sketching…</div></div>'
        : `<div class="frame">${sketch(m.kind, m.active)}${
            STATUS[m.status].badge ? `<span class="badge is-${m.status}">${icon(STATUS[m.status].badge)}</span>` : ''
          }${m.locked ? `<span class="lock-mark" title="Locked">${icon('lock')}</span>` : ''}</div>`
  return `<button type="button" class="tile${state.selected === m.id ? ' is-selected' : ''}${playing ? ' is-playing' : ''}" data-moment="${m.id}"
      aria-label="Moment ${m.id}, ${esc(m.title)}, ${STATUS[m.status].label}${m.locked ? ', locked' : ''}" aria-pressed="${state.selected === m.id}">
    ${frame}
    <span class="tile-label"><span>${m.id} · ${esc(m.title)}</span><span>${clock(m.start)}</span></span>
  </button>`
}

const renderBar = () => {
  const n = state.narration
  const current = n ? findMoment(n.at) : null
  $('#production-bar').innerHTML = `
    <div class="crumbs">
      <button type="button" data-view="canvas">Agents in production</button><span aria-hidden="true">›</span>
      <strong>Episode 2 · Retries and idempotency</strong>
      <span class="format">YouTube · 16:9 · about 75 s</span>
    </div>
    <button type="button" class="brand-chip" id="brand-chip" aria-haspopup="dialog"><span class="swatch"></span>Brand: ${esc(state.brand.name)}</button>
    ${
      n
        ? `<button type="button" class="pill narrating" id="narrate"><span class="rec-dot"></span>Stop · ${clock(n.t)} · moment ${current ? current.id : ''}</button>`
        : `<button type="button" class="pill" id="narrate">${icon('mic')}Narrate over strip</button>`
    }
    <button type="button" class="pill" id="approve-ready">${icon('check')}Approve sketched</button>`
}

const renderLanes = () => {
  $('#lanes').innerHTML = `${state.scenes
    .map((scene, i) => {
      const end = state.scenes[i + 1]?.start ?? END
      const open = scene.moments.some((m) => m.status === 'waiting')
      return `<section class="scene" aria-label="Scene ${i + 1}: ${esc(scene.title)}">
        <div class="scene-head">
          <h3>${i + 1} · ${esc(scene.title)}</h3><span>${clock(scene.start)}–${clock(end)}</span>
          ${open ? `<button type="button" data-run-scene="${scene.id}">${icon('play')} Run scene</button>` : ''}
        </div>
        <div class="strip">${scene.moments.map(tileHtml).join('')}</div>
      </section>`
    })
    .join('')}
    <div class="legend" aria-hidden="true">
      <span><i class="dot-done"></i>approved or built</span>
      <span><i class="dot-changed"></i>changed since approval</span>
      <span><i class="dot-sketched"></i>sketched</span>
      <span><i class="dot-waiting"></i>not yet</span>
    </div>`
}

const renderDetail = () => {
  const m = findMoment(state.selected)
  if (!m) {
    $('#detail').innerHTML = '<p class="small">Select a moment.</p>'
    return
  }
  const card = cardById(m.card)
  const ready = m.status !== 'waiting' && m.status !== 'sketching'
  const stateText =
    m.status === 'changed'
      ? m.reason
      : m.status === 'approved'
        ? 'Approved. The build dresses this layout and never redraws it.'
        : m.status === 'built'
          ? 'Built from the approved sketch.'
          : m.status === 'sketched'
            ? 'Sketched. Approve it, pick another variant, or re-run it.'
            : m.status === 'sketching'
              ? 'Sketching…'
              : 'Not sketched yet. Run the scene to sketch its moments in order.'
  $('#detail').innerHTML = `
    <h3>${m.id} · ${esc(m.title)}</h3>
    <div class="state-line is-${m.status}">${STATUS[m.status].badge ? icon(STATUS[m.status].badge) : ''}<span>${esc(stateText)}</span></div>
    <dl>
      <div class="field"><dt>Role · technique · feeling</dt><dd>${esc(`${m.role} · ${m.technique} · ${m.feeling}`)}</dd></div>
      <div class="field"><dt>Why it is here</dt><dd>${esc(m.why)}</dd></div>
      <div class="field"><dt>Explains card</dt><dd>${
        card ? `<button type="button" class="card-link" data-goto-card="${card.id}">${esc(card.title)}</button>` : '—'
      }</dd></div>
      <div class="field"><dt>Voice cues</dt><dd><ol class="cues">${m.cues
        .map(([t, text]) => `<li><time>${t.toFixed(1)}</time><span>${esc(text)}</span></li>`)
        .join('')}</ol></dd></div>
      <div class="field"><dt>Blueprint · hero</dt><dd>${esc(`${m.blueprint} · ${m.hero}`)}</dd></div>
      ${
        ready
          ? `<div class="field"><dt>Variants</dt><dd><div class="variants">${m.variants
              .slice(-3)
              .map(
                (letter) => `<button type="button" class="variant" data-variant="${letter}" aria-pressed="${m.active === letter}">
                  <span class="frame">${sketch(m.kind, letter)}</span>${letter}${m.active === letter ? ' · active' : ''}
                </button>`
              )
              .join('')}</div></dd></div>`
          : ''
      }
    </dl>
    <div class="detail-actions">
      <button type="button" class="primary" data-approve ${ready && m.status !== 'approved' && m.status !== 'built' ? '' : 'disabled'}>${icon('check')}Approve</button>
      <button type="button" class="ghost" data-lock aria-pressed="${m.locked}">${icon('lock')}${m.locked ? 'Unlock' : 'Lock'}</button>
      <button type="button" class="ghost" data-rerun ${ready && !m.locked && m.status !== 'built' ? '' : 'disabled'}>${icon('refresh')}Re-run</button>
    </div>
    <p class="small">History: ${m.sketches} sketch${m.sketches === 1 ? '' : 'es'} · ${m.active} active${
      m.comments ? ` · ${m.comments} comment pinned` : ''
    }</p>`
}

const renderMoments = () => {
  document.documentElement.style.setProperty('--brand-accent', state.brand.accent)
  renderBar()
  renderLanes()
  renderDetail()
}

const select = (id) => {
  state.selected = id
  renderLanes()
  renderDetail()
  $(`[data-moment="${CSS.escape(id)}"]`)?.focus()
}

const sketchMoment = (m, delay = 1100) =>
  new Promise((resolve) => {
    m.status = 'sketching'
    renderLanes()
    if (state.selected === m.id) renderDetail()
    setTimeout(() => {
      if (m.status === 'sketching') {
        m.status = 'sketched'
        m.reason = null
      }
      renderLanes()
      if (state.selected === m.id) renderDetail()
      resolve()
    }, delay)
  })

const runScene = async (sceneId) => {
  const scene = state.scenes.find((s) => s.id === sceneId)
  const queue = scene.moments.filter((m) => m.status === 'waiting')
  toast(`Sketching ${queue.length} moment${queue.length === 1 ? '' : 's'} of “${scene.title}” in order. Nothing approved is redrawn.`)
  for (const m of queue) await sketchMoment(m, 700)
}

const changeAccent = (accent) => {
  if (accent === state.brand.accent) return
  const from = state.brand.accent
  state.brand.accent = accent
  let flipped = 0
  allMoments().forEach((m) => {
    if (m.status === 'approved' || m.status === 'built') {
      m.status = 'changed'
      m.reason = `Changed: the brand accent went from ${from} to ${accent} after approval. Approve again, or re-run.`
      flipped++
    }
  })
  renderMoments()
  toast(`Brand accent changed for every format of this episode. ${flipped} approved moment${flipped === 1 ? '' : 's'} marked changed.`)
}

const narrate = () => {
  if (state.narration) {
    clearInterval(state.narration.timer)
    state.narration = null
    renderBar()
    renderLanes()
    return toast('Prototype: nothing was recorded. In the product this take becomes the voice for these moments.')
  }
  const timeline = allMoments()
  state.narration = { t: 0, at: timeline[0].id }
  state.narration.timer = setInterval(() => {
    const n = state.narration
    n.t += 0.25
    const current = [...timeline].reverse().find((m) => m.start <= n.t)
    if (current && current.id !== n.at) {
      n.at = current.id
      renderLanes()
      $(`[data-moment="${CSS.escape(current.id)}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    }
    if (n.t >= END) return narrate()
    renderBar()
  }, 62)
  renderBar()
  renderLanes()
}

$('#moments-view').addEventListener('click', (event) => {
  const t = event.target
  const tile = t.closest('[data-moment]')
  if (tile) return select(tile.dataset.moment)
  const button = t.closest('button')
  if (!button) return
  const m = findMoment(state.selected)
  if (button.id === 'narrate') return narrate()
  if (button.id === 'approve-ready') {
    const ready = allMoments().filter((x) => x.status === 'sketched')
    ready.forEach((x) => (x.status = 'approved'))
    toast(ready.length ? `${ready.length} moment${ready.length === 1 ? '' : 's'} approved` : 'Nothing is waiting for approval')
    return renderMoments()
  }
  if (button.id === 'brand-chip')
    return openPopover(
      button,
      `<h4>Brand accent · ${esc(state.brand.name)}</h4>
       <p>Applies to every format of this episode. Approved moments will need another look.</p>
       <div class="accents">${ACCENTS.map(
         (a) => `<button type="button" data-act="${a}" style="background:${a}" aria-label="Accent ${a}" aria-pressed="${a === state.brand.accent}"></button>`
       ).join('')}</div>`,
      (act) => {
        closePopover()
        changeAccent(act)
      }
    )
  if (button.dataset.runScene) return runScene(button.dataset.runScene)
  if (button.dataset.gotoCard) {
    state.selectedCard = button.dataset.gotoCard
    setView('canvas')
    const el = $(`[data-card="${button.dataset.gotoCard}"]`)
    if (el) {
      const box = $('#canvas').getBoundingClientRect()
      state.cam.x = box.width / 2 - (el.offsetLeft + el.offsetWidth / 2) * state.cam.k
      state.cam.y = box.height / 3 - (el.offsetTop + 40) * state.cam.k
      applyCam()
    }
    return
  }
  if (!m) return
  if (button.dataset.variant) {
    if (m.active !== button.dataset.variant) {
      m.active = button.dataset.variant
      if (m.status === 'approved' || m.status === 'changed') {
        m.status = 'sketched'
        m.reason = null
      }
    }
    renderLanes()
    return renderDetail()
  }
  if (button.hasAttribute('data-approve')) {
    m.status = 'approved'
    m.reason = null
    toast(`Moment ${m.id} approved`)
  }
  if (button.hasAttribute('data-lock')) {
    m.locked = !m.locked
    toast(m.locked ? `Moment ${m.id} locked: Run scene and Re-run leave it alone` : `Moment ${m.id} unlocked`)
  }
  if (button.hasAttribute('data-rerun')) {
    const letter = 'ABCDEFGH'[m.variants.length] || 'H'
    m.variants.push(letter)
    m.active = letter
    m.sketches++
    sketchMoment(m)
    return renderDetail()
  }
  renderLanes()
  renderDetail()
})

// Arrow keys move between moments: left and right in a scene, up and down
// to the nearest moment of the next scene.
$('#lanes').addEventListener('keydown', (event) => {
  const tile = event.target.closest('[data-moment]')
  if (!tile || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
  event.preventDefault()
  const sceneIndex = state.scenes.findIndex((s) => s.moments.some((m) => m.id === tile.dataset.moment))
  const scene = state.scenes[sceneIndex]
  const index = scene.moments.findIndex((m) => m.id === tile.dataset.moment)
  if (event.key === 'ArrowLeft' && index > 0) select(scene.moments[index - 1].id)
  if (event.key === 'ArrowRight' && index < scene.moments.length - 1) select(scene.moments[index + 1].id)
  const other = state.scenes[sceneIndex + (event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0)]
  if (other && other !== scene) select(other.moments[Math.min(index, other.moments.length - 1)].id)
})

/* ---------- Header: catch-up and Ask ---------- */

$('#catchup').onclick = (event) =>
  openPopover(
    event.currentTarget,
    `<h4>Since you last looked</h4>
     <p>Sample changes, by you, Kai and the AI</p>
     <div class="change"><span>The AI suggested a card, “Observability”, from 3 notes</span><time>10 min</time></div>
     <div class="change"><span>You added 4 notes from “Retries without tears”</span><time>1 h</time></div>
     <div class="change"><span>Moment 2.3 was sketched</span><time>2 h</time></div>
     <div class="change"><span>Kai commented on moment 2.2</span><time>Yesterday</time></div>
     <div class="change"><span>Series setting v3 was published</span><time>Yesterday</time></div>
     <ul class="after-list"><li><button type="button" data-act="moments">Open the moment strip</button></li></ul>`,
    (act) => {
      closePopover()
      if (act === 'moments') setView('moments')
    }
  )

$('#ask').onclick = (event) => {
  const card = cardById(state.selectedCard)
  const m = state.view === 'moments' ? findMoment(state.selected) : null
  const context = m ? `moment ${m.id}, “${m.title}”` : card ? `the card “${card.title}”` : 'the whole project'
  openPopover(
    event.currentTarget,
    `<h4>Ask about ${esc(context)}</h4>
     <p>The agent reads what is selected, proposes the steps with time and cost, and waits for you.</p>
     <label class="sr-only" for="ask-text">Your request</label>
     <textarea id="ask-text" placeholder="For example: find two more notes for this card in my sources"></textarea>
     <div class="composer-row"><span class="hint">Prototype: no agent runs</span><button type="button" class="primary" data-act="plan">Plan it</button></div>
     <div id="ask-plan"></div>`,
    (act) => {
      if (act === 'plan') {
        $('#ask-plan').innerHTML = `<ol class="plan"><li>Read ${esc(context)} and its sources</li><li>Propose two notes, marked as suggestions</li><li>Wait for you to accept them</li></ol>
          <p class="small cost">About 20 seconds · about $0.02 (example)</p>
          <div class="composer-row"><span></span><span><button type="button" class="ghost" data-act="cancel">Cancel</button>
          <button type="button" class="primary" data-act="approve">Approve</button></span></div>`
      }
      if (act === 'approve') {
        closePopover()
        toast('Prototype: the plan would run now, and its suggestions would appear dashed.')
      }
      if (act === 'cancel') closePopover()
    }
  )
}

/* ---------- Start ---------- */
renderCanvas()
requestAnimationFrame(fitAll)
