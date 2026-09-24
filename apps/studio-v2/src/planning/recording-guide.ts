// A scene's recording guide (P2): what the creator records for this scene
// and how, derived from its plan and its words. It explains the proposed
// human contribution; it does not require one — planning and a labelled
// preview go ahead without a take.
//
// Voice and picture are separate decisions: the voice can continue while
// the graphics take the whole frame, so the guide asks for every spoken
// line, on camera or not. It never asks the speaker to hit animation
// timestamps: the recorded take sets the clock, and the graphics follow it.
import type { SceneTreatmentV1, TreatmentMoment } from './scene-treatment'

export type Framing = 'full' | 'shared' | 'hidden' | 'undecided'
export type GuideLine = { text: string; wording: 'approved' | 'draft' }
export type GuideStep = { moment: string; title: string; framing: Framing; say: string; instruction: string; attention: string }
export type GuideSection = { id: string; moments: string[]; framing: Framing; label: string }
export type RecordingGuide = {
  purpose: string
  wording: 'approved' | 'draft'
  lines: GuideLine[]
  steps: GuideStep[]
  sections: GuideSection[]
  framing: string[]
  delivery: string[]
  // Whether the voice carries on while the speaker is off screen.
  offCamera: boolean
  // What decides the delivery: the creator's choice, or not yet.
  voice: 'human' | 'generated' | 'silent' | 'undecided'
  note: string
}

const INSTRUCTIONS: Record<Framing, string> = {
  full: 'On camera, full frame — speak to the lens.',
  shared: 'On camera beside the graphics — keep to your side of the frame.',
  hidden: 'Off screen — keep speaking; the graphics take the frame while your voice continues.',
  undecided: 'Framing not decided yet — record the line; where you appear is chosen later.',
}

const framingOf = (moment: TreatmentMoment): Framing => moment.presenter?.visibility || 'undecided'

// The scene's words as the lines to record: one per paragraph.
const linesOf = (script: string) =>
  script
    .split(/\n\s*\n/)
    .map(paragraph => paragraph.replace(/\[[^\]]*\]/g, '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)

export const recordingGuide = (input: {
  plan: SceneTreatmentV1
  script: string
  wordingPolicy: 'preserve' | 'assist' | 'draft'
  delivery: 'human' | 'generated' | 'silent' | null
}): RecordingGuide => {
  const { plan } = input
  const wording = input.wordingPolicy === 'preserve' ? 'approved' : 'draft'
  const steps: GuideStep[] = plan.moments.map(moment => ({
    moment: moment.id,
    title: moment.title,
    framing: framingOf(moment),
    say: moment.narration?.guide || moment.narration?.job || '',
    instruction: INSTRUCTIONS[framingOf(moment)],
    attention: moment.attention,
  }))
  // Sections a take can be broken into: runs of moments with one framing.
  const sections: GuideSection[] = []
  for (const step of steps) {
    const last = sections[sections.length - 1]
    if (last && last.framing === step.framing) last.moments.push(step.moment)
    else sections.push({ id: `section-${sections.length + 1}`, moments: [step.moment], framing: step.framing, label: '' })
  }
  sections.forEach((section, index) => {
    const names = section.moments.map(id => steps.find(step => step.moment === id)?.title || id)
    section.label = `${index + 1}. ${names.join(' → ')} — ${section.framing === 'hidden' ? 'voice only' : section.framing === 'undecided' ? 'framing open' : section.framing === 'full' ? 'on camera' : 'beside the graphics'}`
  })
  const framings = new Set(steps.map(step => step.framing))
  const framing = [
    plan.treatments.presenter ? `The plan's presenter treatment: ${plan.treatments.presenter}` : '',
    framings.has('shared') ? 'When you share the frame, keep your face clear of the graphics side; the captions sit below both.' : '',
    framings.has('full') ? 'Full-frame moments: centre yourself, eyes to the lens.' : '',
    framings.has('hidden') ? 'Voice-only moments are recorded like the rest — the graphics carry the picture.' : '',
    steps.length > 1 && steps[steps.length - 1].framing !== 'hidden' && steps.some(step => step.framing === 'hidden') ? 'You return to the frame for the close.' : '',
  ].filter(Boolean)
  const delivery = [
    ...steps.filter(step => step.attention).map(step => `${step.title}: let “${step.attention}” land before you move on.`),
    plan.continuity.entry ? `Coming in: the scene opens on ${plan.continuity.entry}.` : '',
    plan.continuity.exit ? `Handing over: it leaves on ${plan.continuity.exit}.` : '',
    'Speak naturally; pause where the idea needs it. The take sets the timing — the graphics follow you.',
  ].filter(Boolean)
  return {
    purpose: plan.takeaway || plan.question,
    wording,
    lines: linesOf(input.script).map(text => ({ text, wording })),
    steps,
    sections,
    framing,
    delivery,
    offCamera: framings.has('hidden'),
    voice: input.delivery || 'undecided',
    note:
      input.delivery === 'generated'
        ? 'This scene is narrated by a generated voice: there is nothing to record.'
        : input.delivery === 'silent'
          ? 'This scene is silent: there is nothing to record.'
          : 'Record the whole scene in one take, or section by section. No take is needed to plan or to preview the scene.',
  }
}
