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
import type { PlanningOverviewV1, ScenePreviewView, VisualCastSummary } from './planning-workspace'
import { compareTreatments, DIFFERENCE_LABELS } from './plan-compare'
import { recordingGuide } from './recording-guide'
import { approvePlan, loadPlanning, planScene, previewScene, saveSceneDirection } from './planning-client'
import { BROWSER_REVIEW_MESSAGE, progressText } from '../harness-choice'

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
  takeOf: (sceneId: string) => { known: boolean; current: boolean; revision: number | null } | null
  // Make a plan revision's lines the scene's script, with that lineage.
  applyScript: (sceneId: string, script: string, lineage: { treatment: string; revision: number }) => void
  // The notebook redraws the review of every scene.
  refresh: () => void
  record: (sceneId: string) => void
  // The planning workspace, on this scene, revision and moment.
  openWorkspace: (sceneId: string, revision: string, moment: string) => void
  // The stage shows which page objects a moment is about — and, when the
  // stage plays the plan's preview, goes to the moment.
  selectMoment: (sceneId: string, targets: { nodes: string[]; objectIds: string[] } | null, at: number | null) => void
  // The stage switches to the scene's plan preview.
  showPreview: (sceneId: string) => void
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
      (overview?.scenes || []).map(scene => [scene.id, scene.view.state, scene.continuity]),
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
  const recordingState = (scene: Scene) => {
    if (scene.delivery === 'generated' || scene.delivery === 'silent') return chip(`Recording: not needed (${scene.delivery})`)
    const take = host.takeOf(scene.id)
    if (take) return take.current ? chip('Recording: take matches the script', 'good') : take.known ? chip('Recording: take is of an earlier script', 'warn') : chip('Recording: take recorded')
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

  // The compact strip every scene block carries.
  const strip = (scene: Scene, expanded: boolean) => {
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
      { class: 'review-strip' },
      h('span', { class: 'review-strip-label', text: 'Scene review' }),
      planState(scene),
      recordingState(scene),
      previewChip(scene),
      chip('Output: not produced'),
      cast.length ? thumbs : null,
      h('span', { class: 'review-strip-open', text: expanded ? 'Selected — reviewing below' : 'Select the scene to review it' }),
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

  const momentsOf = (scene: Scene, plan: SceneTreatmentV1) => {
    const state = uiOf(scene.id)
    const list = h('ol', { class: 'review-moments' })
    plan.moments.forEach((moment, index) => {
      const selected = state.moment === moment.id
      const item = h('li', { class: `review-moment${selected ? ' is-selected' : ''}` })
      const head = h('button', { type: 'button', class: 'review-moment-head', 'data-focus': `moment:${scene.id}:${moment.id}`, 'aria-pressed': selected ? 'true' : 'false' },
        h('span', { class: 'review-moment-number', text: String(index + 1) }),
        h('strong', { text: moment.title }),
        moment.estimateSeconds ? h('small', { text: `≈${moment.estimateSeconds}s est.` }) : null,
      )
      head.addEventListener('click', () => {
        state.moment = selected ? '' : moment.id
        // On the sketch of this very revision, the stage goes to the moment.
        const ready = previewFor(scene, shownRecord(scene))
        const at = state.moment && ready ? ready.summary.moments.find(entry => entry.id === moment.id)?.start ?? null : null
        host.selectMoment(scene.id, state.moment ? targetsOf(scene, plan, moment) : null, at)
        host.refresh()
      })
      item.append(
        head,
        h('div', { class: 'review-moment-body' },
          h('p', {}, h('span', { class: 'review-label', text: 'Sees ' }), moment.objects?.change || moment.observation),
          moment.narration ? h('p', {}, h('span', { class: 'review-label', text: 'Hears ' }), moment.narration.guide || moment.narration.job) : null,
          h('p', { class: 'review-muted' }, h('span', { class: 'review-label', text: 'Attention ' }), moment.attention),
          h('div', { class: 'review-chips' },
            moment.presenter ? chip(`presenter ${moment.presenter.visibility}`) : null,
            moment.text ? chip(`text: ${moment.text.content.slice(0, 40)}`) : null,
            moment.camera ? chip(`camera ${moment.camera.treatment}`) : null,
          ),
        ),
      )
      list.append(item)
    })
    return list
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
      take && take.known && !take.current ? h('p', { class: 'review-warn', text: `Your current take was spoken against an earlier script${take.revision ? ` (plan r${take.revision})` : ''}. It is kept; re-record the scene, or align the take, where the words changed.` }) : null,
      guide.lines.length
        ? h('div', {}, h('h6', { text: `Lines to record — ${guide.source === 'plan' ? `plan r${planRecord.revision}'s narration, in its order` : 'the notebook\'s script'} (${lineLabel})` }), h('ol', { class: 'review-guide-lines' }, ...guide.lines.map(line => h('li', { text: line.text }))))
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

  const productionOf = (scene: Scene, record: PlanningRecord | null) => {
    const approved = scene.view.reviewed
    const plan = (approved?.content || record?.content) as SceneTreatmentV1 | undefined
    const needs = [
      approved ? `✓ An approved plan (r${approved.revision}).` : '✗ An approved plan — approve one first.',
      scene.delivery === 'human' ? '✗ Your take for this scene — none is recorded yet.' : scene.delivery ? `✓ Delivery: ${scene.delivery}.` : '✗ A delivery choice for this scene (my voice, generated or silent).',
      ...(plan?.objects || []).filter(object => ['enrich', 'generate'].includes(object.asset.status)).map(object => `✗ Artwork for ${object.entity} (${object.asset.status}).`),
    ]
    return h('div', { class: 'review-production' },
      h('p', { class: 'review-warn', text: 'Not connected yet: this build stops at approved plans and rough sketches. Approving a plan never starts production.' }),
      h('p', {}, 'Producing a scene from its approved plan — its code, artwork, voice and timing, on your “Scene production” harness — comes next. It will need:'),
      h('ul', {}, ...needs.map(line => h('li', { text: line }))),
      h('p', { class: 'review-muted', text: 'Build whole notebook, in the toolbar, is the older build: it works from the notebook\'s scripts and pages, and does not use approved plans.' }),
    )
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
      const note = h('p', { class: 'review-muted review-no-preview', text: `No preview of r${record.revision} yet — the stage shows its page.${others.length ? ` Sketches exist for ${others.map(view => `r${view.of.revision}`).join(', ')}.` : ''}` })
      if (others.length) {
        const other = others[0]
        const go = h('button', { type: 'button', class: 'link-button', 'data-focus': `show-revision:${other.of.record}`, text: `Show r${other.of.revision} and its preview` })
        go.addEventListener('click', () => {
          const state = uiOf(scene.id)
          state.revision = other.of.record
          state.moment = ''
          host.selectMoment(scene.id, null, null)
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
      h('h6', { text: 'What the sketch cannot show yet' }),
      h('ul', { class: 'review-provisional' }, ...ready.summary.provisional.map(item => h('li', { text: readable(item) }))),
      h('h6', { text: 'Moment map' }),
      h('p', { class: 'review-muted', text: 'Which moments each layer takes part in. It is read-only and estimated — not the composition\'s timeline; editing timing arrives with production.' }),
      lanes,
    ))
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
    actions.append(approveButton, previewButton, workspace)
    const revisions = h('div', { class: 'review-revisions' })
    for (const entry of recordsOf(scene.id).filter(item => item.content)) {
      const button = h('button', { type: 'button', class: `review-revision${entry.id === record?.id ? ' is-selected' : ''}`, 'data-focus': `revision:${entry.id}`, text: `r${entry.revision} ${entry.status === 'reviewed' ? (entry.id === view.reviewed?.id ? 'approved' : 'approved earlier') : entry.status}` })
      button.addEventListener('click', () => {
        state.revision = entry.id
        state.moment = ''
        host.selectMoment(scene.id, null, null)
        host.refresh()
      })
      revisions.append(button)
    }
    root.append(
      h('header', { class: 'review-head' },
        h('div', {}, h('span', { class: 'review-eyebrow', text: 'Scene review' }), h('h3', { text: scene.title || scene.id }), revisions),
        actions,
      ),
    )
    if (error) root.append(h('p', { class: 'review-error', text: error }))
    if (!desktop) root.append(h('p', { class: 'review-muted review-host-note', text: BROWSER_REVIEW_MESSAGE }))
    // Where the plan stands.
    if (view.latest && isActiveStatus(view.latest.status)) {
      root.append(h('p', { class: 'review-busy', 'data-review-progress': view.latest.id, text: progress.get(view.latest.id) || `Planning revision ${view.latest.revision} with your local harness…` }))
    }
    if (view.latest?.status === 'failed') root.append(h('p', { class: 'review-error', text: `Revision ${view.latest.revision} failed: ${view.latest.error?.message || 'no reason given'}${view.reviewed ? ` — the approved plan (r${view.reviewed.revision}) is unchanged` : ''}` }))
    if (record && record.id === view.current?.id && view.staleBecause) root.append(h('p', { class: 'review-warn', text: `Stale — ${view.staleBecause}. Revise to plan from the current inputs.` }))
    if (!plan) {
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
            h('p', { class: 'review-muted', text: 'Select a moment to see what it is about on the stage.' }),
            momentsOf(scene, plan),
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
        disclosure(`production:${scene.id}`, 'Production — not connected yet', productionOf(scene, record)),
        disclosure(`details:${scene.id}`, 'Details: evidence, skills, provenance', h('div', { class: 'review-details' },
          h('p', { class: 'review-muted', text: `Plan r${record.revision} · ${record.status === 'reviewed' ? 'approved' : record.status} · ${record.adapter || 'harness unknown'} ${record.reportedModel || record.model || ''}${record.approval ? ` · approved ${new Date(record.approval.at).toLocaleString()} with brief ${record.approval.briefId.slice(0, 18)}…${record.approval.castId ? ' and the visual cast' : ''}` : ''}` }),
          h('p', {}, h('strong', { text: 'Skills. ' }), plan.skills.map(skill => skill.skill).join(', ') || '—'),
          h('p', { class: 'review-muted', text: 'Source evidence, the explanation brief and the raw files are in the planning workspace.' }),
        )),
      )
    }
    return root
  }

  // One widget per scene block: the strip, and the review when selected.
  const widget = (sceneId: string, expanded: boolean) => {
    const scene = sceneOf(sceneId)
    const element = h('div', { class: `scene-review${expanded ? ' is-expanded' : ''}`, contenteditable: 'false', 'data-review-scene': sceneId })
    if (!scene) return element
    element.append(strip(scene, expanded))
    if (expanded) element.append(panel(scene))
    return element
  }

  // What a widget shows, so an unchanged widget is not drawn again.
  const signature = (sceneId: string, expanded: boolean) => {
    const scene = sceneOf(sceneId)
    const state = uiOf(sceneId)
    const record = scene ? shownRecord(scene) : null
    const preview = scene ? previewStateOf(scene, record) : null
    const current = scene ? previewStateOf(scene, scene.view.current) : null
    return JSON.stringify([shown, expanded, scene?.view.state, scene?.view.current?.id, scene?.view.reviewed?.id, state.revision, state.compare, state.moment, preview?.state, preview?.stale, preview?.recordId, current?.state, current?.stale, error, host.script(sceneId), host.takeOf(sceneId)])
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
      if (!key) return
      const again = document.querySelector<HTMLElement>(`.scene-review [data-focus="${CSS.escape(key)}"]`)
      again?.focus({ preventScroll: true })
    },
    // Show this scene's revision and moment, as another view left them.
    focus: (sceneId: string, revision: string, moment: string) => {
      if (!sceneOf(sceneId)) return
      const state = uiOf(sceneId)
      if (revision && recordsOf(sceneId).some(record => record.id === revision)) state.revision = revision
      state.moment = moment
    },
    // The plan the stage should show for a scene, and its current moment.
    stageOf: (sceneId: string) => {
      const scene = sceneOf(sceneId)
      if (!scene) return null
      const record = shownRecord(scene)
      return { scene, record, moment: uiOf(sceneId).moment, preview: previewFor(scene, record) }
    },
  }
}
