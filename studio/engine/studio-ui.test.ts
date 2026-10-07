import { expect, it, vi } from 'vitest'
import type { Snapshot } from '../shared/api'
vi.mock('../app/api', () => ({ api: {} }))
const { parseHTML } = await import('linkedom')
const { givenAnswer, repoAsk, repoChip, repoDialog } =
  await import('../app/repo-view')
const { repoAskKey } = await import('../shared/repos')

const snapshot = (extra: Partial<Snapshot> = {}, project: object = {}) =>
  ({
    project: {
      id: 'n',
      title: 'Bursts',
      source: '',
      slides: [],
      video: null,
      ...project
    },
    status: 'ready',
    error: null,
    events: [],
    ...extra
  }) as Snapshot
const doc = (html: string) => parseHTML(`<div>${html}</div>`).document
const link = {
  path: '/code/limiter',
  name: 'limiter',
  branch: 'fix-burst',
  base: 'main'
}
const slide = { id: 'a', title: 'The fix', svg: '<svg/>' }
const need = { kind: 'code' as const, what: 'the setting', source: null }

it('names the linked repo and its branch, and links one', () => {
  expect(repoChip(snapshot(), true)).toContain('No repo')
  expect(repoChip(snapshot({}, { repos: [link] }), true)).toContain(
    'limiter · fix-burst'
  )
  const empty = doc(repoDialog(snapshot()))
  expect(empty.querySelector('select')).toBeNull()
  expect(empty.querySelector('button.primary')?.hasAttribute('disabled')).toBe(
    true
  )
  const found = doc(
    repoDialog(snapshot(), {
      path: '/code/limiter',
      name: 'limiter',
      current: 'fix-burst',
      branches: ['fix-burst', 'main'],
      base: 'main'
    })
  )
  expect(
    found.querySelector<HTMLSelectElement>('#repo-branch option[selected]')
      ?.textContent
  ).toBe('fix-burst')
  expect(found.querySelector('#repo-base option[selected]')?.textContent).toBe(
    'main'
  )
})

it('offers to ask the repo, says while it asks, and why it failed', () => {
  expect(repoAsk(snapshot(), slide, need, true)).toBe('')
  const linked = snapshot({}, { repos: [link] })
  expect(repoAsk(linked, slide, need, true)).toContain('Ask limiter')
  // The creator on camera is never the repo's to answer.
  expect(repoAsk(linked, slide, { ...need, kind: 'creator' }, true)).toBe('')
  const key = repoAskKey('a', 'the setting')
  const ask = { slideId: 'a', what: 'the setting', at: 'now' }
  expect(
    repoAsk(
      snapshot(
        { repoAsks: { [key]: { ...ask, state: 'asking' } } },
        {
          repos: [link]
        }
      ),
      slide,
      need,
      true
    )
  ).toContain('Asking limiter…')
  const failed = repoAsk(
    snapshot(
      {
        repoAsks: {
          [key]: { ...ask, state: 'failed', error: 'The agent stopped' }
        }
      },
      { repos: [link] }
    ),
    slide,
    need,
    true
  )
  expect(failed).toContain('The agent stopped')
  expect(failed).toContain('Try again')
})

it('shows where an answer came from, and asks again', () => {
  const answer = {
    what: 'the setting',
    answer: 'A burst of 40.',
    from: {
      repo: 'limiter',
      branch: 'fix-burst',
      commit: 'abcdef1234',
      files: [{ path: 'bucket.ts', lines: [2, 2] as [number, number] }]
    }
  }
  const given = doc(givenAnswer(snapshot(), slide, answer, true))
  expect(given.querySelector('.provenance')?.textContent).toBe(
    'From limiter · fix-burst @ abcdef1 bucket.ts:2–2'
  )
  expect(given.querySelector('form.ask-again')).not.toBeNull()
  // Asking again failed: the reason shows above the form.
  const failed = doc(
    givenAnswer(
      snapshot({
        repoAsks: {
          [repoAskKey('a', 'the setting')]: {
            slideId: 'a',
            what: 'the setting',
            state: 'failed',
            error: 'The agent stopped',
            at: ''
          }
        }
      }),
      slide,
      answer,
      true
    )
  )
  expect(failed.querySelector('.repo-failed')?.textContent).toBe(
    'The agent stopped'
  )
  expect(givenAnswer(snapshot(), slide, { what: 'x', answer: 'y' }, true)).toBe(
    '<p class="evidence-given"><b>x</b> y</p>'
  )
})

it('lists the series, and shows one’s arc, episodes and the next', async () => {
  const { episodeChip, newSeriesDialog, seriesPageView, seriesSection } =
    await import('../app/series-view')
  expect(seriesSection([])).toBe('')
  expect(
    seriesSection([
      { id: 's', title: 'Rate limits', episodes: 1, planned: 4, updatedAt: '' }
    ])
  ).toContain('1 episode of 4 planned')
  expect(
    doc(newSeriesDialog()).querySelector<HTMLInputElement>(
      'input[name="growth"][checked]'
    )?.value
  ).toBe('one')
  const series = {
    id: 's',
    title: 'Rate limits',
    about: 'How we limit requests',
    createdAt: '',
    growth: 'arc' as const,
    episodes: [{ notebookId: 'n1', number: 1, part: 0 }],
    repos: [link],
    threads: ['The outage'],
    arc: {
      episodes: [3, 4] as [number, number],
      at: '',
      parts: [
        { title: 'Why limits', carries: 'The outage', narrative: 'incident' },
        { title: 'The bucket', carries: 'How it works' }
      ]
    }
  }
  const page = doc(
    seriesPageView({
      series,
      episodes: [
        {
          ...series.episodes[0],
          title: 'The outage',
          status: 'ready',
          narrative: 'incident'
        }
      ]
    })
  )
  expect(
    [...page.querySelectorAll('.series-arc li')].map((item) =>
      item.classList.contains('is-made')
    )
  ).toEqual([true, false])
  expect(page.querySelector('.series-arc small')?.textContent).toBe(
    'Incident walkthrough'
  )
  expect(page.querySelector('#episode-form label')?.textContent).toBe(
    'Next: The bucket'
  )
  expect(
    page.querySelector<HTMLInputElement>('#episode-form [name="part"]')?.value
  ).toBe('1')
  expect(page.querySelector('#series-threads')?.textContent).toBe('The outage')
  const planning = seriesPageView({
    series: {
      ...series,
      arc: undefined,
      planning: { state: 'planning', at: '' }
    },
    episodes: []
  })
  expect(planning).toContain('Planning the arc…')
  expect(planning).toContain('No episode yet.')
  expect(
    episodeChip(snapshot({}, { episode: { series: 's', number: 2 } }))
  ).toContain('Episode 2')
  expect(episodeChip(snapshot())).toBe('')
})

it('offers a page’s demo where one is wanted, and shows it once captured', async () => {
  const { captureBlock } = await import('../app/capture-view')
  expect(captureBlock(snapshot(), slide, true)).toBe('')
  const wants = {
    ...slide,
    needs: [{ kind: 'demo' as const, what: 'signing up', source: null }]
  }
  const offered = doc(
    captureBlock(
      snapshot({}, { productUrls: ['https://acme.example/'] }),
      wants,
      true
    )
  )
  expect(offered.querySelector<HTMLInputElement>('[name="url"]')?.value).toBe(
    'https://acme.example/'
  )
  expect(offered.querySelector('button')?.textContent).toBe('Capture the demo')
  const at = (capture: object) =>
    captureBlock(snapshot(), { ...slide, capture } as never, true)
  const base = { url: 'https://acme.example/', steps: [], at: '' }
  expect(at({ ...base, state: 'planning' })).toContain(
    'Drafting the steps from acme.example…'
  )
  expect(at({ ...base, state: 'capturing' })).toContain(
    'Capturing acme.example…'
  )
  const ready = doc(
    at({
      ...base,
      steps: [{ do: 'click', target: 'Sign up' }],
      state: 'ready',
      objectKey: 'n/product-capture/x.mp4',
      seconds: 6.2
    })
  )
  expect(ready.querySelector('video')?.getAttribute('src')).toBe(
    '/objects/n/product-capture/x.mp4'
  )
  expect(ready.querySelector('textarea')?.textContent).toBe('click Sign up')
  expect(at({ ...base, state: 'failed', error: 'No page' })).toContain(
    'No page'
  )
})

it('lays out a release: when, teasers, words and the YouTube bundle', async () => {
  const { localTime, releaseBusy, releaseDialog } =
    await import('../app/release-view')
  const teaser = {
    id: 't',
    channel: 'x' as const,
    aspect: '1:1' as const,
    segments: [
      { from: 0, to: 4 },
      { from: 48, to: 60 }
    ],
    at: ''
  }
  const made = snapshot(
    {},
    {
      release: {
        at: '2026-10-20T09:30:00.000Z',
        teasers: [
          { ...teaser, state: 'ready', objectKey: 'n/teaser/t.mp4' },
          { ...teaser, id: 'u', state: 'cutting' }
        ],
        posts: {
          x: 'It broke.',
          linkedin: 'Last week',
          youtube: 'Why',
          at: ''
        },
        campaign: []
      }
    }
  )
  const page = doc(releaseDialog(made))
  expect(page.querySelector<HTMLInputElement>('#release-at')?.value).toBe(
    localTime('2026-10-20T09:30:00.000Z')
  )
  expect(
    [...page.querySelectorAll('.teaser-row span')].map(
      (item) => item.textContent
    )
  ).toEqual(['X · 1:1 · 16s', 'X · 1:1 · 16s'])
  expect(page.querySelector('.teaser-row a')?.getAttribute('download')).toBe(
    'teaser-x-1x1.mp4'
  )
  expect(page.querySelector('label[for="post-x"] small')?.textContent).toBe(
    '9/280'
  )
  expect(page.querySelector('a[href="/api/projects/n/bundle"]')).not.toBeNull()
  expect(releaseBusy(made)).toBe(true)
  expect(releaseBusy(snapshot())).toBe(false)
})

it('shows each account’s app and who is connected, never a secret', async () => {
  const { accountsDialog } = await import('../app/accounts-view')
  const account = (provider: 'google' | 'x' | 'linkedin', extra = {}) => ({
    provider,
    clientId: null,
    hasSecret: false,
    fromEnvironment: false,
    redirectUri: `http://127.0.0.1:4320/api/accounts/${provider}/callback`,
    connected: null,
    ...extra
  })
  const page = doc(
    accountsDialog({
      accounts: [
        account('google', {
          clientId: 'g-app',
          hasSecret: true,
          connected: { name: 'Acme Engineering', at: '' }
        }),
        account('x', { fromEnvironment: true, clientId: 'x-app' }),
        account('linkedin', {
          clientId: 'li',
          connected: {
            name: 'Ada',
            at: '',
            expiresAt: new Date(Date.now() + 86_400_000).toISOString()
          }
        })
      ],
      xPrices: { post: 0.015, postWithLink: 0.2 }
    })
  )
  expect(page.querySelector('.account-row h3 small')?.textContent).toBe(
    'Acme Engineering'
  )
  expect(
    page.querySelector<HTMLInputElement>('[name="clientSecret"]')?.placeholder
  ).toBe('Kept by the studio')
  expect(page.querySelectorAll('form.account-app')).toHaveLength(2)
  expect(page.querySelector('.account-warn')?.textContent).toContain(
    'sign in again'
  )
  expect(
    page.querySelector<HTMLInputElement>('#x-prices [name="postWithLink"]')
      ?.value
  ).toBe('0.2')
})

it('draws retention against the beats in the release', async () => {
  const { numbersSection } = await import('../app/numbers-view')
  const empty = doc(numbersSection(snapshot()))
  expect(empty.querySelector('.retention')).toBeNull()
  expect(empty.querySelector('[data-action="read-numbers"]')).not.toBeNull()
  const project = {
    slides: [
      { id: 'a', title: 'a', svg: '' },
      { id: 'b', title: 'b', svg: '' }
    ],
    video: {
      settings: {
        presence: 'off',
        voice: { kind: 'record' },
        narrative: 'incident',
        direction: { preset: 'briefing' }
      },
      scenes: ['impact', 'timeline'].map((beat, index) => ({
        id: `s${index}`,
        slideId: ['a', 'b'][index],
        beats: [beat],
        moments: []
      })),
      transitions: [],
      inputKey: '',
      produced: {
        inputKey: '',
        objectKey: 'k',
        clock: [
          { sceneId: 's0', start: 0, duration: 10 },
          { sceneId: 's1', start: 10, duration: 10 }
        ]
      }
    },
    release: {
      teasers: [],
      campaign: [],
      youtube: { state: 'uploaded', videoId: 'dQw4w9WgXcQ', at: '' },
      numbers: [
        {
          at: '2026-10-07T10:00:00.000Z',
          source: 'youtube',
          views: 1200,
          watchMinutes: 340,
          retention: [1, 0.95, 0.9, 0.5, 0.4]
        }
      ]
    }
  }
  const page = doc(numbersSection(snapshot({}, project)))
  expect(page.querySelector('.numbers-totals')?.textContent).toBe(
    '1,200 views · 340 minutes watched'
  )
  expect(
    [...page.querySelectorAll('.retention li span')].map(
      (item) => item.textContent
    )
  ).toEqual(['Impact', 'Timeline'])
  expect(page.querySelector('.numbers-drop')?.textContent).toBe(
    'People left during timeline: 50 of every hundred'
  )
  expect(page.querySelector<HTMLInputElement>('#youtube-video')?.value).toBe(
    'https://youtu.be/dQw4w9WgXcQ'
  )
})

it('lists the campaign by day, with what is due and what went out', async () => {
  const { campaignSection, dueCount } = await import('../app/campaign-view')
  expect(campaignSection(snapshot())).toContain('Set when it goes out')
  const item = {
    channel: 'x' as const,
    asset: 'episode',
    kind: 'launch' as const,
    words: 'Out now {link}',
    time: '09:00'
  }
  const made = snapshot(
    {},
    {
      release: {
        at: new Date(Date.now() - 86_400_000).toISOString(),
        teasers: [],
        campaign: [
          { ...item, id: 'a', offsetDays: 0, state: 'approved' },
          { ...item, id: 'b', offsetDays: 3, state: 'draft' },
          {
            ...item,
            id: 'c',
            offsetDays: -1,
            state: 'posted',
            postUrl: 'https://x.com/i/web/status/1'
          },
          {
            ...item,
            id: 'd',
            channel: 'youtube',
            offsetDays: 0,
            state: 'approved'
          }
        ]
      }
    }
  )
  const page = doc(campaignSection(made))
  expect(page.querySelectorAll('.campaign-item.is-due')).toHaveLength(1)
  expect(dueCount(made)).toBe(1)
  expect(
    page.querySelector('.is-due [data-action="campaign-post"]')?.className
  ).toBe('primary')
  expect(page.querySelector('.is-posted a')?.getAttribute('href')).toBe(
    'https://x.com/i/web/status/1'
  )
  // YouTube's goes out with the upload: no "Post now".
  expect(page.querySelectorAll('[data-action="campaign-post"]')).toHaveLength(2)
})

it('offers publishing from the studio, and says what YouTube kept', async () => {
  const { youtubeSection } = await import('../app/release-view')
  expect(youtubeSection(snapshot())).toContain('Upload to YouTube')
  const uploaded = youtubeSection(
    snapshot(
      {},
      {
        release: {
          teasers: [],
          campaign: [],
          youtube: {
            state: 'uploaded',
            videoId: 'vid123',
            notes: ['YouTube kept it private'],
            at: ''
          }
        }
      }
    )
  )
  expect(uploaded).toContain('https://www.youtube.com/watch?v=vid123')
  expect(uploaded).toContain('YouTube kept it private')
  expect(uploaded).not.toContain('Upload to YouTube')
})

it('offers to link a repo beside requests one could answer', async () => {
  const { linkRepoAsk } = await import('../app/repo-view')
  const code = [{ kind: 'code' as const, what: 'the setting', source: null }]
  expect(linkRepoAsk(snapshot(), code, true)).toContain('Link a repo to ask it')
  expect(linkRepoAsk(snapshot(), code, false)).toBe('')
  expect(linkRepoAsk(snapshot({}, { repos: [link] }), code, true)).toBe('')
  expect(
    linkRepoAsk(
      snapshot(),
      [{ kind: 'creator', what: 'you on camera', source: null }],
      true
    )
  ).toBe('')
})
