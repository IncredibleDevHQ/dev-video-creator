// The planning workspace (M0): read a video's Explanation Brief and each
// scene's creative plan, direct them, regenerate, compare and mark reviewed.
//
// Its layout borrows an editor's shape — scenes on the left, the stage in the
// middle, an inspector on the right, a sequence of moments with overlapping
// channel lanes along the bottom — but nothing here plays. A plan is not an
// animation yet: selecting a moment reveals what the plan says, durations are
// shown only as estimates the plan supplied, and no artwork, audio or code is
// generated to fill the view.
//
// Every state comes from the durable planning records, so closing the
// workspace, refreshing the app or reopening it later shows the same brief,
// the same plans and any run still going. Reviewing a plan changes its status
// and nothing else.
import type { ExplanationBriefV1, BriefUnit } from './explanation-brief'
import { channelsOf, TREATMENT_CHANNELS, type SceneTreatmentV1, type TreatmentChannel, type TreatmentMoment } from './scene-treatment'
import { PLANNING_STATE_LABELS, type PlanningRecord, type ScenePlanningView } from './planning-records'

type BasePage = { scene: string; title: string; idea: string; narration: string; sourcePassages: string[]; presentationKind: string; svg: string }
type SceneRow = {
  id: string
  title: string
  index: number
  originScenes: string[]
  script: string
  direction: string
  delivery: 'human' | 'generated' | 'silent' | null
  view: ScenePlanningView
}
export type PlanningOverviewV1 = {
  projectId: string
  available: boolean
  bundle: { name: string; version: string; hash: string; upstreamCommit: string } | null
  baseTitle: string
  baseLimitation: string | null
  brief: { current: PlanningRecord | null; latest: PlanningRecord | null; stale: boolean }
  scenes: SceneRow[]
  videoDirection: string
  basePages: BasePage[]
  records: PlanningRecord[]
}

type Harness = { id: string; ok: boolean; version?: string; reason?: string }

export type PlanningWorkspaceHost = {
  fetchJson: <T>(path: string, init?: RequestInit) => Promise<T>
  toast: (message: string) => void
  openNotebook: (id: string) => Promise<void> | void
  // The notebook open in the editor now, and its forks when it is a base.
  current: () => { id: string; title: string; derivedFrom?: { notebook: string; baseTitle?: string; baseRevision?: string } | null }
  forksOf: (baseId: string) => Promise<Array<{ id: string; title: string }>>
  // The base's own pages, for the presentation view in a base notebook.
  basePages: () => BasePage[]
}

const HARNESS_LABELS: Record<string, string> = { kimi: 'Kimi', 'claude-code': 'Claude Code', codex: 'Codex' }
const HARNESS_MODELS: Record<string, string | undefined> = { kimi: 'kimi-code/k3' }
const CHANNEL_LABELS: Record<TreatmentChannel, string> = {
  narration: 'Narration',
  objects: 'Objects',
  text: 'Text',
  presenter: 'Presenter',
  camera: 'Camera',
  audio: 'Sound',
}
const DELIVERY_LABELS: Record<string, string> = { '': 'Delivery undecided', human: 'My voice / presenter', generated: 'Generated narration', silent: 'Silent' }
const PREFERRED_HARNESS_KEY = 'studio.planningHarness'

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

const chip = (text: string, tone = '') => h('span', { class: `planning-chip${tone ? ` is-${tone}` : ''}`, text })
const basisTag = (basis: string) => h('span', { class: `planning-basis is-${basis}`, text: basis })
const when = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString() : '')

const STATE_TONES: Record<ScenePlanningView['state'], string> = {
  preparing: 'busy',
  'brief-failed': 'bad',
  'ready-to-plan': '',
  planning: 'busy',
  candidate: 'new',
  reviewed: 'good',
  stale: 'warn',
  failed: 'bad',
}

export const createPlanningWorkspace = (host: PlanningWorkspaceHost) => {
  const dialog = document.getElementById('planning-dialog') as HTMLDialogElement
  const root = document.getElementById('planning-workspace') as HTMLElement
  const bridge = window.studioDesktop

  let overview: PlanningOverviewV1 | null = null
  let projectId = ''
  let readOnly = false
  let forks: Array<{ id: string; title: string }> = []
  let selectedScene = ''
  let tab: 'presentation' | 'brief' | 'plan' = 'plan'
  let revision = ''
  let compareWith = ''
  let moment = ''
  let showRaw = false
  let harnesses: Harness[] = []
  let pollTimer = 0
  let unsubscribe: (() => void) | null = null
  const progress = new Map<string, string>()
  let busy = false

  const preferredHarness = () => {
    let preferred = ''
    try {
      preferred = localStorage.getItem(PREFERRED_HARNESS_KEY) || ''
    } catch {
      preferred = ''
    }
    const online = harnesses.filter(entry => entry.ok)
    return online.find(entry => entry.id === preferred)?.id || online[0]?.id || ''
  }

  const recordsFor = (kind: PlanningRecord['kind'], subject: string) =>
    (overview?.records || []).filter(record => record.kind === kind && record.subject === subject).sort((a, b) => b.revision - a.revision)

  const active = () => (overview?.records || []).filter(record => record.status === 'queued' || record.status === 'running')

  // ——— Loading ———
  const load = async () => {
    if (!projectId) return
    try {
      overview = readOnly
        ? await host.fetchJson<PlanningOverviewV1>(`/api/planning/${encodeURIComponent(host.current().id)}/child/${encodeURIComponent(projectId)}`)
        : await host.fetchJson<PlanningOverviewV1>(`/api/planning/${encodeURIComponent(projectId)}`)
    } catch (error) {
      overview = null
      render(error instanceof Error ? error.message : 'Planning could not be loaded')
      return
    }
    if (!selectedScene || !overview.scenes.some(scene => scene.id === selectedScene)) selectedScene = overview.scenes[0]?.id || ''
    render()
    schedulePoll()
  }

  const schedulePoll = () => {
    window.clearTimeout(pollTimer)
    if (!dialog.open || !active().length) return
    pollTimer = window.setTimeout(() => void load(), 3000)
  }

  const listen = () => {
    if (unsubscribe || !bridge?.isDesktop) return
    unsubscribe = bridge.harness.onEvent(({ runId, event }) => {
      const owner = (overview?.records || []).find(record => record.runId === runId)
      if (!owner) return
      const text = event.text || event.error || (event.tool ? `Working: ${event.tool}` : '')
      if (text) progress.set(owner.id, text.replace(/\s+/g, ' ').slice(0, 220))
      if (event.type === 'done') void load()
      else renderProgress(owner.id)
    })
  }

  // ——— Actions ———
  const startRun = async (record: PlanningRecord, route: 'Prepare Brief' | 'Plan Scene') => {
    if (!bridge?.isDesktop) {
      host.toast('Planning runs in the desktop app, with your local harness')
      return
    }
    const adapter = preferredHarness()
    if (!adapter) {
      const message = 'No local harness is available — install Kimi, Claude Code or Codex, then retry.'
      await host.fetchJson(`/api/planning/records/${encodeURIComponent(record.id)}/fail`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message, providerStatus: 'no harness online' }) }).catch(() => {})
      host.toast(message)
      return
    }
    try {
      await bridge.harness.run({
        adapter,
        skill: 'video-planner',
        route,
        projectId,
        inputs: { planning: { recordId: record.id }, ...(HARNESS_MODELS[adapter] ? { model: HARNESS_MODELS[adapter] } : {}), effort: 'high', autonomous: true },
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      // A run the harness refused to start leaves its record failed, with why.
      await host.fetchJson(`/api/planning/records/${encodeURIComponent(record.id)}/fail`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: `The local harness did not start: ${message}`, providerStatus: message }) }).catch(() => {})
      host.toast(message)
    }
  }

  const prepareBrief = async () => {
    if (readOnly || busy) return
    busy = true
    try {
      const { record, reused } = await host.fetchJson<{ record: PlanningRecord; reused: boolean }>(`/api/planning/${encodeURIComponent(projectId)}/brief`, { method: 'POST' })
      if (!reused || record.status === 'queued') await startRun(record, 'Prepare Brief')
      else host.toast('The brief is already being prepared')
    } catch (error) {
      host.toast(error instanceof Error ? error.message : 'The brief could not be queued')
    } finally {
      busy = false
      await load()
    }
  }

  const saveInputs = async (subject: string, change: { direction?: string; delivery?: string | null }) => {
    await host.fetchJson(`/api/planning/${encodeURIComponent(projectId)}/inputs`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ subject, ...change }),
    })
  }

  const generatePlan = async () => {
    if (readOnly || busy || !selectedScene) return
    busy = true
    try {
      // Direction typed but not yet saved travels with this request.
      const sceneBox = root.querySelector<HTMLTextAreaElement>('#planning-scene-direction')
      const videoBox = root.querySelector<HTMLTextAreaElement>('#planning-video-direction')
      const scene = overview?.scenes.find(entry => entry.id === selectedScene)
      if (sceneBox && scene && sceneBox.value !== scene.direction) await saveInputs(selectedScene, { direction: sceneBox.value })
      if (videoBox && overview && videoBox.value !== overview.videoDirection) await saveInputs('', { direction: videoBox.value })
      const { record, reused } = await host.fetchJson<{ record: PlanningRecord; reused: boolean }>(`/api/planning/${encodeURIComponent(projectId)}/scenes/${encodeURIComponent(selectedScene)}`, { method: 'POST' })
      if (!reused || record.status === 'queued') await startRun(record, 'Plan Scene')
      else host.toast('This plan is already being made from the same inputs')
      revision = ''
      tab = 'plan'
    } catch (error) {
      host.toast(error instanceof Error ? error.message : 'The plan could not be queued')
    } finally {
      busy = false
      await load()
    }
  }

  const review = async (record: PlanningRecord) => {
    try {
      await host.fetchJson(`/api/planning/records/${encodeURIComponent(record.id)}/review`, { method: 'POST' })
      host.toast(`Revision ${record.revision} is the reviewed plan. Nothing else was started.`)
    } catch (error) {
      host.toast(error instanceof Error ? error.message : 'Could not mark the plan reviewed')
    }
    await load()
  }

  const stop = async (record: PlanningRecord) => {
    if (record.runId && bridge?.isDesktop) await bridge.harness.cancel(record.runId).catch(() => false)
    else await host.fetchJson(`/api/planning/records/${encodeURIComponent(record.id)}/fail`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: 'Stopped before it started' }) }).catch(() => {})
    await load()
  }

  // ——— Rendering ———
  const render = (error = '') => {
    root.replaceChildren()
    root.append(renderHeader(error))
    if (!overview) return
    root.append(
      h('div', { class: 'planning-body' }, renderScenes(), renderStage(), renderInspector()),
      renderSequence(),
      renderFooter(),
    )
  }

  const renderProgress = (recordId: string) => {
    const line = root.querySelector<HTMLElement>(`[data-progress="${recordId}"]`)
    if (line) line.textContent = progress.get(recordId) || 'Starting the local harness…'
  }

  const renderHeader = (error: string) => {
    const current = host.current()
    const brief = overview?.brief
    const briefState = !overview
      ? chip('unavailable', 'bad')
      : brief?.current
        ? chip(`Brief r${brief.current.revision}${brief.stale ? ' · stale' : ''}`, brief.stale ? 'warn' : 'good')
        : brief?.latest && (brief.latest.status === 'queued' || brief.latest.status === 'running')
          ? chip('Preparing the brief', 'busy')
          : brief?.latest?.status === 'failed'
            ? chip('Brief failed', 'bad')
            : chip('No brief yet')
    const lineage = overview
      ? readOnly
        ? `Base “${current.title}” · showing video “${forks.find(fork => fork.id === projectId)?.title || projectId}” (read-only — its records belong to the video)`
        : `Video “${current.title}” · from base “${overview.baseTitle}”${current.derivedFrom?.baseRevision ? ` @ ${current.derivedFrom.baseRevision}` : ''}${overview.bundle ? ` · skills ${overview.bundle.name} ${overview.bundle.version} (Hyperframes ${overview.bundle.upstreamCommit.slice(0, 8)})` : ''}`
      : ''
    const harnessSelect = h('select', { class: 'planning-harness', 'aria-label': 'Local harness for planning runs', ...(readOnly ? { disabled: true } : {}) })
    const preferred = preferredHarness()
    for (const entry of harnesses) {
      const option = h('option', { value: entry.id, text: `${HARNESS_LABELS[entry.id] || entry.id}${entry.ok ? '' : ' (not found)'}`, ...(entry.ok ? {} : { disabled: true }) })
      if (entry.id === preferred) option.selected = true
      harnessSelect.append(option)
    }
    if (!harnesses.length) harnessSelect.append(h('option', { text: 'No local harness found' }))
    harnessSelect.addEventListener('change', () => {
      try {
        localStorage.setItem(PREFERRED_HARNESS_KEY, harnessSelect.value)
      } catch {
        // not remembered; the choice still applies now
      }
    })
    const actions = h('div', { class: 'planning-header-actions' })
    if (readOnly) {
      if (forks.length > 1) {
        const picker = h('select', { class: 'planning-harness', 'aria-label': 'Video fork' })
        for (const fork of forks) {
          const option = h('option', { value: fork.id, text: fork.title })
          if (fork.id === projectId) option.selected = true
          picker.append(option)
        }
        picker.addEventListener('change', () => {
          projectId = picker.value
          selectedScene = ''
          void load()
        })
        actions.append(h('label', { class: 'planning-field' }, 'Video ', picker))
      }
      const open = h('button', { type: 'button', class: 'button primary', text: 'Open the video notebook' })
      open.addEventListener('click', () => void host.openNotebook(projectId))
      actions.append(open)
    } else if (overview) {
      const briefRecord = brief?.latest
      const running = briefRecord && (briefRecord.status === 'queued' || briefRecord.status === 'running')
      const label = !brief?.current ? (briefRecord?.status === 'failed' ? 'Retry the brief' : 'Prepare the brief') : brief.stale ? 'Prepare the brief again' : 'Prepare again'
      const prepare = h('button', { type: 'button', class: `button ${brief?.current && !brief.stale ? 'ghost' : 'primary'}`, text: running ? 'Preparing…' : label, ...(running || !overview.available ? { disabled: true } : {}) })
      prepare.addEventListener('click', () => {
        // A new brief makes every plan drawn from the current one stale.
        const planned = overview!.records.some(record => record.kind === 'treatment' && record.content)
        if (brief?.current && planned && !window.confirm('Prepare the brief again? Creative plans made from the current brief will read as stale; they stay available for reference.')) return
        void prepareBrief()
      })
      actions.append(h('label', { class: 'planning-field' }, 'Harness ', harnessSelect), prepare)
      if (running && briefRecord) {
        const stopButton = h('button', { type: 'button', class: 'button ghost', text: 'Stop' })
        stopButton.addEventListener('click', () => void stop(briefRecord))
        actions.append(stopButton)
      }
    }
    const close = h('button', { type: 'button', class: 'icon-button planning-close', 'aria-label': 'Close planning', text: '×' })
    close.addEventListener('click', () => dialog.close())
    actions.append(close)
    return h(
      'header',
      { class: 'planning-header' },
      h(
        'div',
        { class: 'planning-title' },
        h('span', { class: 'eyebrow', text: readOnly ? 'Video plans · read-only' : 'Plan the video' }),
        h('h2', {}, current.title, ' ', briefState),
        h('p', { class: 'planning-lineage', text: lineage }),
        error ? h('p', { class: 'planning-error', text: error }) : null,
        overview && !overview.available ? h('p', { class: 'planning-error', text: 'Planning needs the desktop app: the pinned skill bundle and your local harness live there.' }) : null,
        overview?.baseLimitation ? h('p', { class: 'planning-note', text: overview.baseLimitation }) : null,
      ),
      actions,
    )
  }

  const renderScenes = () => {
    const list = h('ol', { class: 'planning-scenes', 'aria-label': 'Scenes' })
    for (const scene of overview!.scenes) {
      const item = h(
        'li',
        {},
        h(
          'button',
          { type: 'button', class: `planning-scene${scene.id === selectedScene ? ' is-selected' : ''}`, 'aria-current': scene.id === selectedScene ? 'true' : undefined },
          h('span', { class: 'planning-scene-number', text: String(scene.index + 1).padStart(2, '0') }),
          h('strong', { text: scene.title || scene.id }),
          chip(PLANNING_STATE_LABELS[scene.view.state], STATE_TONES[scene.view.state]),
          h('small', { text: `from base ${scene.originScenes.map(origin => overview!.basePages.find(page => page.scene === origin)?.title || origin).join(' + ') || '—'}` }),
          scene.view.reviewed && scene.view.state !== 'reviewed' ? h('small', { class: 'planning-kept', text: `reviewed r${scene.view.reviewed.revision} kept` }) : null,
        ),
      )
      item.querySelector('button')!.addEventListener('click', () => {
        selectedScene = scene.id
        revision = ''
        compareWith = ''
        moment = ''
        showRaw = false
        render()
      })
      list.append(item)
    }
    return h('nav', { class: 'planning-column planning-nav' }, h('h3', { text: 'Scenes' }), list)
  }

  const sceneRow = () => overview!.scenes.find(scene => scene.id === selectedScene) || null

  const shownPlan = () => {
    const scene = sceneRow()
    if (!scene) return null
    const records = recordsFor('treatment', scene.id).filter(record => record.content)
    return records.find(record => record.id === revision) || scene.view.current || records[0] || null
  }

  const renderStage = () => {
    const tabs = h('div', { class: 'planning-tabs', role: 'tablist' })
    for (const [id, label] of [['presentation', 'Presentation brief'], ['brief', 'Video explanation brief'], ['plan', 'Creative plan']] as const) {
      const button = h('button', { type: 'button', role: 'tab', class: `planning-tab${tab === id ? ' is-active' : ''}`, 'aria-selected': tab === id ? 'true' : 'false', text: label })
      button.addEventListener('click', () => {
        tab = id
        showRaw = false
        render()
      })
      tabs.append(button)
    }
    const body = showRaw ? renderRaw() : tab === 'presentation' ? renderPresentation() : tab === 'brief' ? renderBrief() : renderPlan()
    return h('section', { class: 'planning-column planning-stage' }, tabs, body)
  }

  const renderPresentation = () => {
    const scene = sceneRow()
    if (!scene) return h('p', { text: 'No scene selected.' })
    const pages = readOnly
      ? host.basePages().filter(page => scene.originScenes.includes(page.scene))
      : overview!.basePages.filter(page => scene.originScenes.includes(page.scene))
    const wrapper = h(
      'div',
      { class: 'planning-pane' },
      h('p', { class: 'planning-note', text: readOnly ? 'The base\'s own presentation input for this page, as it is now.' : 'What this video pinned from its base: the presentation input the page was drawn from. A reference and a lineage link — not a scene boundary, layout or duration.' }),
    )
    for (const page of pages) {
      const figure = h('figure', { class: 'planning-wireframe' })
      if (page.svg) {
        const image = h('img', { alt: `Wireframe of ${page.title}` })
        image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(page.svg)}`
        figure.append(image)
      }
      figure.append(h('figcaption', { text: `Reference wireframe · base page ${page.scene}` }))
      wrapper.append(
        h(
          'article',
          { class: 'planning-card' },
          h('h4', { text: page.title }),
          figure,
          page.presentationKind ? h('p', { class: 'planning-muted' }, 'Slide kind: ', h('code', { text: page.presentationKind }), ' — presentation-only, never used to plan the video.') : null,
          page.idea ? h('p', {}, h('strong', { text: 'Idea. ' }), page.idea) : null,
          page.narration ? h('p', {}, h('strong', { text: 'Narration. ' }), page.narration) : null,
          page.sourcePassages.length ? h('div', {}, h('strong', { text: 'Source passages' }), h('ul', {}, ...page.sourcePassages.map(passage => h('li', { class: 'planning-quote', text: passage })))) : null,
        ),
      )
    }
    if (!pages.length) wrapper.append(h('p', { text: 'This scene has no base page on record.' }))
    return wrapper
  }

  const evidenceOf = (brief: ExplanationBriefV1, refs: string[]) =>
    refs.map(ref => brief.evidence.find(entry => entry.id === ref)).filter(Boolean) as ExplanationBriefV1['evidence']

  const renderUnit = (brief: ExplanationBriefV1, unit: BriefUnit) =>
    h(
      'article',
      { class: 'planning-card' },
      h('h4', { text: unit.question }),
      h('p', { text: unit.explain }),
      unit.conditions.length ? h('ul', { class: 'planning-list' }, ...unit.conditions.map(condition => h('li', {}, condition.text, ' ', basisTag(condition.basis)))) : null,
      h('h5', { text: 'What the viewer needs' }),
      h('ul', { class: 'planning-list' }, ...unit.communicationNeeds.map(need => h('li', {}, h('strong', { text: need.need }), ` — ${need.why} `, basisTag(need.basis)))),
      unit.demonstration ? h('p', {}, h('strong', { text: 'Demonstration. ' }), unit.demonstration.text, ' ', basisTag(unit.demonstration.basis)) : h('p', { class: 'planning-muted', text: 'Demonstration left open for the creative plan.' }),
      h('h5', { text: 'Evidence' }),
      h('ul', { class: 'planning-list' }, ...evidenceOf(brief, unit.evidenceRefs).map(entry => h('li', { class: 'planning-quote' }, entry.text, entry.locator ? h('small', { text: ` ${entry.locator}` }) : null, ' ', basisTag(entry.kind)))),
    )

  const renderBrief = () => {
    const record = overview!.brief.current
    const latest = overview!.brief.latest
    if (!record?.content) {
      if (latest && (latest.status === 'queued' || latest.status === 'running')) {
        return h('div', { class: 'planning-pane' }, h('p', { class: 'planning-busy', 'data-progress': latest.id, text: progress.get(latest.id) || 'Preparing the explanation brief with your local harness…' }))
      }
      if (latest?.status === 'failed') {
        return h('div', { class: 'planning-pane' }, ...failure(latest, 'The brief could not be prepared', 'The video notebook is intact. Retry the brief, or switch the harness at the top first.'))
      }
      return h('div', { class: 'planning-pane' }, h('p', { text: 'No brief yet. Prepare it from the retained source and your narrative.' }))
    }
    const brief = record.content as ExplanationBriefV1
    const scene = sceneRow()
    const mine = scene ? brief.coverage.filter(entry => scene.originScenes.includes(entry.scene)) : []
    const units = [...new Set(mine.flatMap(entry => entry.units))].map(id => brief.units.find(unit => unit.id === id)).filter(Boolean) as BriefUnit[]
    return h(
      'div',
      { class: 'planning-pane' },
      overview!.brief.stale ? h('p', { class: 'planning-warn', text: 'The inputs have moved since this brief was made (source, scripts, theme or direction). Prepare it again to plan from the current state.' }) : null,
      h('p', { class: 'planning-message' }, h('strong', { text: 'Message. ' }), brief.purpose.message),
      h('p', { class: 'planning-muted', text: `${brief.purpose.deliverable} · ${brief.purpose.audience} · ${brief.purpose.requestedSeconds ? `about ${brief.purpose.requestedSeconds}s requested` : 'no length requested'} · wording ${brief.source.wordingPolicy} · source ${brief.source.coverage}` }),
      h('h4', { text: 'This scene' }),
      ...(units.length ? units.map(unit => renderUnit(brief, unit)) : [h('p', { class: 'planning-muted', text: mine.find(entry => entry.omittedReason)?.omittedReason || 'The brief maps no explanation unit to this scene\'s pages.' })]),
      h('h4', { text: 'The whole video' }),
      h('article', { class: 'planning-card' },
        h('h5', { text: 'Progression' }),
        h('ol', { class: 'planning-list' }, ...brief.progression.map(step => h('li', {}, h('code', { text: step.unit }), ` ${step.note} `, chip(step.ordering)))),
        h('h5', { text: 'Entities' }),
        h('ul', { class: 'planning-list' }, ...brief.entities.map(entity => h('li', {}, h('strong', { text: entity.name }), ` — ${entity.role}`))),
        brief.openDecisions.length ? h('div', {}, h('h5', { text: 'Open decisions' }), h('ul', { class: 'planning-list' }, ...brief.openDecisions.map(text => h('li', { text })))) : null,
        brief.uncertainty.length ? h('div', {}, h('h5', { text: 'Uncertainty' }), h('ul', { class: 'planning-list' }, ...brief.uncertainty.map(entry => h('li', {}, entry.text, ' ', chip(entry.kind, 'warn'))))) : null,
        h('h5', { text: 'Route' }),
        h('p', {}, h('code', { text: brief.route.workflow }), ` — ${brief.route.reason}`),
      ),
      h('p', { class: 'planning-provenance', text: `Brief r${record.revision} · ${record.adapter ? `${HARNESS_LABELS[record.adapter] || record.adapter}${record.model ? ` ${record.model}` : ''}` : 'harness unknown'} · ${when(record.updatedAt)} · source ${brief.source.revisionRef} · base ${brief.material.baseRevision}` }),
    )
  }

  const failure = (record: PlanningRecord, what: string, next: string) => {
    const message = record.error?.message || 'no reason given'
    const provider = record.error?.providerStatus && record.error.providerStatus !== message ? record.error.providerStatus : ''
    return [
      h('p', { class: 'planning-error', text: `${what}: ${message}` }),
      provider ? h('p', { class: 'planning-muted', text: `Last provider status: ${provider}` }) : null,
      h('p', { class: 'planning-muted', text: `${next}${record.adapter ? ` It ran on ${HARNESS_LABELS[record.adapter] || record.adapter}.` : ''}` }),
    ].filter(Boolean) as HTMLElement[]
  }

  const renderPlan = () => {
    const scene = sceneRow()
    if (!scene) return h('p', { text: 'No scene selected.' })
    const view = scene.view
    const all = recordsFor('treatment', scene.id)
    const pane = h('div', { class: 'planning-pane' })
    if (view.state === 'preparing' || view.state === 'brief-failed') {
      pane.append(h('p', { text: view.state === 'preparing' ? 'The brief comes first: this scene can be planned once it is ready.' : 'The brief failed. Retry it from the header; this scene waits for it.' }))
      return pane
    }
    if (view.latest && (view.latest.status === 'queued' || view.latest.status === 'running')) {
      pane.append(h('p', { class: 'planning-busy', 'data-progress': view.latest.id, text: progress.get(view.latest.id) || `Planning revision ${view.latest.revision} with your local harness…` }))
      if (view.reviewed) pane.append(h('p', { class: 'planning-muted', text: `The reviewed plan (r${view.reviewed.revision}) stays in place until you review a new one.` }))
      const stopButton = h('button', { type: 'button', class: 'button ghost', text: 'Stop this run' })
      stopButton.addEventListener('click', () => void stop(view.latest!))
      if (!readOnly) pane.append(stopButton)
    }
    if (view.latest?.status === 'failed') {
      pane.append(...failure(view.latest, `Revision ${view.latest.revision} failed`, `${view.reviewed ? `The reviewed plan (r${view.reviewed.revision}) is unchanged. ` : ''}Retry below, or switch the harness at the top first.`))
    }
    const record = shownPlan()
    if (!record?.content) {
      if (view.state === 'ready-to-plan') pane.append(h('p', { text: 'Ready to plan. Add direction below if you want, then generate the creative plan.' }))
      return pane
    }
    const plan = record.content as SceneTreatmentV1
    const cast = new Set(plan.objects.map(object => object.entity))
    const uncast = [...new Set(plan.moments.flatMap(item => item.objects?.actors || []))].filter(actor => !cast.has(actor))
    // Revisions: what exists, what happened to each, and a comparison.
    const versions = h('div', { class: 'planning-versions' }, h('span', { class: 'planning-muted', text: 'Revisions ' }))
    for (const entry of all) {
      const button = h('button', { type: 'button', class: `planning-version${entry.id === record.id ? ' is-selected' : ''}${entry.id === compareWith ? ' is-compared' : ''}`, text: `r${entry.revision} ${entry.status}`, ...(entry.content ? {} : { disabled: true }) })
      button.addEventListener('click', event => {
        if ((event as MouseEvent).altKey || (event as MouseEvent).shiftKey) compareWith = compareWith === entry.id ? '' : entry.id
        else {
          revision = entry.id
          moment = ''
        }
        render()
      })
      versions.append(button)
    }
    const compare = h('button', { type: 'button', class: 'button ghost', text: compareWith ? 'Stop comparing' : 'Compare with…', ...(all.some(entry => entry.content && entry.id !== record.id) ? {} : { disabled: true }) })
    compare.addEventListener('click', () => {
      const other = all.find(entry => entry.content && entry.id !== record.id)
      compareWith = compareWith ? '' : other?.id || ''
      if (!compareWith) host.toast('There is no other revision with a plan to compare')
      render()
    })
    versions.append(compare)
    pane.append(versions)
    if (record.status === 'superseded') pane.append(h('p', { class: 'planning-warn', text: `This revision was superseded: ${record.error?.message || 'a newer run or changed inputs replaced it'}. It is kept for reference.` }))
    if (record.id === view.current?.id && view.staleBecause) pane.append(h('p', { class: 'planning-warn', text: `Stale — ${view.staleBecause}. Generate a new candidate to plan from the current inputs.` }))
    const other = compareWith ? all.find(entry => entry.id === compareWith)?.content as SceneTreatmentV1 | undefined : undefined
    if (other) pane.append(renderComparison(plan, other, all.find(entry => entry.id === compareWith)!.revision, record.revision))
    pane.append(
      h('article', { class: 'planning-card planning-plan-head' },
        h('h4', { text: plan.question }),
        h('p', {}, h('strong', { text: 'Takeaway. ' }), plan.takeaway),
        h('p', {}, h('strong', { text: 'How it develops. ' }), plan.development),
        plan.demonstration ? h('p', {}, h('strong', { text: 'Demonstration. ' }), plan.demonstration.text, ' ', ...plan.demonstration.values.map(value => h('span', { class: 'planning-value' }, value.value, ' ', basisTag(value.basis)))) : null,
      ),
      h('div', { class: 'planning-grid' },
        h('article', { class: 'planning-card' },
          h('h5', { text: 'Objects' }),
          plan.objects.length ? h('ul', { class: 'planning-list' }, ...plan.objects.map(object => h('li', {}, h('strong', { text: object.entity }), ` — ${object.role}. `, h('em', { text: object.performance || 'No performance described.' }), ' ', chip(object.asset.status === 'reuse' ? `reuse ${object.asset.ref}` : object.asset.status)))) : null,
          uncast.length ? h('p', { class: 'planning-warn', text: `Moved in its moments but not cast, so no look or asset is decided: ${uncast.join(', ')}.` }) : null,
          !plan.objects.length && !uncast.length ? h('p', { class: 'planning-muted', text: 'No objects: this scene is carried by other channels.' }) : null,
        ),
        h('article', { class: 'planning-card' },
          h('h5', { text: 'Presenter, text and camera' }),
          h('p', {}, h('strong', { text: 'Presenter. ' }), plan.treatments.presenter),
          h('p', {}, h('strong', { text: 'Text. ' }), plan.treatments.text),
          h('p', {}, h('strong', { text: 'Camera. ' }), plan.treatments.camera),
          h('p', {}, h('strong', { text: 'Delivery. ' }), plan.delivery.voice, plan.delivery.note ? ` — ${plan.delivery.note}` : ''),
        ),
        h('article', { class: 'planning-card' },
          h('h5', { text: 'Skills that shaped it' }),
          h('ul', { class: 'planning-list' }, ...plan.skills.map(skill => h('li', {}, h('code', { text: skill.skill }), ` — ${skill.why}`, skill.references.length ? h('details', {}, h('summary', { text: `${skill.references.length} reference${skill.references.length === 1 ? '' : 's'}` }), h('ul', {}, ...skill.references.map(reference => h('li', {}, h('code', { text: reference }))))) : null))),
        ),
        h('article', { class: 'planning-card' },
          h('h5', { text: 'Before it can be built' }),
          h('ul', { class: 'planning-list' },
            ...plan.requirements.assets.map(text => h('li', {}, chip('asset'), ` ${text}`)),
            ...plan.requirements.takes.map(text => h('li', {}, chip('take'), ` ${text}`)),
            ...plan.requirements.decisions.map(text => h('li', {}, chip('decision'), ` ${text}`)),
            ...plan.unresolved.map(text => h('li', {}, chip('open', 'warn'), ` ${text}`)),
            ...((record.report?.constructionRisks || []).map(text => h('li', {}, chip('unproven', 'warn'), ` ${text}`))),
          ),
          h('p', { class: 'planning-muted', text: `Continuity — enters: ${plan.continuity.entry} · leaves: ${plan.continuity.exit}` }),
        ),
      ),
      plan.rosterProposal ? h('p', { class: 'planning-warn', text: `Roster proposal (${plan.rosterProposal.action} ${plan.rosterProposal.scenes.join(', ')}): ${plan.rosterProposal.reason}. A proposal only — the scenes are unchanged until you decide.` }) : '',
      h('p', { class: 'planning-provenance', text: `Plan r${record.revision} · ${record.status} · ${record.adapter ? `${HARNESS_LABELS[record.adapter] || record.adapter}${record.model ? ` ${record.model}` : ''}` : 'harness unknown'} · workflow ${record.workflow || '—'} · ${when(record.updatedAt)}${record.reviewedAt ? ` · reviewed ${when(record.reviewedAt)}` : ''}` }),
    )
    return pane
  }

  const renderComparison = (plan: SceneTreatmentV1, other: SceneTreatmentV1, otherRevision: number, revisionNumber: number) => {
    const titles = (entry: SceneTreatmentV1) => entry.moments.map(item => `${item.title} — ${item.observation}`)
    const recipes = (entry: SceneTreatmentV1) => [...new Set(entry.moments.flatMap(item => item.recipes.map(recipe => `${recipe.catalog}:${recipe.id}`)))]
    const column = (label: string, entry: SceneTreatmentV1, against: SceneTreatmentV1) =>
      h('div', { class: 'planning-compare-column' },
        h('h5', { text: label }),
        h('p', { text: entry.takeaway }),
        h('ol', { class: 'planning-list' }, ...titles(entry).map(text => h('li', { class: titles(against).includes(text) ? '' : 'is-different', text }))),
        h('p', { class: 'planning-muted' }, 'Recipes: ', ...recipes(entry).map(id => h('code', { class: recipes(against).includes(id) ? '' : 'is-different', text: `${id} ` }))),
      )
    return h('div', { class: 'planning-compare' }, column(`r${revisionNumber}`, plan, other), column(`r${otherRevision}`, other, plan))
  }

  const renderInspector = () => {
    const record = tab === 'plan' ? shownPlan() : null
    const plan = record?.content as SceneTreatmentV1 | undefined
    const brief = overview!.brief.current?.content as ExplanationBriefV1 | undefined
    const aside = h('aside', { class: 'planning-column planning-inspector' }, h('h3', { text: 'Inspector' }))
    const selected = plan?.moments.find(item => item.id === moment) || plan?.moments[0]
    if (!plan || !selected) {
      aside.append(h('p', { class: 'planning-muted', text: tab === 'plan' ? 'Select a moment in the sequence below.' : 'The inspector follows the creative plan: open the Creative plan tab.' }))
      return aside
    }
    const row = (label: string, value: Node | string | null) => (value ? h('div', { class: 'planning-row' }, h('dt', { text: label }), h('dd', {}, value)) : null)
    aside.append(
      h('h4', { text: selected.title }),
      h('dl', { class: 'planning-rows' },
        row('Why the viewer needs it', selected.purpose),
        row('What they should notice', selected.observation),
        row('Attention on', selected.attention),
        row('Narration', selected.narration ? `${selected.narration.job}${selected.narration.guide ? ` — “${selected.narration.guide}”` : ''}` : null),
        row('Visible change', selected.objects ? `${selected.objects.change}${selected.objects.actors.length ? ` (${selected.objects.actors.join(', ')})` : ''}` : null),
        row('Text', selected.text ? `${selected.text.content} (${selected.text.role})` : null),
        row('Presenter', selected.presenter ? `${selected.presenter.visibility} — ${selected.presenter.reason}` : null),
        row('Camera', selected.camera ? `${selected.camera.treatment} on ${selected.camera.subject} — ${selected.camera.reason}` : null),
        row('Sound', selected.audio ? `${selected.audio.cue} — ${selected.audio.reason}` : null),
        row('Length', selected.estimateSeconds ? `≈ ${selected.estimateSeconds}s (estimate — timing waits for audio)` : 'Not estimated — timing waits for audio'),
      ),
      h('h5', { text: 'Recipes and why' }),
      selected.recipes.length
        ? h('ul', { class: 'planning-list' }, ...selected.recipes.map(recipe => h('li', {}, h('code', { text: recipe.id }), ' ', chip(recipe.catalog, recipe.catalog === 'adapted' ? 'warn' : ''), ` ${recipe.purpose} `, h('small', { text: `(${CHANNEL_LABELS[recipe.channel] || recipe.channel}${recipe.controls.length ? ` · drives ${recipe.controls.join(', ')}` : ''})` }))))
        : h('p', { class: 'planning-muted', text: 'No recipe: this moment holds or is carried by speech alone.' }),
      h('h5', { text: 'Evidence' }),
      brief && selected.evidenceRefs.length
        ? h('ul', { class: 'planning-list' }, ...evidenceOf(brief, selected.evidenceRefs).map(entry => h('li', { class: 'planning-quote', text: entry.text })))
        : h('p', { class: 'planning-muted', text: 'No evidence cited for this moment.' }),
    )
    return aside
  }

  const renderSequence = () => {
    const record = tab === 'plan' ? shownPlan() : null
    const plan = record?.content as SceneTreatmentV1 | undefined
    const section = h('section', { class: 'planning-sequence', 'aria-label': 'Moments and channels' })
    if (!plan) {
      section.append(h('p', { class: 'planning-muted', text: 'The creative plan\'s moments appear here as an ordered sequence, with a lane for each channel they use.' }))
      return section
    }
    const lanes = TREATMENT_CHANNELS.filter(channel => plan.moments.some(item => channelsOf(item).includes(channel)))
    const grid = h('div', { class: 'planning-lanes', style: `grid-template-columns: 108px repeat(${plan.moments.length}, minmax(150px, 1fr))` })
    grid.append(h('div', { class: 'planning-lane-head', text: 'Moment' }))
    plan.moments.forEach((item, index) => {
      const head = h('button', { type: 'button', class: `planning-moment${(moment || plan.moments[0].id) === item.id ? ' is-selected' : ''}` },
        h('span', { class: 'planning-scene-number', text: String(index + 1) }),
        h('strong', { text: item.title }),
        item.estimateSeconds ? h('small', { text: `≈${item.estimateSeconds}s est.` }) : null,
      )
      head.addEventListener('click', () => {
        moment = item.id
        render()
      })
      grid.append(head)
    })
    for (const lane of lanes) {
      grid.append(h('div', { class: 'planning-lane-head', text: CHANNEL_LABELS[lane] }))
      for (const item of plan.moments) grid.append(h('div', { class: `planning-cell${channelsOf(item).includes(lane) ? ' is-used' : ''}`, text: cellText(item, lane) }))
    }
    section.append(grid, h('p', { class: 'planning-muted', text: plan.moments.some(item => item.estimateSeconds) ? 'Ordered moments; any lengths are the plan\'s estimates, not measured timing.' : 'Ordered moments; lengths wait for audio.' }))
    return section
  }

  const cellText = (item: TreatmentMoment, lane: TreatmentChannel) => {
    if (lane === 'narration') return item.narration?.job || ''
    if (lane === 'objects') return item.objects?.change || ''
    if (lane === 'text') return item.text ? `${item.text.content}` : ''
    if (lane === 'presenter') return item.presenter ? `${item.presenter.visibility}` : ''
    if (lane === 'camera') return item.camera ? `${item.camera.treatment}` : ''
    return item.audio?.cue || ''
  }

  const renderFooter = () => {
    const scene = sceneRow()
    const footer = h('footer', { class: 'planning-footer' })
    if (!scene) return footer
    const raw = h('button', { type: 'button', class: 'button ghost', text: showRaw ? 'Back to the plan' : 'Raw files' })
    raw.addEventListener('click', () => {
      showRaw = !showRaw
      render()
    })
    if (readOnly) {
      const said = (label: string, value: string) => h('p', {}, h('strong', { text: `${label} ` }), value || h('span', { class: 'planning-muted', text: 'none' }))
      footer.append(
        h('div', { class: 'planning-direction is-read-only' }, said('Video direction.', overview!.videoDirection), said('Scene direction.', scene.direction), said('Delivery.', scene.delivery ? DELIVERY_LABELS[scene.delivery] : 'undecided')),
        h('div', { class: 'planning-footer-actions' }, h('span', { class: 'planning-muted', text: 'Plans are directed, generated and reviewed in the video notebook.' }), raw),
      )
      return footer
    }
    const videoBox = h('textarea', { id: 'planning-video-direction', rows: '2', placeholder: 'Direction for the whole video (optional)' })
    videoBox.value = overview!.videoDirection
    const sceneBox = h('textarea', { id: 'planning-scene-direction', rows: '2', placeholder: 'Direction for this scene (optional) — what should change in the next candidate?' })
    sceneBox.value = scene.direction
    const delivery = h('select', { 'aria-label': 'Delivery for this scene' })
    for (const [value, label] of Object.entries(DELIVERY_LABELS)) {
      const option = h('option', { value, text: label })
      if ((scene.delivery || '') === value) option.selected = true
      delivery.append(option)
    }
    delivery.addEventListener('change', async () => {
      await saveInputs(scene.id, { delivery: delivery.value || null }).catch(error => host.toast(error instanceof Error ? error.message : 'Could not save the delivery'))
      host.toast('Delivery saved. Plans made before it are now stale.')
      await load()
    })
    for (const [box, subject] of [[videoBox, ''], [sceneBox, scene.id]] as const) {
      box.addEventListener('change', async () => {
        await saveInputs(subject, { direction: box.value }).catch(error => host.toast(error instanceof Error ? error.message : 'Could not save the direction'))
        await load()
      })
    }
    const view = scene.view
    const generating = view.state === 'planning'
    const generate = h('button', { type: 'button', class: 'button primary', text: view.latest?.status === 'failed' ? 'Retry creative plan' : view.current ? 'Regenerate with direction' : 'Generate creative plan', ...(generating || !overview!.brief.current || !overview!.available ? { disabled: true } : {}) })
    generate.addEventListener('click', () => void generatePlan())
    const shown = shownPlan()
    const canReview = shown?.status === 'candidate' && !(shown.id === view.current?.id && view.staleBecause)
    const reviewButton = h('button', { type: 'button', class: 'button secondary', text: shown?.status === 'reviewed' ? 'Reviewed' : 'Mark reviewed', ...(canReview ? {} : { disabled: true }) })
    reviewButton.addEventListener('click', () => shown && void review(shown))
    footer.append(
      h('div', { class: 'planning-direction' }, videoBox, sceneBox),
      h('div', { class: 'planning-footer-actions' }, delivery, generate, reviewButton, raw),
    )
    return footer
  }

  // The raw planning artifacts: the packet the run read and what it wrote,
  // straight from the run directory, plus the record's stored JSON.
  const renderRaw = () => {
    const scene = sceneRow()
    const record = tab === 'brief' || !scene ? overview!.brief.latest : shownPlan() || scene.view.latest
    const pane = h('div', { class: 'planning-pane planning-raw' }, h('p', { class: 'planning-muted', text: record ? `Record ${record.id} · r${record.revision} · ${record.status}${record.runId ? ` · run ${record.runId}` : ''}` : 'No record yet.' }))
    if (!record) return pane
    pane.append(h('details', { open: true }, h('summary', { text: 'Stored record (JSON)' }), h('pre', { text: JSON.stringify(record, null, 2) })))
    if (record.runId && bridge?.isDesktop) {
      const holder = h('div', {}, h('p', { class: 'planning-muted', text: 'Reading the run directory…' }))
      pane.append(holder)
      void bridge.harness.artefacts(record.runId).then(artefacts => {
        const files = { ...(artefacts.planning?.packet || {}), ...(artefacts.planning?.planning || {}) }
        holder.replaceChildren(
          ...(Object.keys(files).length
            ? Object.entries(files).map(([name, text]) => h('details', {}, h('summary', { text: name }), h('pre', { text })))
            : [h('p', { class: 'planning-muted', text: 'The run directory is no longer available; the stored record above is the durable copy.' })]),
        )
      }).catch(() => holder.replaceChildren(h('p', { class: 'planning-muted', text: 'The run directory could not be read.' })))
    }
    return pane
  }

  const open = async (options: { prepare?: boolean } = {}) => {
    const current = host.current()
    readOnly = !current.derivedFrom?.notebook
    progress.clear()
    showRaw = false
    if (readOnly) {
      forks = await host.forksOf(current.id)
      if (!forks.length) {
        overview = null
        root.replaceChildren(
          h('header', { class: 'planning-header' },
            h('div', { class: 'planning-title' }, h('span', { class: 'eyebrow', text: 'Video plans' }), h('h2', { text: current.title }), h('p', { class: 'planning-lineage', text: 'This is a base notebook. Its video plans live in a video fork: create one first, and it will prepare its explanation brief.' })),
            h('div', { class: 'planning-header-actions' }, (() => {
              const close = h('button', { type: 'button', class: 'icon-button planning-close', 'aria-label': 'Close planning', text: '×' })
              close.addEventListener('click', () => dialog.close())
              return close
            })()),
          ),
        )
        if (!dialog.open) dialog.showModal()
        return
      }
      if (!forks.some(fork => fork.id === projectId)) projectId = forks[0].id
    } else {
      projectId = current.id
    }
    if (bridge?.isDesktop) harnesses = await bridge.harness.adapters().catch(() => [])
    listen()
    if (!dialog.open) dialog.showModal()
    await load()
    if (options.prepare && !readOnly && overview && !overview.brief.current && !active().some(record => record.kind === 'brief')) await prepareBrief()
  }

  dialog.addEventListener('close', () => {
    window.clearTimeout(pollTimer)
  })

  return { open, reload: load }
}
