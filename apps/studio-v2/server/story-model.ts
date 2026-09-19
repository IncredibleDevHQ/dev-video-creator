// Story-level records for the grounded base notebook (D2).
//
// WordingPolicy governs how much the creator's supplied text may be
// rewritten; buildExplanationModel turns an outline into claims, objects and
// relations with stable first-class identities — positional scene ids (so
// duplicate titles cannot collide), label-normalised object ids shared
// across scenes (so the same thing is the same thing on every page), and
// relation ids that resolve through those objects. Labels and SVG
// coordinates stay presentation, never identity.
import type { Outline } from './source'

export const WORDING_POLICIES = ['preserve', 'assist', 'draft'] as const
export type WordingPolicy = (typeof WORDING_POLICIES)[number]

export const wordingPolicyFrom = (value: unknown, fallback: WordingPolicy = 'draft'): WordingPolicy =>
  (WORDING_POLICIES as readonly string[]).includes(String(value)) ? (value as WordingPolicy) : fallback

const slugify = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32) || 'item'

export type ExplanationModelV1 = {
  version: 1
  scenes: Array<{
    id: string
    index: number
    title: string
    kind: string
    // The viewer question this page answers and the takeaway it lands.
    question: string
    answer: string
    source: string[]
  }>
  objects: Array<{ id: string; label: string; kind: string; scenes: string[] }>
  relations: Array<{ id: string; scene: string; from: string; to: string; verb: string }>
  claims: Array<{ id: string; scene: string; text: string; source: string[]; illustrative: boolean }>
}

export const buildExplanationModel = (outline: Outline): ExplanationModelV1 => {
  const scenes: ExplanationModelV1['scenes'] = []
  const objects: ExplanationModelV1['objects'] = []
  const relations: ExplanationModelV1['relations'] = []
  const claims: ExplanationModelV1['claims'] = []
  // An object keeps one id across every scene that names it; two different
  // things that share a label get disambiguated by kind.
  const objectByKey = new Map<string, string>()

  outline.scenes.forEach((scene, index) => {
    const sceneId = `scene-${index + 1}-${slugify(scene.title)}`
    scenes.push({
      id: sceneId,
      index,
      title: scene.title,
      kind: scene.kind,
      question: scene.idea,
      answer: scene.narration,
      source: scene.source,
    })
    const localIds = new Map<string, string>()
    for (const part of scene.parts) {
      const key = `${part.kind}:${part.label.toLowerCase()}`
      let objectId = objectByKey.get(key)
      if (!objectId) {
        objectId = `obj-${slugify(part.label)}-${objectByKey.size + 1}`
        objectByKey.set(key, objectId)
        objects.push({ id: objectId, label: part.label, kind: part.kind, scenes: [] })
      }
      localIds.set(part.label.toLowerCase(), objectId)
      const record = objects.find(object => object.id === objectId)
      if (record && !record.scenes.includes(sceneId)) record.scenes.push(sceneId)
    }
    scene.relations.forEach((relation, relationIndex) => {
      const from = localIds.get(relation.from.toLowerCase())
      const to = localIds.get(relation.to.toLowerCase())
      if (!from || !to) return
      relations.push({ id: `rel-${sceneId}-${relationIndex + 1}`, scene: sceneId, from, to, verb: relation.verb })
    })
    // The scene's idea and narration are its claims: grounded when source
    // passages back them, explicitly illustrative when they do not.
    const sceneClaims = [scene.idea, scene.narration].filter(text => text.trim())
    sceneClaims.forEach((text, claimIndex) => {
      claims.push({
        id: `claim-${sceneId}-${claimIndex + 1}`,
        scene: sceneId,
        text,
        source: scene.source,
        illustrative: scene.source.length === 0,
      })
    })
  })
  return { version: 1, scenes, objects, relations, claims }
}
