import type { ResearchProjectView } from '../shared/research'
import type { WorkspaceItem } from './workspace-state'
import { projectContext, projectLink } from './project-links'
import { pickerIcons } from './destination-picker'
import { escape } from './ui'

/** Keep the collection and its outputs visible while the conversation changes. */
export function channelWork(
  project: ResearchProjectView,
  active: WorkspaceItem
) {
  const context = projectContext(new URL(active.href, 'http://workspace.local'))
  const chat = project.chats?.find((c) => c.id === context.chat)
  const notebook =
    project.notebooks.find((n) => n.id === context.notebook) ||
    project.notebooks.find((n) => n.id === chat?.notebookId) ||
    project.notebooks[0]
  if (!notebook) return ''
  context.notebook = notebook.id
  const output =
    project.canvas ||
    project.snapshots.find((s) => s.project.id === notebook.id)
  const count = output?.project.slides.length || 0
  const canvasStatus =
    project.syncError || output?.status === 'failed'
      ? 'Paused · review progress'
      : output?.status === 'building'
        ? 'Organizing your notes…'
        : count
          ? `${count} ${count === 1 ? 'story card' : 'story cards'}`
          : notebook.blocks.length
            ? 'Shape your saved notes'
            : 'Grows from your notes'
  const mapId =
    project.canvasId || (notebook.blocks.length ? notebook.id : undefined)
  const video = output?.project.video && !output.project.mapSeries
  const content = projectLink(project.id, context, { projectView: 'canvas' })
  const wireframes =
    output && count
      ? projectLink(project.id, context, {
          detail: '1',
          notebook: output.project.id,
          view: 'presentation'
        })
      : content
  const videoUrl = video
    ? projectLink(project.id, context, {
        detail: '1',
        notebook: output!.project.id,
        view: 'video'
      })
    : mapId
      ? projectLink(project.id, context, { detail: '1', map: mapId })
      : content
  const row = (
    href: string,
    title: string,
    hint: string,
    icon: string,
    selected: boolean
  ) =>
    `<a data-tree-link href="${escape(href)}" ${selected ? 'aria-current="page"' : ''}>${icon}<span><strong>${escape(title)}</strong><small>${escape(hint)}</small></span><span class="channel-work-arrow" aria-hidden="true">›</span></a>`
  return `<section class="channel-work" aria-label="Notebook and content"><h2>From research to a story</h2>
    ${row(projectLink(project.id, context, { projectView: 'notes' }), notebook.title, `${notebook.blocks.length} saved ${notebook.blocks.length === 1 ? 'note' : 'notes'} · Notebook`, pickerIcons.notebook, active.kind === 'Notes')}
    ${row(wireframes, 'Wireframe canvas', canvasStatus, pickerIcons.model, active.kind === 'Create' || active.kind === 'Wireframes')}
    ${row(videoUrl, 'Episodes & video', video ? 'Continue your video' : output?.project.mapSeries ? 'Continue your series' : 'Plan episodes from your cards', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="m10 8 6 4-6 4Z"/></svg>', active.kind === 'Video' || active.kind === 'Canvas')}
    <p>${project.autoOrganize ? 'Saved excerpts keep your canvas growing.' : 'Keep excerpts here, then shape them into a story.'}</p>
    ${chat && active.kind !== 'Chat' ? `<a class="channel-work-return" data-tree-link href="${escape(projectLink(project.id, context, { projectView: 'research' }))}">← Back to ${escape(chat.title)}</a>` : ''}
  </section>`
}
