import { describe, expect, it } from 'vitest'
import {
  compileProject,
  createDefaultBlockConfig,
  defaultBrand,
  defaultThemeMotion,
  builtinStudioThemes,
  generateThemeDirections,
  normalizeStudioTheme,
  type ProjectDocumentV1,
} from './index'

const project = (): ProjectDocumentV1 => {
  const heading = {
    type: 'heading',
    attrs: { id: 'intro', level: 1 },
    content: [{ type: 'text', text: 'Human-first videos' }],
  }
  const paragraph = {
    type: 'paragraph',
    attrs: { id: 'body' },
    content: [
      { type: 'text', text: '<script>alert(1)</script>', marks: [] },
    ],
  }
  return {
    version: 1,
    id: 'test-project',
    title: 'Test',
    notebook: { type: 'doc', content: [heading, paragraph] },
    fps: 30,
    width: 1920,
    height: 1080,
    blocks: {
      intro: createDefaultBlockConfig('intro', heading),
      body: createDefaultBlockConfig('body', paragraph),
    },
    presenterTracks: {},
    brand: defaultBrand,
  }
}

describe('compileProject', () => {
  it('compiles stable nodes into sequential Hyperframes scenes', () => {
    const result = compileProject(project())
    expect(result.scenes.map(scene => scene.id)).toEqual(['intro', 'body'])
    expect(result.scenes[1].startSeconds).toBe(5)
    expect(result.durationSeconds).toBe(10)
    expect(result.html).toContain('data-composition-id="test-project"')
    expect(result.html).toContain('data-node-id="intro"')
    expect(result.html).toContain('window.__timelines["test-project"] = tl')
    expect(result.html).toContain('class="scene clip')
    expect(result.html).toContain('class="composition-brand"')
    expect(result.html).toContain('<strong>incredible</strong>')
    expect(result.html).toContain('data-background-preset="brand"')
    expect(defaultBrand.primary).toBe('#16a34a')
    expect(defaultBrand.accent).toBe('#4ade80')
  })

  it('escapes notebook content', () => {
    const result = compileProject(project())
    expect(result.html).not.toContain('<script>alert(1)</script>')
    expect(result.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
  })

  it('rejects missing or duplicated stable IDs', () => {
    const missing = project()
    delete missing.notebook.content[0].attrs?.id
    expect(() => compileProject(missing)).toThrow('missing its stable ID')

    const duplicate = project()
    duplicate.notebook.content[1].attrs = { id: 'intro' }
    expect(() => compileProject(duplicate)).toThrow(
      'Duplicate renderable node ID',
    )
  })

  it('adds presenter media as independent Hyperframes tracks', () => {
    const withPresenter = project()
    withPresenter.presenterTracks.intro = [
      {
        kind: 'human-camera',
        videoUrl: 'http://127.0.0.1:4319/assets/take.webm',
        audioUrl: 'http://127.0.0.1:4319/assets/voice.mp3',
        audioKind: 'generated',
      },
    ]
    const result = compileProject(withPresenter)
    expect(result.html).toContain('<video class="camera')
    expect(result.html).toContain('<audio data-start="0"')
  })

  it('compiles per-block backgrounds and expanded presenter placements', () => {
    const directed = project()
    directed.blocks.intro.background = {
      preset: 'violet',
      color: '#111827',
    }
    directed.blocks.intro.camera.position = 'overlay-left'
    directed.blocks.intro.camera.shape = 'rounded-rectangle'
    directed.presenterTracks.intro = [
      {
        kind: 'human-camera',
        videoUrl: 'http://127.0.0.1:4319/assets/take.webm',
        audioKind: 'none',
      },
    ]

    const result = compileProject(directed)
    expect(result.html).toContain('data-background-preset="violet"')
    expect(result.html).toContain('linear-gradient(135deg, #d8b4fe 0%, #7c3aed 100%)')
    expect(result.html).toContain('camera-overlay-left rounded-rectangle')
  })

  it('compiles a saved theme as a complete block and video recipe', () => {
    const themed = project()
    themed.theme = builtinStudioThemes.find(
      theme => theme.id === 'lee-gradient-grid',
    )
    const result = compileProject(themed)

    expect(result.html).toContain('data-theme-id="lee-gradient-grid"')
    expect(result.html).toContain('data-list-style="cards"')
    expect(result.html).toContain('data-code-style="terminal"')
    expect(result.html).toContain('class="video-border-gradient"')
    expect(result.html).toContain('linear-gradient(90deg, transparent')
  })

  it('creates keyless theme directions with color-input-safe palettes', () => {
    const themes = generateThemeDirections('#1747e8', 'Example', 'both')
    expect(themes).toHaveLength(4)
    expect(new Set(themes.map(theme => theme.canvas.treatment)).size).toBe(3)
    themes.forEach(theme => {
      Object.values(theme.brand).forEach(color =>
        expect(color).toMatch(/^#[0-9a-f]{6}$/i),
      )
      theme.canvas.gradient.forEach(color =>
        expect(color).toMatch(/^#[0-9a-f]{6}$/i),
      )
    })
  })

  it('renders a semantic palette, uploaded logo, and person-led point overlay', () => {
    const themed = project()
    themed.theme = structuredClone(builtinStudioThemes[1])
    themed.theme.brand.secondary = '#2563eb'
    themed.theme.logo = {
      url: 'http://127.0.0.1:4319/assets/brand.svg',
      placement: 'top-right',
      size: 42,
    }
    themed.blocks.intro.camera.mode = 'person-background-left'
    themed.blocks.intro.camera.position = 'full'
    themed.presenterTracks.intro = [
      {
        kind: 'human-camera',
        videoUrl: 'http://127.0.0.1:4319/assets/take.webm',
        audioKind: 'none',
      },
    ]

    const result = compileProject(themed)
    expect(result.html).toContain('--secondary:#2563eb')
    expect(result.html).toContain('presenter-person-background-left')
    expect(result.html).toContain('camera-full')
    expect(result.html).toContain('class="composition-corner-logo logo-top-right"')
    expect(result.html).toContain('src="http://127.0.0.1:4319/assets/brand.svg"')
  })

  it('migrates legacy theme and block camera layouts', () => {
    const legacyTheme = structuredClone(builtinStudioThemes[0])
    legacyTheme.video.layout = 'overlay' as typeof legacyTheme.video.layout
    delete (legacyTheme as Partial<typeof legacyTheme>).motion
    expect(normalizeStudioTheme(legacyTheme).video.layout).toBe(
      'portrait-overlay',
    )
    expect(normalizeStudioTheme(legacyTheme).motion).toEqual(defaultThemeMotion)

    const legacyProject = project()
    delete (legacyProject.blocks.intro.camera as Partial<
      typeof legacyProject.blocks.intro.camera
    >).mode
    expect(compileProject(legacyProject).html).toContain(
      'presenter-information-circle',
    )
  })

  it('keeps markdown content inside presenter-safe regions', () => {
    const result = compileProject(project())

    expect(result.html).toContain('--presenter-safe-width: 62%')
    expect(result.html).toContain(
      'width: min(100%, var(--content-layout-width), var(--presenter-safe-width))',
    )
    expect(result.html).toContain(
      'grid-template-columns: repeat(2, minmax(0, 1fr))',
    )
    expect(result.html).toContain('overflow-wrap: anywhere')
  })

  it('compiles list and code sequences as individually seekable targets', () => {
    const animated = project()
    const list = {
      type: 'bulletList',
      attrs: { id: 'points' },
      content: [
        {
          type: 'listItem',
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: 'First' }] },
          ],
        },
        {
          type: 'listItem',
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: 'Second' }] },
          ],
        },
      ],
    }
    const code = {
      type: 'codeBlock',
      attrs: { id: 'code' },
      content: [{ type: 'text', text: 'const a = 1\nconst b = 2' }],
    }
    animated.notebook.content.push(list, code)
    animated.blocks.points = createDefaultBlockConfig('points', list)
    animated.blocks.code = createDefaultBlockConfig('code', code)
    animated.blocks.points.reveal = 'line-by-line'
    animated.blocks.code.reveal = 'line-by-line'

    const result = compileProject(animated)
    expect(result.html).toContain('class="code-line" data-line="2"')
    expect(result.html).toContain('#scene-2 .content li')
    expect(result.html).toContain('#scene-3 .content .code-line')
    expect(result.html).toContain('stagger:')
  })
})
