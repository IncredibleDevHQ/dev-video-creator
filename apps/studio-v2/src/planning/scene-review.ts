// Scene review inside the video notebook (P2). Every scene block carries a
// compact strip — its plan, recording and output states, and the cast it
// draws on — and the selected scene opens beside the stage: what it will
// explain and how, the objects it uses, its moments, what is still open,
// direction for the next candidate, a recording guide, a comparison with
// another revision, and the actions: approve (which starts nothing), preview,
// record, and production, kept distinct.
//
// Everything comes from the durable planning records, so a restart shows the
// same approvals. A poll that brings nothing new changes nothing on screen;
// what the creator opened, typed or selected survives the renders that do.
import type { ExplanationBriefV1 } from './explanation-brief'
import type { SceneTreatmentV1, TreatmentMoment } from './scene-treatment'
import { PLANNING_STATE_LABELS, isActiveStatus, type PlanningRecord, type ScenePlanningView } from './planning-records'
import type { PlanningOverviewV1, ScenePreviewView, SceneProductionView, VisualCastSummary } from './planning-workspace'
import { compareTreatments, DIFFERENCE_LABELS } from './plan-compare'
import { recordingGuide } from './recording-guide'
import { acceptProduction, approvePlan, loadPlanning, planScene, previewScene, produceScene, saveProductionEdits, saveSceneDirection } from './planning-client'
import { BROWSER_REVIEW_MESSAGE, progressText } from '../harness-choice'
import { videoNextStep, type NextStep } from './next-step'

type FetchJson = <T>(path: string, init?: RequestInit) => Promise<T>
type Scene = PlanningOverviewV1['scenes'][number]
type CastEntry = VisualCastSummary['entries'][number]

// checking: the harness submitted it, and the product is playing it in the
// pinned player before it can read ready.
export type PreviewState = { state: 'none' | 'building' | 'ready' | 'failed'; recordId?: string; message?: string; stale?: boolean; checking?: boolean }

export type SceneReviewHost = {
  fetchJson: FetchJson
  toast: (message: string) => void
  // The open video notebook, or null for a base or an ordinary notebook.
  projectId: () => string | null
  wordingPolicy: () => 'preserve' | 'assist' | 'draft'
  // The scene's words as the notebook holds them now.
  script: (sceneId: string) => string
  // The scene's current take, and whether it was spoken against the words
  // the scene has now (null: no take).
  // The scene's current take against its script now: changed are the
  // script's lines the take was not spoken against; null when the take kept
  // only the whole script's fingerprint.
  takeOf: (sceneId: string) => { known: boolean; current: boolean; revision: number | null; changed: string[] | null; dropped: number | null } | null
  // Make a plan revision's lines the scene's script, with that lineage.
  applyScript: (sceneId: string, script: string, lineage: { treatment: string; revision: number }) => void
  // The notebook redraws the review of every scene.
  refresh: () => void
  record: (sceneId: string) => void
  // The planning workspace, on this scene, revision and moment.
  openWorkspace: (sceneId: string, revision: string, moment: string) => void
  // The stage shows which page objects a moment is about — and, when the
  // stage plays the plan's preview or the scene produced from it, goes to
  // the moment: `at` on the preview, `producedAt` on the production.
  selectMoment: (sceneId: string, targets: { nodes: string[]; objectIds: string[] } | null, at: number | null, producedAt: number | null) => void
  // The stage switches to the scene's plan preview.
  showPreview: (sceneId: string) => void
  // The stage shows the base's newer page for this scene, to compare; and
  // the scene takes it as its page (F1 of the Perplexity review).
  showBaseReference: (sceneId: string) => void
  adoptReference: (sceneId: string) => Promise<void>
  // The stage plays the scene's produced composition (P4) — from `at`, when
  // given; an accepted one becomes the scene's output in the notebook, which
  // plays and exports it.
  showProduction: (sceneId: string, at?: number) => void
  adoptProduction: (sceneId: string, production: SceneProductionView) => Promise<void>
  // The production the notebook plays for the scene, if any; and the
  // notebook's own scene back in its place.
  producedIn: (sceneId: string) => string | null
  releaseProduction: (sceneId: string) => Promise<void>
}

type SceneUi = { revision: string; compare: string; moment: string; direction: string | null }

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
const chip = (text: string, tone = '') => h('span', { class: `review-chip${tone ? ` is-${tone}` : ''}`, text })

const PLAN_TONES: Record<ScenePlanningView['state'], string> = {
  'needs-brief': '',
  preparing: 'busy',
  'brief-failed': 'bad',
  'ready-to-plan': '',
  planning: 'busy',
  candidate: 'new',
  reviewed: 'good',
  stale: 'warn',
  failed: 'bad',
}

export const createSceneReview = (host: SceneReviewHost) => {
  let overview: PlanningOverviewV1 | null = null
  let loadedFor = ''
  let error = ''
  let shown = ''
  let pollTimer = 0
  let busy = false
  const ui = new Map<string, SceneUi>()
  const disclosures = new Map<string, boolean>()
  const progress = new Map<string, string>()
  let listening = false

  const uiOf = (sceneId: string) => {
    let state = ui.get(sceneId)
    if (!state) ui.set(sceneId, (state = { revision: '', compare: '', moment: '', direction: null }))
    return state
  }
  const sceneOf = (sceneId: string) => overview?.scenes.find(scene => scene.id === sceneId) || null
  const recordsOf = (sceneId: string) =>
    (overview?.records || []).filter(record => record.kind === 'treatment' && record.subject === sceneId).sort((a, b) => b.revision - a.revision)
  const shownRecord = (scene: Scene) => {
    const state = uiOf(scene.id)
    const all = recordsOf(scene.id).filter(record => record.content)
    return all.find(record => record.id === state.revision) || scene.view.current || all[0] || null
  }
  const active = () => (overview?.records || []).some(record => isActiveStatus(record.status))
  // A plan revision's own sketch: another revision's is never shown for it.
  const previewFor = (scene: Scene, record: PlanningRecord | null | undefined): ScenePreviewView | null =>
    (record && scene.preview?.byTreatment?.[record.id]) || null
  // What the stage plays as the scene's production: the newest one, else
  // the one accepted — and, for a moment, only the one of that revision.
  const productionShown = (scene: Scene) => scene.production?.ready || scene.production?.accepted || null
  const producedFor = (scene: Scene, record: PlanningRecord | null | undefined) => {
    const production = productionShown(scene)
    return production && record && production.of.record === record.id ? production : null
  }
  // Where the scene's production stands, for the next step.
  const productionStateOf = (scene: Scene): 'none' | 'producing' | 'ready' | 'accepted' | 'stale' | 'failed' => {
    const production = scene.production
    if (!production) return 'none'
    if (isActiveStatus(production.latest.status)) return 'producing'
    if (production.ready && !production.ready.accepted && production.ready.current) return 'ready'
    if (production.accepted?.current) return 'accepted'
    if (production.ready || production.accepted) return 'stale'
    return production.latest.status === 'failed' ? 'failed' : 'none'
  }
  // Where the sketch of one plan revision stands.
  const previewStateOf = (scene: Scene, record: PlanningRecord | null | undefined): PreviewState => {
    const preview = scene.preview
    if (!preview || !record) return { state: 'none' }
    const latest = preview.latest
    if (latest.treatmentId === record.id && isActiveStatus(latest.status)) return { state: 'building', recordId: latest.id, checking: latest.status === 'verifying' }
    const ready = previewFor(scene, record)
    if (ready) return { state: 'ready', recordId: ready.id, stale: !ready.current }
    if (latest.treatmentId === record.id && latest.status === 'failed') return { state: 'failed', recordId: latest.id, message: latest.error?.message }
    return { state: 'none' }
  }

  // ——— Loading ———
  const load = async () => {
    const projectId = host.projectId()
    window.clearTimeout(pollTimer)
    if (!projectId) {
      if (overview) {
        overview = null
        loadedFor = ''
        host.refresh()
      }
      return
    }
    try {
      overview = await loadPlanning(host.fetchJson, projectId)
      loadedFor = projectId
      error = ''
    } catch (failure) {
      error = failure instanceof Error ? failure.message : 'Planning could not be loaded'
    }
    const signature = JSON.stringify([
      loadedFor,
      error,
      (overview?.records || []).map(record => [record.id, record.status, record.updatedAt, record.reportedModel]),
      (overview?.scenes || []).map(scene => [scene.id, scene.view.state, scene.continuity, scene.reference?.revision, scene.reference?.adopted?.revision, scene.reference?.newer?.revision, scene.reference?.newer?.designing, scene.reference?.baseDesigning, scene.production?.latest?.id, scene.production?.latest?.status, scene.production?.ready?.id, scene.production?.ready?.current, scene.production?.accepted?.id, scene.production?.ready?.edits?.revision, scene.production?.accepted?.edits?.revision, scene.production?.accepted?.accepted?.edits, scene.productionWaits]),
      overview?.visualCast?.status,
      overview?.visualCast?.id,
      overview?.brief.stale,
    ])
    if (signature !== shown) {
      shown = signature
      host.refresh()
    }
    if (active() || overview?.visualCast?.status === 'extracting') pollTimer = window.setTimeout(() => void load(), 4000)
  }

  const listen = () => {
    const bridge = window.studioDesktop
    if (listening || !bridge?.isDesktop) return
    listening = true
    bridge.harness.onEvent(({ runId, event }) => {
      if (!overview) return
      if (event.type === 'done') {
        void load()
        return
      }
      const owner = overview.records.find(record => record.runId === runId)
      if (!owner) return
      const text = progressText(event)
      if (!text) return
      progress.set(owner.id, text.slice(0, 200))
      document.querySelectorAll<HTMLElement>(`[data-review-progress="${owner.id}"]`).forEach(element => (element.textContent = text.slice(0, 200)))
    })
  }

  // What the creator reads names scenes, pages and artwork by their titles,
  // never by the ids the records use.
  const readable = (text: string) => {
    let out = text
    for (const scene of overview?.scenes || []) if (scene.id && out.includes(scene.id)) out = out.split(scene.id).join(`“${scene.title || 'untitled scene'}”`)
    for (const entry of overview?.visualCast?.entries || []) if (entry.libraryKey && out.includes(entry.libraryKey)) out = out.split(entry.libraryKey).join(`“${entry.label}”`)
    return out
  }
  const pageTitle = (page: string) => overview?.visualCast?.pages.find(entry => entry.scene === page)?.title || overview?.basePages.find(entry => entry.scene === page)?.title || 'another page'

  // ——— What a moment is about, on the page ———
  const targetsOf = (scene: Scene, plan: SceneTreatmentV1, moment: TreatmentMoment) => {
    const cast = overview?.visualCast?.entries || []
    const brief = overview?.brief.current?.content as ExplanationBriefV1 | undefined
    const nodes = new Set<string>()
    const objectIds = new Set<string>()
    for (const actor of moment.objects?.actors || []) {
      const ref = plan.objects.find(object => object.entity === actor)?.asset.ref
      const entry = ref ? cast.find(item => item.libraryKey === ref) : undefined
      if (entry) nodes.add(entry.node)
      for (const id of brief?.entities.find(entity => entity.id === actor)?.legacyObjectIds || []) objectIds.add(id)
      for (const item of cast.filter(candidate => scene.originScenes.includes(candidate.page) && candidate.node.endsWith(`-node-${actor}`))) nodes.add(item.node)
    }
    return { nodes: [...nodes], objectIds: [...objectIds] }
  }

  // ——— Actions ———
  const run = async (what: string, action: () => Promise<unknown>) => {
    if (busy) return
    busy = true
    try {
      await action()
    } catch (failure) {
      host.toast(failure instanceof Error ? failure.message : `Could not ${what}`)
    } finally {
      busy = false
      await load()
    }
  }
  const revise = (scene: Scene) =>
    run('plan the scene', async () => {
      const state = uiOf(scene.id)
      const projectId = host.projectId()
      if (!projectId) return
      if (state.direction !== null && state.direction !== scene.direction) await saveSceneDirection(host.fetchJson, projectId, scene.id, state.direction)
      state.direction = null
      state.revision = ''
      const { reused } = await planScene(host.fetchJson, projectId, scene.id)
      host.toast(reused ? 'This plan is already being made from the same inputs' : 'Planning a new candidate — the approved plan stays until you approve another')
    })
  const preview = (scene: Scene, record: PlanningRecord, again: boolean) =>
    run('preview the plan', async () => {
      const projectId = host.projectId()
      if (!projectId) return
      const { reused, record: previewRecord } = await previewScene(host.fetchJson, projectId, scene.id, { recordId: record.id, again })
      if (reused && previewRecord.status === 'ready') host.showPreview(scene.id)
      else host.toast(`Sketching a rough preview of plan r${record.revision} — the harness builds it; nothing is produced`)
    })
  const approve = (record: PlanningRecord) =>
    run('approve the plan', async () => {
      await approvePlan(host.fetchJson, record.id)
      host.toast(`Revision ${record.revision} is this scene's approved plan. Nothing else was started.`)
    })

  // Focus a review control by its key; false when it is gone or disabled.
  const refocus = (key: string) => {
    const again = document.querySelector<HTMLElement>(`.scene-review [data-focus="${CSS.escape(key)}"]`)
    if (!again || (again as HTMLButtonElement).disabled) return false
    again.focus({ preventScroll: true })
    return document.activeElement === again
  }

  // ——— Rendering ———
  const disclosure = (key: string, summary: string, content: Node, openByDefault = false) => {
    const details = h('details', { class: 'review-disclosure', 'data-review-open': key, ...((disclosures.get(key) ?? openByDefault) ? { open: true } : {}) }, h('summary', { text: summary, 'data-focus': `summary:${key}` }), content)
    details.addEventListener('toggle', () => disclosures.set(key, details.open))
    return details
  }

  const planState = (scene: Scene) => {
    const view = scene.view
    const label = view.state === 'reviewed' ? `Approved r${view.reviewed?.revision}` : view.state === 'candidate' ? `Candidate r${view.current?.revision}` : PLANNING_STATE_LABELS[view.state]
    return chip(`Plan: ${label}`, PLAN_TONES[view.state])
  }
  // Which page the scene is planned from (F1): a schematic draft, a
  // designed slide, a page — adopted from the base after the fork, or the
  // one it was forked with — and whether the base offers a newer one.
  const PAGE_KIND: Record<string, string> = { designed: 'designed slide', schematic: 'schematic', page: 'page' }
  const pageState = (scene: Scene) => {
    const reference = scene.reference
    if (!reference) return null
    const kind = PAGE_KIND[reference.kind] || reference.kind
    const element = chip(`Page: ${kind}${reference.adopted ? ' (adopted)' : ''}`, reference.kind === 'schematic' ? 'warn' : '')
    element.title = `Planned from revision ${reference.revision.slice(0, 8)} of base page ${reference.baseScene}${reference.adopted ? `, adopted ${new Date(reference.adopted.at).toLocaleString()}` : ''}`
    return element
  }
  const newerPage = (scene: Scene) => {
    const newer = scene.reference?.newer
    if (newer && !newer.designing && newer.svg) return chip(`Base has a newer ${PAGE_KIND[newer.kind] || 'page'}`, 'new')
    if (newer?.designing || scene.reference?.baseDesigning) return chip('Base still designing this page', 'busy')
    return null
  }
  const recordingState = (scene: Scene) => {
    if (scene.delivery === 'generated' || scene.delivery === 'silent') return chip(`Recording: not needed (${scene.delivery})`)
    const take = host.takeOf(scene.id)
    if (take) {
      if (take.current) return chip('Recording: take matches the script', 'good')
      if (take.changed?.length) return chip(`Recording: ${take.changed.length} line${take.changed.length === 1 ? '' : 's'} to re-record`, 'warn')
      return take.known ? chip('Recording: take is of an earlier script', 'warn') : chip('Recording: take recorded')
    }
    return scene.view.current ? chip('Recording: guide ready · no take yet') : chip('Recording: waits for a plan')
  }
  // The strip speaks for the scene's current plan; an older revision's
  // sketch only ever reads as out of date, and says whose it is.
  const previewChip = (scene: Scene) => {
    const preview = previewStateOf(scene, scene.view.current)
    if (preview.state === 'none') {
      const older = Object.values(scene.preview?.byTreatment || {}).sort((a, b) => b.of.revision - a.of.revision)[0]
      if (!older) return null
      const element = chip('Preview: out of date', 'warn')
      element.title = `The newest sketch is of r${older.of.revision}; ${scene.view.current ? `r${scene.view.current.revision} has none yet` : 'the scene has no current plan'}`
      return element
    }
    return chip(`Preview: ${preview.state === 'ready' ? (preview.stale ? 'out of date' : 'ready') : preview.state === 'building' ? (preview.checking ? 'checking…' : 'building…') : 'failed'}`, preview.state === 'ready' && !preview.stale ? 'good' : preview.state === 'failed' ? 'bad' : preview.state === 'building' ? 'busy' : 'warn')
  }

  // The scene's output (P4): produced from its approved plan, and accepted.
  const outputState = (scene: Scene) => {
    const production = scene.production
    if (!production) return chip('Output: not produced')
    if (isActiveStatus(production.latest.status)) return chip(production.latest.status === 'verifying' ? 'Output: checking…' : 'Output: producing…', 'busy')
    if (production.accepted) return chip(production.accepted.current ? 'Output: accepted' : 'Output: accepted, out of date', production.accepted.current ? 'good' : 'warn')
    if (production.ready) return chip(production.ready.current ? 'Output: produced — review it' : 'Output: produced, out of date', production.ready.current ? 'new' : 'warn')
    if (production.latest.status === 'failed') return chip('Output: production failed', 'bad')
    return chip('Output: not produced')
  }

  // The compact strip every other scene block carries; inline, the selected
  // scene's one status line under its title (F7). Inline, the plan's state
  // is the revision control's to say, once (F6 of the Perplexity review).
  const strip = (scene: Scene, inline: boolean) => {
    const cast = (overview?.visualCast?.entries || []).filter(entry => scene.originScenes.includes(entry.page) && entry.verification === 'verified')
    const thumbs = h('span', { class: 'review-strip-cast', title: cast.map(entry => entry.label).join(', ') })
    for (const entry of cast.slice(0, 6)) {
      const image = h('img', { alt: entry.label, loading: 'lazy' })
      image.src = entry.thumbnail
      thumbs.append(image)
    }
    if (cast.length > 6) thumbs.append(h('small', { text: `+${cast.length - 6}` }))
    return h(
      'div',
      { class: `review-strip${inline ? ' is-inline' : ''}` },
      inline ? null : h('span', { class: 'review-strip-label', text: 'Scene review' }),
      pageState(scene),
      newerPage(scene),
      inline ? null : planState(scene),
      recordingState(scene),
      previewChip(scene),
      outputState(scene),
      cast.length ? thumbs : null,
      inline ? null : h('span', { class: 'review-strip-open', text: 'Select the scene to review it' }),
    )
  }

  const castFor = (plan: SceneTreatmentV1, scene: Scene) => {
    const cast = overview?.visualCast?.entries || []
    const byKey = (key?: string) => (key ? cast.find(entry => entry.libraryKey === key) : undefined)
    const items = plan.objects.map(object => {
      const entry = byKey(object.asset.ref)
      const art = h('span', { class: 'review-cast-art' })
      if (entry) {
        const image = h('img', { alt: entry.label, loading: 'lazy' })
        image.src = entry.thumbnail
        art.append(image)
      } else art.append(h('span', { class: 'review-cast-none', text: object.asset.status === 'native' ? 'native' : '—' }))
      return h('li', { class: 'review-cast-item' },
        art,
        h('span', {},
          h('strong', { text: object.entity }),
          ' ',
          chip(object.asset.status, object.asset.status === 'undecided' ? 'warn' : object.asset.status === 'reuse' ? 'good' : ''),
          entry ? h('small', { text: ` ${entry.label} (${entry.kind}${scene.originScenes.includes(entry.page) ? '' : `, from “${pageTitle(entry.page)}”`})` }) : null,
          h('small', { class: 'review-muted', text: ` ${object.performance || object.role}` }),
          object.asset.reason ? h('small', { class: 'review-muted', text: ` — ${readable(object.asset.reason)}` }) : null,
        ),
      )
    })
    const pageCast = cast.filter(entry => scene.originScenes.includes(entry.page))
    const unused = pageCast.filter(entry => !plan.objects.some(object => object.asset.ref && object.asset.ref === entry.libraryKey))
    return h('div', {},
      items.length ? h('ul', { class: 'review-cast' }, ...items) : h('p', { class: 'review-muted', text: 'The plan casts no objects: speech, text or the camera carry it.' }),
      unused.length ? h('p', { class: 'review-muted', text: `From the page but not used: ${unused.map(entry => entry.label).join(', ')}.` }) : null,
    )
  }

  // The scene's moments as a compact list, a line each, with the selected
  // one opened under its own line (F6 of the Perplexity review): the whole
  // sequence scans at a glance, and only the moment being compared with the
  // stage is read.
  const pickMoment = (scene: Scene, plan: SceneTreatmentV1, id: string) => {
    const state = uiOf(scene.id)
    // What had the keyboard: the stage's redraw takes focus, so it is put
    // back once the stage and the review are drawn again.
    const focused = document.activeElement instanceof HTMLElement && document.activeElement.closest('.scene-review') ? document.activeElement.getAttribute('data-focus') || '' : ''
    state.moment = id
    const moment = plan.moments.find(entry => entry.id === id)
    // On the sketch of this very revision, the stage goes to the moment.
    const ready = previewFor(scene, shownRecord(scene))
    const at = moment && ready ? ready.summary.moments.find(entry => entry.id === moment.id)?.start ?? null : null
    // And on the scene produced from this very revision.
    const produced = producedFor(scene, shownRecord(scene))
    const producedAt = moment && produced ? produced.summary.moments.find(entry => entry.id === moment.id)?.start ?? null : null
    host.selectMoment(scene.id, moment ? targetsOf(scene, plan, moment) : null, at, producedAt)
    host.refresh()
    // The review is drawn again as the editor updates, so the keyboard goes
    // back at once — not on a frame a hidden window may not paint. A step at
    // either end is disabled there: the moment's own line keeps it then.
    const keep = () => focused && document.activeElement?.getAttribute('data-focus') !== focused && !refocus(focused) && refocus(`moment:${scene.id}:${id}`)
    keep()
    window.requestAnimationFrame(() => {
      keep()
      // The opened moment in view, scrolling only when it is not.
      if (id) document.querySelector(`.scene-review [data-review-moment="${CSS.escape(id)}"]`)?.scrollIntoView({ block: 'nearest', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
    })
  }
  const momentsOf = (scene: Scene, plan: SceneTreatmentV1) => {
    const state = uiOf(scene.id)
    const list = h('ol', { class: 'review-moments' })
    plan.moments.forEach((moment, index) => {
      const selected = state.moment === moment.id
      const head = h('button', { type: 'button', class: 'review-moment-head', 'data-focus': `moment:${scene.id}:${moment.id}`, 'aria-expanded': selected ? 'true' : 'false' },
        h('span', { class: 'review-moment-number', text: String(index + 1) }),
        h('strong', { text: moment.title }),
        moment.estimateSeconds ? h('small', { text: `≈${moment.estimateSeconds}s` }) : null,
      )
      head.addEventListener('click', () => pickMoment(scene, plan, selected ? '' : moment.id))
      list.append(h('li', { class: `review-moment${selected ? ' is-selected' : ''}` }, head, selected ? momentDetail(scene, plan, index) : null))
    })
    return list
  }
  // The opened moment: why it is there, what changes on screen and what is
  // said — the things to hold against the stage — and a step to its
  // neighbours.
  const momentDetail = (scene: Scene, plan: SceneTreatmentV1, index: number) => {
    const moment = plan.moments[index]
    const step = (to: number, text: string, key: string) => {
      const button = h('button', { type: 'button', class: 'review-moment-step', 'data-focus': `${key}:${scene.id}`, text, ...(to < 0 || to >= plan.moments.length ? { disabled: true } : {}) })
      button.addEventListener('click', () => pickMoment(scene, plan, plan.moments[to].id))
      return button
    }
    const field = (label: string, text: string | null | undefined) => (text ? [h('dt', { text: label }), h('dd', { text: readable(text) })] : [])
    const chips = [
      moment.presenter ? chip(`presenter ${moment.presenter.visibility}`) : null,
      moment.text ? chip(`text: ${moment.text.content}`) : null,
      moment.camera ? chip(`camera ${moment.camera.treatment}`) : null,
    ].filter(Boolean) as HTMLElement[]
    return h('div', { class: 'review-moment-detail', 'data-review-moment': moment.id, role: 'region', 'aria-label': `Moment ${index + 1} of ${plan.moments.length}: ${moment.title}` },
      h('dl', { class: 'review-moment-fields' },
        ...field('Purpose', moment.purpose),
        ...field('On screen', moment.objects?.change || moment.observation),
        ...field('Narration', moment.narration ? moment.narration.guide || moment.narration.job : ''),
        ...field('Attention', moment.attention),
      ),
      h('div', { class: 'review-moment-foot' },
        chips.length ? h('div', { class: 'review-chips' }, ...chips) : h('span'),
        h('span', { class: 'review-moment-steps' }, step(index - 1, '‹ Previous', 'moment-previous'), step(index + 1, 'Next ›', 'moment-next')),
      ),
    )
  }

  // What an earlier take still covers, and what to re-record: by line where
  // the take kept its lines, otherwise the whole.
  const takeNote = (take: NonNullable<ReturnType<SceneReviewHost['takeOf']>>) => {
    const of = `Your current take was spoken against an earlier script${take.revision ? ` (plan r${take.revision})` : ''}. It is kept`
    if (take.changed?.length) {
      return h('div', { class: 'review-warn review-take-lines' },
        h('p', { text: `${of}, and still covers the other lines. Re-record ${take.changed.length === 1 ? 'this line' : `these ${take.changed.length} lines`}, or align the take there:` }),
        h('ol', {}, ...take.changed.map(line => h('li', { text: line }))),
      )
    }
    if (take.dropped) return h('p', { class: 'review-warn', text: `${of}. The script has since lost ${take.dropped} of its lines: align the take, or re-record the scene.` })
    return h('p', { class: 'review-warn', text: `${of}; re-record the scene, or align the take, where the words changed.` })
  }

  const guideOf = (scene: Scene, plan: SceneTreatmentV1, planRecord: PlanningRecord) => {
    const guide = recordingGuide({ plan, script: host.script(scene.id), wordingPolicy: host.wordingPolicy(), delivery: scene.delivery })
    // The teleprompter, rehearsal and take read the scene's script: until it
    // says what this plan says, recording would be against other words.
    const older = guide.source === 'plan' && !guide.matchesScript
    const record = h('button', { type: 'button', class: 'button ghost', text: 'Rehearse or record this scene', 'data-focus': `record:${scene.id}`, ...(older ? { disabled: true, title: `Use plan r${planRecord.revision}'s lines first, so the teleprompter shows what the plan says` } : {}) })
    record.addEventListener('click', () => host.record(scene.id))
    const take = host.takeOf(scene.id)
    const lineLabel = guide.wording === 'approved' ? 'approved wording — keep it' : 'draft wording — you may say it your way'
    const change = older
      ? (() => {
          const apply = h('button', { type: 'button', class: 'button secondary', 'data-focus': `use-plan-script:${scene.id}`, text: `Use plan r${planRecord.revision}'s lines as the scene's script` })
          apply.addEventListener('click', () => {
            host.applyScript(scene.id, guide.planScript, { treatment: planRecord.id, revision: planRecord.revision })
            host.refresh()
            // The keyboard goes on to what comes next, recording: never to
            // whatever the redrawn review happens to put first.
            window.requestAnimationFrame(() => {
              if (!refocus(`record:${scene.id}`)) (document.activeElement as HTMLElement | null)?.blur?.()
            })
          })
          return h('div', { class: 'review-script-change' },
            h('p', { class: 'review-warn', text: `The notebook's script for this scene is older than plan r${planRecord.revision}: ${guide.scriptLines.length} line${guide.scriptLines.length === 1 ? '' : 's'}, in another order or wording. The teleprompter, rehearsal and your take use the notebook's script.` }),
            guide.scriptLines.length ? h('details', { class: 'review-script-older' }, h('summary', { text: 'The notebook\'s script now' }), h('ol', {}, ...guide.scriptLines.map(line => h('li', { text: line })))) : null,
            apply,
          )
        })()
      : null
    return h('div', { class: 'review-guide' },
      h('p', {}, h('strong', { text: 'What it is for. ' }), guide.purpose),
      h('p', { class: 'review-muted', text: guide.note }),
      take && take.known && !take.current ? takeNote(take) : null,
      guide.lines.length
        ? h('div', {}, h('h6', { text: `Lines to record — ${guide.source === 'plan' ? `plan r${planRecord.revision}'s narration, in its order` : 'the notebook\'s script'} (${lineLabel})` }), h('ol', { class: 'review-guide-lines' }, ...guide.lines.map(line => {
          // A line the current take was not spoken against: only these need
          // re-recording (R4).
          const changed = Boolean(take && !take.current && take.changed?.includes(line.text))
          return h('li', { class: changed ? 'is-changed' : '', text: line.text }, changed ? h('span', { class: 'review-line-flag', text: 'changed since your take' }) : null)
        })))
        : h('p', { class: 'review-muted', text: 'The scene has no words yet.' }),
      change,
      h('h6', { text: 'Where you are, moment by moment' }),
      h('ol', {}, ...guide.steps.map(step => h('li', {}, h('strong', { text: `${step.title}: ` }), step.instruction))),
      guide.sections.length > 1 ? h('p', { class: 'review-muted', text: `Record it whole, or in sections: ${guide.sections.map(section => section.label).join(' · ')}` }) : null,
      guide.framing.length ? h('ul', { class: 'review-muted' }, ...guide.framing.map(line => h('li', { text: line }))) : null,
      h('ul', { class: 'review-muted' }, ...guide.delivery.map(line => h('li', { text: line }))),
      guide.voice === 'generated' || guide.voice === 'silent' ? null : record,
    )
  }

  const compareOf = (scene: Scene, plan: SceneTreatmentV1, record: PlanningRecord) => {
    const state = uiOf(scene.id)
    const others = recordsOf(scene.id).filter(entry => entry.content && entry.id !== record.id)
    if (!others.length) return h('p', { class: 'review-muted', text: 'There is no other revision to compare with yet.' })
    const picker = h('select', { 'aria-label': 'Compare with revision', 'data-focus': `compare:${scene.id}` })
    picker.append(h('option', { value: '', text: 'Choose a revision…' }))
    for (const other of others) {
      const option = h('option', { value: other.id, text: `r${other.revision} · ${other.status === 'reviewed' ? 'approved' : other.status}` })
      if (other.id === state.compare) option.selected = true
      picker.append(option)
    }
    picker.addEventListener('change', () => {
      state.compare = picker.value
      host.refresh()
    })
    const other = others.find(entry => entry.id === state.compare)
    const body = h('div', {}, h('label', { class: 'review-field' }, `Compare r${record.revision} with `, picker))
    if (other) {
      const differences = compareTreatments(other.content as SceneTreatmentV1, plan)
      if (!differences.length) body.append(h('p', { class: 'review-muted', text: 'The two revisions plan the same thing.' }))
      const groups = new Map<string, typeof differences>()
      for (const difference of differences) groups.set(difference.category, [...(groups.get(difference.category) || []), difference])
      for (const [category, items] of groups) {
        body.append(h('h6', { text: DIFFERENCE_LABELS[category as keyof typeof DIFFERENCE_LABELS] }),
          h('ul', { class: 'review-diff' }, ...items.map(item => h('li', { class: `is-${item.change}` },
            h('strong', { text: `${item.change === 'added' ? 'Added' : item.change === 'removed' ? 'Removed' : 'Changed'}: ${item.label}` }),
            item.before ? h('span', { class: 'review-before', text: ` r${other.revision}: ${item.before}` }) : null,
            item.after ? h('span', { class: 'review-after', text: ` r${record.revision}: ${item.after}` }) : null,
          ))))
      }
    }
    return body
  }

  // Production (P4): the scene made from its approved plan on its real
  // clock, by the creator's "Scene production" harness — only when asked —
  // then watched on the stage and accepted as the scene's output.
  let accepting = ''
  const produce = (scene: Scene, again: boolean, note = '') =>
    run('produce the scene', async () => {
      const projectId = host.projectId()
      if (!projectId) return
      const { reused, record } = await produceScene(host.fetchJson, projectId, scene.id, { again, ...(note ? { note } : {}) })
      if (reused && (record.status === 'ready' || record.status === 'reviewed')) host.showProduction(scene.id)
      else host.toast(`Producing ${scene.title || 'the scene'} from its approved plan — its clock is made first, then your harness builds the scene`)
    })
  const accept = (scene: Scene, production: SceneProductionView) => {
    if (accepting) return
    accepting = production.id
    host.refresh()
    void (async () => {
      try {
        await acceptProduction(host.fetchJson, production.id)
        // The accepted view carries the render the notebook plays.
        await load()
        const accepted = sceneOf(scene.id)?.production?.accepted
        if (!accepted || accepted.id !== production.id || !accepted.accepted) throw new Error('The scene was accepted, but its render is not listed yet — reload the video to use it')
        await host.adoptProduction(scene.id, accepted)
        host.toast('Accepted: the notebook now plays and exports this scene as produced')
      } catch (failure) {
        host.toast(failure instanceof Error ? failure.message : 'Could not accept the produced scene')
      } finally {
        accepting = ''
        await load()
        host.refresh()
      }
    })()
  }
  // The notebook's use of an accepted production is the creator's to change.
  let using = ''
  const useInNotebook = (scene: Scene, accepted: SceneProductionView | null) => {
    if (using) return
    using = scene.id
    host.refresh()
    void (async () => {
      try {
        if (accepted) {
          await host.adoptProduction(scene.id, accepted)
          host.toast('The notebook plays and exports this scene as produced again')
        } else {
          await host.releaseProduction(scene.id)
          host.toast('The notebook plays its own scene again — your takes where you present it. The accepted production is kept.')
        }
      } catch (failure) {
        host.toast(failure instanceof Error ? failure.message : 'Could not change what the notebook plays')
      } finally {
        using = ''
        host.refresh()
      }
    })()
  }
  // Timing edits (P6): the creator nudges when an action starts inside its
  // moment, through the controls the production's code reads. Each change is
  // saved as an edit revision; undo and redo walk this session's history.
  const editHistory = new Map<string, { past: Array<Record<string, number>>; future: Array<Record<string, number>> }>()
  let savingEdit = ''
  const historyOf = (id: string) => {
    let history = editHistory.get(id)
    if (!history) editHistory.set(id, (history = { past: [], future: [] }))
    return history
  }
  const saveEdit = (scene: Scene, production: SceneProductionView, values: Record<string, number>, step: 'edit' | 'undo' | 'redo', at: number | null) => {
    if (savingEdit) return
    savingEdit = production.id
    const before = { ...production.edits.values }
    void (async () => {
      try {
        const { edits } = await saveProductionEdits(host.fetchJson, production.id, production.edits.revision, values)
        const history = historyOf(production.id)
        if (step === 'edit') {
          history.past.push(before)
          history.future = []
        } else if (step === 'undo') history.future.push(before)
        else history.past.push(before)
        await load()
        host.showProduction(scene.id, at ?? undefined)
        host.toast(`${step === 'undo' ? 'Undone' : step === 'redo' ? 'Redone' : 'Saved'} as edit ${edits.revision}: the stage plays it${production.accepted ? '; accept again to put it in the output' : ''}`)
      } catch (failure) {
        host.toast(failure instanceof Error ? failure.message : 'The edit could not be saved')
        await load()
      } finally {
        savingEdit = ''
        host.refresh()
      }
    })()
  }
  const timingOf = (scene: Scene, production: SceneProductionView) => {
    const controls = production.summary.controls
    const plan = scene.view.reviewed?.content as SceneTreatmentV1 | undefined
    const box = h('div', { class: 'review-timing', 'data-review-timing': production.id })
    const edited = production.edits.revision
    box.append(h('p', {}, h('strong', { text: 'Timing' }), controls.length ? ` — nudge when an action starts inside its moment${edited ? ` · edit ${edited}` : ''}` : ' — this production exposes nothing to nudge. Ask for the change below, and the scene is produced again with it.'))
    if (!controls.length) return box
    const history = historyOf(production.id)
    const values = { ...production.edits.values }
    const valueOf = (id: string, fallback: number) => (typeof values[id] === 'number' ? values[id] : fallback)
    const momentOf = (id: string) => production.summary.moments.find(moment => moment.id === id)
    const list = h('ul', { class: 'review-timing-list' })
    for (const control of controls) {
      const moment = momentOf(control.moment)
      const title = moment?.title || plan?.moments.find(entry => entry.id === control.moment)?.title || control.moment
      const input = h('input', { type: 'number', step: '0.05', min: String(control.min), max: String(control.max), value: String(valueOf(control.id, control.default)), 'aria-label': `${control.label}, seconds after “${title}” starts`, 'data-focus': `control:${production.id}:${control.id}`, ...(savingEdit ? { disabled: true } : {}) })
      let timer = 0
      const commit = () => {
        window.clearTimeout(timer)
        const next = Math.round(Number(input.value) * 1000) / 1000
        if (!Number.isFinite(next) || next === valueOf(control.id, control.default)) return
        if (next < control.min || next > control.max) {
          host.toast(`${control.label} stays between ${control.min}s and ${control.max}s: outside that it would leave its moment`)
          input.value = String(valueOf(control.id, control.default))
          return
        }
        saveEdit(scene, production, { ...values, [control.id]: next }, 'edit', moment ? moment.start : null)
      }
      input.addEventListener('input', () => {
        window.clearTimeout(timer)
        timer = window.setTimeout(commit, 700)
      })
      input.addEventListener('change', commit)
      input.addEventListener('keydown', event => {
        if (event.key === 'Enter') commit()
      })
      const changed = typeof values[control.id] === 'number' && values[control.id] !== control.default
      const reset = h('button', { type: 'button', class: 'link-button', 'data-focus': `reset-control:${production.id}:${control.id}`, text: `Reset to ${control.default}s`, ...(changed && !savingEdit ? {} : { disabled: true }) })
      reset.addEventListener('click', () => {
        const next = { ...values }
        delete next[control.id]
        saveEdit(scene, production, next, 'edit', moment ? moment.start : null)
      })
      list.append(h('li', { 'data-control': control.id }, h('span', { class: 'review-timing-label' }, h('strong', { text: control.label }), ` in “${title}”`), input, h('span', { class: 'review-muted', text: `s after it starts (${control.min}–${control.max}s)` }), reset))
    }
    box.append(list)
    const tools = h('div', { class: 'review-actions' })
    const undo = h('button', { type: 'button', class: 'button ghost', 'data-focus': `undo-edit:${scene.id}`, text: 'Undo', title: 'Undo the last timing edit (⌘Z)', ...(history.past.length && !savingEdit ? {} : { disabled: true }) })
    const redo = h('button', { type: 'button', class: 'button ghost', 'data-focus': `redo-edit:${scene.id}`, text: 'Redo', title: 'Redo (⇧⌘Z)', ...(history.future.length && !savingEdit ? {} : { disabled: true }) })
    const stepBack = () => {
      const previous = history.past.pop()
      if (previous) saveEdit(scene, production, previous, 'undo', null)
    }
    const stepForward = () => {
      const next = history.future.pop()
      if (next) saveEdit(scene, production, next, 'redo', null)
    }
    undo.addEventListener('click', stepBack)
    redo.addEventListener('click', stepForward)
    box.addEventListener('keydown', event => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'z' || savingEdit) return
      event.preventDefault()
      if (event.shiftKey) stepForward()
      else stepBack()
    })
    tools.append(undo, redo)
    // An accepted production is rendered again to take newer edits.
    if (production.accepted && production.accepted.edits !== edited && production.current) {
      const again = h('button', { type: 'button', class: 'button primary', 'data-focus': `accept-edits:${scene.id}`, text: accepting === production.id ? 'Rendering your edits…' : 'Accept with your edits', ...(accepting ? { disabled: true } : {}) })
      again.addEventListener('click', () => accept(scene, production))
      tools.append(again)
    }
    box.append(tools)
    if (production.accepted && production.accepted.edits !== edited) box.append(h('p', { class: 'review-warn', 'data-review-edits': 'unrendered', text: `The stage plays edit ${edited}; the output was rendered with ${production.accepted.edits ? `edit ${production.accepted.edits}` : 'no edits'}. Accept again to render your edits into it.` }))
    const carried = production.edits.carried
    if (carried && (carried.applied.length || carried.conflicts.length)) {
      box.append(h('div', { class: carried.conflicts.length ? 'review-warn' : 'review-muted', 'data-review-carried': production.id },
        carried.applied.length ? h('p', { text: `Carried from the scene's previous production: ${carried.applied.map(id => controls.find(control => control.id === id)?.label || id).join(', ')}.` }) : null,
        carried.conflicts.length ? h('p', { text: 'Not carried, because they no longer fit:' }) : null,
        carried.conflicts.length ? h('ul', {}, ...carried.conflicts.map(conflict => h('li', { text: `${conflict.value}s — ${conflict.reason}` }))) : null,
      ))
    }
    return box
  }
  // A change the controls cannot make goes back to the producer, as a note
  // with a new production of the same approved plan.
  const askFor = (scene: Scene) => {
    const box = h('div', { class: 'review-ask' })
    const field = h('textarea', { rows: '2', placeholder: 'What should change — for example, “hold on the full bucket before the request is refused”', 'aria-label': 'The change to ask for', 'data-focus': `ask-change:${scene.id}` })
    const send = h('button', { type: 'button', class: 'button ghost', 'data-focus': `ask-produce:${scene.id}`, text: 'Produce again with this change' })
    send.addEventListener('click', () => {
      const note = field.value.trim()
      if (!note) {
        host.toast('Say what should change first')
        return
      }
      void produce(scene, true, note)
    })
    box.append(field, send)
    return box
  }

  const productionOf = (scene: Scene) => {
    const approved = scene.view.reviewed
    const production = scene.production
    const desktop = Boolean(window.studioDesktop?.isDesktop)
    const box = h('div', { class: 'review-production', 'data-review-production': scene.id })
    const planned = approved?.content as SceneTreatmentV1 | undefined
    if (!approved) {
      box.append(h('p', { class: 'review-muted', text: 'A scene is produced from its approved plan: approve a plan first. Approving starts nothing.' }))
      return box
    }
    // What production waits for, before it can start: a fresh approved plan,
    // and what the product needs to set its clock (a delivery; for a scene
    // you present, your take of the plan's lines).
    const waits = [
      scene.view.state === 'stale' && scene.view.current?.id === approved.id ? `The approved plan r${approved.revision} is stale — plan and approve the scene again.` : '',
      scene.productionWaits || '',
    ].filter(Boolean)
    const latest = production?.latest
    const ready = production?.ready
    const accepted = production?.accepted
    if (latest && isActiveStatus(latest.status)) {
      box.append(h('p', { class: 'review-busy', 'data-review-progress': latest.id, text: progress.get(latest.id) || (latest.status === 'verifying' ? 'Playing the produced scene in the pinned player to check it…' : `Producing the scene from r${approved.revision} with your local harness…`) }))
    } else if (latest?.status === 'failed') {
      box.append(h('p', { class: 'review-error', text: `The production failed: ${latest.error?.message || 'no reason given'}${accepted ? ' — the accepted output is unchanged' : ''}.` }))
    }
    const shown = ready || accepted
    if (shown) {
      const clock = shown.summary.clock === 'generated-voice' ? `a generated voice (${shown.voice || 'system voice'})` : shown.summary.clock === 'take' ? 'your take' : 'silence, by choice'
      box.append(
        ...([
          h('p', {}, h('strong', { text: `Produced from r${shown.of.revision}` }), ` · ${shown.summary.duration}s on ${clock} · ${shown.checked ? 'played and checked' : 'never checked'}${shown.accepted ? ` · accepted ${new Date(shown.accepted.at).toLocaleString()}` : ''}`),
          !shown.current ? h('p', { class: 'review-warn', text: `Out of date: ${shown.staleBecause}. Produce the scene again to realize the plan as it is now${shown.accepted ? '; the accepted output plays until then' : ''}.` }) : null,
          shown.summary.unmet.length ? h('div', { class: 'review-warn' }, h('p', { text: 'What the approved plan asked for and this production could not meet:' }), h('ul', {}, ...shown.summary.unmet.map(item => h('li', { text: item })))) : null,
          shown.clockReview.length ? h('div', { class: 'review-muted', 'data-review-clock': shown.id }, h('p', { text: 'On your take:' }), h('ul', {}, ...shown.clockReview.map(item => h('li', { text: item })))) : null,
        ].filter(Boolean) as HTMLElement[]),
      )
    }
    // Whether the notebook plays the accepted production, and the switch.
    const inNotebook = host.producedIn(scene.id)
    if (accepted?.accepted) {
      const plays = inNotebook === accepted.id
      box.append(h('p', { class: plays ? 'review-muted' : 'review-warn', 'data-review-output': plays ? 'plays' : 'kept' }, plays
        ? `The notebook plays and exports the accepted production of r${accepted.of.revision} for this scene${accepted.current ? '' : ', until it is produced again'}.`
        : `The production of r${accepted.of.revision} is accepted, but the notebook plays its own scene here.`))
    } else if (inNotebook) {
      box.append(h('p', { class: 'review-warn', 'data-review-output': 'unlisted', text: 'The notebook plays a production that is no longer listed for this scene.' }))
    }
    const actions = h('div', { class: 'review-actions' })
    if (shown) {
      const play = h('button', { type: 'button', class: 'button ghost', 'data-focus': `show-production:${scene.id}`, text: 'Play it on the stage' })
      play.addEventListener('click', () => host.showProduction(scene.id))
      actions.append(play)
    }
    if (accepted?.accepted || inNotebook) {
      const plays = Boolean(accepted && inNotebook === accepted.id)
      const toggle = h('button', { type: 'button', class: 'button ghost', 'data-focus': `use-production:${scene.id}`, text: using === scene.id ? 'Changing…' : plays || !accepted ? 'Play the notebook\'s own scene' : 'Play the accepted production', ...(using ? { disabled: true } : {}) })
      toggle.addEventListener('click', () => useInNotebook(scene, plays || !accepted ? null : accepted))
      actions.append(toggle)
    }
    if (ready && ready.current && !ready.accepted) {
      const acceptButton = h('button', { type: 'button', class: 'button primary', 'data-focus': `accept-production:${scene.id}`, text: accepting === ready.id ? 'Rendering the accepted scene…' : 'Accept as the scene\'s output', ...(accepting ? { disabled: true } : {}) })
      acceptButton.addEventListener('click', () => accept(scene, ready))
      actions.append(acceptButton)
    }
    const running = Boolean(latest && isActiveStatus(latest.status))
    const again = Boolean(shown)
    const produceButton = h('button', {
      type: 'button',
      class: again ? 'button ghost' : 'button primary',
      'data-focus': `produce:${scene.id}`,
      text: running ? 'Producing…' : again ? 'Produce again' : `Produce scene from r${approved.revision}`,
      ...(running || waits.length || !desktop ? { disabled: true } : {}),
      ...(desktop ? {} : { title: 'Production runs in the desktop app' }),
    })
    produceButton.addEventListener('click', () => void produce(scene, again))
    actions.append(produceButton)
    box.append(actions)
    if (shown && shown.current) box.append(timingOf(scene, shown), disclosure(`ask:${scene.id}`, 'Ask for a different change', askFor(scene)))
    if (waits.length) box.append(h('ul', { class: 'review-muted' }, ...waits.map(line => h('li', { text: line }))))
    const rich = (planned?.objects || []).filter(object => ['enrich', 'generate'].includes(object.asset.status))
    if (rich.length && !shown) box.append(h('p', { class: 'review-muted', text: `The plan asks for richer artwork of ${rich.map(object => object.entity).join(', ')}: the production draws it from the cast, or names it as unmet — nothing stands in for it.` }))
    box.append(h('p', { class: 'review-muted', text: 'Build whole notebook, under Advanced, is the older build: it works from the notebook\'s scripts and pages, and does not use approved plans.' }))
    return box
  }

  // The plan preview: what the sketch shows, what is provisional, and its
  // timeline — read-only, from the manifest the sketch declared.
  const previewSection = (scene: Scene, record: PlanningRecord): HTMLElement[] => {
    const preview = scene.preview
    const state = previewStateOf(scene, record)
    if (state.state === 'building') return [h('p', { class: 'review-busy', 'data-review-progress': preview!.latest.id, text: state.checking ? `Playing the sketch of r${record.revision} in the pinned player to check it…` : progress.get(preview!.latest.id) || `Sketching a rough preview of r${record.revision} with your local harness…` })]
    const items: HTMLElement[] = []
    const ready = previewFor(scene, record)
    if (state.state === 'failed') items.push(h('p', { class: 'review-error', text: `The preview of r${record.revision} could not be built: ${preview!.latest.error?.message || 'no reason given'}${ready ? ' — its earlier preview stays' : ''}.` }))
    if (!ready) {
      // No sketch of this revision: say so, and never lend it another's.
      const others = Object.values(preview?.byTreatment || {}).filter(view => view.of.record !== record.id).sort((a, b) => b.of.revision - a.of.revision)
      // A revision produced without a sketch plays as produced on the stage.
      const where = producedFor(scene, record) ? 'it was produced without one' : 'the stage shows its page'
      const note = h('p', { class: 'review-muted review-no-preview', text: `No preview of r${record.revision} yet — ${where}.${others.length ? ` Sketches exist for ${others.map(view => `r${view.of.revision}`).join(', ')}.` : ''}` })
      if (others.length) {
        const other = others[0]
        const go = h('button', { type: 'button', class: 'link-button', 'data-focus': `show-revision:${other.of.record}`, text: `Show r${other.of.revision} and its preview` })
        go.addEventListener('click', () => {
          const state = uiOf(scene.id)
          state.revision = other.of.record
          state.moment = ''
          host.selectMoment(scene.id, null, null, null)
          host.refresh()
        })
        note.append(' ', go)
      }
      items.push(note)
      return items
    }
    const show = h('button', { type: 'button', class: 'button ghost', text: 'Play it on the stage', 'data-focus': `show-preview:${scene.id}` })
    show.addEventListener('click', () => host.showPreview(scene.id))
    items.push(h('div', { class: `review-preview${ready.current ? '' : ' is-stale'}` },
      h('div', { class: 'review-preview-head' },
        h('h4', { text: `Plan preview — a rough sketch of r${ready.of.revision}` }),
        show,
      ),
      !ready.current ? h('p', { class: 'review-warn', text: `Out of date: ${readable(ready.staleBecause || 'the scene\'s plan has changed since this sketch')}. Sketch it again to see what the plan shows now.` }) : null,
      h('p', { class: 'review-muted review-preview-summary', text: `${ready.summary.duration}s · ${ready.summary.moments.length} moments · ${ready.checked ? 'played and checked' : 'never checked in the player'} · rough: ${previewFlags(ready).join(' · ')} — what it cannot show yet is under Preview details.` }),
    ))
    return items
  }
  // What a sketch cannot show yet, in brief.
  const previewFlags = (ready: ScenePreviewView) => [
    ready.summary.provisional.some(item => /tim/i.test(item)) ? 'timing estimated' : '',
    'draft artwork',
    ready.summary.layers.some(layer => layer.kind === 'presenter' && layer.placeholder) ? 'presenter stand-in' : '',
    ready.summary.layers.some(layer => layer.kind !== 'presenter' && layer.placeholder) ? 'placeholders' : '',
  ].filter(Boolean)
  // The sketch's own account, and which moments each layer takes part in.
  const previewDetails = (scene: Scene, record: PlanningRecord) => {
    const ready = previewFor(scene, record)
    if (!ready) return null
    const total = ready.summary.duration || 1
    const lanes = h('div', { class: 'review-timeline', role: 'table', 'aria-label': 'Moment map (read-only)' },
      h('div', { class: 'review-timeline-row is-moments', role: 'row' },
        h('span', { class: 'review-timeline-label', text: 'Moments' }),
        h('span', { class: 'review-timeline-track' }, ...ready.summary.moments.map(moment => h('span', { class: 'review-timeline-clip is-moment', style: `left:${(moment.start / total) * 100}%;width:${((moment.end - moment.start) / total) * 100}%`, title: `${moment.title}: ${moment.start}–${moment.end}s (estimated)`, text: moment.title }))),
      ),
      ...ready.summary.layers.map(layer => {
        const spans = ready.summary.moments.filter(moment => layer.moments.includes(moment.id))
        return h('div', { class: 'review-timeline-row', role: 'row' },
          h('span', { class: 'review-timeline-label', text: `${layer.label}` , title: `${layer.kind}${layer.reuses ? ' · reuses the cast' : ''}${layer.placeholder ? ` · ${layer.placeholder}` : ''}` }),
          h('span', { class: 'review-timeline-track' }, ...spans.map(moment => h('span', { class: `review-timeline-clip is-${layer.kind}${layer.placeholder ? ' is-placeholder' : ''}`, style: `left:${(moment.start / total) * 100}%;width:${((moment.end - moment.start) / total) * 100}%` }))),
        )
      }),
    )
    return disclosure(`preview-details:${scene.id}`, `Preview details and moment map (r${ready.of.revision})`, h('div', { class: 'review-preview-details' },
      h('p', { class: 'review-muted', text: `${ready.summary.duration}s · ${ready.summary.moments.length} moments · ${ready.summary.layers.length} layers${ready.adapter ? ` · sketched by ${ready.adapter}${ready.model ? ` ${ready.model}` : ''}` : ''}` }),
      h('h6', { text: 'How it was checked' }),
      h('p', { class: 'review-muted review-checked', text: ready.checked
        ? `Played in the pinned Hyperframes ${ready.checked.runtime} player (${new Date(ready.checked.at).toLocaleString()}): ${ready.checked.tweens} tweens over ${ready.checked.duration}s; all ${ready.checked.files} files it asked for were in the sketch; ${ready.checked.reseeks} moments sought again showed the same frame; ${ready.checked.layers} layers each showed in their moments; ${ready.checked.changes} planned changes visible on screen.`
        : 'Never played to check it: this sketch was accepted before the product played sketches in the player. Sketch it again for a checked one.' }),
      ...(ready.summary.schedule ? [
        h('h6', { text: 'Its clock' }),
        h('p', { class: 'review-muted review-clock', text: [
          `${ready.summary.schedule.events} counted changes, replayed against the plan's count`,
          ...ready.summary.schedule.rules.map(rule => `${rule.id}: ${rule.change === 'add' ? '+' : '−'}${rule.amount} every ${rule.every}s from ${rule.from}s, whenever there is ${rule.change === 'add' ? 'room' : 'supply'}`),
          ...ready.summary.schedule.pauses.map(pause => `held ${pause.start}–${pause.end}s (${pause.note})`),
        ].join(' · ') }),
      ] : []),
      h('h6', { text: 'What the sketch cannot show yet' }),
      h('ul', { class: 'review-provisional' }, ...ready.summary.provisional.map(item => h('li', { text: readable(item) }))),
      h('h6', { text: 'Moment map' }),
      h('p', { class: 'review-muted', text: 'Which moments each layer takes part in. It is read-only and estimated — not the composition\'s timeline; editing timing arrives with production.' }),
      lanes,
    ))
  }

  // The base designed this scene's page after the video was made (F1): it
  // is offered — compared on the stage, and taken only when the creator
  // says so. Taking it keeps the scene's recordings and earlier plans; its
  // plans and sketches made from the old page read as out of date.
  let adopting = ''
  const referenceNotice = (scene: Scene) => {
    const reference = scene.reference
    const newer = reference?.newer
    if (!reference || (!newer && !reference.baseDesigning)) return null
    if (!newer || newer.designing || !newer.svg) {
      return h('p', { class: 'review-muted review-reference', 'data-review-reference': 'designing', text: `The base is still designing this scene's slide. When it lands you can compare it here and adopt it; this scene keeps its ${PAGE_KIND[reference.kind] || 'page'} until you do.` })
    }
    const kind = PAGE_KIND[newer.kind] || 'page'
    const compare = h('button', { type: 'button', class: 'button ghost', 'data-focus': `compare-reference:${scene.id}`, text: 'Compare on the stage' })
    compare.addEventListener('click', () => host.showBaseReference(scene.id))
    const adopt = h('button', { type: 'button', class: 'button primary', 'data-focus': `adopt-reference:${scene.id}`, text: `Use this ${newer.kind === 'designed' ? 'designed reference' : 'page'}`, ...(adopting === scene.id ? { disabled: true } : {}) })
    adopt.addEventListener('click', async () => {
      adopting = scene.id
      host.refresh()
      try {
        await host.adoptReference(scene.id)
      } finally {
        adopting = ''
        host.refresh()
      }
    })
    const planned = Boolean(scene.view.current || scene.view.reviewed)
    return h(
      'div',
      { class: 'review-reference', 'data-review-reference': 'newer' },
      h('p', {}, h('strong', { text: `The base has a newer ${kind} for this scene${newer.by ? `, by ${newer.by}` : ''}. ` }), `This video was made from its ${PAGE_KIND[reference.kind] || 'page'} (revision ${reference.revision.slice(0, 8)}; the base's is ${newer.revision.slice(0, 8)}).`),
      h('p', { class: 'review-muted', text: `Using it gives this scene that page and its artwork for planning.${planned ? ' Its plans and sketches made from the old page read as out of date; they are kept.' : ''} Recordings and the other scenes are not touched.` }),
      h('div', { class: 'review-actions' }, compare, adopt),
    )
  }

  // The selected scene's review.
  const panel = (scene: Scene) => {
    const state = uiOf(scene.id)
    const view = scene.view
    const record = shownRecord(scene)
    const plan = record?.content as SceneTreatmentV1 | undefined
    const root = h('section', { class: 'review-panel', 'aria-label': `Review of ${scene.title}` })
    // Header: the plan shown, its state, and the scene's actions.
    const actions = h('div', { class: 'review-actions' })
    const canApprove = record?.status === 'candidate' && !(record.id === view.current?.id && view.staleBecause)
    const approveButton = h('button', { type: 'button', class: 'button primary', 'data-focus': `approve:${scene.id}`, text: !record ? 'Approve plan' : record.status === 'reviewed' ? (record.id === view.reviewed?.id ? `r${record.revision} approved ✓` : `r${record.revision} approved earlier`) : `Approve r${record.revision}`, ...(canApprove ? {} : { disabled: true }) })
    approveButton.addEventListener('click', () => record && void approve(record))
    const previewState = previewStateOf(scene, record)
    const previewOfShown = Boolean(previewFor(scene, record))
    const desktop = Boolean(window.studioDesktop?.isDesktop)
    const previewButton = h('button', { type: 'button', class: 'button secondary', 'data-focus': `preview:${scene.id}`, text: !record ? 'Preview plan' : previewState.state === 'building' ? `${previewState.checking ? 'Checking' : 'Building'} the preview of r${record.revision}…` : previewOfShown ? `Sketch r${record.revision} again` : `Preview r${record.revision}`, ...(record && previewState.state !== 'building' && desktop ? {} : { disabled: true }), ...(desktop ? {} : { title: 'Sketching runs in the desktop app' }) })
    previewButton.addEventListener('click', () => record && void preview(scene, record, previewOfShown))
    const workspace = h('button', { type: 'button', class: 'button ghost', text: 'Planning workspace', 'data-focus': `workspace:${scene.id}` })
    workspace.addEventListener('click', () => host.openWorkspace(scene.id, record?.id || '', state.moment))
    // One approval action, there only while the revision shown can be
    // approved: an approved revision says so in the revision control, not
    // again on a disabled button (F6 of the Perplexity review).
    actions.append(...(canApprove ? [approveButton] : []), previewButton, workspace)
    // The plan's one revision and status control: each revision with where
    // it stands, or, before any, the plan's state.
    const revisions = h('div', { class: 'review-revisions', role: 'group', 'aria-label': 'Plan revisions' }, h('span', { class: 'review-revisions-label', text: 'Plan' }))
    const entries = recordsOf(scene.id).filter(item => item.content)
    if (!entries.length) revisions.append(chip(PLANNING_STATE_LABELS[view.state], PLAN_TONES[view.state]))
    for (const entry of entries) {
      const status = entry.status === 'reviewed' ? (entry.id === view.reviewed?.id ? 'approved' : 'approved earlier') : entry.status
      const button = h('button', { type: 'button', class: `review-revision${entry.id === record?.id ? ' is-selected' : ''}${entry.status === 'reviewed' && entry.id === view.reviewed?.id ? ' is-approved' : ''}`, 'data-focus': `revision:${entry.id}`, 'aria-pressed': entry.id === record?.id ? 'true' : 'false', text: `r${entry.revision} ${status}${entry.id === view.current?.id && view.staleBecause ? ' · out of date' : ''}` })
      button.addEventListener('click', () => {
        state.revision = entry.id
        state.moment = ''
        host.selectMoment(scene.id, null, null, null)
        host.refresh()
      })
      revisions.append(button)
    }
    // One header for the scene (F7): its title, where it stands in one
    // line, then its plan revisions and what to do next.
    root.append(
      h('header', { class: 'review-head' },
        h('div', { class: 'review-head-main' }, h('span', { class: 'review-eyebrow', text: `Scene ${scene.index + 1} · review` }), h('h3', { text: scene.title || scene.id }), strip(scene, true)),
        h('div', { class: 'review-controls' }, revisions, actions),
      ),
    )
    if (error) root.append(h('p', { class: 'review-error', text: error }))
    if (!desktop) root.append(h('p', { class: 'review-muted review-host-note', text: BROWSER_REVIEW_MESSAGE }))
    const notice = referenceNotice(scene)
    if (notice) root.append(notice)
    // Where the plan stands.
    if (view.latest && isActiveStatus(view.latest.status)) {
      root.append(h('p', { class: 'review-busy', 'data-review-progress': view.latest.id, text: progress.get(view.latest.id) || `Planning revision ${view.latest.revision} with your local harness…` }))
    }
    if (view.latest?.status === 'failed') root.append(h('p', { class: 'review-error', text: `Revision ${view.latest.revision} failed: ${view.latest.error?.message || 'no reason given'}${view.reviewed ? ` — the approved plan (r${view.reviewed.revision}) is unchanged` : ''}` }))
    if (record && record.id === view.current?.id && view.staleBecause) root.append(h('p', { class: 'review-warn', text: `Stale — ${view.staleBecause}. Revise to plan from the current inputs.` }))
    if (!plan) {
      // Before a plan, what the scene's pages were made to teach.
      const objectives = (overview?.basePages || []).filter(page => scene.originScenes.includes(page.scene) && page.objective).map(page => page.objective)
      if (objectives.length) root.append(h('div', { class: 'review-objective' }, h('h4', { text: 'What it should teach' }), ...objectives.map(text => h('p', { class: 'review-question', text }))))
      root.append(h('p', { class: 'review-muted', text: view.state === 'needs-brief' ? 'The video\'s explanation brief comes first — prepare it in the planning workspace.' : view.state === 'preparing' ? 'The explanation brief is being prepared; this scene can be planned once it is ready.' : 'No plan yet. Add direction below if you want, then plan the scene.' }))
    } else {
      const ledger = plan.ledger
      root.append(
        h('div', { class: 'review-grid' },
          h('div', { class: 'review-column' },
            h('h4', { text: 'What it explains' }),
            h('p', { class: 'review-question', text: plan.question }),
            h('p', {}, h('strong', { text: 'Takeaway. ' }), plan.takeaway),
            plan.demonstration ? h('p', {}, h('strong', { text: 'Example. ' }), plan.demonstration.text) : null,
            ledger ? h('p', { class: 'review-muted', text: `The count: ${ledger.quantity} from ${ledger.initial} to ${ledger.final} over ${ledger.events.length} changes — checked.` }) : null,
          ),
          h('div', { class: 'review-column' },
            h('h4', { text: `Moments (${plan.moments.length})` }),
            momentsOf(scene, plan),
            plan.moments.some(moment => moment.id === state.moment) ? null : h('p', { class: 'review-muted review-moment-hint', text: 'Select a moment to read what it shows and says; the stage goes to it.' }),
          ),
        ),
      )
      if (record) root.append(...previewSection(scene, record))
      root.append(h('div', { class: 'review-objects' }, h('h4', { text: 'Objects and their artwork' }), castFor(plan, scene)))
      const open = [
        ...plan.unresolved.map(text => `Open: ${text}`),
        ...plan.requirements.decisions.map(text => `Decide: ${text}`),
        ...plan.requirements.assets.map(text => `Artwork: ${text}`),
        ...(record.report?.warnings || []).map(text => `Check: ${text}`),
        ...(scene.continuity || []).filter(seam => seam.state === 'proposed' || seam.state === 'broken').map(seam => `Seam (${seam.side === 'incoming' ? 'opening' : 'ending'}): ${seam.state}${seam.reason ? ` — ${seam.reason}` : ''}`),
      ]
      if (open.length) root.append(h('div', { class: 'review-open' }, h('h4', { text: 'Still to resolve' }), h('ul', {}, ...open.map(text => h('li', { text: readable(text) })))))
    }
    // Direction for the next candidate.
    const box = h('textarea', { rows: '2', 'data-focus': `direction:${scene.id}`, placeholder: 'Direction for the next candidate — what should change?', 'aria-label': 'Direction for this scene' })
    box.value = state.direction ?? scene.direction
    box.addEventListener('input', () => (state.direction = box.value))
    const reviseButton = h('button', { type: 'button', class: 'button secondary', 'data-focus': `revise:${scene.id}`, text: view.current ? 'Revise the plan' : 'Plan the scene', ...(view.state === 'planning' || !overview?.brief.current || overview.brief.stale || !overview.available || !desktop ? { disabled: true } : {}), ...(desktop ? {} : { title: 'Planning runs in the desktop app' }) })
    reviseButton.addEventListener('click', () => void revise(scene))
    root.append(h('div', { class: 'review-direction' }, box, reviseButton))
    if (!plan && record) root.append(...previewSection(scene, record))
    if (plan && record) {
      root.append(
        disclosure(`guide:${scene.id}`, 'Recording guide', guideOf(scene, plan, record)),
        disclosure(`compare:${scene.id}`, 'Compare with another revision', compareOf(scene, plan, record)),
        previewDetails(scene, record) || '',
        disclosure(`production:${scene.id}`, 'Produced scene', productionOf(scene), true),
        disclosure(`details:${scene.id}`, 'Details: evidence, skills, provenance', h('div', { class: 'review-details' },
          h('p', { class: 'review-muted', text: `Plan r${record.revision} · ${record.status === 'reviewed' ? 'approved' : record.status} · ${record.adapter || 'harness unknown'} ${record.reportedModel || record.model || ''}${record.approval ? ` · approved ${new Date(record.approval.at).toLocaleString()} with brief ${record.approval.briefId.slice(0, 18)}…${record.approval.castId ? ' and the visual cast' : ''}` : ''}` }),
          h('p', {}, h('strong', { text: 'Skills. ' }), plan.skills.map(skill => skill.skill).join(', ') || '—'),
          h('p', { class: 'review-muted', text: 'Source evidence, the explanation brief and the raw files are in the planning workspace.' }),
        )),
      )
    }
    return root
  }

  // One widget per scene block: the strip, or the review when selected —
  // which then leads, above the block it reviews (F7).
  const widget = (sceneId: string, expanded: boolean) => {
    const scene = sceneOf(sceneId)
    const element = h('div', { class: `scene-review${expanded ? ' is-expanded' : ''}`, contenteditable: 'false', 'data-review-scene': sceneId })
    if (!scene) return element
    element.append(expanded ? panel(scene) : strip(scene, false))
    return element
  }

  // What a widget shows, so an unchanged widget is not drawn again.
  const signature = (sceneId: string, expanded: boolean) => {
    const scene = sceneOf(sceneId)
    const state = uiOf(sceneId)
    const record = scene ? shownRecord(scene) : null
    const preview = scene ? previewStateOf(scene, record) : null
    const current = scene ? previewStateOf(scene, scene.view.current) : null
    const reference = scene?.reference
    return JSON.stringify([shown, expanded, scene?.view.state, scene?.view.current?.id, scene?.view.reviewed?.id, state.revision, state.compare, state.moment, preview?.state, preview?.stale, preview?.recordId, current?.state, current?.stale, error, host.script(sceneId), host.takeOf(sceneId), reference?.revision, reference?.adopted?.revision, reference?.newer?.revision, reference?.newer?.designing, reference?.baseDesigning, adopting === sceneId, scene?.production?.latest?.status, scene?.production?.ready?.id, scene?.production?.ready?.current, scene?.production?.accepted?.id, scene?.production?.accepted?.current, accepting, using, host.producedIn(sceneId), scene?.production?.ready?.edits?.revision, scene?.production?.accepted?.accepted?.edits, scene?.productionWaits, savingEdit, editHistory.get(scene?.production?.ready?.id || '')?.past.length, editHistory.get(scene?.production?.ready?.id || '')?.future.length])
  }

  return {
    load,
    listen,
    active: () => Boolean(overview),
    has: (sceneId: string) => Boolean(sceneOf(sceneId)),
    widget,
    signature,
    // Focus inside a review, so a redraw can put it back.
    focusKey: () => {
      const active = document.activeElement
      if (!(active instanceof HTMLElement) || !active.closest('.scene-review')) return ''
      return active.getAttribute('data-focus') || ''
    },
    restoreFocus: (key: string) => {
      if (key) refocus(key)
    },
    // Show this scene's revision and moment, as another view left them.
    focus: (sceneId: string, revision: string, moment: string) => {
      if (!sceneOf(sceneId)) return
      const state = uiOf(sceneId)
      if (revision && recordsOf(sceneId).some(record => record.id === revision)) state.revision = revision
      state.moment = moment
    },
    // The video's one next step, from the selected scene (F10 of the
    // Perplexity review); null until the plans are read.
    nextStep: (selected: string | null): NextStep | null => {
      if (!overview) return null
      const brief = overview.brief.latest
      return videoNextStep({
        scenes: overview.scenes.map(scene => {
          const take = host.takeOf(scene.id)
          // A take whose script is not known is not asked for again.
          const production = productionStateOf(scene)
          const accepted = scene.production?.accepted
          return {
            id: scene.id,
            index: scene.index,
            title: scene.title,
            state: scene.view.state,
            delivery: scene.delivery,
            take: !take ? 'none' : take.current || !take.known ? 'current' : 'earlier',
            production,
            produced: Boolean(accepted && host.producedIn(scene.id) === accepted.id),
            productionWaits: scene.productionWaits ?? null,
          }
        }),
        brief: { ready: Boolean(overview.brief.current), stale: overview.brief.stale, preparing: Boolean(brief && brief.kind === 'brief' && isActiveStatus(brief.status)), failed: brief?.status === 'failed' },
        selected,
        desktop: Boolean(window.studioDesktop?.isDesktop),
      })
    },
    // Plan the scene, as its review's own button does.
    plan: (sceneId: string) => {
      const scene = sceneOf(sceneId)
      if (scene) void revise(scene)
    },
    // Produce the scene from its approved plan, as its review's button does.
    produce: (sceneId: string) => {
      const scene = sceneOf(sceneId)
      if (scene?.view.reviewed) void produce(scene, false)
    },
    // The plan the stage should show for a scene, and its current moment.
    stageOf: (sceneId: string) => {
      const scene = sceneOf(sceneId)
      if (!scene) return null
      const record = shownRecord(scene)
      return { scene, record, moment: uiOf(sceneId).moment, preview: previewFor(scene, record), production: productionShown(scene) }
    },
  }
}
