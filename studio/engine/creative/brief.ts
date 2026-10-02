import type { Project } from '../../shared/model'
import { readRow, writeRow } from '../persistence'
import { fingerprintOf } from '../planning/fingerprint'
import { validateBrief, type BriefContext } from './explanation-brief'
import { runValidatedJsonStage, type CreativeSelection } from './stage'
import type { ExplanationBriefV1 } from './explanation-brief'
import type { HarnessEvent } from '../harness/types'
export const prepareCreativeBrief = async (
  project: Project,
  selection: CreativeSelection,
  origin: string,
  onEvent?: (event: HarnessEvent) => Promise<void> | void,
  phase: 'source' | 'video' = 'video'
) => {
  const retained = await readRow<{ text: string; title: string }>(
    'sources',
    project.id
  )
  const sourceText = retained?.text || project.source
  const sourceRevision = fingerprintOf(sourceText),
    baseRevision = fingerprintOf(project.slides)
  const themeRef = fingerprintOf(project.branding || null)
  const context: BriefContext = {
    baseSceneIds: project.slides.map((slide) => slide.id),
    sourceRevision,
    sourceText,
    creatorText: '',
    wordingPolicy: 'draft',
    scripts: [],
    baseNotebookRef: project.id,
    baseRevision,
    themeRef,
    sceneDecisions: [],
    requestedSeconds: null
  }
  const inputKey = fingerprintOf(context)
  const sourceBrief =
    phase === 'video'
      ? await readRow<{ brief: ExplanationBriefV1 }>(
          'source-briefs',
          project.id
        )
      : null
  const brief = await runValidatedJsonStage({
    projectId: project.id,
    inputKey,
    checkpoint: phase === 'source' ? 'creative-source-brief' : 'creative-brief',
    route: 'Prepare Brief',
    file: 'planning/brief.json',
    tool: 'plan_submit_brief',
    selection,
    origin,
    onEvent,
    packet: {
      ...(sourceBrief
        ? { 'packet/SOURCE_BRIEF.json': JSON.stringify(sourceBrief.brief) }
        : {}),
      'packet/CONTEXT.json': JSON.stringify(context, null, 2),
      'packet/SOURCE.md': sourceText
        .split(/\n\s*\n/)
        .map((paragraph, index) => `[paragraph ${index + 1}]\n${paragraph}`)
        .join('\n\n'),
      'packet/NARRATIVE.md':
        (phase === 'source'
          ? 'This is the source explanation brief before story and presentation design. There are no base pages yet: keep coverage empty and derive the question, entities, evidence and explanatory units from the full source. '
          : sourceBrief
            ? 'Continue the retained source brief: preserve its explanatory intent and evidence, now mapping coverage onto the designed presentation. '
            : '') +
        'The creator requests an explanatory video from the retained source. No approved exact narration or length was supplied. Presentation notes are references, not creator decisions.',
      'packet/THEME.json': JSON.stringify({
        ref: themeRef,
        branding: project.branding || null
      }),
      'packet/PRESENTATION.md': project.slides
        .map(
          (slide) =>
            `## ${slide.id}: ${slide.title}\nIdea: ${slide.idea || ''}\nReference narration: ${slide.narration || ''}\nEvidence: ${(slide.evidence || []).join('\n')}`
        )
        .join('\n\n')
    },
    validate: (raw) => {
      const report = validateBrief(raw, context)
      return { ...report, value: report.brief }
    }
  })
  if (phase === 'source')
    await writeRow('source-briefs', project.id, {
      projectId: project.id,
      sourceRevision,
      brief
    })
  return brief
}
