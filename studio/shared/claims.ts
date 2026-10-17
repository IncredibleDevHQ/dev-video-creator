// A flag on words the studio wrote that still promise past the creator's
// after one rewrite (engine/claims.ts): shown wherever the creator approves
// those words, until they write it again or keep it (review 8).
import type { Project, Slide } from './model'

export type Line = 'bridge' | 'outro'

/** A page's flagged lines in and out that the creator hasn't answered:
 * what to check in each, while it is the same line. */
export const openChecks = (
  project: Pick<Project, 'segueChecks'>,
  slide: Pick<Slide, 'id' | 'bridge' | 'outro'>
) => {
  const checks = project.segueChecks?.[slide.id]
  const open = (line: Line) => {
    const check = checks?.[line]
    return check && !check.kept && check.line === slide[line]
      ? check.note
      : undefined
  }
  const bridge = open('bridge')
  const outro = open('outro')
  return bridge || outro
    ? { ...(bridge ? { bridge } : {}), ...(outro ? { outro } : {}) }
    : undefined
}

/** A post's flag the creator hasn't answered, while it is the same post. */
export const openPostCheck = (
  release: Project['release'],
  channel: 'x' | 'linkedin' | 'youtube'
) => {
  const check = release?.postChecks?.[channel]
  return check && !check.kept && check.text === release?.posts?.[channel]
    ? check.note
    : undefined
}
