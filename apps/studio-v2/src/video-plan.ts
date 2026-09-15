// The video object: one plan above the scenes. Each scene is handed the
// slice it needs — its neighbours, its share of the runtime, the shared
// names. Budgets follow the target runtime and the arc role, not only the
// drawing: framing scenes (hook, map, close) take a capped share and the
// body shares the rest by what its pictures deserve, so at a longer target
// the idea grows and the table of contents does not.
import type { ProjectDocumentV1, TiptapNode } from 'markdown-composition'
import { arcRoleFor, declaredSceneKind, type ArcRole, type SceneKind } from './director'

export type VideoPlanScene = {
  nodeId: string
  index: number
  title: string
  kind: SceneKind
  arcRole: ArcRole
  pageRole: string
  idea: string
  naturalSeconds: number
  budgetSeconds: number | null
  previous: { nodeId: string; title: string; idea: string } | null
  next: { nodeId: string; title: string; idea: string } | null
  entities: Array<{ id: string; label: string; type: string }>
}

export type VideoPlan = {
  targetSeconds: number | null
  naturalSeconds: number
  plannedSeconds: number
  scenes: VideoPlanScene[]
  glossary: Array<{ term: string; meaning: string }>
  // Entity identity across pages: one key per thing, the scenes it is on.
  entities: Record<string, { key: string; label: string; type: string; scenes: string[] }>
}

// The share of the runtime a framing scene may take, and the weight the
// body scenes share the rest by (the length brief's role scale).
const ROLE_CAP: Partial<Record<ArcRole, number>> = { hook: 0.08, map: 0.06, close: 0.06 }
const ROLE_WEIGHT: Record<ArcRole, number> = { hook: 0.75, map: 0.9, build: 1, idea: 1.15, explain: 1, evidence: 1.05, close: 0.7 }
const MIN_SECONDS = 8
const MAX_SECONDS = 20 * 60
const ARC_ROLES: ArcRole[] = ['hook', 'map', 'build', 'idea', 'explain', 'evidence', 'close']
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value))
const round1 = (value: number) => Math.round(value * 10) / 10

export const entityKey = (label: string, type: string) => {
  const words = label.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean)
  const singular = words.map(word => (word.length > 4 && word.endsWith('s') && !word.endsWith('ss') ? word.slice(0, -1) : word))
  return `${type}:${singular.join(' ')}`
}

const pageRoleOf = (node: TiptapNode) => {
  const svg = String(node.attrs?.svg || '')
  const match = /data-(?:pptx-)?page-role="([^"]+)"/.exec(svg.slice(0, 2000))
  return match ? match[1] : ''
}

export const videoPlanFor = (project: ProjectDocumentV1): VideoPlan => {
  const nodes = project.notebook.content.filter(node => (node.type === 'scene' || node.type === 'slide') && typeof node.attrs?.id === 'string')
  const count = Math.max(1, nodes.length)
  const outlineScenes = project.outline?.scenes || []
  const base = nodes.map((node, index) => {
    const attrs = node.attrs as Record<string, unknown>
    const nodeId = String(attrs.id)
    const pageRole = pageRoleOf(node)
    const brief = attrs.lengthBrief && typeof attrs.lengthBrief === 'object' ? (attrs.lengthBrief as { seconds?: number; kind?: SceneKind }) : null
    const auto = attrs.directorAuto && typeof attrs.directorAuto === 'object' ? (attrs.directorAuto as { kind?: SceneKind }) : null
    const kind: SceneKind = declaredSceneKind(pageRole) || brief?.kind || auto?.kind || 'diagram'
    // An authored role (the gold storyboard's arcRole) is never overwritten;
    // otherwise the role follows the kind and the position.
    const authored = ARC_ROLES.includes(attrs.arcRole as ArcRole) ? (attrs.arcRole as ArcRole) : null
    const arcRole = authored || arcRoleFor(kind, { index, count }, [], pageRole)
    const title = String(attrs.title || `Scene ${index + 1}`)
    const fromOutline = outlineScenes.find(scene => scene.nodeId === nodeId) || outlineScenes.find(scene => scene.title === title)
    const idea = String(attrs.directorNotes || fromOutline?.idea || '').trim().slice(0, 240)
    const naturalSeconds = round1(clamp(Number(brief?.seconds) || (Number(project.blocks[nodeId]?.durationMs) || 0) / 1000 || 30, MIN_SECONDS, MAX_SECONDS))
    const motion = attrs.motion && typeof attrs.motion === 'object' ? (attrs.motion as { entities?: Array<{ id: string; label: string; type: string }> }) : null
    const entities = Array.isArray(motion?.entities) ? motion!.entities!.map(entity => ({ id: entity.id, label: entity.label, type: entity.type })) : []
    return { nodeId, index, title, kind, arcRole, pageRole, idea, naturalSeconds, entities }
  })
  const targetSeconds = Number(project.outline?.targetSeconds) > 0 ? Number(project.outline!.targetSeconds) : null
  let budgets: Array<number | null> = base.map(() => null)
  if (targetSeconds && base.length) {
    const framing = base.map(scene => {
      const cap = ROLE_CAP[scene.arcRole]
      return cap ? Math.max(MIN_SECONDS, Math.min(targetSeconds * cap, scene.naturalSeconds)) : null
    })
    const framingTotal = framing.reduce<number>((sum, value) => sum + (value || 0), 0)
    const weightOf = (scene: (typeof base)[number]) => scene.naturalSeconds * ROLE_WEIGHT[scene.arcRole]
    const weightTotal = base.reduce((sum, scene, index) => sum + (framing[index] === null ? weightOf(scene) : 0), 0) || 1
    const rest = Math.max(0, targetSeconds - framingTotal)
    budgets = base.map((scene, index) => round1(framing[index] !== null ? framing[index]! : clamp((rest * weightOf(scene)) / weightTotal, MIN_SECONDS, MAX_SECONDS)))
  }
  const scenes: VideoPlanScene[] = base.map((scene, index) => ({
    ...scene,
    budgetSeconds: budgets[index],
    previous: index > 0 ? { nodeId: base[index - 1].nodeId, title: base[index - 1].title, idea: base[index - 1].idea } : null,
    next: index + 1 < base.length ? { nodeId: base[index + 1].nodeId, title: base[index + 1].title, idea: base[index + 1].idea } : null,
  }))
  const entities: VideoPlan['entities'] = {}
  scenes.forEach(scene => {
    scene.entities.forEach(entity => {
      const key = entityKey(entity.label, entity.type)
      const record = (entities[key] ||= { key, label: entity.label, type: entity.type, scenes: [] })
      if (!record.scenes.includes(scene.nodeId)) record.scenes.push(scene.nodeId)
    })
  })
  const naturalSeconds = round1(base.reduce((sum, scene) => sum + scene.naturalSeconds, 0))
  const plannedSeconds = round1(scenes.reduce((sum, scene) => sum + (scene.budgetSeconds ?? scene.naturalSeconds), 0))
  return { targetSeconds, naturalSeconds, plannedSeconds, scenes, glossary: project.outline?.glossary || [], entities }
}

// What changed for each scene between two plans: a new role, or a new
// scene after it (so its outro hands over to the wrong place).
export const arcChanges = (before: VideoPlan, after: VideoPlan) =>
  after.scenes.flatMap(scene => {
    const was = before.scenes.find(entry => entry.nodeId === scene.nodeId)
    if (!was) return []
    const role = was.arcRole !== scene.arcRole ? { from: was.arcRole, to: scene.arcRole } : null
    const outro = (was.next?.nodeId || '') !== (scene.next?.nodeId || '') ? { was: was.next?.title || '(the end)', now: scene.next?.title || '(the end)' } : null
    return role || outro ? [{ nodeId: scene.nodeId, title: scene.title, role, outro }] : []
  })
