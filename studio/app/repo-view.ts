// A notebook's linked repo: the chip beside its template, the dialog that
// links it, and on a page each request the agent can answer from it, then
// its answer with the commit and files it came from, and "ask again".
import type { Snapshot } from '../shared/api'
import type { Slide } from '../shared/model'
import type { EvidenceAnswer, EvidenceNeed } from '../shared/narratives'
import {
  REPO_KINDS,
  repoAskKey,
  shortCommit,
  type RepoInspection
} from '../shared/repos'
import { escape } from './ui'

/** The repo chip in the notebook's choices row. */
export const repoChip = (snapshot: Snapshot, editable: boolean) => {
  const repos = snapshot.project.repos || []
  const label = repos.length
    ? `${repos[0].name} · ${repos[0].branch}${repos.length > 1 ? ` +${repos.length - 1}` : ''}`
    : 'No repo'
  return `<button type="button" class="choice" data-action="repo-dialog" ${editable ? '' : 'disabled'}>${escape(label)}</button>`
}

const options = (values: string[], chosen: string) =>
  values
    .map(
      (value) =>
        `<option value="${escape(value)}"${value === chosen ? ' selected' : ''}>${escape(value)}</option>`
    )
    .join('')

/** Linking a repo: its folder, the branch that is the scenario, its base. */
export const repoDialog = (
  snapshot: Snapshot,
  found: RepoInspection | null = null
) => {
  const linked = snapshot.project.repos?.[0]
  const path = found?.path || linked?.path || ''
  const branches = found?.branches || (linked ? [linked.branch] : [])
  const bases = found?.branches || (linked ? [linked.base] : [])
  return `<h2>Link a repo</h2>
<p>The agent answers this notebook’s requests from the branch, reading it and never writing. Each answer names its commit and files.</p>
<form id="repo-form" class="repo-form">
<label for="repo-path">Folder</label>
<div class="repo-path"><input id="repo-path" name="path" value="${escape(path)}" placeholder="/Users/you/code/project" autocomplete="off" required><button type="button" data-action="inspect-repo">Look</button></div>
${
  branches.length
    ? `<label for="repo-branch">Branch <small>the scenario</small></label>
<select id="repo-branch" name="branch">${options(branches, linked?.branch || found?.current || '')}</select>
<label for="repo-base">Compared with</label>
<select id="repo-base" name="base">${options(bases, linked?.base || found?.base || '')}</select>`
    : ''
}
<div class="dialog-actions">${linked ? '<button type="button" class="quiet" data-action="unlink-repos">Unlink</button>' : ''}<button type="button" class="quiet" data-action="close">Cancel</button><button class="primary" ${branches.length ? '' : 'disabled'}>Link</button></div>
</form>`
}

/** Under a request: ask the repo, or how the asking is going. */
export const repoAsk = (
  snapshot: Snapshot,
  slide: Slide,
  need: EvidenceNeed,
  editable: boolean
) => {
  const repo = snapshot.project.repos?.[0]
  if (!repo || !(REPO_KINDS as readonly string[]).includes(need.kind)) return ''
  const ask = snapshot.repoAsks?.[repoAskKey(slide.id, need.what)]
  if (ask?.state === 'asking')
    return `<p class="repo-asking" role="status">Asking ${escape(repo.name)}…</p>`
  return `<p class="repo-ask">${
    ask?.state === 'failed'
      ? `<span class="repo-failed">${escape(ask.error || 'The agent could not answer')}</span>`
      : ''
  }<button type="button" class="quiet" data-action="ask-repo" data-evidence-slide="${escape(slide.id)}" data-evidence-what="${escape(need.what)}" ${editable ? '' : 'disabled'}>${ask?.state === 'failed' ? 'Try again' : `Ask ${escape(repo.name)}`}</button></p>`
}

/** The answer's opening, said in one line. */
const firstSentence = (text: string) => {
  const plain = text.replace(/```[\s\S]*?```/g, ' ').replace(/`/g, '')
  const sentence = plain.match(/^[\s\S]*?[.!?](\s|$)/)?.[0] || plain
  const line = sentence.replace(/\s+/g, ' ').trim()
  return line.length > 160 ? `${line.slice(0, 157)}…` : line
}

/** The whole answer: its paragraphs, and its code as code. */
const answerBody = (text: string) =>
  text
    .split(/(```[a-z]*\n[\s\S]*?```)/)
    .map((part) => {
      const code = part.match(/^```[a-z]*\n([\s\S]*?)```$/)
      if (code) return `<pre><code>${escape(code[1].trimEnd())}</code></pre>`
      return part
        .split(/\n{2,}/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean)
        .map((paragraph) => `<p>${escape(paragraph)}</p>`)
        .join('')
    })
    .join('')

/** An answer, with where it came from; one from a repo can be asked again. */
export const givenAnswer = (
  snapshot: Snapshot,
  slide: Slide,
  item: EvidenceAnswer,
  editable: boolean
) => {
  if (!item.from)
    return `<p class="evidence-given"><b>${escape(item.what)}</b> ${escape(item.answer)}</p>`
  const ask = snapshot.repoAsks?.[repoAskKey(slide.id, item.what)]
  const asking = ask?.state === 'asking'
  // Asking again failed: say why, above the form to try once more.
  const failed =
    ask?.state === 'failed'
      ? `<p class="repo-failed">${escape(ask.error || 'The agent could not answer')}</p>`
      : ''
  const files = item.from.files
    .map(
      (file) =>
        `<code>${escape(file.path)}${file.lines ? `:${file.lines[0]}–${file.lines[1]}` : ''}</code>`
    )
    .join(' ')
  return `<div class="evidence-given from-repo"><details><summary><b>${escape(item.what)}</b> ${escape(firstSentence(item.answer))}</summary>${answerBody(item.answer)}</details>
<p class="provenance">From ${escape(item.from.repo)} · ${escape(item.from.branch)} @ <code>${shortCommit(item.from.commit)}</code> ${files}</p>
${
  asking
    ? `<p class="repo-asking" role="status">Asking ${escape(item.from.repo)} again…</p>`
    : `${failed}<form class="ask-again" data-evidence-slide="${escape(slide.id)}" data-evidence-what="${escape(item.what)}"><input name="prompt" placeholder="Not right? Say what to look for" aria-label="What to look for instead" autocomplete="off" ${editable ? '' : 'disabled'}><button ${editable ? '' : 'disabled'}>Ask again</button></form>`
}</div>`
}

/** Beside a page's requests: link a repo when one could answer them. */
export const linkRepoAsk = (
  snapshot: Snapshot,
  needs: EvidenceNeed[],
  editable: boolean
) =>
  !editable ||
  snapshot.project.repos?.length ||
  !needs.some((need) => (REPO_KINDS as readonly string[]).includes(need.kind))
    ? ''
    : '<button type="button" class="quiet link-repo" data-action="repo-dialog">Link a repo to ask it</button>'
