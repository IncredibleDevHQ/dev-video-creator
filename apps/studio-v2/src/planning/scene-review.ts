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
import { PLANNING_STATE_LABELS, isActiveStatus, validationOf, type FrameRegion, type PlanDraft, type PlanningRecord, type ScenePlanningView, type TypeFaces, type ValidationView } from './planning-records'
import type { PlanningOverviewV1, ScenePreviewView, SceneProductionView, VisualCastSummary } from './planning-workspace'
import { compareTreatments, DIFFERENCE_LABELS } from './plan-compare'
import { claimFlagText } from './claim-scope'
import { recordingGuide } from './recording-guide'
import { acceptProduction, approvePlan, loadPlanning, planScene, prepareBrief, previewScene, produceScene, saveProductionEdits, saveSceneDelivery, saveSceneDirection, stopRun } from './planning-client'
import { BROWSER_REVIEW_MESSAGE, failureTitle, progressText } from '../harness-choice'
import { progressOf, sinceOf } from './progress'
import { videoNextStep, type NextStep } from './next-step'
import { deliveryChangeOf, previewFor, previewStateOf, producedFor, productionShown, productionStateOf, railStateOf, sceneActionsOf, treatmentRecordsOf, type Delivery, type PreviewState, type SceneAction, type SceneActions } from './scene-state'

type FetchJson = <T>(path: string, init?: RequestInit) => Promise<T>
type Scene = PlanningOverviewV1['scenes'][number]
type CastEntry = VisualCastSummary['entries'][number]

export type { PreviewState }

// One of a scene's takes, as the Record tab lists it (U5).
export type SceneTakeView = {
  recordingId: string
  // Its number among all the scene's takes, v1 first.
  version: number
  durationMs: number
  recordedAt: string
  // The one the scene uses.
  selected: boolean
  // A pickup fills in some lines of the selected take; it is never selected.
  pickup: boolean
  lines: number | null
  hasMedia: boolean
  // Spoken to the script as it is now; null when the take kept no record.
  current: boolean | null
}

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
  // pickups: how many pickups fill in lines for the take.
  takeOf: (sceneId: string) => { known: boolean; current: boolean; revision: number | null; changed: string[] | null; dropped: number | null; pickups?: number } | null
  // Make a plan revision's lines the scene's script, with that lineage.
  applyScript: (sceneId: string, script: string, lineage: { treatment: string; revision: number }) => void
  // The notebook redraws the review of every scene.
  refresh: () => void
  record: (sceneId: string) => void
  // Record only these lines of the scene: a pickup that fills in for the
  // selected take, which stays selected.
  recordPickup: (sceneId: string, lines: string[]) => void
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
  // A moment was chosen (the scene workspace opens it in its inspector).
  momentPicked?: (sceneId: string, momentId: string) => void
  // What the stage shows now, so the workspace's one action can follow it.
  stageMode?: () => 'reference' | 'schematic' | 'base' | 'preview' | 'output'
  // A preview was asked for and is being made (U4): the creator waits for it.
  previewRequested?: (sceneId: string, planRecordId: string, previewJobId: string, revision: number) => void
  // The planning records were read again.
  loaded?: () => void
  // Where the harness and model for each job are chosen (AI settings).
  openAiSettings?: () => void
  // Whether an approved plan stays on show while a newer one is planned
  // (the scene workspace; the notebook shows the newest).
  pinApproved?: () => boolean
  // The scene's takes; using another; playing one on the stage (U5).
  takesOf?: (sceneId: string) => SceneTakeView[]
  selectTake?: (sceneId: string, recordingId: string) => void
  playTake?: (sceneId: string, recordingId: string) => void
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
  const recordsOf = (sceneId: string) => treatmentRecordsOf(overview?.records || [], sceneId)
  const shownRecord = (scene: Scene) => {
    const state = uiOf(scene.id)
    const all = recordsOf(scene.id).filter(record => record.content)
    return all.find(record => record.id === state.revision) || scene.view.current || all[0] || null
  }
  const active = () => (overview?.records || []).some(record => isActiveStatus(record.status))

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
      (overview?.scenes || []).map(scene => [scene.id, scene.view.state, scene.delivery, scene.direction, scene.continuity, scene.reference?.revision, scene.reference?.adopted?.revision, scene.reference?.newer?.revision, scene.reference?.newer?.designing, scene.reference?.baseDesigning, scene.production?.latest?.id, scene.production?.latest?.status, scene.production?.ready?.id, scene.production?.ready?.current, scene.production?.accepted?.id, scene.production?.ready?.edits?.revision, scene.production?.accepted?.edits?.revision, scene.production?.accepted?.accepted?.edits, scene.productionWaits]),
      overview?.visualCast?.status,
      overview?.visualCast?.id,
      overview?.brief.stale,
    ])
    if (signature !== shown) {
      shown = signature
      host.refresh()
    }
    if (overview) {
      // A stop is acknowledged once its record has ended.
      for (const id of [...stopping]) if (!isActiveStatus((overview.records.find(record => record.id === id) || { status: 'failed' }).status)) stopping.delete(id)
      host.loaded?.()
    }
    // A scene waiting for its base's page is watched too: the worker lands
    // the page whatever is open, and it is offered here as it lands (B06).
    const awaitingPages = (overview?.scenes || []).some(scene => scene.reference?.baseDesigning || scene.reference?.newer?.designing)
    if (active() || overview?.visualCast?.status === 'extracting' || awaitingPages) pollTimer = window.setTimeout(() => void load(), 4000)
  }

  // Runs asked to stop: "Cancelling…" until their records end.
  const stopping = new Set<string>()
  // What the base's design run last did, for the scenes waiting on its pages
  // (the chaining of the BoltDB review).
  const designProgress = new Map<string, { text: string; at: number }>()
  const designLine = (runId: string) => {
    const progress = designProgress.get(runId)
    return progress ? `${progress.text} · ${Math.max(0, Math.round((Date.now() - progress.at) / 1000))}s ago` : 'Waiting for the designer\'s next step'
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
      if (event.type !== 'error' && (overview.scenes || []).some(scene => scene.reference?.designRun?.runId === runId)) {
        const said = progressText(event)
        if (said) {
          designProgress.set(runId, { text: said.slice(0, 120), at: Date.now() })
          document.querySelectorAll<HTMLElement>(`[data-review-design="${CSS.escape(runId)}"]`).forEach(element => (element.textContent = designLine(runId)))
        }
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
  // `said` is what the creator reads once it starts, when a change of
  // theirs started it.
  const revise = (scene: Scene, said?: string) =>
    run('plan the scene', async () => {
      const state = uiOf(scene.id)
      const projectId = host.projectId()
      if (!projectId) return
      if (state.direction !== null && state.direction !== scene.direction) await saveSceneDirection(host.fetchJson, projectId, scene.id, state.direction)
      state.direction = null
      // The approved plan on show stays there while a newer one is made: the
      // new candidate is offered, never put in its place (U3).
      const shown = shownRecord(scene)
      state.revision = host.pinApproved?.() && shown && shown.status === 'reviewed' && shown.id === scene.view.reviewed?.id ? shown.id : ''
      const { reused } = await planScene(host.fetchJson, projectId, scene.id)
      host.toast(reused ? 'This plan is already being made from the same inputs' : said || (scene.view.reviewed ? 'Planning a new candidate — the approved plan stays until you approve another' : 'Planning the scene: each phase shows as the harness reaches it'))
    })
  const preview = (scene: Scene, record: PlanningRecord, again: boolean) =>
    run('preview the plan', async () => {
      const projectId = host.projectId()
      if (!projectId) return
      const { reused, record: previewRecord } = await previewScene(host.fetchJson, projectId, scene.id, { recordId: record.id, again })
      if (reused && previewRecord.status === 'ready') host.showPreview(scene.id)
      else {
        host.previewRequested?.(scene.id, record.id, previewRecord.id, record.revision)
        host.toast(`Sketching a rough preview of plan r${record.revision} — the harness builds it; nothing is produced`)
      }
    })
  const approve = (record: PlanningRecord) =>
    run('approve the plan', async () => {
      await approvePlan(host.fetchJson, record.id)
      host.toast(`Revision ${record.revision} is this scene's approved plan. Nothing else was started.`)
    })

  // Focus a review control by its key — in the notebook's review or the
  // scene workspace, whichever is on screen; false when it is gone or disabled.
  const SURFACES = '.scene-review, .scene-workspace'
  const findFocus = (key: string) =>
    [...document.querySelectorAll<HTMLElement>(`[data-focus="${CSS.escape(key)}"]`)].find(element => element.closest(SURFACES) && element.getClientRects().length > 0) || null
  const refocus = (key: string) => {
    const again = findFocus(key)
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
      if (take.current) return chip(take.pickups ? `Recording: take and pickup${take.pickups === 1 ? '' : 's'} match the script` : 'Recording: take matches the script', 'good')
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
    // A newer production waiting for review comes first: it is what to do next.
    if (production.ready && !production.ready.accepted && production.ready.current) return chip('Output: produced — review it', 'new')
    if (production.accepted) return chip(production.accepted.current ? 'Output: accepted' : 'Output: accepted, out of date', production.accepted.current ? 'good' : 'warn')
    if (production.ready) return chip('Output: produced, out of date', 'warn')
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

  // What the plan does with each object of the scene's own page — use it,
  // adapt it, replace it or omit it — then what else it brings in. A
  // designed slide's artwork is never dropped without a decision shown here.
  const DECISIONS: Record<string, { label: string; tone: string }> = {
    reuse: { label: 'Use', tone: 'good' },
    adapt: { label: 'Adapt', tone: 'new' },
    enrich: { label: 'Adapt · richer', tone: 'new' },
    native: { label: 'Replace · drawn exactly', tone: '' },
    generate: { label: 'Replace · new artwork', tone: '' },
    omit: { label: 'Omit', tone: '' },
  }
  // The page's own objects, each with the plan's decision, and their tally.
  const castDecisions = (plan: SceneTreatmentV1, scene: Scene) => {
    const cast = overview?.visualCast?.entries || []
    const pageCast = cast.filter(entry => scene.originScenes.includes(entry.page) && entry.verification === 'verified' && entry.libraryKey)
    const designed = scene.reference?.kind === 'designed'
    const decisions = pageCast.map(entry => {
      const objects = plan.objects.filter(object => object.asset.ref === entry.libraryKey && object.asset.status !== 'undecided')
      const object = objects.find(candidate => candidate.asset.status !== 'omit') || objects[0]
      return { entry, object, decision: object ? DECISIONS[object.asset.status] || { label: object.asset.status, tone: '' } : null }
    })
    const counts = new Map<string, number>()
    for (const item of decisions) {
      const key = item.decision ? item.decision.label.split(' · ')[0] : 'Not decided'
      counts.set(key, (counts.get(key) || 0) + 1)
    }
    const tally = ['Use', 'Adapt', 'Replace', 'Omit', 'Not decided'].filter(key => counts.get(key)).map(key => `${counts.get(key)} ${key === 'Use' ? 'used' : key === 'Adapt' ? 'adapted' : key === 'Replace' ? 'replaced' : key === 'Omit' ? 'omitted' : 'not decided'}`)
    const tallyText = pageCast.length ? `The ${designed ? 'designed slide' : 'page'}'s ${pageCast.length} object${pageCast.length === 1 ? '' : 's'}: ${tally.join(', ')}.` : ''
    return { cast, pageCast, designed, decisions, tally, tallyText, undecided: counts.get('Not decided') || 0 }
  }
  const castFor = (plan: SceneTreatmentV1, scene: Scene) => {
    const { cast, pageCast, designed, decisions, tallyText } = castDecisions(plan, scene)
    const byKey = (key?: string) => (key ? cast.find(entry => entry.libraryKey === key) : undefined)
    const art = (entry: (typeof cast)[number] | undefined, fallback: string) => {
      const box = h('span', { class: 'review-cast-art' })
      if (entry) {
        const image = h('img', { alt: entry.label, loading: 'lazy' })
        image.src = entry.thumbnail
        box.append(image)
      } else box.append(h('span', { class: 'review-cast-none', text: fallback }))
      return box
    }
    const pageList = decisions.map(({ entry, object, decision }) =>
      h('li', { class: 'review-cast-item', 'data-cast-decision': decision ? decision.label.split(' · ')[0].toLowerCase() : 'undecided' },
        art(entry, '—'),
        h('span', {},
          h('strong', { text: entry.label }),
          ' ',
          decision ? chip(decision.label, decision.tone) : chip('Not decided', designed ? 'bad' : 'warn'),
          object && object.asset.status !== 'omit' ? h('small', { text: ` as ${object.entity}${object.performance ? ` — ${object.performance}` : ''}` }) : null,
          object?.asset.reason ? h('small', { class: 'review-muted', text: ` ${object.asset.status === 'omit' ? '' : '· '}${readable(object.asset.reason)}` }) : null,
        ),
      ))
    // What the plan brings from elsewhere, or draws new.
    const pageKeys = new Set(pageCast.map(entry => entry.libraryKey))
    const others = plan.objects.filter(object => !(object.asset.ref && pageKeys.has(object.asset.ref)) && object.asset.status !== 'omit')
    const otherList = others.map(object => {
      const entry = byKey(object.asset.ref)
      return h('li', { class: 'review-cast-item' },
        art(entry, object.asset.status === 'native' ? 'native' : '—'),
        h('span', {},
          h('strong', { text: object.entity }),
          ' ',
          chip(DECISIONS[object.asset.status]?.label || object.asset.status, object.asset.status === 'undecided' ? 'warn' : DECISIONS[object.asset.status]?.tone || ''),
          entry ? h('small', { text: ` ${entry.label} (${entry.kind}${scene.originScenes.includes(entry.page) ? '' : `, from “${pageTitle(entry.page)}”`})` }) : null,
          h('small', { class: 'review-muted', text: ` ${object.performance || object.role}` }),
          object.asset.reason ? h('small', { class: 'review-muted', text: ` — ${readable(object.asset.reason)}` }) : null,
        ),
      )
    })
    return h('div', { 'data-review-cast': scene.id },
      pageCast.length
        ? h('div', {},
            h('p', { class: 'review-cast-tally', text: tallyText }),
            h('ul', { class: 'review-cast' }, ...pageList),
          )
        : null,
      otherList.length ? h('div', {}, h('p', { class: 'review-muted', text: pageCast.length ? 'Also in the scene:' : 'The scene\'s objects:' }), h('ul', { class: 'review-cast' }, ...otherList)) : null,
      !pageCast.length && !otherList.length ? h('p', { class: 'review-muted', text: 'The plan casts no objects: speech, text or the camera carry it.' }) : null,
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
    const focused = document.activeElement instanceof HTMLElement && document.activeElement.closest(SURFACES) ? document.activeElement.getAttribute('data-focus') || '' : ''
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
      host.momentPicked?.(scene.id, id)
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
  const takeNote = (take: NonNullable<ReturnType<SceneReviewHost['takeOf']>>, sceneId: string) => {
    const of = `Your current take was spoken against an earlier script${take.revision ? ` (plan r${take.revision})` : ''}. It is kept`
    if (take.changed?.length) {
      // Only the lines that changed are asked for again: a pickup of them
      // fills in for the take, which stays.
      const changed = take.changed
      const pickup = h('button', { type: 'button', class: 'button secondary', 'data-focus': `record-pickup:${sceneId}`, text: `Record only ${changed.length === 1 ? 'this line' : `these ${changed.length} lines`}` })
      pickup.addEventListener('click', () => host.recordPickup(sceneId, changed))
      return h('div', { class: 'review-warn review-take-lines' },
        h('p', { text: `${of}, and still covers the other lines. Record ${changed.length === 1 ? 'this line' : `these ${changed.length} lines`} as a pickup — the rest of your take stays — or align the take there:` }),
        h('ol', {}, ...changed.map(line => h('li', { text: line }))),
        pickup,
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
      take && take.known && !take.current ? takeNote(take, scene.id) : null,
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

  // The faces a production's type is set in, as its render sets them (B11):
  // what stands in for a generic family, and a face that could not be had.
  const typeLine = (type: TypeFaces) => {
    const put = Object.entries(type.substituted).map(([generic, face]) => `${face} for ${generic}`)
    const shown = put.length ? put.join(', ') : type.faces.join(', ')
    const missing = type.unresolved.map(face => `“${face}”`).join(', ')
    return `Type: ${shown} — the same on the stage and in the video.${missing ? ` ${missing} could not be had; ${type.unresolved.length === 1 ? 'it falls' : 'they fall'} back alike in both.` : ''}`
  }
  // Before anything is produced (Q01 of the BoltDB review): the faces the
  // theme's type will be set in, and what the plan asks that the pinned
  // runtime has not proven — said while the creator can still change them,
  // not after production has waited on them.
  const themeTypeLine = (faces: NonNullable<PlanningOverviewV1['themeType']>) => {
    const missing = faces.filter(face => !face.available)
    const listed = faces.map(face => `${face.family} (${face.role})`).join(', ')
    const unique = (values: string[]) => values.filter((value, index, all) => all.indexOf(value) === index)
    const families = unique(missing.map(face => face.family))
    return missing.length
      ? `Type: ${listed}. ${families.map(family => `“${family}”`).join(', ')} cannot be had here: ${families.length === 1 ? 'it is' : 'they are'} set in the system's ${unique(missing.map(face => face.fallback)).join(' and ')}, alike on the stage and in the video — choose another theme to change it.`
      : `Type: ${listed} — each set in its own face, the same on the stage and in the video.`
  }
  // One status, the list on demand (R06 of the project-flow rereview): a
  // long column of runtime caveats buried what needed a decision.
  const risksOf = (record: PlanningRecord | null | undefined) => {
    const risks = record?.report?.constructionRisks || []
    if (!record || !risks.length) return null
    return h('div', { class: 'review-warn review-claims review-risks', 'data-review-risks': record.id },
      h('p', {}, h('strong', { text: `${risks.length} recipe${risks.length === 1 ? '' : 's'} not yet proven in the pinned runtime` }), ` — the production may build ${risks.length === 1 ? 'it' : 'them'} another way, and will say so.`),
      disclosure(`risks:${record.id}`, risks.length === 1 ? 'Which one' : `Which ${risks.length}`, h('ul', {}, ...risks.map(risk => h('li', { text: readable(risk) })))),
    )
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
      const clock = shown.summary.clock === 'generated-voice' ? `a generated voice (${shown.voice || 'system voice'})` : shown.summary.clock === 'take' ? (shown.voice || 'Your take').replace(/^Your/, 'your') : 'silence, by choice'
      box.append(
        ...([
          h('p', {}, h('strong', { text: `Produced from r${shown.of.revision}` }), ` · ${shown.summary.duration}s on ${clock} · ${shown.checked ? 'played and checked' : 'never checked'}${shown.accepted ? ` · accepted ${new Date(shown.accepted.at).toLocaleString()}` : ''}`),
          !shown.current ? h('p', { class: 'review-warn', text: `Out of date: ${shown.staleBecause}. Produce the scene again to realize the plan as it is now${shown.accepted ? '; the accepted output plays until then' : ''}.` }) : null,
          shown.type && shown.type.faces.length ? h('p', { class: shown.type.unresolved.length ? 'review-warn' : 'review-muted', 'data-review-type': shown.id, text: typeLine(shown.type) }) : null,
          shown.summary.unmet.length ? h('div', { class: 'review-warn' }, h('p', { text: 'What the approved plan asked for and this production could not meet:' }), h('ul', {}, ...shown.summary.unmet.map(item => h('li', { text: item })))) : null,
          shown.clockReview.length ? h('div', { class: 'review-muted', 'data-review-clock': shown.id }, h('p', { text: shown.summary.clock === 'take' ? 'On your take:' : 'On the voice\'s clock:' }), h('ul', {}, ...shown.clockReview.map(item => h('li', { text: item })))) : null,
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
    if (!shown) {
      const faces = overview?.themeType
      if (faces?.length) box.append(h('p', { class: faces.some(face => !face.available) ? 'review-warn' : 'review-muted', 'data-review-type-before': scene.id, text: themeTypeLine(faces) }))
      const risks = risksOf(approved)
      if (risks) box.append(risks)
    }
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
    if (state.state === 'failed') {
      // One whose checks refused every submission says so, with the last
      // check and every attempt to inspect (R09 of the project-flow rereview).
      const checks = preview!.latest.validation || null
      const lastCheck = checks?.attempts[checks.attempts.length - 1] || null
      items.push(h('p', { class: 'review-error', text: lastCheck
        ? `The preview of r${record.revision} ${lastCheck.attempt >= checks!.budget ? `could not be verified after ${lastCheck.attempt} attempts` : `failed after ${lastCheck.attempt} refused submission${lastCheck.attempt === 1 ? '' : 's'}`}${ready ? ' — its earlier preview stays' : ''}. ${lastCheckText(lastCheck)}`
        : `The preview of r${record.revision} could not be built: ${preview!.latest.error?.message || 'no reason given'}${ready ? ' — its earlier preview stays' : ''}.` }))
      if (checks) items.push(disclosure(`checks:${preview!.latest.id}`, `Inspect the ${checks.attempts.length === 1 ? 'check' : `${checks.attempts.length} checks`}`, checksPanel(checks)))
    }
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
      // A scene not yet planned takes its slide by itself when it lands; a
      // planned one is offered it (the chaining of the BoltDB review).
      const run = reference.designRun
      const untouched = !scene.view.latest && !scene.view.current && !scene.view.reviewed && !scene.production?.latest
      return h('div', { class: 'review-muted review-reference', 'data-review-reference': 'designing' },
        h('p', { text: `The base is still designing this scene's slide${run?.by ? `, with ${run.by}` : ''}. ${untouched ? 'When it lands, this scene takes it by itself — it is not planned yet.' : `When it lands you can compare it here and adopt it; this scene keeps its ${PAGE_KIND[reference.kind] || 'page'} until you do.`}` }),
        run ? h('p', { class: 'review-design-progress', 'data-review-design': run.runId, text: designLine(run.runId) }) : null,
      )
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

  // What the plan claims more strongly than its sources, or still says
  // after the direction asked to drop it (B07 of the BoltDB review): shown
  // with the plan, before it is approved.
  const claimsOf = (record: PlanningRecord | null | undefined) => {
    const claims = record?.report?.claims || []
    if (!record || !claims.length) return null
    return h('div', { class: 'review-warn review-claims', 'data-review-claims': record.id },
      h('p', {}, h('strong', { text: record.status === 'candidate' ? `Claims to check before approving (${claims.length})` : `Claims to check (${claims.length})` })),
      h('ul', {}, ...claims.map(flag => h('li', { text: readable(claimFlagText(flag)) }))),
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
            claimsOf(record),
            risksOf(record),
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

  // ——— The scene workspace (U2 of the scene workspace plan) ———
  // The same scene, revision and moment as the notebook's review, laid out
  // around the central stage: a header with the revision on show and its one
  // action; an inspector with the scene's story, one moment, how it is voiced
  // and its output; and a drawer with the context — briefs, evidence, the
  // cast's decisions and how each part was made.
  const onDesktop = () => Boolean(window.studioDesktop?.isDesktop)
  const briefStateOf = () => {
    const latest = overview?.brief.latest
    return {
      ready: Boolean(overview?.brief.current),
      stale: Boolean(overview?.brief.stale),
      preparing: Boolean(latest && latest.kind === 'brief' && isActiveStatus(latest.status)),
      failed: latest?.status === 'failed',
      recordId: latest?.id || null,
    }
  }
  const actionsOf = (scene: Scene): SceneActions =>
    sceneActionsOf({ scene, shown: shownRecord(scene), brief: briefStateOf(), take: host.takeOf(scene.id), desktop: onDesktop(), available: Boolean(overview?.available), stage: host.stageMode?.() })
  const recordById = (id?: string) => (id ? (overview?.records || []).find(record => record.id === id) || null : null)
  type WorkspaceTab = 'story' | 'moment' | 'record' | 'output'
  type Lead = (tab: WorkspaceTab, focus?: string) => void
  // The scene's script against the plan: recording waits until they agree.
  const scriptLags = (scene: Scene) => {
    const record = shownRecord(scene)
    const plan = record?.content as SceneTreatmentV1 | undefined
    if (!plan) return false
    const guide = recordingGuide({ plan, script: host.script(scene.id), wordingPolicy: host.wordingPolicy(), delivery: scene.delivery })
    return guide.source === 'plan' && !guide.matchesScript
  }
  const perform = (scene: Scene, action: SceneAction, lead: Lead) => {
    if (action.disabled) return
    const record = recordById(action.recordId)
    switch (action.kind) {
      case 'prepare-brief':
        void run('prepare the brief', async () => {
          const projectId = host.projectId()
          if (!projectId) return
          const { reused } = await prepareBrief(host.fetchJson, projectId)
          host.toast(reused ? 'The brief is already being prepared' : 'Preparing the explanation brief with your planning harness — every scene is planned from it')
        })
        return
      case 'plan':
        void revise(scene)
        return
      case 'revise':
        lead('story', `direction:${scene.id}`)
        return
      case 'stop':
        if (!record || stopping.has(record.id)) return
        stopping.add(record.id)
        host.refresh()
        void run('stop the run', () => stopRun(host.fetchJson, record))
        return
      case 'preview':
        if (record) void preview(scene, record, previewStateOf(scene, record).state === 'ready')
        return
      case 'show-preview':
        host.showPreview(scene.id)
        return
      case 'approve':
      case 'approve-unpreviewed':
        if (record) void approve(record)
        return
      case 'show-current': {
        const state = uiOf(scene.id)
        state.revision = ''
        state.moment = ''
        host.selectMoment(scene.id, null, null, null)
        host.refresh()
        return
      }
      case 'choose-delivery':
        lead('record', `delivery:${scene.id}`)
        return
      case 'record': {
        // The teleprompter reads the scene's script: it says what the plan
        // says before anything is recorded against it.
        if (scriptLags(scene)) {
          lead('record', `use-plan-script:${scene.id}`)
          host.toast('Use the plan\'s lines as the scene\'s script first, so the teleprompter shows what the plan says')
          return
        }
        lead('record')
        const take = host.takeOf(scene.id)
        if (take && take.known && !take.current && take.changed?.length) host.recordPickup(scene.id, take.changed)
        else host.record(scene.id)
        return
      }
      case 'produce':
        void produce(scene, Boolean(productionShown(scene)))
        return
      case 'review-output':
        lead('output')
        host.showProduction(scene.id)
        return
      case 'accept': {
        const ready = scene.production?.ready
        if (ready) accept(scene, ready)
        return
      }
    }
  }
  const actionButton = (scene: Scene, action: SceneAction, primary: boolean, lead: Lead) => {
    const cancelling = action.kind === 'stop' && Boolean(action.recordId && stopping.has(action.recordId))
    const button = h('button', {
      type: 'button',
      class: `button ${primary ? 'primary' : 'ghost'}`,
      'data-focus': `ws-action:${action.kind}:${scene.id}`,
      'data-action': action.kind,
      text: cancelling ? 'Cancelling…' : action.label,
      ...(cancelling ? { disabled: true } : action.disabled ? { disabled: true, title: action.disabled } : busy ? { disabled: true } : {}),
    })
    button.addEventListener('click', () => perform(scene, action, lead))
    return button
  }
  // The one revision control: every revision with where it stands.
  const revisionPicker = (scene: Scene) => {
    const view = scene.view
    const entries = recordsOf(scene.id).filter(item => item.content)
    const record = shownRecord(scene)
    if (!entries.length) return chip(`Plan: ${PLANNING_STATE_LABELS[view.state]}`, PLAN_TONES[view.state])
    const select = h('select', { class: 'ws-revision', 'aria-label': 'Plan revision on show', 'data-focus': `ws-revision:${scene.id}` })
    for (const entry of entries) {
      const status = entry.status === 'reviewed' ? (entry.id === view.reviewed?.id ? 'approved' : 'approved earlier') : entry.status
      const option = h('option', { value: entry.id, text: `Plan r${entry.revision} · ${status}${entry.id === view.current?.id && view.staleBecause ? ' · out of date' : ''}` })
      if (entry.id === record?.id) option.selected = true
      select.append(option)
    }
    select.addEventListener('change', () => {
      const state = uiOf(scene.id)
      state.revision = select.value
      state.moment = ''
      host.selectMoment(scene.id, null, null, null)
      host.refresh()
    })
    return select
  }
  // ——— Useful progress (U3 of the scene workspace plan) ———
  const HARNESS_NAMES: Record<string, string> = { 'claude-code': 'Claude Code', kimi: 'Kimi', codex: 'Codex' }
  const madeWith = (record: PlanningRecord) =>
    record.adapter ? `${HARNESS_NAMES[record.adapter] || record.adapter}${record.reportedModel || record.model ? ` · ${record.reportedModel || record.model}` : ''}` : 'Your local harness'
  // How many of the run's submissions were refused, of how many it may make.
  const refusedText = (record: PlanningRecord, repairs: number) => {
    const refused = validationOf(record)
    return refused ? `${refused.last.attempt} of ${refused.budget} submissions refused` : `repaired ${repairs} time${repairs === 1 ? '' : 's'}`
  }
  // A run in its named phases: the ones the product confirmed, what is
  // happening now, how long it has run, and who runs it — with the harness's
  // own last word, small, apart from the progress.
  const progressBlock = (record: PlanningRecord, compact = false) => {
    const state = progressOf(record)
    const since = String((record as { createdAt?: string }).createdAt || '')
    return h('div', { class: `ws-progress${compact ? ' is-compact' : ''}`, 'data-progress-record': record.id },
      h('ol', { class: 'ws-phases', 'aria-label': 'Phases' }, ...state.phases.map(phase => h('li', { 'data-phase': phase.key, 'data-state': phase.state, 'aria-current': phase.state === 'active' ? 'step' : undefined }, h('span', { class: 'ws-phase-mark', 'aria-hidden': 'true' }), h('span', { text: phase.label })))),
      state.now ? h('p', { class: 'ws-progress-now', role: 'status', text: state.now }) : null,
      // Under the stage the activity line already says how long.
      h('p', { class: 'ws-progress-meta' },
        ...[
          compact || !since ? null : h('span', { class: 'ws-progress-time', 'data-since': since, 'data-suffix': ' so far', 'aria-live': 'off', text: `${sinceOf(since)} so far` }),
          h('span', { class: 'ws-progress-who', text: madeWith(record) }),
          state.repairs ? h('span', { text: refusedText(record, state.repairs) }) : null,
        ].filter((part): part is HTMLSpanElement => Boolean(part)).flatMap((part, index) => (index ? [' · ', part] : [part])),
      ),
      compact ? null : h('small', { class: 'ws-progress-last', 'data-review-progress': record.id, title: 'What the harness last said it did', text: progress.get(record.id) || '' }),
    )
  }
  // Sections of a plan its run published, shown for what they are.
  const draftBlock = (draft: PlanDraft, label: string) =>
    h('div', { class: 'ws-draft' },
      h('p', { class: 'ws-draft-label', text: label }),
      draft.question ? h('p', { class: 'ws-draft-question', text: draft.question }) : null,
      draft.takeaway ? h('p', { class: 'ws-draft-takeaway' }, h('strong', { text: 'Takeaway. ' }), draft.takeaway) : null,
      draft.moments?.length ? h('ol', { class: 'ws-draft-moments' }, ...draft.moments.map(moment => h('li', { title: moment.summary, text: moment.title }))) : null,
    )
  // A run that ended without a plan: what happened, the provider's own
  // words, the ways on — and the approved plan, untouched.
  const failureBlock = (scene: Scene, record: PlanningRecord) => {
    const stopped = Boolean(record.progress?.events.some(event => event.milestone === 'stopped')) || /^Stopped|was cancelled/.test(record.error?.message || '')
    const category = stopped ? 'stopped' : record.error?.category || 'other'
    const provider = record.error?.providerStatus && record.error.providerStatus !== record.error.message ? record.error.providerStatus : ''
    const again = h('button', { type: 'button', class: 'button secondary', 'data-focus': `retry-plan:${scene.id}`, text: 'Plan the scene again', ...(!onDesktop() || !overview?.brief.current || overview.brief.stale ? { disabled: true } : {}) })
    again.addEventListener('click', () => void revise(scene))
    const change = h('button', { type: 'button', class: 'button ghost', 'data-focus': 'change-harness', text: 'Change the harness or model' })
    change.addEventListener('click', () => host.openAiSettings?.())
    return h('div', { class: 'ws-failure', 'data-failure': category, role: 'alert' },
      h('p', {}, h('strong', { text: stopped ? `Planning r${record.revision} was stopped.` : `Planning r${record.revision} failed${category !== 'other' ? ` — ${failureTitle(category).toLowerCase()}` : ''}.` }), ' ', stopped ? 'Nothing it made was kept as a plan.' : readable(record.error?.message || 'No reason was given.')),
      provider ? h('p', { class: 'ws-failure-provider' }, h('span', { class: 'review-muted', text: 'What the provider said: ' }), provider) : null,
      !stopped && record.error?.recovery?.length ? h('ul', { class: 'ws-failure-recovery' }, ...record.error.recovery.map(line => h('li', { text: line }))) : null,
      scene.view.reviewed ? h('p', { class: 'review-muted', text: `The approved plan, r${scene.view.reviewed.revision}, is unchanged.` }) : null,
      h('div', { class: 'review-actions' }, again, stopped ? null : change),
    )
  }

  // What the player's check saw of a refused submission (R09 of the
  // project-flow rereview): each attempt, newest first, with its problems —
  // and for a moment seeked twice, both frames side by side, where they
  // differ outlined, and the layers drawn at another place.
  // The last check in a line: its first problem's first sentence, and how
  // many more there were — the whole of it is in the checks.
  const lastCheckText = (check: ValidationView['attempts'][number]) => {
    const first = check.problems[0] || 'no reason was given'
    const sentence = (/^(.+?)[.!?](?=\s+[A-Z“"]|$)/.exec(first)?.[1] || first).trim()
    const more = check.problems.length - 1
    return `The last check found: ${readable(sentence)}${more ? ` — and ${more} more problem${more === 1 ? '' : 's'}` : ''}.`
  }
  const regionText = (box: FrameRegion) => `x ${Math.round(box.left)}–${Math.round(box.right)}, y ${Math.round(box.top)}–${Math.round(box.bottom)}`
  const evidenceFrame = (src: string, label: string, item: ValidationView['attempts'][number]['evidence'][number]) => {
    const image = Object.assign(h('img', { alt: `${label}: the frame at ${Number(item.at.toFixed(2))}s`, loading: 'lazy' }), { src })
    const box = item.region
    const outline = box ? h('span', { class: 'ws-evidence-region', 'aria-hidden': 'true' }) : null
    if (outline && box) Object.assign(outline.style, { left: `${(box.left / item.size.width) * 100}%`, top: `${(box.top / item.size.height) * 100}%`, width: `${((box.right - box.left) / item.size.width) * 100}%`, height: `${((box.bottom - box.top) / item.size.height) * 100}%` })
    return h('div', { class: 'ws-evidence-frame' }, image, outline, h('span', { class: 'ws-evidence-label', text: label }))
  }
  const checksPanel = (checks: ValidationView) =>
    h('div', { class: 'ws-checks' },
      ...[...checks.attempts].reverse().map(entry => h('section', { class: 'ws-check', 'data-check-attempt': String(entry.attempt) },
        h('h4', { text: `Attempt ${entry.attempt} of ${checks.budget}${entry.at ? ` · ${new Date(entry.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : ''}` }),
        h('ul', { class: 'ws-check-problems' }, ...entry.problems.map(problem => h('li', { text: problem }))),
        ...entry.evidence.map(item => h('figure', { class: 'ws-evidence' },
          h('div', { class: 'ws-evidence-pair' }, evidenceFrame(item.frames.first, 'First seek', item), evidenceFrame(item.frames.again, 'Second seek', item)),
          h('figcaption', { text: `${Number(item.at.toFixed(2))}s, seeked twice: ${item.pixels} pixels differ${item.region ? `, within ${regionText(item.region)}` : ''}.${item.layers.map(layer => ` Layer “${layer.id}” is ${layer.first ? `at ${regionText(layer.first)}` : 'not shown'} the first time, ${layer.again ? `at ${regionText(layer.again)}` : 'not shown'} the second.`).join('')}` }),
        )),
      )),
    )

  // A preview that could not be built, under the stage: the phase it failed
  // in, what was said, whether an earlier preview stays — and building it
  // again. A stop the creator asked for is said as such. One whose checks
  // refused every submission says so, with the last check, every attempt to
  // inspect, and the ways on: again (with a direction, or on another
  // harness), or approval without a preview (R09 of the project-flow
  // rereview). Once the scene has a production, the failure is the
  // preview's history, not the stage's state: it never misdescribes what
  // plays.
  const buildFailureOf = (scene: Scene, actions: SceneActions) => {
    const record = shownRecord(scene)
    if (!record || (actions.activity && ['preview', 'production'].includes(actions.activity.kind))) return null
    const state = previewStateOf(scene, record)
    const failed = state.state === 'failed' ? recordById(state.recordId) : null
    if (!failed) return null
    const stopped = Boolean(failed.progress?.events.some(event => event.milestone === 'stopped')) || /^Stopped|was cancelled/.test(failed.error?.message || '')
    const phase = progressOf(failed).phases.find(entry => entry.state === 'failed')
    const earlier = previewFor(scene, record)
    const provider = failed.error?.providerStatus && failed.error.providerStatus !== failed.error.message ? failed.error.providerStatus : ''
    const checks = scene.preview?.latest.id === failed.id ? scene.preview.latest.validation || null : null
    const lastCheck = checks?.attempts[checks.attempts.length - 1] || null
    const spent = Boolean(checks && lastCheck && lastCheck.attempt >= checks.budget)
    const again = h('button', { type: 'button', class: 'button secondary', 'data-focus': `retry-preview:${scene.id}`, text: `Preview r${record.revision} again`, ...(onDesktop() ? {} : { disabled: true }) })
    again.addEventListener('click', () => void preview(scene, record, false))
    const inspect = checks ? disclosure(`checks:${failed.id}`, `Inspect the ${checks.attempts.length === 1 ? 'check' : `${checks.attempts.length} checks`}`, checksPanel(checks)) : null
    // Produced from this revision, or its production on the stage: the
    // failed preview is history, said as such.
    const playing = host.stageMode?.() === 'output' && Boolean(productionShown(scene))
    if (playing || producedFor(scene, record)) {
      return h('div', { class: 'ws-build-failure is-history', 'data-failure': 'history', role: 'status' },
        h('p', {}, stopped ? `The preview of r${record.revision} was stopped.` : spent ? `The preview of r${record.revision} could not be verified after ${lastCheck!.attempt} attempts.` : `The preview of r${record.revision} failed.`, ' It is kept in the preview’s history', playing ? '; the stage plays the scene’s production.' : '.'),
        inspect,
      )
    }
    const change = h('button', { type: 'button', class: 'button ghost', 'data-focus': `preview-harness:${scene.id}`, text: 'Change the harness or model' })
    change.addEventListener('click', () => host.openAiSettings?.())
    const headline = stopped
      ? `The preview of r${record.revision} was stopped.`
      : spent
        ? `The preview of r${record.revision} could not be verified after ${lastCheck!.attempt} attempts.`
        : `The preview of r${record.revision} failed${phase ? ` while ${phase.label.charAt(0).toLowerCase()}${phase.label.slice(1)}` : ''}.`
    const said = stopped ? '' : lastCheck ? ` ${lastCheckText(lastCheck)}` : ` ${readable(failed.error?.message || 'No reason was given.')}`
    return h('div', { class: 'ws-build-failure', 'data-failure': stopped ? 'stopped' : spent ? 'unverified' : failed.error?.category || 'other', role: stopped ? 'status' : 'alert' },
      h('p', {},
        h('strong', { text: headline }),
        said,
        earlier ? ' Its earlier preview stays playable.' : ' The stage keeps the reference.',
      ),
      provider ? h('p', { class: 'ws-failure-provider' }, h('span', { class: 'review-muted', text: 'What the provider said: ' }), provider) : null,
      checks && !stopped ? h('p', { class: 'review-muted', text: record.status === 'candidate' ? 'Preview it again with a direction for what to change, or on another harness — or approve the plan without a preview.' : 'Preview it again with a direction for what to change, or on another harness.' }) : null,
      h('div', { class: 'review-actions' }, again, checks && !stopped ? change : null),
      inspect,
    )
  }

  // What is running for the scene, said once, with how long it has run.
  const activityLine = (scene: Scene, actions: SceneActions) => {
    const activity = actions.activity
    if (!activity) return null
    const record = recordById(activity.recordId)
    const since = String((record as { createdAt?: string } | null)?.createdAt || '')
    const phase = record ? progressOf(record).phases.find(entry => entry.state === 'active')?.label : ''
    return h('p', { class: 'ws-activity', role: 'status', 'data-ws-activity': activity.kind },
      h('span', { class: 'ws-activity-dot', 'aria-hidden': 'true' }),
      h('strong', { text: `${activity.label}…` }),
      phase ? h('span', { class: 'ws-activity-phase', text: ` ${phase}` }) : null,
      since ? h('span', { class: 'ws-activity-time', 'data-since': since, 'data-prefix': ' ', 'aria-live': 'off', text: ` ${sinceOf(since)}` }) : null,
    )
  }
  const workspaceHead = (scene: Scene, lead: Lead) => {
    const actions = actionsOf(scene)
    return {
      revision: revisionPicker(scene),
      voice: voiceControl(scene),
      primary: actions.primary ? actionButton(scene, actions.primary, true, lead) : null,
      secondary: actions.secondary.map(action => actionButton(scene, action, false, lead)),
      activity: activityLine(scene, actions),
      // A preview or production being built: its phases, under the stage.
      build: actions.activity && ['preview', 'production'].includes(actions.activity.kind) && recordById(actions.activity.recordId) ? progressBlock(recordById(actions.activity.recordId)!, true) : null,
      buildFailure: buildFailureOf(scene, actions),
      actions,
    }
  }

  // Story: what the scene teaches and how the plan stands — the question and
  // takeaway first, the rest on demand.
  const storyOf = (scene: Scene, lead: Lead) => {
    const view = scene.view
    const record = shownRecord(scene)
    const plan = record?.content as SceneTreatmentV1 | undefined
    const box = h('div', { class: 'ws-story' })
    if (error) box.append(h('p', { class: 'review-error', text: error }))
    if (!onDesktop()) box.append(h('p', { class: 'review-muted review-host-note', text: BROWSER_REVIEW_MESSAGE }))
    const notice = referenceNotice(scene)
    if (notice) box.append(notice)
    const planning = view.latest && view.latest.kind === 'treatment' && isActiveStatus(view.latest.status) ? view.latest : null
    const failed = view.latest && view.latest.kind === 'treatment' && view.latest.status === 'failed' ? view.latest : null
    // The brief comes first, in its own phases.
    const brief = overview?.brief.latest
    if (!planning && brief && isActiveStatus(brief.status)) box.append(h('h4', { class: 'ws-label', text: 'Preparing the explanation brief' }), progressBlock(brief))
    if (planning) {
      box.append(h('h4', { class: 'ws-label', text: `Planning r${planning.revision}` }), progressBlock(planning))
      if (planning.progress?.draft && (planning.progress.draft.question || planning.progress.draft.moments?.length)) box.append(draftBlock(planning.progress.draft, 'Draft · still being checked'))
      if (record && record.status === 'reviewed') box.append(h('p', { class: 'review-muted', text: `The approved plan, r${record.revision}, stays on show below; r${planning.revision} is offered for review once it is ready.` }))
    }
    if (failed) {
      box.append(failureBlock(scene, failed))
      if (failed.progress?.draft && (failed.progress.draft.question || failed.progress.draft.moments?.length)) box.append(draftBlock(failed.progress.draft, 'Draft from the run that failed · not checked'))
    }
    if (record && record.id === view.current?.id && view.staleBecause) box.append(h('p', { class: 'review-warn', text: `Out of date — ${view.staleBecause}. Plan again from the current inputs.` }))
    if (!plan) {
      const objectives = (overview?.basePages || []).filter(page => scene.originScenes.includes(page.scene) && page.objective).map(page => page.objective)
      if (objectives.length) box.append(h('h4', { class: 'ws-label', text: 'What it should teach' }), ...objectives.map(text => h('p', { class: 'ws-question', text })))
      // Never "no plan yet … plan the scene" while it is being planned.
      if (!planning && !failed) box.append(h('p', { class: 'review-muted', text: view.state === 'needs-brief' ? 'The video\'s explanation brief comes first: prepare it, then plan this scene.' : view.state === 'preparing' ? 'The explanation brief is being prepared; this scene can be planned once it is ready.' : 'No plan yet. Add direction below if you want, then plan the scene.' }))
    } else {
      box.append(
        h('h4', { class: 'ws-label', text: `What it teaches · plan r${record!.revision}` }),
        h('p', { class: 'ws-question', text: plan.question }),
        h('p', { class: 'ws-takeaway' }, h('strong', { text: 'Takeaway. ' }), plan.takeaway),
        ...[claimsOf(record), risksOf(record)].filter((part): part is HTMLDivElement => Boolean(part)),
      )
      const brief = overview?.brief.current?.content as ExplanationBriefV1 | undefined
      const evidence = brief ? [...new Set(plan.moments.flatMap(moment => moment.evidenceRefs || []))].map(ref => brief.evidence.find(entry => entry.id === ref)).filter(Boolean) as ExplanationBriefV1['evidence'] : []
      if (plan.demonstration || plan.ledger || evidence.length) {
        box.append(disclosure(`ws-example:${scene.id}`, 'Example and evidence', h('div', { class: 'ws-example' },
          plan.demonstration ? h('p', {}, h('strong', { text: 'Example. ' }), plan.demonstration.text) : null,
          plan.ledger ? h('p', { class: 'review-muted', text: `The count: ${plan.ledger.quantity} from ${plan.ledger.initial} to ${plan.ledger.final} over ${plan.ledger.events.length} changes — checked.` }) : null,
          evidence.length ? h('ul', { class: 'ws-evidence' }, ...evidence.slice(0, 8).map(entry => h('li', {}, h('q', { text: entry.text }), entry.locator ? h('small', { text: ` ${entry.locator}` }) : null))) : null,
        )))
      }
      const { tallyText, undecided, designed } = castDecisions(plan, scene)
      if (tallyText) {
        const more = h('button', { type: 'button', class: 'link-button', 'data-focus': `ws-cast:${scene.id}`, text: 'Each object' })
        more.addEventListener('click', () => lead('story', 'context:cast'))
        box.append(h('p', { class: undecided ? (designed ? 'review-error ws-cast-line' : 'review-warn ws-cast-line') : 'review-muted ws-cast-line' }, tallyText, ' ', more))
      }
      const open = [
        ...plan.unresolved.map(text => `Open: ${text}`),
        ...plan.requirements.decisions.map(text => `Decide: ${text}`),
        ...plan.requirements.assets.map(text => `Artwork: ${text}`),
        ...(record!.report?.warnings || []).map(text => `Check: ${text}`),
        ...(scene.continuity || []).filter(seam => seam.state === 'proposed' || seam.state === 'broken').map(seam => `Seam (${seam.side === 'incoming' ? 'opening' : 'ending'}): ${seam.state}${seam.reason ? ` — ${seam.reason}` : ''}`),
      ]
      if (open.length) box.append(disclosure(`ws-open:${scene.id}`, `Still to resolve (${open.length})`, h('ul', { class: 'ws-open' }, ...open.map(text => h('li', { text: readable(text) })))))
    }
    // Direction for the next candidate, and planning it.
    const state = uiOf(scene.id)
    const field = h('textarea', { rows: '3', 'data-focus': `direction:${scene.id}`, placeholder: view.current ? 'Direction for the next candidate — what should change?' : 'Direction for the plan (optional) — what should it show?', 'aria-label': 'Direction for this scene' })
    field.value = state.direction ?? scene.direction
    field.addEventListener('input', () => (state.direction = field.value))
    const planBlocked = view.state === 'planning' || !overview?.brief.current || overview.brief.stale || !overview.available || !onDesktop()
    const planButton = h('button', { type: 'button', class: 'button secondary', 'data-focus': `revise:${scene.id}`, text: view.current ? 'Plan again with this direction' : 'Plan the scene', ...(planBlocked ? { disabled: true } : {}), ...(onDesktop() ? {} : { title: 'Planning runs in the desktop app' }) })
    planButton.addEventListener('click', () => void revise(scene))
    box.append(h('div', { class: 'ws-direction' }, h('label', { class: 'ws-label', text: 'Direction' }), field, planButton))
    if (plan && record) box.append(disclosure(`ws-compare:${scene.id}`, 'Compare with another revision', compareOf(scene, plan, record)))
    return box
  }

  // Moment: one moment at a time — what changes on screen, the words said
  // over it, where the viewer looks — with its direction on demand.
  const momentOf = (scene: Scene) => {
    const record = shownRecord(scene)
    const plan = record?.content as SceneTreatmentV1 | undefined
    const box = h('div', { class: 'ws-moment' })
    if (!plan) {
      box.append(h('p', { class: 'review-muted', text: 'The scene\'s moments appear here once it has a plan.' }))
      return box
    }
    const state = uiOf(scene.id)
    const index = plan.moments.findIndex(moment => moment.id === state.moment)
    if (index < 0) {
      box.append(h('p', { class: 'review-muted', text: `${plan.moments.length} moments. Choose one under the stage, or here:` }))
      const list = h('ol', { class: 'ws-moment-list' })
      plan.moments.forEach((moment, at) => {
        const pick = h('button', { type: 'button', 'data-focus': `ws-moment:${scene.id}:${moment.id}` }, h('span', { class: 'review-moment-number', text: String(at + 1) }), h('span', { text: moment.title }))
        pick.addEventListener('click', () => pickMoment(scene, plan, moment.id))
        list.append(h('li', {}, pick))
      })
      box.append(list)
      return box
    }
    const moment = plan.moments[index]
    const step = (to: number, text: string, key: string) => {
      const button = h('button', { type: 'button', class: 'button ghost ws-step', 'data-focus': `${key}:${scene.id}`, text, ...(to < 0 || to >= plan.moments.length ? { disabled: true } : {}) })
      button.addEventListener('click', () => pickMoment(scene, plan, plan.moments[to].id))
      return button
    }
    const ready = previewFor(scene, record)
    const produced = producedFor(scene, record)
    const timed = (produced || ready)?.summary.moments.find(entry => entry.id === moment.id)
    const seconds = timed ? `${Math.round((timed.end - timed.start) * 10) / 10}s${produced ? '' : ' est.'}` : moment.estimateSeconds ? `≈${moment.estimateSeconds}s est.` : ''
    const field = (label: string, text: string | null | undefined, className = '') => (text ? [h('dt', { text: label }), h('dd', { class: className, text: readable(text) })] : [])
    const targets = targetsOf(scene, plan, moment)
    const mapped = targets.nodes.length + targets.objectIds.length
    box.append(
      h('div', { class: 'ws-moment-head' },
        h('span', { class: 'ws-moment-count', text: `Moment ${index + 1} of ${plan.moments.length}` }),
        h('span', { class: 'ws-moment-steps' }, step(index - 1, '‹ Previous', 'moment-previous'), step(index + 1, 'Next ›', 'moment-next')),
      ),
      h('h3', { class: 'ws-moment-title', 'data-review-moment': moment.id }, moment.title, seconds ? h('small', { text: ` ${seconds}` }) : null),
      h('dl', { class: 'ws-moment-fields' },
        ...field('On screen', moment.objects?.change || moment.observation),
        ...field('Spoken line', moment.narration ? moment.narration.guide || moment.narration.job : '', 'ws-spoken'),
        ...field('Viewer focus', moment.attention),
      ),
      h('p', { class: 'review-muted ws-mapping', text: mapped ? `On the reference, what this moment is about is highlighted (${mapped} ${mapped === 1 ? 'thing' : 'things'}). The video may restage it.` : 'Nothing on the reference maps to this moment: the scene will stage it on its own.' }),
      disclosure(`ws-direction:${scene.id}`, 'Direction', h('dl', { class: 'ws-moment-fields' },
        ...field('Why it is there', moment.purpose),
        ...field('Presenter', moment.presenter ? `${moment.presenter.visibility}${moment.presenter.reason ? ` — ${moment.presenter.reason}` : ''}` : ''),
        ...field('Text', moment.text ? `${moment.text.content} (${moment.text.role})` : ''),
        ...field('Camera', moment.camera ? `${moment.camera.treatment} on ${moment.camera.subject}${moment.camera.reason ? ` — ${moment.camera.reason}` : ''}` : ''),
        ...field('Objects', moment.objects?.actors?.length ? moment.objects.actors.join(', ') : ''),
        ...field('Sound', moment.audio ? `${moment.audio.cue}${moment.audio.reason ? ` — ${moment.audio.reason}` : ''}` : ''),
        ...field('Recipes', moment.recipes?.length ? moment.recipes.map(recipe => recipe.id).join(', ') : ''),
      )),
    )
    return box
  }

  // Record: who speaks in the scene, and — for a scene you present — what to
  // say and where, your take, and recording it.
  const DELIVERY_CHOICES: Array<['human' | 'generated' | 'silent', string, string]> = [
    ['human', 'You present it', 'Your voice — and your picture where the plan shows you. Your take sets the scene\'s clock.'],
    ['generated', 'Generated voice', 'The plan\'s lines are spoken by a generated voice when the scene is produced. Nothing to record.'],
    ['silent', 'Silent', 'No voice: the scene keeps the plan\'s timing, with its sound cues only.'],
  ]
  let savingDelivery = ''
  // Takes whose file would not play, said so until the video is reopened.
  const failedTakes = new Set<string>()
  const minutes = (ms: number) => {
    const seconds = Math.max(0, Math.round(ms / 1000))
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
  }
  // The scene's takes (U5): every take kept, the one the scene uses said so,
  // another used only when asked; each played on the stage. A take without
  // its file — missing, or one that would not load — says so, and is not
  // offered for use.
  const takesOf = (scene: Scene) => {
    const takes = host.takesOf?.(scene.id) || []
    const full = takes.filter(take => !take.pickup)
    const pickups = takes.filter(take => take.pickup)
    const box = h('div', { class: 'ws-takes' }, h('h4', { class: 'ws-label', text: full.length ? `Takes · ${full.length}` : 'Takes' }))
    if (!full.length) {
      box.append(h('p', { class: 'ws-take-none', text: 'No take yet. What follows is guidance; nothing is recorded for this scene.' }))
      return box
    }
    const list = h('ol', { class: 'ws-take-list' })
    for (const take of full) {
      const missing = !take.hasMedia || failedTakes.has(take.recordingId)
      const when = Date.parse(take.recordedAt) ? new Date(take.recordedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''
      const play = h('button', { type: 'button', class: 'button ghost', 'data-focus': `take-play:${take.recordingId}`, text: 'Play', ...(take.hasMedia ? {} : { disabled: true }) })
      play.addEventListener('click', () => host.playTake?.(scene.id, take.recordingId))
      let use: HTMLElement
      if (take.selected) use = h('span', { class: 'ws-take-used', text: 'Used for this scene' })
      else {
        use = h('button', { type: 'button', class: 'button secondary', 'data-focus': `take-use:${take.recordingId}`, text: `Use take v${take.version}`, ...(missing ? { disabled: true, title: 'Its file is missing' } : {}) })
        use.addEventListener('click', () => host.selectTake?.(scene.id, take.recordingId))
      }
      const state = !take.hasMedia
        ? 'Its file is missing: the take is on record, but there is nothing to play.'
        : failedTakes.has(take.recordingId)
          ? 'Its file could not be loaded.'
          : take.current === false
            ? 'Spoken to earlier words than the script now.'
            : take.current
              ? 'Spoken to the script as it is now.'
              : ''
      list.append(h('li', { class: `ws-take${take.selected ? ' is-selected' : ''}${missing ? ' is-missing' : ''}`, 'data-take': take.recordingId },
        h('p', { class: 'ws-take-head' }, h('strong', { text: `v${take.version}` }), h('span', { text: [minutes(take.durationMs), when].filter(Boolean).join(' · ') })),
        state ? h('p', { class: `ws-take-state${missing ? ' is-missing' : take.current === false ? ' is-older' : ''}`, text: state }) : null,
        h('div', { class: 'ws-take-actions' }, play, use),
      ))
    }
    box.append(list)
    if (pickups.length) box.append(h('p', { class: 'review-muted', text: `${pickups.length} pickup${pickups.length === 1 ? '' : 's'} fill${pickups.length === 1 ? 's' : ''} in lines of the take used: ${pickups.map(take => `v${take.version}${take.lines ? ` (${take.lines} line${take.lines === 1 ? '' : 's'})` : ''}`).join(', ')}.` }))
    return box
  }
  // A generated voice, once a production has made it (the choice above
  // already says that nothing is recorded).
  const voiceNote = (scene: Scene) => {
    const made = scene.production?.accepted || scene.production?.ready
    return made && made.summary.clock === 'generated-voice' ? h('p', { class: 'ws-voice-made', text: `Its generated voice${made.voice ? ` (${made.voice})` : ''} was made for the production of plan r${made.of.revision}: ${Math.round(made.summary.duration * 10) / 10}s.` }) : null
  }
  // Who speaks, chosen for one scene from wherever it is asked — beside the
  // scene's title as well as in Record (R08 of the project-flow rereview). A
  // plan is made for who speaks: plans made before read as out of date, and
  // are kept. A plan still being made would finish out of date — that is
  // said before anything changes, with stopping it and planning again as
  // the way on.
  // Who speaks, changed (F02 of the fix verification): the question says
  // what the scene will be left with; the choice is saved first, and only a
  // saved choice stops a plan being made and plans the scene again.
  const chooseDelivery = async (drawn: Scene, value: Delivery, label: string) => {
    if (savingDelivery || drawn.delivery === value) return
    const projectId = host.projectId()
    if (!projectId) return
    // Where the scene stands now: a plan may have started since this was drawn.
    await load().catch(() => undefined)
    const scene = sceneOf(drawn.id) || drawn
    if (scene.delivery === value) return
    const change = deliveryChangeOf(scene, value, label)
    if (change.confirm && !window.confirm(change.confirm)) return
    savingDelivery = scene.id
    host.refresh()
    void (async () => {
      let saved = false
      try {
        await saveSceneDelivery(host.fetchJson, projectId, scene.id, value)
        saved = true
        if (change.stop) {
          stopping.add(change.stop.id)
          await stopRun(host.fetchJson, change.stop).catch(() => undefined)
        }
      } catch (failure) {
        host.toast(change.failed(failure instanceof Error ? failure.message : 'the studio did not answer'))
      } finally {
        savingDelivery = ''
        await load().catch(() => undefined)
      }
      if (!saved) return
      const now = change.replan ? sceneOf(scene.id) : null
      if (now) void revise(now, change.saved)
      else host.toast(change.saved)
    })()
  }
  // Beside the scene's title: who speaks, and what deciding later costs.
  const voiceControl = (scene: Scene) => {
    const select = h('select', { class: 'ws-voice', 'aria-label': 'Who speaks in this scene', 'data-focus': `voice:${scene.id}`, title: scene.delivery ? 'Who speaks in this scene: the plan is made for it' : 'Decide later: the scene can be planned now, but it is planned again once you choose — and produced only then', ...(savingDelivery ? { disabled: true } : {}) })
    const options: Array<[string, string]> = [['', 'Voice: decide later'], ...DELIVERY_CHOICES.map(([value, label]) => [value, `Voice: ${value === 'human' ? 'you present it' : label.toLowerCase()}`] as [string, string])]
    for (const [value, text] of options) {
      const option = h('option', { value, text, ...(value === '' && scene.delivery ? { disabled: true } : {}) })
      if ((scene.delivery || '') === value) option.selected = true
      select.append(option)
    }
    select.addEventListener('change', () => {
      const chosen = DELIVERY_CHOICES.find(([value]) => value === select.value)
      if (!chosen) return
      select.value = scene.delivery || ''
      void chooseDelivery(scene, chosen[0], chosen[1])
    })
    return h('label', { class: `ws-voice-field${scene.delivery ? '' : ' is-undecided'}` }, select)
  }
  const recordOf = (scene: Scene) => {
    const box = h('div', { class: 'ws-record' })
    const choice = h('div', { class: 'ws-delivery', role: 'radiogroup', 'aria-label': 'Who speaks in this scene' })
    for (const [value, label] of DELIVERY_CHOICES) {
      const selected = scene.delivery === value
      const button = h('button', { type: 'button', role: 'radio', 'aria-checked': selected ? 'true' : 'false', class: selected ? 'is-selected' : '', 'data-focus': value === (scene.delivery || 'human') ? `delivery:${scene.id}` : `delivery-${value}:${scene.id}`, text: label, ...(savingDelivery ? { disabled: true } : {}) })
      button.addEventListener('click', () => void chooseDelivery(scene, value, label))
      choice.append(button)
    }
    const said = DELIVERY_CHOICES.find(([value]) => value === scene.delivery)
    box.append(h('h4', { class: 'ws-label', text: 'Who speaks' }), choice, h('p', { class: 'review-muted', text: said ? said[2] : 'Not chosen yet: the scene can be planned without it, but it is planned again once you choose — and produced only then.' }))
    const record = shownRecord(scene)
    const plan = record?.content as SceneTreatmentV1 | undefined
    if (!plan || !record) {
      // A take can come before any plan: it is listed all the same.
      if (scene.delivery !== 'generated' && scene.delivery !== 'silent' && host.takesOf?.(scene.id).length) box.append(takesOf(scene))
      box.append(h('p', { class: 'review-muted', text: 'What to say, and where, comes with the plan.' }))
      return box
    }
    if (scene.delivery === 'generated' || scene.delivery === 'silent') {
      const guide = recordingGuide({ plan, script: host.script(scene.id), wordingPolicy: host.wordingPolicy(), delivery: scene.delivery })
      const made = voiceNote(scene)
      if (made) box.append(made)
      if (scene.delivery === 'generated' && guide.lines.length) box.append(h('h4', { class: 'ws-label', text: `The lines the voice speaks — plan r${record.revision}` }), h('ol', { class: 'review-guide-lines' }, ...guide.lines.map(line => h('li', { text: line.text }))))
      return box
    }
    box.append(takesOf(scene), h('h4', { class: 'ws-label', text: `Recording guide — plan r${record.revision}` }), guideOf(scene, plan, record))
    return box
  }

  // Context: what the scene was planned from and how each part was made.
  const contextOf = (scene: Scene, section: 'brief' | 'explanation' | 'cast' | 'details') => {
    const record = shownRecord(scene)
    const plan = record?.content as SceneTreatmentV1 | undefined
    const box = h('div', { class: `ws-context-body is-${section}` })
    if (section === 'brief') {
      const pages = (overview?.basePages || []).filter(page => scene.originScenes.includes(page.scene))
      if (!pages.length) box.append(h('p', { class: 'review-muted', text: 'This scene has no base page on record.' }))
      for (const page of pages) {
        box.append(h('article', { class: 'ws-context-card' },
          h('h4', { text: page.title }),
          page.objective ? h('p', {}, h('strong', { text: 'Teaching objective. ' }), page.objective) : null,
          page.narration ? h('p', {}, h('strong', { text: 'Narration. ' }), page.narration) : null,
          page.sourcePassages.length ? h('div', {}, h('strong', { text: 'Source passages' }), h('ul', {}, ...page.sourcePassages.map(passage => h('li', { class: 'ws-quote', text: passage })))) : null,
          page.layoutGuidance ? disclosure(`ws-layout:${page.scene}`, 'Previous layout guidance', h('p', { class: 'review-muted', text: page.layoutGuidance })) : null,
        ))
      }
      return box
    }
    if (section === 'explanation') {
      const brief = overview?.brief.current
      const content = brief?.content as ExplanationBriefV1 | undefined
      if (!content) {
        box.append(h('p', { class: 'review-muted', text: overview?.brief.latest && isActiveStatus(overview.brief.latest.status) ? 'The explanation brief is being prepared.' : 'No explanation brief yet: it is prepared before the first plan.' }))
        return box
      }
      if (overview?.brief.stale) box.append(h('p', { class: 'review-warn', text: `Out of date — ${overview.brief.staleBecause || 'its inputs changed'}.` }))
      box.append(h('p', {}, h('strong', { text: 'Message. ' }), content.purpose.message))
      const mine = content.coverage.filter(entry => scene.originScenes.includes(entry.scene))
      const units = [...new Set(mine.flatMap(entry => entry.units))].map(id => content.units.find(unit => unit.id === id)).filter(Boolean) as ExplanationBriefV1['units']
      if (!units.length) box.append(h('p', { class: 'review-muted', text: mine.find(entry => entry.omittedReason)?.omittedReason || 'The brief maps no explanation unit to this scene\'s pages.' }))
      for (const unit of units) {
        box.append(h('article', { class: 'ws-context-card' },
          h('h4', { text: unit.question }),
          h('p', { text: unit.explain }),
          h('ul', {}, ...unit.communicationNeeds.map(need => h('li', {}, h('strong', { text: need.need }), ` — ${need.why}`))),
          h('ul', { class: 'ws-evidence' }, ...unit.evidenceRefs.map(ref => content.evidence.find(entry => entry.id === ref)).filter(Boolean).map(entry => h('li', {}, h('q', { text: entry!.text }), entry!.locator ? h('small', { text: ` ${entry!.locator}` }) : null))),
        ))
      }
      box.append(h('p', { class: 'review-muted', text: `Brief r${brief!.revision} · ${brief!.adapter || 'harness unknown'} ${brief!.reportedModel || brief!.model || ''}` }))
      return box
    }
    if (section === 'cast') {
      if (!plan) {
        const cast = (overview?.visualCast?.entries || []).filter(entry => scene.originScenes.includes(entry.page))
        box.append(h('p', { class: 'review-muted', text: cast.length ? `The scene's page offers ${cast.length} object${cast.length === 1 ? '' : 's'}; the plan decides what to do with each.` : 'The scene\'s page offers no reusable objects.' }))
        return box
      }
      box.append(castFor(plan, scene))
      return box
    }
    // Details: how the plan, its preview and the production were made, and
    // the plan's full text to read or copy.
    if (!record || !plan) {
      box.append(h('p', { class: 'review-muted', text: 'Nothing has been planned for this scene yet.' }))
    } else {
      box.append(
        h('p', { class: 'review-muted', text: `Plan r${record.revision} · ${record.status === 'reviewed' ? 'approved' : record.status} · ${record.adapter || 'harness unknown'} ${record.reportedModel || record.model || ''}${record.workflow ? ` · workflow ${record.workflow}` : ''}${record.approval ? ` · approved ${new Date(record.approval.at).toLocaleString()}` : ''}` }),
        h('p', {}, h('strong', { text: 'Skills. ' }), plan.skills.map(skill => skill.skill).join(', ') || '—'),
      )
      const details = previewDetails(scene, record)
      if (details) box.append(details)
      const text = JSON.stringify(plan, null, 2)
      const copy = h('button', { type: 'button', class: 'button ghost', 'data-focus': `ws-copy-plan:${scene.id}`, text: 'Copy the plan' })
      copy.addEventListener('click', () => {
        void navigator.clipboard?.writeText(text).then(() => host.toast('The plan\'s full text is on the clipboard'), () => host.toast('Could not copy: select the text instead'))
      })
      box.append(disclosure(`ws-plan-text:${scene.id}`, `The plan's full text (r${record.revision})`, h('div', { class: 'ws-plan-text' }, copy, h('pre', { text }))))
    }
    const workspace = h('button', { type: 'button', class: 'button ghost', 'data-focus': `workspace:${scene.id}`, text: 'Open the planning workspace' })
    workspace.addEventListener('click', () => host.openWorkspace(scene.id, record?.id || '', uiOf(scene.id).moment))
    box.append(h('p', { class: 'review-muted', text: 'The planning workspace holds the harness and model for planning, the brief\'s preparation and each run\'s raw files.' }), workspace)
    return box
  }

  // The moments of the revision on show, for the row under the stage: timed
  // by what the stage plays of that revision, else by the plan's estimates.
  const momentsRow = (sceneId: string) => {
    const scene = sceneOf(sceneId)
    const record = scene ? shownRecord(scene) : null
    const plan = record?.content as SceneTreatmentV1 | undefined
    if (!scene) return null
    if (!plan) {
      // No plan yet: the moments its run published, for what they are.
      const latest = scene.view.latest
      const drafted = latest && latest.kind === 'treatment' && isActiveStatus(latest.status) ? latest.progress?.draft?.moments || [] : []
      return drafted.length ? { draft: true, selected: '', measured: false, duration: null, moments: drafted.map((moment, index) => ({ id: moment.id, index, title: moment.title, start: null, end: null, seconds: null })) } : null
    }
    const mode = host.stageMode?.()
    const produced = producedFor(scene, record)
    const ready = previewFor(scene, record)
    const playing = mode === 'output' ? produced : mode === 'preview' ? ready : null
    return {
      draft: false,
      selected: uiOf(sceneId).moment,
      measured: Boolean(playing && playing === produced),
      duration: playing?.summary.duration ?? null,
      moments: plan.moments.map((moment, index) => {
        const timed = playing?.summary.moments.find(entry => entry.id === moment.id)
        return { id: moment.id, index, title: moment.title, start: timed?.start ?? null, end: timed?.end ?? null, seconds: timed ? Math.round((timed.end - timed.start) * 10) / 10 : moment.estimateSeconds ?? null }
      }),
    }
  }

  // The scene's timeline (U6): the plan's moments on the clock of what the
  // stage plays — the produced scene's measured clock, the sketch's, or the
  // plan's estimates — each with who is heard, whether the presenter is in
  // the picture, the text, the camera and the sound; and the layers the
  // composition declared, over the moments they appear in. Read-only: what
  // can be adjusted is adjusted in Output.
  const PRESENCE: Record<'full' | 'shared' | 'hidden' | 'undecided', string> = { full: 'On camera', shared: 'Beside the graphics', hidden: 'Voice only', undecided: 'Framing open' }
  const timelineOf = (sceneId: string) => {
    const scene = sceneOf(sceneId)
    const record = scene ? shownRecord(scene) : null
    const plan = record?.content as SceneTreatmentV1 | undefined
    if (!scene || !record || !plan) return null
    const mode = host.stageMode?.()
    const produced = producedFor(scene, record)
    const ready = previewFor(scene, record)
    const measured = mode === 'output' && Boolean(produced)
    const summary = measured ? produced!.summary : mode === 'preview' && ready ? ready.summary : null
    let at = 0
    const moments = plan.moments.map((moment, index) => {
      const timed = summary?.moments.find(entry => entry.id === moment.id)
      const start = timed ? timed.start : at
      const end = timed ? timed.end : start + (moment.estimateSeconds || 4)
      at = Math.max(at, end)
      const presence = scene.delivery === 'human' ? moment.presenter?.visibility || 'undecided' : ''
      return {
        id: moment.id,
        index,
        title: moment.title,
        start,
        end,
        voice: scene.delivery === 'silent' ? '' : moment.narration?.guide || '',
        presence,
        presenter: presence ? PRESENCE[presence] : '',
        text: moment.text?.content || '',
        camera: moment.camera?.treatment || '',
        sound: moment.audio?.cue || '',
      }
    })
    const clock = measured
      ? produced!.summary.clock === 'take' ? 'your take' : produced!.summary.clock === 'generated-voice' ? 'the generated voice' : 'the plan\'s timing, silent'
      : summary ? `the sketch of plan r${record.revision}` : `plan r${record.revision}'s estimates`
    return {
      moments,
      duration: summary?.duration || at,
      measured,
      timed: Boolean(summary),
      clock,
      voice: scene.delivery === 'generated' ? 'Generated voice' : scene.delivery === 'silent' ? '' : 'Voice',
      layers: (summary?.layers || []).map(layer => ({ id: layer.id, label: layer.label, kind: layer.kind, moments: layer.moments, placeholder: Boolean(layer.placeholder) })),
      adjustable: measured ? produced!.summary.controls.length : 0,
      selected: uiOf(sceneId).moment,
    }
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

  const workspaceScene = (sceneId: string) => sceneOf(sceneId)
  // What a scene's progress is drawn from: its latest plan, the brief and
  // the preview or production being made — each run's milestones and draft.
  const progressKey = (sceneId: string) => {
    const scene = sceneOf(sceneId)
    if (!scene) return null
    const activity = recordById(actionsOf(scene).activity?.recordId)
    return [scene.view.latest, overview?.brief.latest, activity].map(record => (record ? [record.id, record.status, record.progress?.events.length ?? 0, record.progress?.draft ?? null, record.error?.message ?? null] : null))
  }
  return {
    load,
    listen,
    // A take's file would not play: its row says so (U5).
    takeFailed: (recordingId: string) => {
      if (failedTakes.has(recordingId)) return
      failedTakes.add(recordingId)
      host.refresh()
    },
    // A planning record as last read, or null when it is not listed yet.
    recordOf: (id: string) => (overview?.records || []).find(record => record.id === id) || null,
    // The scene workspace's parts (U2 of the scene workspace plan): drawn
    // from the same records, state and actions as the notebook's review.
    workspace: {
      scenes: () =>
        (overview?.scenes || []).map(scene => ({ id: scene.id, index: scene.index, title: scene.title || scene.id, state: railStateOf(scene, host.takeOf(scene.id)) })),
      head: (sceneId: string, lead: Lead) => {
        const scene = workspaceScene(sceneId)
        return scene ? workspaceHead(scene, lead) : null
      },
      story: (sceneId: string, lead: Lead) => {
        const scene = workspaceScene(sceneId)
        return scene ? storyOf(scene, lead) : null
      },
      moment: (sceneId: string) => {
        const scene = workspaceScene(sceneId)
        return scene ? momentOf(scene) : null
      },
      record: (sceneId: string) => {
        const scene = workspaceScene(sceneId)
        return scene ? recordOf(scene) : null
      },
      output: (sceneId: string) => {
        const scene = workspaceScene(sceneId)
        return scene ? productionOf(scene) : null
      },
      context: (sceneId: string, section: 'brief' | 'explanation' | 'cast' | 'details') => {
        const scene = workspaceScene(sceneId)
        return scene ? contextOf(scene, section) : null
      },
      moments: momentsRow,
      timeline: timelineOf,
      // Playback moved into another moment: the inspector follows, the
      // stage is not sought.
      follow: (sceneId: string, momentId: string) => {
        if (!workspaceScene(sceneId)) return
        uiOf(sceneId).moment = momentId
        host.refresh()
      },
      pick: (sceneId: string, momentId: string) => {
        const scene = workspaceScene(sceneId)
        const plan = scene ? (shownRecord(scene)?.content as SceneTreatmentV1 | undefined) : undefined
        if (scene && plan) pickMoment(scene, plan, momentId)
      },
      // What the scene's workspace shows, so an unchanged one is not redrawn.
      signature: (sceneId: string) => JSON.stringify([signature(sceneId, true), progressKey(sceneId), [...stopping], host.takesOf?.(sceneId), [...failedTakes], host.stageMode?.(), savingDelivery, busy, overview?.brief.current?.id, overview?.brief.stale, briefStateOf().preparing, overview?.scenes.map(scene => [scene.id, scene.title, railStateOf(scene, host.takeOf(scene.id))])]),
      // Whether the scene has anything to produce yet (the Output tab).
      approved: (sceneId: string) => Boolean(workspaceScene(sceneId)?.view.reviewed),
      // A run's progress, for lines drawn outside the review.
      progress: (recordId: string) => progress.get(recordId) || '',
    },
    active: () => Boolean(overview),
    has: (sceneId: string) => Boolean(sceneOf(sceneId)),
    widget,
    signature,
    // Focus inside a review, so a redraw can put it back.
    focusKey: () => {
      const active = document.activeElement
      if (!(active instanceof HTMLElement) || !active.closest(SURFACES)) return ''
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
    // Prepare the video's brief, as the scene workspace's own button does:
    // a new video prepares it there, not in a planning window over it (R06
    // of the project-flow rereview).
    prepareBrief: () => {
      const scene = overview?.scenes[0]
      if (!scene || !overview?.available || briefStateOf().preparing || (overview.brief.current && !overview.brief.stale)) return false
      perform(scene, { kind: 'prepare-brief', label: 'Prepare the brief' }, () => undefined)
      return true
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
