// Jev, for a notebook: the template its source tells, a direction to tell
// it in, what the source holds; and, once the wireframes exist, which beat
// each page carries. Suggestions only: the creator decides.
import type { Snapshot } from '../shared/api'
import {
  AUDIENCE_LABELS,
  EVIDENCE_LABELS,
  LENGTHS,
  NARRATIVES,
  PRESETS,
  SUGGEST_CONFIDENCE,
  allowedPresets,
  directionSettings,
  lengthLabel,
  narrativeById,
  type Audience,
  type CoverageReading,
  type Direction,
  type Drama,
  type Elaboration,
  type EvidenceKind,
  type LengthRange,
  type PresetId,
  type TemplateSuggestion,
  suggestedDirection
} from '../shared/narratives'
import { askJev, jevConfigured, type JevAnswer, type JevQuestion } from './jev'
import { readRow } from './persistence'
import { addEvent, changeProject, loadProject } from './projects'
import type { SourceRead } from './source-document'

const ELABORATION: Elaboration[] = ['brief', 'standard', 'thorough']
const DRAMA: Drama[] = ['calm', 'lively', 'dramatic']
const EVIDENCE_WORDS: Record<EvidenceKind, string> = {
  numbers: 'figures that carry the point: counts, rates, latencies, costs',
  timeline: 'a sequence of events with times or dates',
  code: 'code the viewer needs to see',
  diff: 'a before-and-after change to code or configuration',
  diagram: 'a structure or a flow with parts that relate',
  demo: 'a product someone can be shown using',
  terminal: 'commands and their output',
  quote: 'a statement worth showing word for word',
  creator: 'a personal account by the author'
}
const lengthKey = (range: LengthRange) => `l${range[0]}-${range[1]}`

/** The questions Jev is asked about a source. */
export const suggestionQuestions = (): Record<string, JevQuestion> => ({
  narrative: {
    type: 'choice',
    instructions:
      'Which kind of engineering story does this source tell? Pick the template whose story it is.',
    criteria: Object.fromEntries(
      NARRATIVES.map((item) => [item.id, `${item.name}: ${item.line}`])
    )
  },
  direction: {
    type: 'choice',
    instructions: 'Which way of telling suits this source best?',
    criteria: Object.fromEntries(
      PRESETS.map((preset) => [preset.id, `${preset.name}: ${preset.line}`])
    )
  },
  length: {
    type: 'choice',
    instructions: 'How long a video does this source support without padding?',
    criteria: Object.fromEntries(
      LENGTHS.map((range) => [lengthKey(range), lengthLabel(range)])
    )
  },
  audience: {
    type: 'choice',
    instructions: 'Who is this source written for?',
    criteria: AUDIENCE_LABELS
  },
  elaboration: {
    type: 'score',
    instructions: 'How much explanation does the source support?',
    criteria: ['Brief', 'Standard', 'Thorough']
  },
  drama: {
    type: 'score',
    instructions: 'How much tension does the source carry?',
    criteria: ['Calm', 'Lively', 'Dramatic']
  },
  ...Object.fromEntries(
    (Object.keys(EVIDENCE_LABELS) as EvidenceKind[]).map((kind) => [
      `evidence_${kind}`,
      {
        type: 'noul' as const,
        instructions: `Does the source hold ${EVIDENCE_WORDS[kind]}?`
      }
    ])
  )
})

const choice = (answer?: JevAnswer) =>
  answer?.type === 'choice' ? answer : null
const level = <T>(answer: JevAnswer | undefined, levels: T[], fallback: T) =>
  answer?.type === 'score'
    ? (levels[
        Math.max(0, Math.min(levels.length - 1, Math.round(answer.score)))
      ] ?? fallback)
    : fallback

/** Jev's answers, read as a suggestion. */
export const readSuggestion = (
  answers: Record<string, JevAnswer>,
  at = new Date().toISOString()
): TemplateSuggestion | null => {
  const narrative = choice(answers.narrative)
  if (!narrative || !narrativeById(narrative.choice)) return null
  const narratives = Object.entries(narrative.probabilities)
    .filter(([id]) => narrativeById(id))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id, p]) => ({ id, p: Math.round(p * 100) / 100 }))
  const sure = (answer: ReturnType<typeof choice>) =>
    answer && answer.confidence >= SUGGEST_CONFIDENCE ? answer.choice : null
  const preset = choice(answers.direction)?.choice as PresetId | undefined
  const length = LENGTHS.find(
    (range) => lengthKey(range) === sure(choice(answers.length))
  )
  const audience = sure(choice(answers.audience))
  return {
    at,
    narratives,
    confidence: Math.round(narrative.confidence * 100) / 100,
    preset: PRESETS.some((item) => item.id === preset)
      ? (preset as PresetId)
      : narrativeById(narrative.choice)!.preset,
    length: length || null,
    audience:
      audience && audience in AUDIENCE_LABELS ? (audience as Audience) : null,
    evidence: Object.fromEntries(
      (Object.keys(EVIDENCE_LABELS) as EvidenceKind[]).flatMap((kind) => {
        const answer = answers[`evidence_${kind}`]
        return answer?.type === 'noul'
          ? [[kind, Math.round(answer.noul * 100) / 100]]
          : []
      })
    ),
    elaboration: level(answers.elaboration, ELABORATION, 'standard'),
    drama: level(answers.drama, DRAMA, 'calm'),
    preselected: false
  }
}

/**
 * Asks Jev what the notebook's source tells and keeps the answer on the
 * notebook. A sure answer becomes the notebook's template when it has none
 * and no wireframe exists yet; an unsure one waits for the creator.
 */
export const suggestTemplate = async (id: string) => {
  if (!jevConfigured())
    throw new Error('Jev is not set up: add TYPESAFE_API_KEY to .env')
  const source = await readRow<SourceRead>('sources', id)
  const snapshot = await loadProject(id)
  if (!source || !snapshot) throw new Error('Read the source first')
  const answers = await askJev(
    { title: source.title, text: source.text.slice(0, 24_000) },
    suggestionQuestions()
  )
  const suggestion = readSuggestion(answers)
  if (!suggestion) throw new Error('Jev did not suggest a template')
  return changeProject(id, (current) => {
    const open =
      ['draft', 'failed'].includes(current.status) &&
      !current.project.slides.length &&
      !current.project.narrative
    if (open && suggestion.confidence >= SUGGEST_CONFIDENCE) {
      const top = suggestion.narratives[0].id
      suggestion.preselected = true
      current.project.narrative = top
      current.project.direction = suggestedDirection(top, suggestion)
      addEvent(
        current,
        'slide',
        `Suggested the ${narrativeById(top)!.name} template`
      )
    }
    current.suggestion = suggestion
  })
}

/** In the background, after a source is read: never in the creator's way. */
export const suggestQuietly = (id: string) => {
  if (jevConfigured()) void suggestTemplate(id).catch(() => {})
}

/**
 * Which beat each wireframe carries, as Jev reads it, beside the beats the
 * story planner gave it. A page it reads differently is worth a look.
 */
export const readCoverage = async (
  snapshot: Snapshot
): Promise<CoverageReading | null> => {
  const narrative = narrativeById(snapshot.project.narrative)
  const pages = snapshot.project.slides.filter((slide) => slide.beats?.length)
  if (!narrative || !pages.length) return null
  const criteria = {
    ...Object.fromEntries(
      narrative.beats.map((beat) => [beat.id, `${beat.name}: ${beat.know}`])
    ),
    none: 'None of these beats'
  }
  const answers = await askJev(
    {
      story: `${narrative.name}: ${narrative.line}`,
      pages: pages.map((slide, index) => ({
        page: index + 1,
        title: slide.title,
        idea: slide.idea || '',
        narration: slide.narration || ''
      }))
    },
    Object.fromEntries(
      pages.map((slide, index) => [
        `page_${index + 1}`,
        {
          type: 'choice' as const,
          instructions: `Which beat of the story does page ${index + 1}, “${slide.title}”, carry?`,
          criteria
        }
      ])
    )
  )
  return {
    at: new Date().toISOString(),
    pages: Object.fromEntries(
      pages.flatMap((slide, index) => {
        const answer = choice(answers[`page_${index + 1}`])
        return answer
          ? [
              [
                slide.id,
                {
                  beat: answer.choice,
                  confidence: Math.round(answer.confidence * 100) / 100
                }
              ]
            ]
          : []
      })
    )
  }
}

/** Keeps Jev's reading of the wireframes on the notebook. */
export const checkCoverage = async (id: string) => {
  const snapshot = await loadProject(id)
  if (!snapshot || !jevConfigured()) return snapshot
  const reading = await readCoverage(snapshot)
  if (!reading) return snapshot
  return changeProject(id, (current) => {
    current.coverageReading = reading
  })
}
