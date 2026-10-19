import { expect, it } from 'vitest'
import { parseHTML } from 'linkedom'
import { channelWork } from '../app/channel-work'
import type { ResearchProjectView } from '../shared/research'
import type { WorkspaceItem } from '../app/workspace-state'

const project: ResearchProjectView = {
  id: 'p',
  title: 'Research',
  createdAt: '',
  updatedAt: '',
  repos: [],
  nodes: [],
  notebooks: [
    {
      id: 'book',
      title: 'Collected findings',
      blocks: [{ id: 'note', text: 'A finding', at: '' }]
    }
  ],
  chats: [
    {
      id: 'chat',
      title: 'Explore',
      notebookId: 'book',
      createdAt: '',
      updatedAt: '',
      repos: []
    }
  ],
  snapshots: [],
  canvas: null
}
const active: WorkspaceItem = {
  key: 'p:Notes:book',
  kind: 'Notes',
  title: 'Collected findings',
  projectId: 'p',
  projectTitle: 'Research',
  href: '/?space=p&book=book&chat=chat&node=branch&projectView=notes'
}

it('carries the exact research branch and notebook into every output and the return link', () => {
  const { document } = parseHTML(channelWork(project, active))
  const links = [...document.querySelectorAll('a')]
  expect(links).toHaveLength(4)
  for (const link of links) {
    const url = new URL(link.getAttribute('href')!, 'http://localhost')
    expect(url.searchParams.get('chat')).toBe('chat')
    expect(url.searchParams.get('node')).toBe('branch')
    expect(url.searchParams.get('book')).toBe('book')
  }
  expect(links[0].getAttribute('aria-current')).toBe('page')
  expect(links.at(-1)!.textContent).toContain('Back to Explore')
})

it('does not imply empty notes have already produced a canvas or video', () => {
  const empty = structuredClone(project)
  empty.notebooks[0].blocks = []
  const markup = channelWork(empty, active)
  expect(markup).toContain('0 saved notes')
  expect(markup).toContain('Grows from your notes')
  expect(markup).not.toContain('Continue your video')
  expect(markup).not.toContain('map=book')
})

it('keeps a newly selected notebook instead of reverting to the channel default', () => {
  const p = structuredClone(project)
  p.notebooks.push({ id: 'second', title: 'Second notebook', blocks: [] })
  const markup = channelWork(p, {
    ...active,
    href: active.href.replace('book=book', 'book=second')
  })
  expect(markup).toContain('Second notebook')
  expect(markup).not.toContain('book=book')
})
