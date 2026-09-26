// Comparing two revisions of a scene plan by what a creator would notice:
// which moments came or went or changed what they show, say or frame,
// which objects changed how their artwork is made, and how the scene now
// meets its neighbours — not a diff of summary prose.
import type { SceneTreatmentV1, TreatmentMoment } from './scene-treatment'

export type PlanDifferenceCategory = 'purpose' | 'demonstration' | 'moments' | 'narration' | 'objects' | 'text' | 'camera' | 'presenter' | 'continuity'
export type PlanDifference = {
  category: PlanDifferenceCategory
  change: 'added' | 'removed' | 'changed'
  label: string
  before?: string
  after?: string
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

// A moment in the other revision: the same id, else the same title.
const counterpart = (moment: TreatmentMoment, others: TreatmentMoment[], taken: Set<TreatmentMoment>) =>
  others.find(other => !taken.has(other) && other.id === moment.id) || others.find(other => !taken.has(other) && other.title === moment.title) || null

export const compareTreatments = (before: SceneTreatmentV1, after: SceneTreatmentV1): PlanDifference[] => {
  const differences: PlanDifference[] = []
  const changed = (category: PlanDifferenceCategory, label: string, a: string, b: string) => {
    if (a !== b) differences.push({ category, change: 'changed', label, before: a, after: b })
  }
  changed('purpose', 'The question', before.question, after.question)
  changed('purpose', 'The takeaway', before.takeaway, after.takeaway)
  changed('demonstration', 'The demonstration', before.demonstration?.text || '', after.demonstration?.text || '')
  if (!same(before.ledger, after.ledger)) {
    const count = (plan: SceneTreatmentV1) => (plan.ledger ? `${plan.ledger.quantity}: ${plan.ledger.initial} → ${plan.ledger.final} over ${plan.ledger.events.length} changes` : 'no count')
    differences.push({ category: 'demonstration', change: before.ledger && after.ledger ? 'changed' : after.ledger ? 'added' : 'removed', label: 'The counted example', before: count(before), after: count(after) })
  }

  // Moments, in order: matched by id, then by title.
  const taken = new Set<TreatmentMoment>()
  for (const moment of after.moments) {
    const earlier = counterpart(moment, before.moments, taken)
    if (!earlier) {
      differences.push({ category: 'moments', change: 'added', label: moment.title, after: moment.observation })
      continue
    }
    taken.add(earlier)
    const name = moment.title
    if (earlier.title !== moment.title) changed('moments', `Moment "${earlier.title}" renamed`, earlier.title, moment.title)
    changed('moments', `${name}: what the viewer sees`, earlier.objects?.change || earlier.observation, moment.objects?.change || moment.observation)
    changed('narration', `${name}: what is said`, earlier.narration?.guide || earlier.narration?.job || '', moment.narration?.guide || moment.narration?.job || '')
    changed('text', `${name}: on-screen text`, earlier.text?.content || '', moment.text?.content || '')
    changed('camera', `${name}: camera`, earlier.camera ? `${earlier.camera.treatment} on ${earlier.camera.subject}` : '', moment.camera ? `${moment.camera.treatment} on ${moment.camera.subject}` : '')
    changed('presenter', `${name}: presenter`, earlier.presenter?.visibility || '', moment.presenter?.visibility || '')
  }
  for (const moment of before.moments) if (!taken.has(moment)) differences.push({ category: 'moments', change: 'removed', label: moment.title, before: moment.observation })

  // Objects: what each is made from, and how it performs.
  const decision = (object: SceneTreatmentV1['objects'][number]) => `${object.asset.status}${object.asset.ref ? ` ${object.asset.ref}` : ''}`
  for (const object of after.objects) {
    const earlier = before.objects.find(entry => entry.entity === object.entity)
    if (!earlier) {
      differences.push({ category: 'objects', change: 'added', label: object.entity, after: `${decision(object)} — ${object.performance}` })
      continue
    }
    changed('objects', `${object.entity}: artwork`, decision(earlier), decision(object))
    changed('objects', `${object.entity}: performance`, earlier.performance, object.performance)
  }
  for (const object of before.objects) if (!after.objects.some(entry => entry.entity === object.entity)) differences.push({ category: 'objects', change: 'removed', label: object.entity, before: decision(object) })

  // Seams.
  const seam = (plan: SceneTreatmentV1, side: 'incoming' | 'outgoing') => `${side === 'incoming' ? plan.continuity.entry : plan.continuity.exit} (${plan.continuity[side]?.kind || 'unstated'})`
  changed('continuity', 'How it opens', seam(before, 'incoming'), seam(after, 'incoming'))
  changed('continuity', 'How it leaves', seam(before, 'outgoing'), seam(after, 'outgoing'))
  return differences
}

export const DIFFERENCE_LABELS: Record<PlanDifferenceCategory, string> = {
  purpose: 'What it explains',
  demonstration: 'The example',
  moments: 'Moments',
  narration: 'What is said',
  objects: 'Objects and artwork',
  text: 'On-screen text',
  camera: 'Camera',
  presenter: 'Presenter',
  continuity: 'Seams',
}
