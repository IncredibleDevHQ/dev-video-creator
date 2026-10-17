import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, expect, it } from 'vitest'
import type { Snapshot } from '../shared/api'
import type { Project } from '../shared/model'
import type { Branding } from '../shared/settings'
// Review 8, round 3 (F19): a titled thumbnail's approval holds for the
// brand it is drawn in, and its picture is made anew when that changes. A
// green clip made with ffmpeg stands for the video; YouTube is never called.
const root = await mkdtemp(join(tmpdir(), 'minimal-review-8-cover-3-'))
process.env.MINIMAL_STUDIO_DATA_DIR = root
const { uploadBundle, updateRelease } = await import('./release')
const { coverImage } = await import('./release-cover')
const { storeAsset, writeRow } = await import('./persistence')
const { loadProject } = await import('./projects')
const cover = await import('../shared/release-cover')
afterAll(() => rm(root, { recursive: true, force: true }))

const work = join(root, 'work')
let videoKey = ''
beforeAll(async () => {
  await mkdir(work, { recursive: true })
  const file = join(work, 'green.mp4')
  execFileSync('ffmpeg', [
    ...['-v', 'error', '-y', '-f', 'lavfi'],
    ...['-i', 'color=c=green:s=640x360:r=30:d=12'],
    ...['-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p'],
    file
  ])
  videoKey = (
    await storeAsset({
      body: await readFile(file),
      contentType: 'video/mp4',
      extension: '.mp4',
      kind: 'produced-video',
      projectId: 'cover-3'
    })
  ).objectKey
})

const branding: Branding = {
  name: 'Latte Labs',
  tagline: '',
  accent: '#22c55e',
  useAccent: true,
  logoKey: null,
  fonts: { display: "'Brand Display', serif", body: 'Inter', mono: 'mono' },
  palette: { ground: '#101828', text: '#ffffff', secondary: '#98a2b3' }
}
/** An older video, one timed scene, in the brand above. */
const episode = (id: string): Project => ({
  id,
  title: 'One click, two lattes',
  source: '',
  slides: [{ id: 's0', title: 'Impact', svg: '' }],
  episode: { series: 'none', number: 3 },
  branding,
  video: {
    settings: { presence: 'off', voice: { kind: 'record' } },
    scenes: [
      {
        id: 'scene-0',
        slideId: 's0',
        phase: 'produced',
        presence: null,
        moments: [{ id: 'm', lines: 'It broke.', start: 0, end: 12 }],
        inputKey: '',
        produced: null,
        error: null
      }
    ],
    transitions: [],
    inputKey: '',
    produced: {
      inputKey: '',
      objectKey: videoKey,
      clock: [{ sceneId: 'scene-0', start: 0, duration: 12 }]
    }
  } as never,
  release: { teasers: [], campaign: [] }
})
const snapshot = (value: Project): Snapshot => ({
  project: value,
  status: 'ready',
  error: null,
  events: []
})
const save = (value: Project) => writeRow('projects', value.id, snapshot(value))
const approve = async (id: string) =>
  updateRelease(id, {
    approveCover: cover.coverStamp((await loadProject(id))!.project)
  })
/** The brand changed after approval, as a look applied to the notebook. */
const rebrand = async (id: string, change: Partial<Branding>) => {
  const project = (await loadProject(id))!.project
  await save({ ...project, branding: { ...project.branding!, ...change } })
}
/** The colour of a JPEG's pixel. */
const pixel = (bytes: Buffer, x: number, y: number) => {
  const rgb = execFileSync(
    'ffmpeg',
    ['-v', 'error', '-i', 'pipe:0', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
    { input: bytes, maxBuffer: 1 << 24 }
  )
  return [0, 1, 2].map((channel) => rgb[(y * 1280 + x) * 3 + channel])
}

it('asks for the titled thumbnail’s approval again when the brand it is drawn in changes (F19, round 3)', async () => {
  const changes: [string, Partial<Branding>][] = [
    ['face', { fonts: { display: 'Fraunces', body: 'Inter', mono: 'mono' } }],
    ['accent', { accent: '#e11d48' }],
    [
      'panel',
      { palette: { ground: '#1a1033', text: '#ffffff', secondary: '#98a2b3' } }
    ],
    [
      'files',
      {
        fontFiles: [
          {
            family: 'Brand Display',
            weight: 700,
            style: 'normal',
            objectKey: 'fonts/brand-display-2.woff2',
            format: 'woff2'
          }
        ]
      }
    ]
  ]
  for (const [what, change] of changes) {
    const id = `brand-${what}`
    await save(episode(id))
    await updateRelease(id, { coverTitle: true })
    await approve(id)
    expect(cover.coverApproved((await loadProject(id))!.project)).toBe(true)
    await rebrand(id, change)
    const changed = (await loadProject(id))!.project
    expect([what, cover.coverApproved(changed)]).toEqual([what, false])
    await expect(uploadBundle(id)).rejects.toThrow(
      'Approve the thumbnail first: Release shows it'
    )
  }
  // A thumbnail without the title carries none of the brand: it holds.
  await save(episode('plain'))
  await approve('plain')
  await rebrand('plain', { accent: '#e11d48' })
  expect(cover.coverApproved((await loadProject('plain'))!.project)).toBe(true)
})

it('draws the titled thumbnail anew when only the brand’s panel colour changes (F19, round 3)', async () => {
  await save(episode('panel'))
  await updateRelease('panel', { coverTitle: true })
  const first = await coverImage((await loadProject('panel'))!.project)
  const [r, g, b] = pixel(first, 20, 20)
  // #101828: the brand's dark ground, blue leading.
  expect(
    Math.abs(r - 0x10) + Math.abs(g - 0x18) + Math.abs(b - 0x28)
  ).toBeLessThan(24)
  await rebrand('panel', {
    palette: { ground: '#2a0a0a', text: '#ffffff', secondary: '#98a2b3' }
  })
  const second = await coverImage((await loadProject('panel'))!.project)
  const [r2, , b2] = pixel(second, 20, 20)
  // #2a0a0a: red now leads, not blue.
  expect(r2).toBeGreaterThan(b2)
  expect(r2).toBeGreaterThan(30)
}, 60_000)
