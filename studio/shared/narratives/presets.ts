// The directions every narrative can be told in. Each narrative names its
// default and the presets that do not suit it; the creator can change any
// setting, and the length stays a range. Faceless keeps the narrative's own
// default and takes you off camera.
import type { DirectionPreset, LengthRange } from './model'

export const PRESETS: DirectionPreset[] = [
  {
    id: 'short-dramatic',
    name: 'Short and dramatic',
    line: 'A punchy cut that you lead, cold open first.',
    length: [45, 90],
    elaboration: 'brief',
    drama: 'dramatic',
    onCamera: 'leads',
    leads: [],
    structure: 'cold-open'
  },
  {
    id: 'briefing',
    name: 'Briefing',
    line: 'Calm and clear, with you at the start and the end.',
    length: [120, 240],
    elaboration: 'standard',
    drama: 'calm',
    onCamera: 'ends',
    leads: [],
    structure: 'chronological'
  },
  {
    id: 'explainer',
    name: 'Explainer',
    line: 'Thorough, question by question, with you as a guide.',
    length: [360, 600],
    elaboration: 'thorough',
    drama: 'calm',
    onCamera: 'guide',
    leads: ['diagram', 'code'],
    structure: 'question-led'
  },
  {
    id: 'deep-dive',
    name: 'Deep dive',
    line: 'A long telling in chapters, a talk in its own right.',
    length: [1200, 1500],
    elaboration: 'thorough',
    drama: 'lively',
    onCamera: 'guide',
    leads: ['code', 'demo'],
    structure: 'chronological'
  },
  {
    id: 'demo-led',
    name: 'Demo-led',
    line: 'The product leads, the result first, you in a bubble.',
    length: [120, 300],
    elaboration: 'standard',
    drama: 'lively',
    onCamera: 'guide',
    leads: ['demo'],
    structure: 'result-first'
  },
  {
    id: 'faceless',
    name: 'Faceless',
    line: 'No one on camera; pictures and voice carry it.',
    onCamera: 'none'
  }
]

/** The lengths offered first; the creator can always set their own range. */
export const LENGTHS: LengthRange[] = [
  [45, 90],
  [120, 240],
  [360, 600],
  [1200, 1500]
]
