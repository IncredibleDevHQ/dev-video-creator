import { editScopeProblems } from '../moment-edit-scope'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fingerprintOf } from '../planning/fingerprint'
import {
  renderNativeBrief,
  renderExplanation,
  renderScenePacket,
  type ScenePacketInput
} from './brief-adapter'
import { validateTreatment, type TreatmentContext } from './scene-treatment'
import { artworkConfigured } from './artwork'
import {
  runValidatedJsonStage,
  readPinnedCapabilities,
  skillsRoot,
  type CreativeSelection
} from './stage'
import type { Presence } from '../../shared/model'
import type { HarnessEvent } from '../harness/types'
export const pinnedBundle = async () => {
  const root = join(skillsRoot(), 'video-planner')
  const references: string[] = []
  const walk = async (relative: string) => {
    for (const entry of await readdir(join(root, relative), {
      withFileTypes: true
    })) {
      const name = relative ? `${relative}/${entry.name}` : entry.name
      if (entry.isDirectory()) await walk(name)
      else if (entry.isFile() && name.endsWith('.md')) references.push(name)
    }
  }
  await walk('')
  const referenceIds = new Set(references)
  const skills = new Set<string>()
  const index: Record<string, string> = {}
  for (const name of references) {
    index[name] = name
    // Manuals cite paths relative to the pinned Hyperframes bundle. These
    // aliases are derived only from files actually shipped in that bundle.
    if (name.startsWith('hyperframes/')) {
      const relative = name.slice('hyperframes/'.length)
      referenceIds.add(relative)
      index[relative] = name
    }
    if (name.endsWith('/SKILL.md')) {
      skills.add(name.slice(0, -9))
      const text = await readFile(join(root, name), 'utf8')
      const declared = /^name:\s*([a-z0-9-]+)\s*$/m.exec(text)?.[1]
      if (declared) skills.add(declared)
    }
  }
  return { references: [...referenceIds], skills: [...skills], index }
}
export const treatmentStagingProblems = (
  treatment: import('./scene-treatment').SceneTreatmentV1,
  presence: Presence | null | undefined,
  role: string
) => {
  const problems: string[] = []
  if (!treatment.moments.length || treatment.moments.length > 16)
    problems.push('A scene needs 1–16 moments')
  if (
    role === 'title' &&
    presence === 'high' &&
    treatment.moments[0]?.presenter?.visibility !== 'full'
  )
    problems.push(
      'The title scene at High opens with the presenter full screen'
    )
  if (
    role === 'ending' &&
    presence &&
    presence !== 'off' &&
    treatment.moments.at(-1)?.presenter?.visibility !== 'full'
  )
    problems.push('The ending scene closes with the presenter full screen')
  return problems
}
/** Develop one scene against the retained source, pinned recipes and current neighbors. */
export const prepareCreativeTreatment = async (input: {
  projectId: string
  selection: CreativeSelection
  origin: string
  context: Omit<
    TreatmentContext,
    'catalog' | 'bundleSkills' | 'bundleReferences'
  >
  editMomentId?: string
  role?: string
  scenePacket: ScenePacketInput
  theme: unknown
  visualCast: unknown
  media?: Record<string, Buffer>
  onEvent?: (event: HarnessEvent) => Promise<void> | void
}) => {
  if (input.scenePacket.scene.id !== input.context.scene)
    throw new Error('Scene packet does not match the planning context')
  const catalog = await readPinnedCapabilities(),
    bundle = await pinnedBundle()
  const context: TreatmentContext = {
    ...input.context,
    catalog,
    bundleSkills: bundle.skills,
    bundleReferences: bundle.references,
    // Absent without a provider, so those plans keep their fingerprint.
    ...(artworkConfigured() ? { drawsArtwork: true as const } : {})
  }
  const inputKey = fingerprintOf({
    editMomentId: input.editMomentId,
    role: input.role,
    context,
    scenePacket: input.scenePacket,
    theme: input.theme,
    visualCast: input.visualCast,
    media: input.media
  })
  return runValidatedJsonStage({
    projectId: input.projectId,
    sceneId: context.scene,
    inputKey,
    checkpoint: 'creative-treatment',
    route: 'Plan Scene',
    file: 'planning/treatment.json',
    tool: 'plan_submit_treatment',
    selection: input.selection,
    origin: input.origin,
    onEvent: input.onEvent,
    packet: {
      'packet/BRIEF.md': renderNativeBrief(context.brief),
      'packet/EXPLANATION.md': renderExplanation(context.brief),
      'packet/SCENE.md': renderScenePacket(input.scenePacket),
      'packet/CONTEXT.json': JSON.stringify(
        {
          ...context,
          editScope: input.editMomentId
            ? {
                momentId: input.editMomentId,
                instruction:
                  'Preserve the previous moment IDs, order, and every unrelated moment exactly.'
              }
            : null,
          role: input.role,
          staging:
            input.role === 'title'
              ? 'At High, the first presenter moment is full screen.'
              : input.role === 'ending'
                ? 'With the camera enabled, the closing presenter moment is full screen.'
                : null
        },
        null,
        2
      ),
      'packet/THEME.json': JSON.stringify(input.theme, null, 2),
      'packet/VISUAL_CAST.json': JSON.stringify(input.visualCast, null, 2),
      'packet/NEIGHBORS.json': JSON.stringify(context.neighbors || [], null, 2),
      'packet/PREVIOUS_PLAN.json': JSON.stringify(
        input.scenePacket.reviewed,
        null,
        2
      ),
      'packet/PINNED_BUNDLE.json': JSON.stringify(
        {
          skillIds: bundle.skills,
          references: bundle.index,
          bundleRoot:
            'Use SKILL_DIR/hyperframes for references beginning skills/; the index maps every accepted id to its real path under SKILL_DIR.'
        },
        null,
        2
      ),
      'packet/RUN.json': JSON.stringify({
        projectId: input.projectId,
        scene: context.scene,
        inputKey
      }),
      ...input.media
    },
    validate: (raw) => {
      const report = validateTreatment(raw, context)
      const problems = [
        ...report.problems,
        ...editScopeProblems(
          input.scenePacket.reviewed?.moments || [],
          report.treatment.moments,
          input.editMomentId
        ),
        ...treatmentStagingProblems(
          report.treatment,
          context.presence,
          input.role || (context.intro ? 'title' : 'body')
        )
      ]
      return {
        ...report,
        ok: problems.length === 0,
        problems,
        value: report.treatment
      }
    }
  })
}
