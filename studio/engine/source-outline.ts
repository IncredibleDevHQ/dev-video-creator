import type { SourceRead } from './source-document'
import {
  EVIDENCE_LABELS,
  type EvidenceKind,
  type EvidenceNeed
} from '../shared/narratives'
// ——— the outline ———

export const SCENE_KINDS = [
  'title',
  'list',
  'diagram',
  'numbers',
  'quote',
  'close'
] as const
export type SceneKind = (typeof SCENE_KINDS)[number]
export const PART_KINDS = ['box', 'step', 'note', 'number'] as const
export const VERBS = [
  'sends to',
  'waits for',
  'calls',
  'reads',
  'writes',
  'returns',
  'splits into',
  'merges into',
  'depends on',
  'becomes',
  'contains',
  'compares with',
  'feeds',
  'triggers'
] as const

export type OutlinePart = {
  label: string
  kind: (typeof PART_KINDS)[number]
  detail: string
}
export type OutlineScene = {
  title: string
  idea: string
  kind: SceneKind
  seconds: number
  parts: OutlinePart[]
  relations: Array<{ from: string; to: string; verb: string }>
  narration: string
  // The article's own sentences this scene rests on, verbatim. The outline
  // is a summary and loses the motivating example, the number and the
  // because; these carry them to the writer, which never sees the source.
  source: string[]
  // With a narrative: the beats the page carries, and the evidence it needs
  // (a verbatim sentence when the source holds it, null when it must be
  // asked for).
  beats?: string[]
  needs?: EvidenceNeed[]
}
export type Outline = {
  title: string
  targetSeconds: number
  scenes: OutlineScene[]
  glossary: Array<{ term: string; meaning: string }>
}

export const outlineSchema = () => ({
  type: 'object',
  additionalProperties: false,
  required: ['title', 'targetSeconds', 'scenes', 'glossary'],
  properties: {
    title: { type: 'string' },
    targetSeconds: { type: 'integer' },
    scenes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'title',
          'idea',
          'kind',
          'seconds',
          'parts',
          'relations',
          'narration',
          'source'
        ],
        properties: {
          title: { type: 'string' },
          idea: { type: 'string' },
          kind: { type: 'string', enum: [...SCENE_KINDS] },
          seconds: { type: 'integer' },
          parts: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['label', 'kind', 'detail'],
              properties: {
                label: { type: 'string' },
                kind: { type: 'string', enum: [...PART_KINDS] },
                detail: { type: 'string' }
              }
            }
          },
          relations: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['from', 'to', 'verb'],
              properties: {
                from: { type: 'string' },
                to: { type: 'string' },
                verb: { type: 'string', enum: [...VERBS] }
              }
            }
          },
          narration: { type: 'string' },
          source: { type: 'array', items: { type: 'string' } }
        }
      }
    },
    glossary: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['term', 'meaning'],
        properties: { term: { type: 'string' }, meaning: { type: 'string' } }
      }
    }
  }
})

export const outlinePrompt = (
  source: Pick<SourceRead, 'title' | 'site' | 'text' | 'words'>,
  targetSeconds: number | null,
  wordingPolicy: 'preserve' | 'assist' | 'draft' = 'draft'
) => {
  const target =
    targetSeconds ||
    Math.max(180, Math.min(540, Math.round((source.words / 2.4) * 0.45)))
  const wording =
    wordingPolicy === 'preserve'
      ? `WORDING POLICY — preserve: this text is the author's own narrative. The narration fields must reuse their sentences word for word wherever they carry the idea; your job is structure and order, not rewriting. Never replace a personal account with generic explanatory prose.`
      : wordingPolicy === 'assist'
        ? `WORDING POLICY — assist: this is the author's own narrative. Keep their voice, claims and examples; you may tighten sentences and propose clearer transitions, but every edit must stay recognisably theirs.`
        : `WORDING POLICY — draft: draft fresh narration from this material in a clear presenter voice.`
  return `You plan a narrated technical explainer video from a written source. A presenter speaks over pages; each page is a scene with one idea. Plan the outline, not the pages.

${wording}

SOURCE: "${source.title}"${source.site ? ` from ${source.site}` : ''} (${source.words} words)
---
${source.text}
---

Return the video's title, a target runtime of about ${target} seconds, and 6 to 14 scenes in order. Each scene:
- one idea, stated in a sentence ("idea");
- a kind: "title" for the opening card (first scene only), "list" for a set of parallel points, "diagram" when the idea is a structure or a process with parts that relate to each other, "numbers" when figures carry the point, "quote" when one statement is the picture, "close" for the last scene only;
- seconds it deserves: the title 12 to 18, the close 8 to 14, others 20 to 70 in proportion to how much the viewer must take in; the sum should land near the target;
- parts: the things the page must show, at most 8, each with a short label (2 to 4 words, as it would be drawn), a kind ("box" for a component or actor, "step" for an ordered stage, "number" for a figure with its unit, "note" for a short caption) and one line of detail; a "list" scene's parts are its points, a "numbers" scene's parts are its figures, a "title" and "close" scene have no parts;
- relations between parts for diagram scenes: from label, to label, and a verb from the allowed set that says what happens between them; use "waits for" for sequential dependency, "sends to" or "feeds" for flow, "splits into" and "merges into" for fan out and fan in, "compares with" for contrast;
- source: two to four FULL SENTENCES copied VERBATIM from the article that this scene rests on.
A heading, a label or a fragment is not a passage: take whole sentences that carry what a drawing cannot — a number, a named example, a consequence, or a reason (the ones with "because", "so that", "when", "if", or a figure).
Copy them exactly, do not paraphrase, do not stitch fragments together.
They are the writer's only access to the article, so choose what the summary would lose.
A title or close scene may have none;
- narration: a first draft of what the presenter says on this scene, two to four plain sentences in the second person plural or first person plural, grounded in the source and naming the parts by their labels; the close hands over or lands the point.
Also return a glossary of up to 12 terms the video introduces, each with a one-line meaning in the video's own words. Keep every label unique within a scene.`
}

// Loose comparison for "is this really in the article": whitespace, quotes
// and case differ between what a model copies and what the page rendered.
const flatten = (text: string) =>
  text
    .toLowerCase()
    .replace(/[\u2018\u2019\u201c\u201d"']/g, '')
    .replace(/\s+/g, ' ')
    .trim()

/** A scene's beats and needs, kept only when the planner gave them. */
const plannedFields = (
  scene: Record<string, unknown>,
  haystack: string
): Pick<OutlineScene, 'beats' | 'needs'> => {
  const beats = Array.isArray(scene.beats)
    ? [
        ...new Set(
          scene.beats
            .map((id) => String(id || '').trim())
            .filter((id) => /^[a-z0-9-]{1,40}$/.test(id))
        )
      ].slice(0, 8)
    : undefined
  const needs = Array.isArray(scene.needs)
    ? scene.needs
        .map((entry): EvidenceNeed | null => {
          const need = (
            entry && typeof entry === 'object' ? entry : {}
          ) as Record<string, unknown>
          const what = String(need.what || '')
            .trim()
            .slice(0, 160)
          const kind = String(need.kind || '') as EvidenceKind
          if (!what || !Object.hasOwn(EVIDENCE_LABELS, kind)) return null
          const quote = String(need.source || '')
            .trim()
            .replace(/\s+/g, ' ')
            .slice(0, 320)
          // A sentence the source does not hold is no source: ask for it.
          return {
            kind,
            what,
            source:
              quote && (!haystack || haystack.includes(flatten(quote)))
                ? quote
                : null
          }
        })
        .filter((need): need is EvidenceNeed => Boolean(need))
        .slice(0, 6)
    : undefined
  return { ...(beats ? { beats } : {}), ...(needs ? { needs } : {}) }
}

export const sanitizeOutline = (
  raw: unknown,
  fallbackTitle: string,
  sourceText = ''
): Outline => {
  const haystack = flatten(sourceText)
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<
    string,
    unknown
  >
  const scenes = (Array.isArray(o.scenes) ? o.scenes : [])
    .map((entry, index): OutlineScene | null => {
      const s = (entry && typeof entry === 'object' ? entry : {}) as Record<
        string,
        unknown
      >
      const title = String(s.title || '')
        .trim()
        .slice(0, 80)
      if (!title) return null
      const kind = SCENE_KINDS.includes(s.kind as SceneKind)
        ? (s.kind as SceneKind)
        : index === 0
          ? 'title'
          : 'diagram'
      const seen = new Set<string>()
      const parts = (Array.isArray(s.parts) ? s.parts : [])
        .map((part) => {
          const p = (part && typeof part === 'object' ? part : {}) as Record<
            string,
            unknown
          >
          const label = String(p.label || '')
            .trim()
            .slice(0, 40)
          if (!label || seen.has(label.toLowerCase())) return null
          seen.add(label.toLowerCase())
          return {
            label,
            kind: PART_KINDS.includes(p.kind as OutlinePart['kind'])
              ? (p.kind as OutlinePart['kind'])
              : 'box',
            detail: String(p.detail || '')
              .trim()
              .slice(0, 160)
          }
        })
        .filter((part): part is OutlinePart => Boolean(part))
        .slice(0, 8)
      const labels = new Set(parts.map((part) => part.label.toLowerCase()))
      const relations = (Array.isArray(s.relations) ? s.relations : [])
        .map((relation) => {
          const r = (
            relation && typeof relation === 'object' ? relation : {}
          ) as Record<string, unknown>
          const from = String(r.from || '').trim()
          const to = String(r.to || '').trim()
          const verb = String(r.verb || '').trim()
          if (
            !labels.has(from.toLowerCase()) ||
            !labels.has(to.toLowerCase()) ||
            from.toLowerCase() === to.toLowerCase()
          )
            return null
          return {
            from,
            to,
            verb: (VERBS as readonly string[]).includes(verb)
              ? verb
              : 'sends to'
          }
        })
        .filter(
          (relation): relation is { from: string; to: string; verb: string } =>
            Boolean(relation)
        )
        .slice(0, 16)
      return {
        title,
        idea: String(s.idea || '')
          .trim()
          .slice(0, 240),
        kind,
        seconds: Math.max(
          6,
          Math.min(120, Math.round(Number(s.seconds) || 30))
        ),
        parts,
        relations,
        narration: String(s.narration || '')
          .trim()
          .slice(0, 900),
        // Verbatim or not at all: a passage the article does not contain is
        // an invention, and the writer would treat it as fact.
        // Verbatim, and a sentence rather than a heading: long enough to
        // say something, and reading like prose or carrying a figure.
        source: (Array.isArray(s.source) ? s.source : [])
          .map((line) =>
            String(line || '')
              .trim()
              .replace(/\s+/g, ' ')
              .slice(0, 320)
          )
          .filter(
            (line) =>
              line.length >= 60 &&
              line.split(' ').length >= 10 &&
              (/[.!?]$/.test(line) || /\d/.test(line))
          )
          .filter((line) => !haystack || haystack.includes(flatten(line)))
          .slice(0, 4),
        ...plannedFields(s, haystack)
      }
    })
    .filter((scene): scene is OutlineScene => Boolean(scene))
    .slice(0, 40)
  const glossary = (Array.isArray(o.glossary) ? o.glossary : [])
    .map((entry) => {
      const g = (entry && typeof entry === 'object' ? entry : {}) as Record<
        string,
        unknown
      >
      const term = String(g.term || '')
        .trim()
        .slice(0, 40)
      return term
        ? {
            term,
            meaning: String(g.meaning || '')
              .trim()
              .slice(0, 160)
          }
        : null
    })
    .filter((entry): entry is { term: string; meaning: string } =>
      Boolean(entry)
    )
    .slice(0, 12)
  const total = scenes.reduce((sum, scene) => sum + scene.seconds, 0)
  return {
    title: String(o.title || fallbackTitle || 'Untitled video')
      .trim()
      .slice(0, 120),
    targetSeconds: Math.max(
      60,
      Math.min(1_800, Math.round(Number(o.targetSeconds) || total || 240))
    ),
    scenes,
    glossary
  }
}

// ——— pages: rendered here, so every page carries the contract ———
//
// The contract: stable ids per structure, named groups with data-role,
// labels as their own <text>, directed connectors with an arrowhead and a
// data-verb, and chrome (background, decoration, header, footer) marked so
// the atomiser never mistakes it for a part.
