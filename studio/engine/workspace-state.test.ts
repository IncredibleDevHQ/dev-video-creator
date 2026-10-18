import { expect, it } from 'vitest'
import {
  readWorkspaceState,
  rememberWorkspaceItem,
  safeWorkspaceHref,
  type WorkspaceItem
} from '../app/workspace-state'
const item: WorkspaceItem = {
  key: 'p:Chat:c',
  projectId: 'p',
  projectTitle: 'Project',
  title: 'Chat',
  kind: 'Chat',
  href: '/?space=p&chat=c&node=first'
}
it('retains local resource routes without arbitrary links or query data', () => {
  for (const value of [
    'https://evil.test',
    '//evil.test/?space=p',
    'javascript:alert(1)',
    '/?chat=c',
    null
  ])
    expect(safeWorkspaceHref(value)).toBeNull()
  expect(safeWorkspaceHref('/?space=p&chat=c&secret=no#hash')).toBe(
    '/?space=p&chat=c'
  )
})
it('deduplicates recent resources while updating their current question', () => {
  let state = rememberWorkspaceItem({ pinned: ['p'], recent: [] }, item)
  state = rememberWorkspaceItem(state, {
    ...item,
    href: '/?space=p&chat=c&node=next',
    search: 'private note body'
  })
  expect(state.recent).toHaveLength(1)
  expect(state.recent[0].href).toContain('node=next')
  expect(JSON.stringify(state)).not.toContain('private note body')
  expect(state.pinned).toEqual(['p'])
  for (let i = 0; i < 25; i++)
    state = rememberWorkspaceItem(state, { ...item, key: String(i) })
  expect(state.recent).toHaveLength(20)
})
it('safely restores malformed and mismatched persisted routes', () => {
  expect(readWorkspaceState('broken')).toEqual({ pinned: [], recent: [] })
  expect(readWorkspaceState('null')).toEqual({ pinned: [], recent: [] })
  const state = readWorkspaceState(
    JSON.stringify({
      pinned: ['p', 'p', 8],
      recent: [item, item, { ...item, key: 'other', projectId: 'wrong' }]
    })
  )
  expect(state.pinned).toEqual(['p'])
  expect(state.recent).toEqual([item])
})
