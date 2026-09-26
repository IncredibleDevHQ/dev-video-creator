// A wireframe made again (R01 of the project-flow rereview): the article it
// is made from, as stored, and each attempt at it. The server's builder and
// the studio's "Make it again" read the article through the one shape here,
// from the one route that serves a stored source revision.
import type { NotebookBuildV1 } from 'markdown-composition'

// The article as it was read and stored (D1): the words a story run or the
// direct model outlines, never the brand evidence read with them. A stored
// revision without its text is no article.
export type StoredArticle = { title: string; site: string; text: string; words: number }

export const storedArticleOf = (revision: unknown): StoredArticle | null => {
  const content = (revision as { content?: Record<string, unknown> } | null)?.content
  const text = typeof content?.text === 'string' ? content.text : ''
  if (!text.trim()) return null
  const words = Number(content?.words)
  return {
    title: String(content?.title || ''),
    site: String(content?.site || ''),
    text,
    words: Number.isFinite(words) && words > 0 ? words : text.split(/\s+/).filter(Boolean).length,
  }
}

// Who makes an attempt: a story run on a harness, or the direct model.
export type WireframeOutliner = Pick<NotebookBuildV1, 'via' | 'runId' | 'by' | 'harness' | 'model'>

// The same wireframe made again: the same article, narrative, wording,
// length and brand — made by whoever makes it now, as an attempt of its own,
// with no failure.
export const nextWireframeAttempt = (build: NotebookBuildV1, outliner: WireframeOutliner, at: { attempt: string; now: string }): NotebookBuildV1 => {
  const { failure: _failure, runId: _runId, harness: _harness, model: _model, ...kept } = build
  return { ...kept, ...outliner, attempt: at.attempt, attempts: (build.attempts || 1) + 1, startedAt: at.now }
}

// The words the creator reads while a wireframe could not be made: why, and
// what they can do about it — a provider's own recovery, like switching
// harness — before making it again.
export const wireframeFailureText = (failure: NonNullable<NotebookBuildV1['failure']>) => {
  const reason = failure.message.replace(/[.\s]+$/, '')
  const steps = (failure.recovery || []).filter(Boolean).map((step, index) => (index ? step.charAt(0).toLowerCase() + step.slice(1) : step))
  return `The wireframe could not be made: ${reason}.${steps.length ? ` ${steps.join(', or ')}.` : ''}`
}
