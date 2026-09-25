// The video scene workspace (U2 of the scene workspace plan): a video
// notebook's scenes around one large central stage. A compact rail lists
// the scenes, each with its reference and the one thing it needs; the header
// names the scene, the plan revision on show and its one action; under the
// stage are the playback controls and a row of the scene's moments; one
// inspector shows the scene's Story, one Moment, how it is recorded, or its
// Output; the context — briefs, evidence, the cast's decisions, how each
// part was made — opens in a drawer.
//
// Nothing here owns planning state: the parts come from the notebook's
// review, drawn from the same durable records, and the stage is the same
// element the notebook uses, moved here without reloading. The notebook
// stays an alternate view, on the same scene ids and order; what this view
// keeps for itself — the view, the scene, the tab, the rail — is a local
// preference, never a plan, an approval or a job.
import './workspace.css'
import type { createSceneReview } from '../planning/scene-review'

export type WorkspaceReview = ReturnType<typeof createSceneReview>['workspace']
export type WorkspaceView = 'scenes' | 'notebook'
export type InspectorTab = 'story' | 'moment' | 'record' | 'output'
export type ContextSection = 'brief' | 'explanation' | 'cast' | 'details'

export type StagePlayback = {
  state: () => { playable: boolean; playing: boolean; ended: boolean; time: number; duration: number; estimated: boolean }
  toggle: () => void
  seek: (time: number) => void
  subscribe: (listener: () => void) => () => void
}

export type SceneWorkspaceHost = {
  review: () => WorkspaceReview | null
  // The open notebook, and whether it is a video notebook.
  projectId: () => string
  video: () => boolean
  // The one scene selection, shared with the notebook.
  selectedScene: () => string
  selectScene: (sceneId: string) => void
  thumbnailOf: (sceneId: string) => string
  // The stage and its bar move into the workspace, and back.
  mountStage: (frame: HTMLElement, bar: HTMLElement) => void
  unmountStage: () => void
  playback: StagePlayback
  // Width over height of the video.
  aspect: () => number
  viewChanged: (view: WorkspaceView) => void
  toast: (message: string) => void
  // A preview that finished while the creator looked elsewhere, chose another
  // view or recorded (U4); and playing it.
  notice: (sceneId: string) => { kind: 'offer' | 'elsewhere' | 'held'; revision: number } | null
  playOffer: (sceneId: string) => void
}

const VIEW_KEY = 'incredible-studio-v2-video-view'
const PREFS_KEY = 'incredible-studio-v2-workspace-'
type Prefs = { scene?: string; tab?: InspectorTab; rail?: boolean; follow?: boolean; context?: ContextSection | '' }

const readJson = <T>(key: string, fallback: T): T => {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? ({ ...fallback, ...JSON.parse(raw) } as T) : fallback
  } catch {
    return fallback
  }
}
const writeJson = (key: string, value: unknown) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // A preference that cannot be kept is only lost on reload.
  }
}
export const savedVideoView = (): WorkspaceView => {
  try {
    return window.localStorage.getItem(VIEW_KEY) === 'notebook' ? 'notebook' : 'scenes'
  } catch {
    return 'scenes'
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

const TABS: Array<[InspectorTab, string]> = [['story', 'Story'], ['moment', 'Moment'], ['record', 'Record'], ['output', 'Output']]
const SECTIONS: Array<[ContextSection, string]> = [['brief', 'Brief'], ['explanation', 'Explanation'], ['cast', 'Cast'], ['details', 'Run details']]
const seconds = (value: number) => `${(Math.round(value * 10) / 10).toFixed(1)}s`

export const createSceneWorkspace = (host: SceneWorkspaceHost) => {
  const root = document.getElementById('scene-workspace') as HTMLElement
  let view: WorkspaceView = savedVideoView()
  let prefs: Prefs = {}
  let prefsFor = ''
  let shown = ''
  let pending = false
  let focusStage = false
  let inspectorOpen = false
  let mounted = false
  let lastCurrent = ''

  const prefsKey = () => `${PREFS_KEY}${host.projectId()}`
  const loadPrefs = () => {
    if (prefsFor === host.projectId()) return
    prefsFor = host.projectId()
    prefs = readJson<Prefs>(prefsKey(), { tab: 'story', rail: false, follow: false, context: '' })
  }
  const savePrefs = (change: Partial<Prefs>) => {
    loadPrefs()
    prefs = { ...prefs, ...change }
    writeJson(prefsKey(), prefs)
  }

  // ——— The skeleton, built once ———
  const head = h('header', { class: 'sw-head' })
  const rail = h('nav', { class: 'sw-rail', 'aria-label': 'Scenes' })
  const stageArea = h('div', { class: 'sw-stage-area' })
  const frame = h('div', { class: 'sw-stage-frame' })
  stageArea.append(frame)
  const bar = h('div', { class: 'sw-stage-bar' })
  const focusButton = h('button', { type: 'button', class: 'sw-tool sw-focus', 'data-focus': 'sw-focus', 'aria-pressed': 'false', text: 'Focus stage', title: 'Hide the scenes and the inspector — the same stage, larger' })
  focusButton.addEventListener('click', () => {
    focusStage = !focusStage
    shown = ''
    render()
  })
  const barTools = h('div', { class: 'sw-stage-tools' }, focusButton)
  const activity = h('div', { class: 'sw-stage-activity', 'aria-live': 'polite' })
  const transport = h('div', { class: 'sw-transport' })
  const barRow = h('div', { class: 'sw-stage-row' }, bar, barTools)
  const centre = h('section', { class: 'sw-centre', 'aria-label': 'Stage' }, stageArea, barRow, activity, transport)
  const tabs = h('div', { class: 'sw-tabs', role: 'tablist', 'aria-label': 'Inspector' })
  const panel = h('div', { class: 'sw-panel', role: 'tabpanel' })
  const inspector = h('aside', { class: 'sw-inspector', 'aria-label': 'Inspector' }, tabs, panel)
  const context = h('aside', { class: 'sw-context', role: 'dialog', 'aria-label': 'Context', hidden: true })
  const announcer = h('p', { class: 'sr-only', 'aria-live': 'polite', role: 'status' })
  // The grid sits inside the workspace, so the workspace's width can reshape it.
  const layout = h('div', { class: 'sw-layout' }, head, rail, centre, inspector, context)
  root.replaceChildren(layout, announcer)

  const review = () => host.review()
  const sceneIds = () => review()?.scenes().map(scene => scene.id) || []
  // The scene on show: the notebook's selection when it is a scene, else the
  // one this workspace last showed, else the first.
  const currentScene = () => {
    const ids = sceneIds()
    const selected = host.selectedScene()
    if (ids.includes(selected)) return selected
    loadPrefs()
    if (prefs.scene && ids.includes(prefs.scene)) return prefs.scene
    return ids[0] || ''
  }

  // ——— Views ———
  const syncTabsInChrome = () => {
    const video = host.video()
    const scenesTab = document.getElementById('workspace-tab-scenes')
    const notebookTab = document.getElementById('workspace-tab-notebook')
    if (scenesTab) {
      scenesTab.hidden = !video
      scenesTab.classList.toggle('active', video && view === 'scenes')
      scenesTab.setAttribute('aria-pressed', String(video && view === 'scenes'))
    }
    if (notebookTab) {
      notebookTab.classList.toggle('active', !video || view === 'notebook')
      notebookTab.setAttribute('aria-pressed', String(!video || view === 'notebook'))
    }
  }
  const apply = () => {
    const on = host.video() && view === 'scenes'
    root.hidden = !on
    document.body.classList.toggle('is-scene-workspace', on)
    syncTabsInChrome()
    if (on && !mounted) {
      host.mountStage(frame, bar)
      mounted = true
    } else if (!on && mounted) {
      host.unmountStage()
      mounted = false
    }
    root.style.setProperty('--sw-aspect', String(host.aspect() || 16 / 9))
    host.viewChanged(on ? 'scenes' : 'notebook')
    shown = ''
    if (on) render()
  }
  const show = (next: WorkspaceView) => {
    view = next
    try {
      window.localStorage.setItem(VIEW_KEY, next)
    } catch {
      // kept for this session only
    }
    // The workspace opens on the scene the notebook was on, and hands it back.
    if (next === 'scenes') {
      const scene = currentScene()
      if (scene && scene !== host.selectedScene()) host.selectScene(scene)
    }
    apply()
  }

  // ——— Rendering ———
  const lead = (tab: InspectorTab, focus?: string) => {
    if (focus?.startsWith('context:')) {
      openContext(focus.slice('context:'.length) as ContextSection)
      return
    }
    savePrefs({ tab })
    inspectorOpen = true
    shown = ''
    render()
    if (focus) focusKey(focus)
  }
  const focusKey = (key: string) => {
    const element = root.querySelector<HTMLElement>(`[data-focus="${CSS.escape(key)}"]`)
    if (!element) return false
    element.focus({ preventScroll: false })
    return document.activeElement === element
  }
  const selectionInside = () => {
    const selection = window.getSelection()
    return Boolean(selection && !selection.isCollapsed && selection.anchorNode && (panel.contains(selection.anchorNode) || context.contains(selection.anchorNode)))
  }

  const renderHead = (sceneId: string) => {
    const parts = review()?.head(sceneId, lead)
    const scene = review()?.scenes().find(entry => entry.id === sceneId)
    const back = h('button', { type: 'button', class: 'sw-back', 'data-focus': 'sw-notebook', text: '‹ Notebook', title: 'The notebook: the outline and the words, on the same scenes' })
    back.addEventListener('click', () => show('notebook'))
    const title = h('div', { class: 'sw-title' },
      h('span', { class: 'sw-eyebrow', text: scene ? `Scene ${scene.index + 1} of ${sceneIds().length}` : 'Scenes' }),
      h('h2', { text: scene?.title || 'No scene yet' }),
    )
    // Near 1024 the inspector is a drawer, opened from here.
    const inspectorButton = h('button', { type: 'button', class: `sw-tool sw-inspector-toggle${inspectorOpen ? ' is-on' : ''}`, 'data-focus': 'sw-inspector', 'aria-expanded': inspectorOpen ? 'true' : 'false', text: 'Inspector' })
    inspectorButton.addEventListener('click', () => {
      inspectorOpen = !inspectorOpen
      shown = ''
      render()
    })
    // The context — briefs, evidence, the cast, how each part was made — in a drawer.
    const contextButton = h('button', { type: 'button', class: `sw-tool sw-context-open${context.hidden ? '' : ' is-on'}`, 'data-focus': 'sw-context', 'aria-expanded': context.hidden ? 'false' : 'true', text: 'Context', title: 'The briefs, the evidence, the cast\'s decisions and how each part was made' })
    contextButton.addEventListener('click', () => (context.hidden ? openContext((prefs.context as ContextSection) || 'brief') : closeContext()))
    const actions = h('div', { class: 'sw-actions' }, ...(parts?.secondary || []), parts?.primary || null, contextButton, inspectorButton)
    const planning = parts?.activity && ['planning', 'brief'].includes(parts.actions.activity?.kind || '') ? parts.activity : null
    head.replaceChildren(back, title, h('div', { class: 'sw-revision-slot' }, parts?.revision || null), h('div', { class: 'sw-status' }, planning), actions)
    // Focus stage sits with the stage's own controls.
    focusButton.textContent = focusStage ? 'Show panels' : 'Focus stage'
    focusButton.setAttribute('aria-pressed', String(focusStage))
    focusButton.classList.toggle('is-on', focusStage)
    // A preview or a production being made shows under the stage; a finished
    // preview the creator did not wait on is offered there.
    const building = parts?.activity && ['preview', 'production'].includes(parts.actions.activity?.kind || '') ? parts.activity : null
    const notice = sceneId ? host.notice(sceneId) : null
    let offer: HTMLElement | null = null
    if (notice && notice.kind !== 'elsewhere') {
      const play = h('button', { type: 'button', class: 'button secondary', 'data-focus': 'sw-play-offer', text: `Play the preview of r${notice.revision}` })
      play.addEventListener('click', () => host.playOffer(sceneId))
      offer = h('p', { class: 'ws-offer', role: 'status', 'data-offer': notice.kind }, h('strong', { text: `The preview of r${notice.revision} is ready.` }), notice.kind === 'held' ? ' It waits until you finish.' : ' Your view is kept.', ' ', play)
    }
    activity.replaceChildren(...[building, offer].filter((part): part is HTMLElement => Boolean(part)))
  }

  const renderRail = (sceneId: string) => {
    loadPrefs()
    const list = h('ol', { class: 'sw-scenes' })
    for (const listed of review()?.scenes() || []) {
      const notice = host.notice(listed.id)
      const scene = notice && listed.id !== sceneId ? { ...listed, state: { label: `Preview r${notice.revision} ready`, tone: 'new' as const } } : listed
      const selected = scene.id === sceneId
      const thumb = host.thumbnailOf(scene.id)
      const button = h('button', { type: 'button', class: `sw-scene${selected ? ' is-selected' : ''}`, 'data-focus': `sw-scene:${scene.id}`, 'data-scene': scene.id, 'aria-current': selected ? 'true' : undefined, title: `${scene.index + 1}. ${scene.title} — ${scene.state.label}` },
        h('span', { class: 'sw-scene-thumb' }, thumb ? Object.assign(h('img', { alt: '', loading: 'lazy' }), { src: thumb }) : null, h('span', { class: 'sw-scene-number', text: String(scene.index + 1) }), h('span', { class: `sw-scene-dot is-${scene.state.tone}`, 'aria-hidden': 'true' })),
        h('span', { class: 'sw-scene-text' }, h('strong', { text: scene.title }), h('span', { class: `sw-scene-state is-${scene.state.tone}`, text: scene.state.label })),
      )
      button.addEventListener('click', () => {
        if (scene.id === currentScene()) return
        savePrefs({ scene: scene.id })
        host.selectScene(scene.id)
      })
      list.append(h('li', {}, button))
    }
    const toggle = h('button', { type: 'button', class: 'sw-rail-toggle', 'data-focus': 'sw-rail', 'aria-expanded': prefs.rail ? 'false' : 'true', title: prefs.rail ? 'Show the scene titles' : 'Show only the scene numbers', text: prefs.rail ? '›' : '‹' })
    toggle.addEventListener('click', () => {
      savePrefs({ rail: !prefs.rail })
      shown = ''
      render()
    })
    rail.replaceChildren(toggle, list)
  }

  const renderInspector = (sceneId: string) => {
    loadPrefs()
    const parts = review()
    const approved = parts?.approved(sceneId) || false
    const available = TABS.filter(([id]) => id !== 'output' || approved)
    const tab: InspectorTab = prefs.tab && available.some(([id]) => id === prefs.tab) ? prefs.tab : 'story'
    tabs.replaceChildren(
      ...available.map(([id, label]) => {
        const on = id === tab
        const button = h('button', { type: 'button', role: 'tab', id: `sw-tab-${id}`, 'aria-selected': on ? 'true' : 'false', 'aria-controls': 'sw-panel', tabindex: on ? '0' : '-1', class: on ? 'is-on' : '', 'data-focus': `sw-tab:${id}`, text: label })
        button.addEventListener('click', () => lead(id))
        button.addEventListener('keydown', event => {
          const index = available.findIndex(([value]) => value === id)
          const to = event.key === 'ArrowRight' ? index + 1 : event.key === 'ArrowLeft' ? index - 1 : event.key === 'Home' ? 0 : event.key === 'End' ? available.length - 1 : null
          if (to === null) return
          event.preventDefault()
          const next = available[(to + available.length) % available.length][0]
          lead(next, `sw-tab:${next}`)
        })
        return button
      }),
    )
    panel.id = 'sw-panel'
    panel.setAttribute('aria-labelledby', `sw-tab-${tab}`)
    const content = tab === 'moment' ? parts?.moment(sceneId) : tab === 'record' ? parts?.record(sceneId) : tab === 'output' ? parts?.output(sceneId) : parts?.story(sceneId, lead)
    panel.replaceChildren(...(content ? [content] : [h('p', { class: 'review-muted', text: 'Loading the scene…' })]))
    if (tab === 'moment') {
      const follow = h('label', { class: 'sw-follow' }, Object.assign(h('input', { type: 'checkbox', 'data-focus': 'sw-follow' }), { checked: Boolean(prefs.follow) }), ' Follow playback')
      follow.querySelector('input')!.addEventListener('change', event => savePrefs({ follow: (event.target as HTMLInputElement).checked }))
      panel.prepend(follow)
    }
  }

  // ——— The context drawer ———
  const renderContext = (sceneId: string) => {
    if (context.hidden) return
    const section = (prefs.context as ContextSection) || 'brief'
    const nav = h('div', { class: 'sw-context-tabs', role: 'tablist', 'aria-label': 'Context' })
    for (const [id, label] of SECTIONS) {
      const on = id === section
      const button = h('button', { type: 'button', role: 'tab', 'aria-selected': on ? 'true' : 'false', tabindex: on ? '0' : '-1', class: on ? 'is-on' : '', 'data-focus': `sw-context:${id}`, text: label })
      button.addEventListener('click', () => openContext(id))
      nav.append(button)
    }
    const close = h('button', { type: 'button', class: 'sw-context-close', 'data-focus': 'sw-context-close', 'aria-label': 'Close the context', text: '×' })
    close.addEventListener('click', () => closeContext())
    const body = review()?.context(sceneId, section) || h('p', { class: 'review-muted', text: 'Loading…' })
    context.replaceChildren(h('div', { class: 'sw-context-head' }, h('strong', { text: 'Context' }), nav, close), h('div', { class: 'sw-context-scroll' }, body))
  }
  const openContext = (section: ContextSection) => {
    savePrefs({ context: section })
    context.hidden = false
    shown = ''
    render()
    focusKey(`sw-context:${section}`)
  }
  const closeContext = () => {
    if (context.hidden) return
    context.hidden = true
    savePrefs({ context: '' })
    shown = ''
    render()
    focusKey('sw-context')
  }

  // ——— Playback and the moments row ———
  const renderTransport = () => {
    const sceneId = currentScene()
    const row = sceneId ? review()?.moments(sceneId) : null
    const state = host.playback.state()
    const play = h('button', { type: 'button', class: 'sw-play', 'data-focus': 'sw-play', 'aria-label': state.playing ? 'Pause' : state.ended ? 'Play again from the start' : 'Play', text: state.playing ? '❚❚' : state.ended ? '↻' : '▶', ...(state.playable ? {} : { disabled: true, title: 'Nothing playable on the stage — the reference is a still page' }) })
    play.addEventListener('click', () => host.playback.toggle())
    const clock = h('span', { class: 'sw-clock', text: state.playable ? `${seconds(state.time)} / ${seconds(state.duration)}${state.estimated ? ' est.' : ''}` : '—' })
    const moments = h('div', { class: 'sw-moments', role: 'listbox', 'aria-label': 'Moments', 'aria-orientation': 'horizontal' })
    let current = ''
    if (row) {
      for (const moment of row.moments) {
        const playing = state.playable && moment.start !== null && moment.end !== null && state.time >= moment.start && state.time < moment.end
        if (playing) current = moment.id
        const chip = h('button', {
          type: 'button',
          role: 'option',
          class: `sw-moment${moment.id === row.selected ? ' is-selected' : ''}${playing ? ' is-current' : ''}`,
          'aria-selected': moment.id === row.selected ? 'true' : 'false',
          'data-focus': `sw-moment:${moment.id}`,
          'data-moment': moment.id,
          title: `${moment.index + 1}. ${moment.title}${moment.seconds ? ` — ${moment.seconds}s${row.measured ? '' : ' est.'}` : ''}`,
          style: `flex-grow:${Math.max(0.6, moment.seconds || 1)}`,
        },
          h('span', { class: 'sw-moment-number', text: String(moment.index + 1) }),
          h('span', { class: 'sw-moment-title', text: moment.title }),
          moment.seconds ? h('span', { class: 'sw-moment-time', text: `${moment.seconds}s${row.measured ? '' : '≈'}` }) : null,
        )
        chip.addEventListener('click', () => {
          review()?.pick(sceneId, moment.id === row.selected ? '' : moment.id)
        })
        moments.append(chip)
      }
      if (state.playable && current) {
        const chip = moments.querySelector<HTMLElement>(`[data-moment="${CSS.escape(current)}"]`)
        const timed = row.moments.find(moment => moment.id === current)
        if (chip && timed && timed.start !== null && timed.end !== null) {
          const head = h('span', { class: 'sw-playhead', 'aria-hidden': 'true' })
          head.style.setProperty('--at', String(Math.min(1, Math.max(0, (state.time - timed.start) / Math.max(0.01, timed.end - timed.start)))))
          chip.append(head)
        }
      }
    } else {
      moments.append(h('span', { class: 'sw-moments-empty', text: 'The plan\'s moments appear here once the scene is planned.' }))
    }
    transport.replaceChildren(play, clock, moments)
    // Following playback moves the inspector's moment, never the page.
    loadPrefs()
    if (prefs.follow && state.playing && current && current !== lastCurrent && row && current !== row.selected) review()?.follow(sceneId, current)
    lastCurrent = current
  }
  host.playback.subscribe(() => {
    if (!root.hidden) renderTransport()
  })

  const signatureOf = (sceneId: string) =>
    JSON.stringify([sceneId, review()?.signature(sceneId) || '', prefs.tab, prefs.rail, prefs.context, context.hidden, focusStage, inspectorOpen, sceneIds().map(id => host.notice(id))])

  const render = () => {
    if (root.hidden || !host.video()) return
    loadPrefs()
    const sceneId = currentScene()
    root.classList.toggle('is-rail-collapsed', Boolean(prefs.rail))
    root.classList.toggle('is-focus-stage', focusStage)
    root.classList.toggle('is-inspector-open', inspectorOpen)
    const signature = signatureOf(sceneId)
    if (signature === shown) {
      renderTransport()
      return
    }
    // Text being selected in the inspector survives: the redraw waits.
    if (selectionInside()) {
      if (!pending) {
        pending = true
        const settle = () => {
          if (selectionInside()) return
          document.removeEventListener('selectionchange', settle)
          pending = false
          render()
        }
        document.addEventListener('selectionchange', settle)
      }
      return
    }
    shown = signature
    // What had the keyboard, where each part was scrolled, and the caret.
    const active = document.activeElement instanceof HTMLElement && root.contains(document.activeElement) ? document.activeElement : null
    const key = active?.getAttribute('data-focus') || ''
    const caret = active instanceof HTMLTextAreaElement || (active instanceof HTMLInputElement && active.type === 'text') ? [active.selectionStart, active.selectionEnd] : null
    const scrolled = [panel, rail, context.querySelector('.sw-context-scroll')].map(element => element?.scrollTop || 0)
    if (sceneId) savePrefs({ scene: sceneId })
    renderHead(sceneId)
    renderRail(sceneId)
    renderInspector(sceneId)
    renderContext(sceneId)
    renderTransport()
    ;[panel, rail, context.querySelector('.sw-context-scroll')].forEach((element, index) => {
      if (element && scrolled[index]) element.scrollTop = scrolled[index]
    })
    if (key) {
      const again = root.querySelector<HTMLElement>(`[data-focus="${CSS.escape(key)}"]`)
      if (again && !(again as HTMLButtonElement).disabled) {
        again.focus({ preventScroll: true })
        if (caret && (again instanceof HTMLTextAreaElement || again instanceof HTMLInputElement)) again.setSelectionRange(caret[0], caret[1])
      }
    }
    // The selected scene in the rail stays in view.
    rail.querySelector('.sw-scene.is-selected')?.scrollIntoView({ block: 'nearest' })
  }

  root.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return
    if (!context.hidden) {
      event.preventDefault()
      closeContext()
    } else if (inspectorOpen && getComputedStyle(inspector).position === 'absolute') {
      event.preventDefault()
      inspectorOpen = false
      shown = ''
      render()
      focusKey('sw-inspector')
    } else if (focusStage) {
      event.preventDefault()
      focusStage = false
      shown = ''
      render()
    }
  })
  document.getElementById('workspace-tab-scenes')?.addEventListener('click', () => show('scenes'))
  document.getElementById('workspace-tab-notebook')?.addEventListener('click', () => {
    if (host.video()) show('notebook')
  })

  return {
    // Called when a notebook opens, and whenever the review or the stage changes.
    start: () => apply(),
    render,
    show,
    view: () => (host.video() ? view : 'notebook'),
    active: () => !root.hidden,
    // A moment was chosen: it opens in the inspector.
    momentPicked: (_sceneId: string, momentId: string) => {
      if (root.hidden || !momentId) return
      savePrefs({ tab: 'moment' })
      shown = ''
      render()
    },
    // After the plans are read: back on the scene this workspace last showed.
    restore: () => {
      loadPrefs()
      const ids = sceneIds()
      if (!root.hidden && prefs.scene && ids.includes(prefs.scene) && prefs.scene !== host.selectedScene()) host.selectScene(prefs.scene)
      shown = ''
      render()
    },
    announce: (message: string) => {
      announcer.textContent = ''
      window.requestAnimationFrame(() => (announcer.textContent = message))
    },
    frame: () => frame,
  }
}
