// The studio's one Jobs control (the Open Slide pass). Every job the creator
// may want to follow — a notebook being made, a scene's plan, preview or
// production, an export, the older explainer build — is listed in one panel
// under one count, from wherever it runs. Each source says what it has now;
// nothing here starts, stops, polls or retries anything by itself: a job's
// actions are the ones its source already has.
//
// What needs the creator — a failure, an export ready to download — stays
// in the panel and marks the control until the source no longer reports it;
// it never depends on a toast.
import { sinceOf } from '../planning/progress'

// running: making progress · waiting: queued, or waiting on something ·
// failed: ended without a result, until another run replaces it · done:
// finished, with something to collect.
export type JobTone = 'running' | 'waiting' | 'failed' | 'done'
export type JobAction = { label: string; run: () => void; primary?: boolean; title?: string }
export type JobView = {
  id: string
  // What it makes, and for what: "Wireframe", "Scene 2 · Dispatch and combine".
  title: string
  // Where it stands, in a few words.
  stage: string
  tone: JobTone
  // When it started, for how long it has run.
  since?: string | null
  // Who runs it: the harness and the model.
  by?: string | null
  actions?: JobAction[]
}
// A job whose own notice lives in the panel already (the export, the older
// explainer build): counted, not drawn again.
export type JobNote = { running: number; attention: number }

export type JobsElements = {
  toggle: HTMLButtonElement
  count: HTMLElement
  panel: HTMLElement
  list: HTMLElement
  empty: HTMLElement
  summary: HTMLElement
  // Said to a screen reader when what needs the creator changes, with the
  // panel open or not.
  announcer?: HTMLElement
}

const h = <K extends keyof HTMLElementTagNameMap>(tag: K, attributes: Record<string, string | undefined> = {}, ...children: Array<Node | string | null>) => {
  const element = document.createElement(tag)
  for (const [key, value] of Object.entries(attributes)) {
    if (value === undefined) continue
    if (key === 'text') element.textContent = value
    else element.setAttribute(key, value)
  }
  for (const child of children) if (child !== null) element.append(child)
  return element
}

const TONE_LABEL: Record<JobTone, string> = { running: 'Running', waiting: 'Waiting', failed: 'Needs you', done: 'Ready' }

// How the control reads: "Jobs", "Jobs · 2 running", "Jobs · 1 needs you".
export const jobsSummaryOf = (jobs: JobView[], notes: JobNote[]) => {
  const running = jobs.filter(job => job.tone === 'running' || job.tone === 'waiting').length + notes.reduce((sum, note) => sum + note.running, 0)
  const attention = jobs.filter(job => job.tone === 'failed' || job.tone === 'done').length + notes.reduce((sum, note) => sum + note.attention, 0)
  const parts = [running ? `${running} running` : '', attention ? `${attention} ${attention === 1 ? 'needs' : 'need'} you` : ''].filter(Boolean)
  return { running, attention, text: parts.join(' · ') }
}

export const createJobs = (elements: JobsElements) => {
  const sources = new Map<string, JobView[]>()
  const notes = new Map<string, JobNote>()
  let drawn = ''
  let said = ''
  const all = () => [...sources.values()].flat()
  const render = () => {
    const jobs = all()
    const summary = jobsSummaryOf(jobs, [...notes.values()])
    elements.count.hidden = !(summary.running || summary.attention)
    elements.count.textContent = String(summary.running + summary.attention)
    elements.toggle.dataset.state = summary.attention ? 'attention' : summary.running ? 'running' : 'idle'
    elements.toggle.setAttribute('aria-label', summary.text ? `Jobs: ${summary.text}` : 'Jobs: nothing running')
    elements.summary.textContent = summary.text
    // A new failure or a finished export is said once; a count that only
    // goes down, or a clock, is not.
    const needs = jobs.filter(job => job.tone === 'failed' || job.tone === 'done').map(job => `${job.title}: ${job.stage}`).join('; ')
    if (elements.announcer && needs && needs !== said) elements.announcer.textContent = `Needs you — ${needs}`
    said = needs
    elements.empty.hidden = Boolean(jobs.length || summary.running || summary.attention)
    // Drawn again only when what it lists changes; the clocks tick by themselves.
    const key = JSON.stringify(jobs.map(job => [job.id, job.title, job.stage, job.tone, job.since, job.by, (job.actions || []).map(action => action.label)]))
    if (key === drawn) return
    drawn = key
    const had = document.activeElement instanceof HTMLElement && elements.list.contains(document.activeElement) ? document.activeElement.dataset.jobAction || '' : ''
    elements.list.replaceChildren(
      ...jobs.map(job => {
        const clock = job.since ? h('span', { class: 'job-time', 'data-since': job.since, text: sinceOf(job.since) }) : null
        const actions = (job.actions || []).map(action => {
          const button = h('button', { type: 'button', class: `job-action${action.primary ? ' is-primary' : ''}`, 'data-job-action': `${job.id}:${action.label}`, title: action.title, text: action.label })
          button.addEventListener('click', () => action.run())
          return button
        })
        return h('li', { class: `job is-${job.tone}`, 'data-job': job.id },
          h('span', { class: 'job-mark', 'aria-hidden': 'true' }),
          h('div', { class: 'job-body' },
            h('p', { class: 'job-title' }, h('strong', { text: job.title }), h('span', { class: 'job-tone', text: TONE_LABEL[job.tone] })),
            h('p', { class: 'job-stage' }, job.stage, clock ? ' · ' : '', clock),
            job.by ? h('p', { class: 'job-by', text: job.by }) : null,
            actions.length ? h('div', { class: 'job-actions' }, ...actions) : null,
          ),
        )
      }),
    )
    if (had) elements.list.querySelector<HTMLElement>(`[data-job-action="${CSS.escape(had)}"]`)?.focus({ preventScroll: true })
  }
  // The running times tick while the panel is open; nothing is redrawn for it.
  window.setInterval(() => {
    if (elements.panel.hidden) return
    elements.list.querySelectorAll<HTMLElement>('[data-since]').forEach(element => {
      const text = sinceOf(element.dataset.since)
      if (text) element.textContent = text
    })
  }, 1000)
  return {
    // What one source has now: its jobs replace the ones it had.
    set: (source: string, jobs: JobView[]) => {
      sources.set(source, jobs)
      render()
    },
    // A job the panel shows with its own notice: only counted.
    note: (source: string, note: JobNote) => {
      notes.set(source, note)
      render()
    },
    render,
  }
}
