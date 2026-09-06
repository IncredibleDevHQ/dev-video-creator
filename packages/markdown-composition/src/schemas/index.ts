// Artefact schemas (spec §6): motion/resolved.json (Core §3.2 plan +
// resolved tiers), motion/track.json (Core §28.9), takes/<id>/take.json
// (Core §13.1), speaker roster/turns (Core §25.1). validateArtefact shape-
// checks an artefact; the tiny validator in ./json-schema.ts covers the
// schema subset these use (ajv in the repo is v6, no draft 2020-12).
import { validateSchema, type SchemaError } from './json-schema'
import { slideMotionV2Schema } from './slide-motion-v2'
import { resolvedSchema } from './resolved'
import { takeSchema } from './take'
import { speakersSchema, trackSchema } from './track'

export const artefactSchemas = {
  'slide-motion-v2': slideMotionV2Schema,
  resolved: resolvedSchema,
  take: takeSchema,
  track: trackSchema,
  speakers: speakersSchema,
} as const

export type ArtefactName = keyof typeof artefactSchemas

export const validateArtefact = (
  name: ArtefactName,
  json: unknown,
): { valid: boolean; errors: SchemaError[] } => {
  const schema = artefactSchemas[name]
  if (!schema) return { valid: false, errors: [{ path: '$', message: `unknown artefact "${name}"` }] }
  const errors = validateSchema(schema as unknown as Record<string, unknown>, json)
  return { valid: errors.length === 0, errors }
}

export { slideMotionV2Schema, resolvedSchema, takeSchema, trackSchema, speakersSchema }
export type { SchemaError }
