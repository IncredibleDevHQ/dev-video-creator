import { expect, it } from 'vitest'
import {
  channelKey,
  channelRows,
  readChannelNavigation
} from '../app/channel-navigation'
import type { ResearchProjectView } from '../shared/research'

const project: ResearchProjectView = {
  id: 'p',
  title: 'Project',
  createdAt: '',
  updatedAt: '',
  notebooks: [],
  repos: [],
  snapshots: [],
  canvas: null,
  chats: [
    {
      id: 'a',
      title: 'Cache design',
      createdAt: '',
      updatedAt: '2026-10-19',
      lastNodeId: 'latest',
      repos: [
        { name: 'lily', path: '/lily', branch: 'feature/cache', base: 'main' }
      ]
    },
    {
      id: 'b',
      title: 'Other channel',
      createdAt: '',
      updatedAt: '2026-10-18',
      repos: []
    }
  ],
  nodes: ['earlier', 'latest', 'foreign'].map((id) => ({
    id,
    chatId: id === 'foreign' ? 'b' : 'a',
    parentId: null,
    question: id,
    answer: '',
    answerText: '',
    at: '',
    state: 'done',
    repos: [],
    harness: { adapter: 'codex' }
  }))
}

it('restores the viewed branch rather than jumping to the latest answer', () => {
  const navigation = readChannelNavigation(
    JSON.stringify({ positions: { [channelKey('p', 'a')]: 'earlier' } })
  )
  const row = channelRows([project], navigation)[0]
  expect(new URL(row.href, 'http://localhost').searchParams.get('node')).toBe(
    'earlier'
  )
  expect(project.chats![0].lastNodeId).toBe('latest')
})

it('ignores bookmarks belonging to another channel or a deleted node', () => {
  for (const node of ['foreign', 'deleted']) {
    const navigation = readChannelNavigation(
      JSON.stringify({ positions: { [channelKey('p', 'a')]: node } })
    )
    expect(
      new URL(
        channelRows([project], navigation)[0].href,
        'http://localhost'
      ).searchParams.get('node')
    ).toBe('latest')
  }
})

it('finds channels by title, repository and branch without adding context', () => {
  for (const query of ['CACHE DESIGN', 'lily', 'feature/cache']) {
    expect(
      channelRows([project], readChannelNavigation(null), query).map(
        (row) => row.chatId
      )
    ).toEqual(['a'])
  }
  expect(
    channelRows([project], readChannelNavigation(null), 'missing')
  ).toEqual([])
})

it('tolerates malformed navigation and deduplicates favorites', () => {
  for (const raw of ['null', '{bad'])
    expect(readChannelNavigation(raw)).toEqual(readChannelNavigation(null))
  const nav = readChannelNavigation(
    JSON.stringify({
      favorites: ['p:Chat:a', 8, 'p:Chat:a'],
      positions: { a: 5, b: 'node' }
    })
  )
  expect(nav.favorites).toEqual(['p:Chat:a'])
  expect(nav.positions).toEqual({ b: 'node' })
  expect(
    channelRows([project], nav)
      .filter((row) => row.favorite)
      .map((row) => row.chatId)
  ).toEqual(['a'])
})
