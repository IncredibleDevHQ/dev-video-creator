// A scene plan's sections as its run publishes them before handing the plan
// in (U3 of the scene workspace plan): the question and takeaway, then a
// summary of each moment. The creator sees them as a draft, still being
// checked — so each is complete, plain text, bounded and identified, or it
// is refused. Nothing private, partial, structured or executable is kept.
export type DraftMoment = { id: string; title: string; summary: string }
export type DraftSection = { question: string; takeaway: string } | { moments: DraftMoment[] }

const MAX_MOMENTS = 24
// Plain text: control characters become spaces, runs of space collapse.
const text = (value: unknown, max: number) =>
  typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : ''

export const validateDraft = (section: unknown, input: Record<string, unknown>): { ok: true; section: 'explanation' | 'moments'; draft: DraftSection } | { ok: false; problems: string[] } => {
  if (section === 'explanation') {
    const question = text(input.question, 300)
    const takeaway = text(input.takeaway, 600)
    const problems = [!question ? 'question is required' : '', !takeaway ? 'takeaway is required' : ''].filter(Boolean)
    return problems.length ? { ok: false, problems } : { ok: true, section, draft: { question, takeaway } }
  }
  if (section === 'moments') {
    const list = Array.isArray(input.moments) ? input.moments : null
    if (!list || !list.length) return { ok: false, problems: ['moments must be a list of the moments planned so far'] }
    if (list.length > MAX_MOMENTS) return { ok: false, problems: [`at most ${MAX_MOMENTS} moments`] }
    const problems: string[] = []
    const seen = new Set<string>()
    const moments = list.map((entry, index) => {
      const item = (entry && typeof entry === 'object' ? entry : {}) as Record<string, unknown>
      const id = typeof item.id === 'string' ? item.id.trim() : ''
      const title = text(item.title, 160)
      const summary = text(item.summary, 400)
      if (!/^[A-Za-z0-9_-]{1,40}$/.test(id)) problems.push(`moment ${index + 1}: id must be 1–40 letters, digits, - or _`)
      else if (seen.has(id)) problems.push(`moment ${index + 1}: id "${id}" is used twice`)
      seen.add(id)
      if (!title) problems.push(`moment ${index + 1}: title is required`)
      return { id, title, summary }
    })
    return problems.length ? { ok: false, problems } : { ok: true, section, draft: { moments } }
  }
  return { ok: false, problems: ['section must be "explanation" or "moments"'] }
}
