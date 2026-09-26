import { describe, expect, it } from 'vitest'
import { audioReadinessOf, compileProject, createDefaultBlockConfig, defaultBrand, defaultStudioTheme, forkNotebook, type ProjectDocumentV1 } from './index'

// An accepted production (P4) replaces its scene in the notebook's
// composition: its render plays for its own length, with its voice when it
// has one, and nothing of the page, its presenter tracks or its cues is
// drawn over it.
const project = (voiced: boolean): ProjectDocumentV1 => {
  const scene = { type: 'scene', attrs: { id: 'bucket', title: 'Token bucket', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720"><rect id="u1" x="10" y="10" width="100" height="100"/></svg>', script: 'Each request spends one token.', windows: [{ say: 'Each request spends one token.', parts: [] }] } }
  const intro = { type: 'heading', attrs: { id: 'intro', level: 1 }, content: [{ type: 'text', text: 'Rate limits' }] }
  return {
    version: 1,
    id: 'produced',
    title: 'Produced',
    notebook: { type: 'doc', content: [intro, scene] },
    fps: 30,
    width: 1920,
    height: 1080,
    blocks: { intro: createDefaultBlockConfig('intro', intro), bucket: createDefaultBlockConfig('bucket', scene) },
    presenterTracks: { bucket: [{ kind: 'narration', audioUrl: 'https://example.com/old-voice.mp3', audioKind: 'generated' }] },
    brand: defaultBrand,
    producedScenes: { bucket: { productionId: 'plan-production-1', videoUrl: 'https://example.com/produced.mp4', durationMs: 21_400, bundle: 'b'.repeat(64), plan: { record: 'plan-treatment-1', revision: 2 }, acceptedAt: '2026-09-25T12:00:00.000Z', voiced } },
  }
}

describe('a produced scene in the notebook', () => {
  it('plays its render for its own length, with its voice, in place of the page', () => {
    const result = compileProject(project(true))
    const scene = result.scenes.find(entry => entry.id === 'bucket')!
    expect(scene.durationSeconds).toBe(21.4)
    expect(scene.presenterTracks).toEqual([])
    expect(result.html).toMatch(/<video class="recorded-take produced-scene clip"[^>]*src="https:\/\/example.com\/produced.mp4"/)
    expect(result.html).toMatch(/<audio [^>]*src="https:\/\/example.com\/produced.mp4"/)
    // The old narration track never plays over the produced voice.
    expect(result.html).not.toContain('old-voice.mp3')
  })

  // F05 of the fix verification: a produced render covers the frame, the
  // scene's chrome hidden under it, so its logo is not asked for at all —
  // while the scenes it does not cover still show it.
  it('asks for the theme logo only where it can be seen', () => {
    for (const placement of ['top-left', 'footer-right'] as const) {
      const branded = { ...project(true), theme: { ...defaultStudioTheme, logo: { url: '/objects/projects/p/brand-logo/logo.svg', placement, size: 28 } } }
      const html = compileProject(branded).html
      const sections = html.split('<section').slice(1)
      const covered = sections.find(section => section.includes('data-node-id="bucket"'))!
      const open = sections.find(section => section.includes('data-node-id="intro"'))!
      expect(covered).not.toContain('logo.svg')
      expect(open).toContain('src="/objects/projects/p/brand-logo/logo.svg"')
    }
  })

  it('plays no take, camera or its voice over the produced scene', () => {
    for (const take of [
      { role: 'presenter' as const },
      { keepsPlan: true, cameraUrl: 'https://example.com/camera.webm' },
      { role: 'scene' as const },
    ]) {
      const recorded = { ...project(true), recordedBlocks: { bucket: { blockId: 'bucket', recordingId: 'take-1', videoUrl: 'https://example.com/take.webm', durationMs: 9_000, recordedAt: '2026-09-25T11:00:00.000Z', storage: 'local' as const, ...take } } }
      const result = compileProject(recorded)
      expect(result.scenes.find(entry => entry.id === 'bucket')!.durationSeconds).toBe(21.4)
      expect(result.html).not.toContain('take.webm')
      expect(result.html).not.toContain('camera.webm')
      expect(result.html).toMatch(/produced-scene/)
    }
  })

  // BoltDB review B10: the page's older dialogue ran past the render — its
  // last caption at 30.9 s of a 28.7 s production — and the export grew a
  // blank tail. Nothing of the page is scheduled under its production.
  it('never schedules the page beneath its render, however long its old dialogue', () => {
    const long = project(true)
    const scene = long.notebook.content![1]
    const said = 'An older line of this scene that takes a long while to say out loud, far longer than its production runs.'
    scene.attrs = {
      ...scene.attrs,
      script: Array.from({ length: 6 }, () => said).join(' '),
      windows: Array.from({ length: 6 }, () => ({ say: said, parts: [] })),
      // A camera-led shot's headline, on a stage the presenter holds.
      directorAuto: { shots: [{ beats: [0, 1], view: 'camera-full', emphasis: 'An older headline' }] },
      stageTrack: [{ atMs: 0, family: 'speaker-full' }],
    }
    long.blocks.bucket = createDefaultBlockConfig('bucket', scene)
    const result = compileProject(long)
    const index = result.scenes.find(entry => entry.id === 'bucket')!.index
    expect(result.scenes.find(entry => entry.id === 'bucket')!.durationSeconds).toBe(21.4)
    expect(result.html).not.toContain(`#scene-${index} .ex-caption`)
    expect(result.html).not.toContain(`__slideDrawScene${index}(`)
    expect(result.html).not.toContain('An older headline')
    // Without its production, the same page does draw and caption itself.
    const { producedScenes: _producedScenes, ...page } = long
    const drawn = compileProject(page).html
    expect(drawn).toContain(`__slideDrawScene${index}(`)
  })

  it('adds no sound for a scene silent by choice', () => {
    const result = compileProject(project(false))
    expect(result.html).toMatch(/produced-scene/)
    expect(result.html).not.toMatch(/<audio [^>]*src="https:\/\/example.com\/produced.mp4"/)
  })

  it('reads as voiced, or silent by choice, for Publish', () => {
    expect(audioReadinessOf(project(true)).blocks.find(entry => entry.block === 'bucket')?.state).toBe('produced')
    expect(audioReadinessOf(project(false)).blocks.find(entry => entry.block === 'bucket')?.state).toBe('silent-by-choice')
  })

  it('belongs to the notebook that accepted it: a fork has none', () => {
    const { project: child } = forkNotebook(project(true), { id: 'child', title: 'Child' })
    expect(child.id).toBe('child')
    expect(child.producedScenes).toBeUndefined()
  })
})
