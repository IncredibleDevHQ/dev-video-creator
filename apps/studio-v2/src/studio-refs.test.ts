import { describe, expect, it } from 'vitest'
import type { ProjectDocumentV1 } from 'markdown-composition'
import { mapMarkupUrls, objectUrl, portableProjectMedia, portableUrl, studioRefOf } from './studio-refs'
import { downloadName } from './studio-download'

// F01 and F05 of the fix verification: the desktop's worker takes a new
// port at every start, so the studio's own files are named by their path.
describe('a reference to the studio\'s own files', () => {
  it('reads root-relative and loopback addresses on any port alike', () => {
    expect(studioRefOf('/objects/projects/p/brand-logo/l.svg')).toEqual({ root: 'objects', path: 'projects/p/brand-logo/l.svg' })
    expect(studioRefOf('http://127.0.0.1:58827/objects/projects/p/export/v.mp4')).toEqual({ root: 'objects', path: 'projects/p/export/v.mp4' })
    expect(studioRefOf('http://localhost:4319/assets/take.webm')).toEqual({ root: 'assets', path: 'take.webm' })
    expect(studioRefOf('/objects/projects%2Fp%2Fframe.png')).toEqual({ root: 'objects', path: 'projects/p/frame.png' })
  })
  it('is not anything else', () => {
    for (const value of ['https://github.com/owner.png', 'https://example.com/objects/x.png', 'data:image/png;base64,AAAA', 'blob:http://127.0.0.1:5/abc', '//cdn.example.com/objects/x', '/api/projects', '/objects/', '/objects/a/../b', 'media/logo.svg', '', undefined, 3]) {
      expect(studioRefOf(value)).toBeNull()
    }
  })
  it('names the same file on the app\'s current origin, and leaves the rest', () => {
    expect(portableUrl('http://127.0.0.1:58827/objects/projects/p/export/v.mp4')).toBe('/objects/projects/p/export/v.mp4')
    expect(portableUrl('http://127.0.0.1:1/objects/a.png?v=2#x')).toBe('/objects/a.png?v=2#x')
    expect(portableUrl('/objects/a.png')).toBe('/objects/a.png')
    expect(portableUrl('https://github.com/owner.png')).toBe('https://github.com/owner.png')
    expect(objectUrl('projects/p/v.mp4')).toBe('/objects/projects/p/v.mp4')
  })
  it('rewrites markup addresses — attributes and CSS — but not fragments', () => {
    const svg = '<svg><image x="1" href="http://127.0.0.1:9/objects/a.png"/><image xlink:href=\'/objects/b.png\'/><rect fill="url(#grad)" style="fill:url(/objects/c.png)"/><use href="#part"/></svg>'
    const seen: string[] = []
    const out = mapMarkupUrls(svg, url => {
      seen.push(url)
      return studioRefOf(url) ? `media/${studioRefOf(url)!.path}` : null
    })
    expect(out).toBe('<svg><image x="1" href="media/a.png"/><image xlink:href=\'media/b.png\'/><rect fill="url(#grad)" style="fill:url(media/c.png)"/><use href="#part"/></svg>')
    expect(seen).not.toContain('#part')
  })
  it('heals a notebook written on another port — its media, never its words', () => {
    const old = 'http://127.0.0.1:58827'
    const project = {
      version: 1, id: 'n', title: 't', fps: 30, width: 1920, height: 1080, blocks: {},
      brand: {} as ProjectDocumentV1['brand'],
      theme: { logo: { url: `${old}/objects/logo.svg`, placement: 'top-left', size: 28 } } as ProjectDocumentV1['theme'],
      presenterTracks: { s1: [{ kind: 'human-camera', videoUrl: `${old}/objects/cam.mp4`, audioKind: 'recorded-mic' }, { kind: 'narration', audioUrl: `${old}/objects/voice.mp3`, audioKind: 'generated' }] },
      recordedBlocks: { s1: { blockId: 's1', recordingId: 'r', videoUrl: `${old}/objects/take.mp4`, cameraUrl: `${old}/objects/cam.mp4`, durationMs: 1, recordedAt: '', storage: 'minio' } },
      producedScenes: { s2: { productionId: 'p', videoUrl: `${old}/objects/produced.mp4`, durationMs: 1, bundle: 'b', plan: { record: 'r', revision: 1 }, acceptedAt: '', voiced: true } },
      notebook: { type: 'doc', content: [
        { type: 'image', attrs: { id: 'i', src: `${old}/objects/figure.png` } },
        { type: 'slide', attrs: { id: 's1', svg: `<svg><image href="${old}/objects/art.png"/></svg>` } },
        { type: 'paragraph', content: [{ type: 'text', text: `${old}/objects/words.png`, marks: [{ type: 'link', attrs: { href: `${old}/objects/link.png` } }] }] },
      ] },
    } as unknown as ProjectDocumentV1
    expect(portableProjectMedia(project)).toBe(8)
    expect(project.theme!.logo.url).toBe('/objects/logo.svg')
    expect(project.presenterTracks.s1.map(track => (track.kind === 'human-camera' ? track.videoUrl : track.audioUrl))).toEqual(['/objects/cam.mp4', '/objects/voice.mp3'])
    expect(project.recordedBlocks!.s1).toMatchObject({ videoUrl: '/objects/take.mp4', cameraUrl: '/objects/cam.mp4' })
    expect(project.producedScenes!.s2.videoUrl).toBe('/objects/produced.mp4')
    expect(project.notebook.content[0].attrs!.src).toBe('/objects/figure.png')
    expect(project.notebook.content[1].attrs!.svg).toBe('<svg><image href="/objects/art.png"/></svg>')
    const words = project.notebook.content[2].content![0]
    expect(words.text).toBe(`${old}/objects/words.png`)
    expect(words.marks![0].attrs!.href).toBe(`${old}/objects/link.png`)
    expect(portableProjectMedia(project)).toBe(0)
  })
  it('gives a download a name the system takes', () => {
    expect(downloadName('How BoltDB Works: A/B tour?', 'mp4')).toBe('How BoltDB Works A B tour.mp4')
    expect(downloadName('   ', 'mp4')).toBe('Incredible Studio.mp4')
  })
})
