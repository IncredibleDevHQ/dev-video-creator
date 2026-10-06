// The handoff to the pinned Hyperframes planning skills.
//
// Upstream workflows read a native `BRIEF.md`: routing and run fields in YAML
// frontmatter, intent in four optional prose sections. A product-specific
// field is not understood merely because it appears in that YAML, so the
// product's meaning travels in a companion, `EXPLANATION.md`, which the
// adapted planning instruction reads explicitly. The native brief carries a
// compact digest and names the companion.
//
// Only choices already made belong in the handoff. Inferred suggestions are
// never written into the native Customizations section, which upstream
// treats as what the user accepted.
import type { ExplanationBriefV1, StatementBasis } from './explanation-brief'
import type { SceneTreatmentV1 } from './scene-treatment'
import { SEAM_LABELS } from '../../shared/video-templates'

const yamlString = (value: string) =>
  JSON.stringify(value.replace(/\s+/g, ' ').trim())
const bullet = (lines: string[]) =>
  lines
    .filter(Boolean)
    .map((line) => `- ${line}`)
    .join('\n')
const basisTag: Record<StatementBasis | 'illustrative', string> = {
  source: 'source',
  creator: 'creator',
  suggestion: 'suggestion',
  illustrative: 'illustrative'
}

// The native envelope, in the upstream brief format.
export const renderNativeBrief = (
  brief: ExplanationBriefV1,
  options: { aspect?: string } = {}
) => {
  const frontmatter = [
    '---',
    `workflow: ${brief.route.workflow}`,
    // The run is planned and reviewed before anything is built.
    'flow: automation',
    'storyboard: yes',
    `message: ${yamlString(brief.purpose.message)}`,
    `audience: ${yamlString(brief.purpose.audience)}`,
    `language: ${brief.purpose.language || 'en'}`,
    `aspect: ${options.aspect || '1920x1080'}`,
    ...(brief.purpose.requestedSeconds
      ? [`length: ${brief.purpose.requestedSeconds}s`]
      : []),
    'angle: explanation',
    '---'
  ]
  const creatorAsks = brief.creativeGuidance
    .filter((entry) => entry.basis === 'creator')
    .map((entry) => entry.text)
  const sections = [
    '## Intent',
    '',
    `${brief.purpose.deliverable} for ${brief.purpose.audience}. The one thing it must communicate: ${brief.purpose.message}`,
    brief.purpose.styleConstraints.length
      ? `\nStyle constraints: ${brief.purpose.styleConstraints.join('; ')}.`
      : '',
    '',
    '## Assets',
    '',
    bullet([
      `Base presentation notebook ${brief.material.baseNotebookRef} at revision ${brief.material.baseRevision} — a visual reference and storyboard, not a layout to reproduce.`,
      brief.material.themeRef
        ? `Saved theme ${brief.material.themeRef} — translate it into a video design; keep its factual colour meanings.`
        : '',
      ...brief.material.assetRefs.map((ref) => `Accepted asset ${ref}.`),
      ...brief.material.takeRefs.map((ref) => `Recorded take ${ref}.`)
    ]) || '- None selected yet.',
    '',
    ...(creatorAsks.length
      ? ['## Customizations', '', bullet(creatorAsks), '']
      : []),
    '## Notes',
    '',
    bullet([
      "Read EXPLANATION.md before planning: it carries the source meaning, the evidence, the explanation units and the creator's constraints. This file is only its digest.",
      `Wording policy: ${brief.source.wordingPolicy}.${brief.source.wordingPolicy === 'preserve' ? ' The approved lines are spoken verbatim.' : ''}`,
      brief.delivery.unresolved ? `Delivery: ${brief.delivery.unresolved}` : '',
      `Route: ${brief.route.workflow} — ${brief.route.reason}`,
      ...brief.openDecisions.map((decision) => `Open: ${decision}`)
    ]),
    ''
  ]
  return `${frontmatter.join('\n')}\n\n${sections.join('\n').replace(/\n{3,}/g, '\n\n')}`
}

// The companion: the whole reduction, readable, with every statement's basis.
export const renderExplanation = (brief: ExplanationBriefV1) => {
  const evidence = new Map(brief.evidence.map((entry) => [entry.id, entry]))
  const cite = (refs: string[]) => (refs.length ? ` [${refs.join(', ')}]` : '')
  const lines: string[] = [
    '# Explanation',
    '',
    `**Message.** ${brief.purpose.message}`,
    '',
    `**Audience.** ${brief.purpose.audience}. **Deliverable.** ${brief.purpose.deliverable}. **Language.** ${brief.purpose.language}.${brief.purpose.requestedSeconds ? ` **Requested length.** about ${brief.purpose.requestedSeconds} seconds for the whole video.` : ''}`,
    '',
    '## Source',
    '',
    `Source revision \`${brief.source.revisionRef}\`${brief.source.narrativeRef ? `, narrative revision \`${brief.source.narrativeRef}\`` : ''}. Coverage: ${brief.source.coverage}.`,
    ...(brief.source.limitations.length
      ? ['', 'Limitations:', bullet(brief.source.limitations)]
      : []),
    '',
    '### Evidence',
    '',
    ...brief.evidence.map(
      (entry) =>
        `- **${entry.id}** (${entry.kind}${entry.locator ? `, ${entry.locator}` : ''}): "${entry.text}"`
    ),
    '',
    '## Entities',
    '',
    ...brief.entities.map((entity) =>
      [
        `- **${entity.name}** \`${entity.id}\` — ${entity.role}${cite(entity.evidenceRefs)}`,
        ...entity.interactions.map((interaction) => `  - ${interaction}`)
      ].join('\n')
    ),
    '',
    '## Explanation units',
    ''
  ]
  for (const unit of brief.units) {
    lines.push(
      `### ${unit.id}: ${unit.question}`,
      '',
      `${unit.explain}${cite(unit.evidenceRefs)}`,
      '',
      ...(unit.entities.length
        ? [`Entities: ${unit.entities.join(', ')}.`, '']
        : []),
      ...(unit.dependsOn.length
        ? [`Depends on: ${unit.dependsOn.join(', ')} (causal).`, '']
        : []),
      ...(unit.conditions.length
        ? [
            'Conditions:',
            bullet(
              unit.conditions.map(
                (condition) =>
                  `${condition.text} _(${basisTag[condition.basis]})_`
              )
            ),
            ''
          ]
        : []),
      ...(unit.demonstration
        ? [
            `Demonstration (${unit.demonstration.basis}): ${unit.demonstration.text}`,
            ''
          ]
        : ['Demonstration: open — the creative plan proposes one.', '']),
      ...(unit.observations.length
        ? [
            'The creator requires the viewer to notice:',
            bullet(unit.observations),
            ''
          ]
        : []),
      'Communication needs:',
      bullet(
        unit.communicationNeeds.map(
          (need) => `${need.need} — ${need.why} _(${basisTag[need.basis]})_`
        )
      ),
      '',
      ...(unit.preserve.length ? ['Preserve:', bullet(unit.preserve), ''] : []),
      ...(unit.originScenes.length
        ? [
            `From base pages: ${unit.originScenes.join(', ')} (lineage only, not a scene boundary).`,
            ''
          ]
        : [])
    )
  }
  lines.push(
    '## Progression',
    '',
    ...brief.progression.map(
      (step, index) =>
        `${index + 1}. ${step.unit} — ${step.note} _(${step.ordering})_`
    ),
    '',
    '## Narrative',
    '',
    ...(brief.narrative.approvedLines.length
      ? [
          'Approved lines (verbatim):',
          ...brief.narrative.approvedLines.map(
            (line) => `- ${line.scene}: "${line.text}"`
          ),
          ''
        ]
      : []),
    ...(brief.narrative.terminology.length
      ? [
          'Terminology:',
          bullet(
            brief.narrative.terminology.map(
              (term) => `**${term.term}** — ${term.meaning}`
            )
          ),
          ''
        ]
      : []),
    ...(brief.narrative.omissions.length
      ? ['Intentional omissions:', bullet(brief.narrative.omissions), '']
      : []),
    '## Material and delivery',
    '',
    bullet([
      `Base notebook ${brief.material.baseNotebookRef} @ ${brief.material.baseRevision}`,
      brief.material.themeRef
        ? `Theme ${brief.material.themeRef}`
        : 'No saved theme',
      brief.material.assetRefs.length
        ? `Assets selected: ${brief.material.assetRefs.join(', ')}`
        : 'No assets selected for this brief (the library may still hold reusable ones)',
      brief.material.takeRefs.length
        ? `Takes: ${brief.material.takeRefs.join(', ')}`
        : 'No recorded takes',
      ...brief.delivery.sceneDecisions.map(
        (decision) =>
          `Scene ${decision.scene}: ${decision.voice} (creator's choice)`
      ),
      brief.delivery.unresolved
        ? `Unresolved: ${brief.delivery.unresolved}`
        : ''
    ]),
    '',
    '## Creative guidance',
    '',
    bullet(
      brief.creativeGuidance.map(
        (entry) => `${entry.text} _(${basisTag[entry.basis]})_`
      )
    ) || '- None.',
    '',
    '## Open decisions',
    '',
    bullet(brief.openDecisions) || '- None recorded.',
    '',
    '## Uncertainty',
    '',
    bullet(
      brief.uncertainty.map((entry) => `${entry.text} _(${entry.kind})_`)
    ) || '- None recorded.',
    '',
    '## Lineage',
    '',
    ...brief.coverage.map(
      (entry) =>
        `- Base page ${entry.scene} → ${entry.units.length ? entry.units.join(', ') : `left out: ${entry.omittedReason}`}`
    ),
    ''
  )
  // An unused evidence id is fine; a cited one must exist. Mark any that do not.
  const cited = new Set([
    ...brief.entities.flatMap((entity) => entity.evidenceRefs),
    ...brief.units.flatMap((unit) => unit.evidenceRefs)
  ])
  const unknown = [...cited].filter((ref) => !evidence.has(ref))
  if (unknown.length)
    lines.push(`> Unresolved evidence references: ${unknown.join(', ')}`, '')
  return lines.join('\n').replace(/\n{3,}/g, '\n\n')
}

// A scene's planning packet: everything the planner needs for this scene,
// standing alone — the video-wide brief travels beside it.
export type ScenePacketInput = {
  videoTitle: string
  scene: { id: string; title: string; index: number; originScenes: string[] }
  // What the base's presentation designer was given for these pages —
  // reference only: never a scene boundary, a layout or a duration.
  presentation: Array<{
    scene: string
    title: string
    objective: string
    layoutGuidance: string
    narration: string
    sourcePassages: string[]
    wireframe: string | null
  }>
  script: string
  units: string[]
  adjacent: Array<{
    position: 'before' | 'after'
    id: string
    title: string
    units: string[]
    takeaway: string | null
    // Its plan now: a reviewed one can be agreed with; a candidate's
    // boundary is only a proposal.
    plan?: {
      state: 'reviewed' | 'candidate'
      revision: number
      entry: string
      exit: string
    } | null
  }>
  direction: { video: string; scene: string }
  delivery: 'human' | 'generated' | 'silent' | null
  // On camera (R07 of the projects-first rereview), and where the choice
  // came from; and whether this is the video's opening (R09).
  presence?: {
    value: 'off' | 'low' | 'high' | null
    from: 'scene' | 'video' | null
  }
  intro?: boolean
  // The slot of the video's template this scene plays, when there is one.
  template?: import('../../shared/video-templates').SlotBrief
  reviewed: SceneTreatmentV1 | null
  assets: Array<{ key: string; role: string; parts: string[] }>
}

// On camera, apart from who speaks (R07 of the projects-first rereview).
const presenceLine = (
  presence: ScenePacketInput['presence'],
  delivery: ScenePacketInput['delivery']
) => {
  const whose =
    presence?.from === 'scene'
      ? "the creator's choice for this scene"
      : "the video's default, which this scene follows"
  switch (presence?.value) {
    case 'off':
      return `On-camera presence: Off (${whose}). No moment shows the presenter: every presenter.visibility is "hidden" and no presenter space is reserved.${delivery === 'human' ? " The creator's voice is voice-over." : ''}`
    case 'low':
      return `On-camera presence: Low (${whose}). The presenter appears only in the scene's closing moment, for its takeaway or the bridge to the next scene (full or shared frame); every earlier moment hides them. Plan that closing layout and its entrance.`
    case 'high':
      return `On-camera presence: High (${whose}). The presenter opens and closes the scene (its first and last moments show them, full or shared) and may hand over between its ideas where a new idea benefits. Keep a technical demonstration continuous: never cut to the presenter between small animations. Choose full frame, shared frame or an inset by the space and reading each moment needs, and say which in presenter.reason.`
    default:
      return 'On-camera presence is not decided: presenter.visibility is a suggestion ("undecided" where it depends on that choice).'
  }
}
// The video's opening (R09 and U02 of the projects-first rereview): not a
// mechanism demonstration, but the hook, the stakes, the promise and the
// handoff — with the video's actual title shown and read.
const introSection = (title: string) => [
  "## This scene's role: the video's opening",
  '',
  `This is the first scene of the video titled "${title}". It is not a mechanism demonstration and needs no numeric example (demonstration.example may be absent). In order, it establishes:`,
  '',
  bullet([
    'the hook — the question or tension that makes the viewer lean in;',
    'the stakes or context — why it matters, and to whom;',
    'the promise — what the viewer will understand by the end of the video;',
    'the handoff — the bridge into the first mechanism, in the next scene.'
  ]),
  '',
  `Show the video's title, exactly "${title}", as on-screen text (text.role "exact") in the first or second moment. Plan its entrance, where it sits against the presenter and the graphics, and a readable hold of at least 2.5 seconds with strong contrast — in every on-camera presence, Off, Low or High.`,
  ''
]

// The slot of the video's template this scene plays, said to the planner.
const templateLine = (slot: NonNullable<ScenePacketInput['template']>) =>
  [
    `The video follows the "${slot.template}" template of the story "${slot.story}" (for ${slot.audience.charAt(0).toLowerCase()}${slot.audience.slice(1)}).`,
    slot.purpose,
    `Its tone: ${slot.tone.toLowerCase()}. Its pacing: ${slot.pacing.toLowerCase()}.`,
    `This scene plays its "${slot.role}" slot (${slot.position}): ${slot.type}.`,
    `Its signature move: ${slot.move}`,
    `When on camera, the presenter is framed this way: ${slot.speaker}.`,
    `Aim for about ${slot.seconds} seconds, and ${
      slot.seam === SEAM_LABELS.end
        ? 'close the video there'
        : `hand over to the next scene with a ${slot.seam.toLowerCase()}`
    }.`
  ].join(' ')

export const renderScenePacket = (input: ScenePacketInput) => {
  const lines = [
    `# Scene ${input.scene.index + 1}: ${input.scene.title}`,
    '',
    `Video: ${input.videoTitle}. Video scene id: \`${input.scene.id}\`. It comes from base page${input.scene.originScenes.length === 1 ? '' : 's'} ${input.scene.originScenes.map((id) => `\`${id}\``).join(', ')}.`,
    '',
    '## What this scene explains',
    '',
    input.units.length
      ? `The brief maps these explanation units to this scene's pages: ${input.units.map((unit) => `\`${unit}\``).join(', ')}. Read them in EXPLANATION.md. You may propose a different grouping as a roster proposal with a reason.`
      : "The brief maps no explanation unit to this scene's pages (see its coverage for why). Plan it as framing, or propose folding it into a neighbour.",
    '',
    '## Presentation input (reference only)',
    '',
    'This is what the presentation designer was given for these pages. It shows how the material was divided for slides; it is not a scene boundary, a layout, a duration or a list of things to show.',
    ''
  ]
  for (const page of input.presentation) {
    lines.push(
      `### Base page \`${page.scene}\`: ${page.title}`,
      '',
      page.objective
        ? `Teaching objective (from the source outline): ${page.objective}`
        : '',
      page.layoutGuidance
        ? `Page notes (slide layout, reference only): ${page.layoutGuidance}`
        : '',
      page.narration ? `Narration: ${page.narration}` : '',
      ...(page.sourcePassages.length
        ? [
            '',
            'Source passages it rests on:',
            bullet(page.sourcePassages.map((passage) => `"${passage}"`))
          ]
        : []),
      page.wireframe
        ? `\nWireframe: \`${page.wireframe}\` (a visual reference; its coordinates and cards are not binding).`
        : '',
      ''
    )
  }
  lines.push(
    '## The words this scene currently speaks',
    '',
    input.script ? input.script : '_No script yet._',
    '',
    '## Neighbours',
    '',
    bullet(
      input.adjacent.map((neighbour) => {
        const before = neighbour.position === 'before'
        const boundary = neighbour.plan
          ? before
            ? neighbour.plan.exit
            : neighbour.plan.entry
          : ''
        const seam = !neighbour.plan
          ? `it has no plan yet, so how it ${before ? 'ends' : 'begins'} is unknown: ${before ? 'open' : 'end'} self-contained, or record a proposal`
          : neighbour.plan.state === 'reviewed'
            ? `its reviewed plan (revision ${neighbour.plan.revision}) ${before ? 'ends' : 'begins'}: "${boundary}" — you may agree a seam with it`
            : `its unreviewed candidate (revision ${neighbour.plan.revision}) ${before ? 'ends' : 'begins'}: "${boundary}" — a seam with it is only a proposal`
        return `${before ? 'Before' : 'After'}: \`${neighbour.id}\` ${neighbour.title}${neighbour.units.length ? ` (units ${neighbour.units.join(', ')})` : ''}${neighbour.takeaway ? ` — reviewed takeaway: ${neighbour.takeaway}` : ''}. Seam: ${seam}.`
      })
    ) || '- This is the only scene.',
    '',
    "NEIGHBORS.json says the same as data. State `continuity.incoming` and `continuity.outgoing` as self-contained, agreed or proposed; never write a neighbour's image as fact when its plan does not promise it.",
    '',
    ...(input.intro ? introSection(input.videoTitle) : []),
    '## Decisions already made',
    '',
    bullet([
      input.delivery
        ? `Delivery for this scene: ${input.delivery} (the creator's choice — keep it).`
        : 'Delivery for this scene is undecided: suggest a presenter treatment if it helps, but keep delivery.voice "undecided".',
      presenceLine(input.presence, input.delivery),
      input.template ? templateLine(input.template) : '',
      input.reviewed
        ? `A reviewed plan exists (question: ${input.reviewed.question}). Keep what it got right unless the direction below asks otherwise.`
        : ''
    ]),
    '',
    '## Creator direction',
    '',
    input.direction.video
      ? `For the whole video: ${input.direction.video}`
      : 'For the whole video: none given.',
    '',
    input.direction.scene
      ? `For this scene: ${input.direction.scene}`
      : 'For this scene: none given.',
    '',
    '## Reusable assets in the library',
    '',
    bullet(
      input.assets.map(
        (asset) =>
          `\`${asset.key}\` — ${asset.role}${asset.parts.length ? ` (parts: ${asset.parts.join(', ')})` : ''}`
      )
    ) || '- None accepted yet.',
    ''
  )
  return lines
    .filter((line) => line !== undefined)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
}
