import { describe, expect, it } from 'vitest'
import {
  compileProject,
  createDefaultBlockConfig,
  defaultBrand,
  defaultThemeMotion,
  builtinStudioThemes,
  generateThemeDirections,
  normalizeStudioTheme,
  normalizedRectStyle,
  presenterLayoutGeometry,
  type BlockBackgroundPreset,
  type CameraPosition,
  type PresenterLayoutMode,
  type ProjectDocumentV1,
  type RevealStyle,
  type SceneLayout,
  type ThemeBlockLayout,
  type ThemeBlockKind,
  type ThemeBlockRendering,
  type ThemeCodeAnimation,
  type ThemeCodeSyntax,
  type TiptapNode,
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
    content: [{ type: 'text', text: '<script>alert(1)</script>', marks: [] }],
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

const projectWithEveryBlockKind = (): ProjectDocumentV1 => {
  const nodes: TiptapNode[] = [
    {
      type: 'heading',
      attrs: { id: 'title', level: 1 },
      content: [{ type: 'text', text: 'A human title' }],
    },
    {
      type: 'paragraph',
      attrs: { id: 'content' },
      content: [{ type: 'text', text: 'A readable explanation.' }],
    },
    {
      type: 'bulletList',
      attrs: { id: 'list' },
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
    },
    {
      type: 'codeBlock',
      attrs: { id: 'code', language: 'ts' },
      content: [{ type: 'text', text: 'const answer = 42' }],
    },
    {
      type: 'blockquote',
      attrs: { id: 'quote' },
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Make it feel human.' }],
        },
      ],
    },
  ]
  return {
    version: 1,
    id: 'all-block-kinds',
    title: 'Every block kind',
    notebook: { type: 'doc', content: nodes },
    fps: 30,
    width: 1920,
    height: 1080,
    blocks: Object.fromEntries(
      nodes.map(node => {
        const id = String(node.attrs?.id)
        return [id, createDefaultBlockConfig(id, node)]
      })
    ),
    presenterTracks: {},
    brand: defaultBrand,
  }
}

describe('compileProject', () => {
  it('keeps every presenter layout inside normalized canvas bounds', () => {
    const modes: PresenterLayoutMode[] = [
      'information-circle',
      'information-tile',
      'portrait-overlay',
      'portrait-rail',
      'split',
      'person-background-left',
      'person-background-right',
      'person-only',
    ]
    const kinds: ThemeBlockKind[] = [
      'title',
      'content',
      'list',
      'code',
      'quote',
    ]

    kinds.forEach(kind => {
      modes.forEach(mode => {
        const { camera, content } = presenterLayoutGeometry(mode, kind)
        ;[camera, ...(content ? [content] : [])].forEach(rect => {
          expect(rect.left).toBeGreaterThanOrEqual(0)
          expect(rect.top).toBeGreaterThanOrEqual(0)
          expect(rect.width).toBeGreaterThan(0)
          expect(rect.height).toBeGreaterThan(0)
          expect(rect.left + rect.width).toBeLessThanOrEqual(100.001)
          expect(rect.top + rect.height).toBeLessThanOrEqual(100.001)
        })
      })
    })
  })

  it('uses the shared presenter geometry in compiled preview media', () => {
    const modes: PresenterLayoutMode[] = [
      'information-circle',
      'information-tile',
      'portrait-overlay',
      'portrait-rail',
      'split',
      'person-background-left',
      'person-background-right',
      'person-only',
    ]

    modes.forEach(mode => {
      const directed = project()
      directed.blocks.intro.camera.mode = mode
      const result = compileProject(directed, {
        previewPresenter: { imageUrl: '/presenter.jpg' },
      })
      expect(result.html).toContain(
        normalizedRectStyle(presenterLayoutGeometry(mode, 'title').camera)
      )
    })
  })

  it('gives content-only blocks the full content-safe frame', () => {
    const directed = project()
    directed.blocks.intro.camera.position = 'hidden'
    const result = compileProject(directed, {
      previewPresenter: { imageUrl: '/presenter.jpg' },
    })

    expect(result.html).toContain('camera-position-hidden')
    expect(result.html).toContain('camera-hidden')
    expect(result.html).toContain(
      '.scene.camera-position-hidden { --presenter-safe-width: 100%; padding-right: 132px; }'
    )
  })

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

  it('includes only the focused empty block in a live preview', () => {
    const withDraft = project()
    withDraft.notebook.content.push({
      type: 'paragraph',
      attrs: { id: 'new-draft' },
    })

    expect(compileProject(withDraft).scenes.map(scene => scene.id)).toEqual([
      'intro',
      'body',
    ])

    const livePreview = compileProject(withDraft, {
      includeEmptyNodeId: 'new-draft',
    })
    expect(livePreview.scenes.map(scene => scene.id)).toEqual([
      'intro',
      'body',
      'new-draft',
    ])
    expect(livePreview.scenes[2].title).toBe('Untitled text block')
    expect(livePreview.html).toContain('data-node-id="new-draft"')
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
      'Duplicate renderable node ID'
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
    expect(result.html).toContain('camera-kind-title clip')
    expect(result.html).toContain('<audio data-start="0"')
  })

  it('compiles image and screen-recording blocks into timed media tracks', () => {
    const withMedia = project()
    const image: TiptapNode = {
      type: 'image',
      attrs: {
        id: 'product-shot',
        src: 'http://127.0.0.1:4319/assets/product.png',
        title: 'Product dashboard',
        alt: 'A product dashboard',
      },
    }
    const screen: TiptapNode = {
      type: 'screenRecording',
      attrs: {
        id: 'screen-demo',
        src: 'http://127.0.0.1:4319/assets/demo.webm',
        title: 'Recorded product demo',
        hasAudio: true,
      },
    }
    withMedia.notebook.content.push(image, screen)
    withMedia.blocks['product-shot'] = createDefaultBlockConfig(
      'product-shot',
      image,
    )
    withMedia.blocks['product-shot'].mediaFrame = {
      borderWidth: 'medium',
      corners: 'rounded',
      elevation: 'lifted',
    }
    withMedia.blocks['screen-demo'] = createDefaultBlockConfig(
      'screen-demo',
      screen,
    )

    const result = compileProject(withMedia)
    const imageScene = result.scenes.find(scene => scene.id === 'product-shot')
    const screenScene = result.scenes.find(scene => scene.id === 'screen-demo')

    expect(imageScene?.title).toBe('Product dashboard')
    expect(imageScene?.durationSeconds).toBe(5)
    expect(screenScene?.title).toBe('Recorded product demo')
    expect(screenScene?.durationSeconds).toBe(8)
    expect(result.html).toContain('class="media-block media-image"')
    expect(result.html).toContain('media-border-medium')
    expect(result.html).toContain('media-corners-rounded')
    expect(result.html).toContain('media-depth-lifted')
    expect(result.html).toContain('data-media-border="medium"')
    expect(result.html).toContain(
      'src="http://127.0.0.1:4319/assets/product.png"',
    )
    expect(result.html).toContain('class="media-block media-screen"')
    expect(result.html).toContain(
      '<video class="clip" data-start="15" data-duration="8"',
    )
    expect(result.html).toContain(
      '<audio data-start="15" data-duration="8"',
    )
    expect(result.html).toContain(
      '.scene:has(.media-image):not(.theme-render-full).layout-prose .content { width: 80%;',
    )
    expect(result.html).toContain(
      '.scene:has(.media-image):not(.theme-render-full).layout-title .media-image img { min-height: 760px;',
    )
    expect(result.html).toContain(
      '.scene:has(.media-image):not(.theme-render-full).layout-split .content { width: 56%;',
    )
    expect(result.html).toContain(
      '.camera.presenter-information-circle, .camera.presenter-information-tile',
    )
    expect(result.html).toContain(
      '.scene:has(.media-block):not(.theme-render-full).theme-layout-split-right .content { width: 44%;',
    )
    expect(result.html).toContain(
      '.scene:has(.media-block):not(.theme-render-full).theme-layout-center .content { width: 68%;',
    )
    expect(result.html).toContain(
      '.layout-title:is(.theme-layout-upper,.theme-layout-lower) .media-block',
    )
  })

  it('shows a presenter placeholder only in live preview compositions', () => {
    const withoutPreview = compileProject(project())
    const withPreview = compileProject(project(), {
      previewPresenter: {
        imageUrl: '/src/assets/presenters/arun.jpg',
        name: 'Arun',
      },
    })

    expect(withoutPreview.html).not.toContain('data-preview-presenter="true"')
    expect(withPreview.html).toContain('data-preview-presenter="true"')
    expect(withPreview.html).toContain('alt="Arun"')
    expect(withPreview.html).not.toContain('camera preview-camera clip')
    const introStart = withPreview.html.indexOf('data-node-id="intro"')
    const introEnd = withPreview.html.indexOf('</section>', introStart)
    expect(withPreview.html.slice(introStart, introEnd)).toContain(
      'data-preview-presenter="true"'
    )
  })

  it('keeps code readable across every placement, rendering, theme, and motion', () => {
    const placements: ThemeBlockLayout[] = [
      'center',
      'left',
      'right',
      'upper',
      'lower',
      'split-left',
      'split-right',
      'full',
    ]
    const renderings: ThemeBlockRendering[] = [
      'panel',
      'terminal',
      'full',
      'editor',
      'glass',
      'minimal',
      'spotlight',
      'split',
      'paper',
    ]
    const codeThemes: ThemeCodeSyntax[] = [
      'light_vs',
      'light_plus',
      'quietlight',
      'solarized_light',
      'abyss',
      'dark_vs',
      'dark_plus',
      'kimbie_dark',
      'monokai',
      'monokai_dimmed',
      'red',
      'solarized_dark',
      'tomorrow_night_blue',
      'hc_black',
    ]
    const codeAnimations: ThemeCodeAnimation[] = [
      'type-lines',
      'highlight-lines',
    ]
    let combinations = 0

    placements.forEach(placement => {
      renderings.forEach(rendering => {
        codeThemes.forEach(codeTheme => {
          codeAnimations.forEach(codeAnimation => {
            const configured = projectWithEveryBlockKind()
            const config = configured.blocks.code
            config.appearance.layout = placement
            config.appearance.render = rendering
            config.appearance.codeTheme = codeTheme
            config.appearance.codeAnimation = codeAnimation
            const result = compileProject(configured)
            const scene = result.scenes.find(item => item.id === 'code')

            expect(scene?.config.appearance).toMatchObject({
              layout: placement,
              render: rendering,
              codeTheme,
              codeAnimation,
            })
            expect(result.html).toContain('white-space: pre-wrap')
            expect(result.html).toContain('overflow-wrap: anywhere')
            expect(result.html).toContain(
              '.scene-kind-code:is(.theme-layout-split-left,.theme-layout-split-right) pre code',
            )
            expect(result.html).toContain(
              '.scene-kind-code.theme-render-split:is(.theme-layout-split-left,.theme-layout-split-right) .content::after { display: none; }',
            )
            expect(result.html).not.toMatch(/\b(?:undefined|NaN)\b/)
            combinations += 1
          })
        })
      })
    })

    expect(combinations).toBe(2016)
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
    expect(result.html).toContain(
      'linear-gradient(135deg, #d8b4fe 0%, #7c3aed 100%)'
    )
    expect(result.html).toContain('camera-overlay-left rounded-rectangle')
  })

  it('compiles a saved theme as a complete block and video recipe', () => {
    const themed = project()
    themed.theme = builtinStudioThemes.find(
      theme => theme.id === 'lee-gradient-grid'
    )
    const result = compileProject(themed)

    expect(result.html).toContain('data-theme-id="lee-gradient-grid"')
    expect(result.html).toContain('data-list-style="cards"')
    expect(result.html).toContain('data-code-style="terminal"')
    expect(result.html).toContain('class="video-border-gradient"')
    expect(result.html).toContain('linear-gradient(90deg, transparent')
    expect(result.html).toContain('data-content-style="editorial"')
    expect(result.html).toContain('data-title-layout="center"')
    expect(result.html).toContain('theme-layout-center')
    expect(result.html).toContain('theme-render-split')
  })

  it('creates keyless theme directions with color-input-safe palettes', () => {
    const themes = generateThemeDirections('#1747e8', 'Example', 'both')
    expect(themes).toHaveLength(4)
    expect(new Set(themes.map(theme => theme.canvas.treatment)).size).toBe(3)
    themes.forEach(theme => {
      Object.values(theme.brand).forEach(color =>
        expect(color).toMatch(/^#[0-9a-f]{6}$/i)
      )
      theme.canvas.gradient.forEach(color =>
        expect(color).toMatch(/^#[0-9a-f]{6}$/i)
      )
      expect(theme.blocks.content).toBeTruthy()
      expect(Object.keys(theme.blocks.layout)).toHaveLength(5)
      expect(theme.blocks.codeTheme).toBeTruthy()
      expect(theme.blocks.codeAnimation).toMatch(
        /^(type-lines|highlight-lines)$/
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
    expect(result.html).toContain(
      'class="composition-corner-logo logo-top-right"'
    )
    expect(result.html).toContain(
      'src="http://127.0.0.1:4319/assets/brand.svg"'
    )
    expect(result.html).toContain(
      '.scene.presenter-person-background-left, .scene.presenter-person-background-right { --presenter-safe-width: 100%; }'
    )
    expect(result.html).toContain(
      '.scene.presenter-person-background-left::after { background: linear-gradient(90deg'
    )
    expect(result.html).toContain(
      '.scene.presenter-person-background-right::after { background: linear-gradient(270deg'
    )
    expect(result.html).toContain(
      '.scene-kind-list.theme-render-timeline ul, .scene-kind-list.theme-render-timeline ol { padding: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));'
    )
    expect(result.html).toContain(
      '.scene-kind-list.theme-render-number-grid ul, .scene-kind-list.theme-render-number-grid ol { display: grid; grid-template-columns: repeat(auto-fit, minmax(330px, 1fr));'
    )
    expect(result.html).toContain(
      '.scene-kind-list li { word-break: normal; overflow-wrap: break-word; text-wrap: pretty; }'
    )
  })

  it('mirrors full-camera content placement with the selected presenter mode', () => {
    const left = project()
    left.blocks.intro.camera.mode = 'person-background-left'
    left.blocks.intro.camera.position = 'full'
    const leftResult = compileProject(left, {
      previewPresenter: { imageUrl: '/presenter.jpg' },
    })

    const right = project()
    right.blocks.intro.camera.mode = 'person-background-right'
    right.blocks.intro.camera.position = 'full'
    const rightResult = compileProject(right, {
      previewPresenter: { imageUrl: '/presenter.jpg' },
    })

    expect(leftResult.html).toContain(
      `style="${normalizedRectStyle(
        presenterLayoutGeometry('person-background-left', 'title').content!,
      )}"`,
    )
    expect(rightResult.html).toContain(
      `style="${normalizedRectStyle(
        presenterLayoutGeometry('person-background-right', 'title').content!,
      )}"`,
    )
    expect(leftResult.html).not.toContain(
      normalizedRectStyle(
        presenterLayoutGeometry('person-background-right', 'title').content!,
      ),
    )
  })

  it('migrates legacy theme and block camera layouts', () => {
    const legacyTheme = structuredClone(builtinStudioThemes[0])
    legacyTheme.video.layout = 'overlay' as typeof legacyTheme.video.layout
    delete (legacyTheme as Partial<typeof legacyTheme>).motion
    delete (legacyTheme.blocks as Partial<typeof legacyTheme.blocks>).content
    delete (legacyTheme.blocks as Partial<typeof legacyTheme.blocks>).layout
    delete (legacyTheme.blocks as Partial<typeof legacyTheme.blocks>).codeTheme
    delete (legacyTheme.blocks as Partial<typeof legacyTheme.blocks>)
      .codeAnimation
    expect(normalizeStudioTheme(legacyTheme).video.layout).toBe(
      'portrait-overlay'
    )
    expect(normalizeStudioTheme(legacyTheme).motion).toEqual(defaultThemeMotion)
    expect(normalizeStudioTheme(legacyTheme).blocks.content).toBe('editorial')
    expect(normalizeStudioTheme(legacyTheme).blocks.layout.code).toBe('full')
    expect(normalizeStudioTheme(legacyTheme).blocks.codeTheme).toBe('dark_plus')
    expect(normalizeStudioTheme(legacyTheme).blocks.codeAnimation).toBe(
      'type-lines'
    )

    const legacyProject = project()
    delete (
      legacyProject.blocks.intro.camera as Partial<
        typeof legacyProject.blocks.intro.camera
      >
    ).mode
    expect(compileProject(legacyProject).html).toContain(
      'presenter-information-circle'
    )
  })

  it('keeps markdown content inside presenter-safe regions', () => {
    const result = compileProject(project())

    expect(result.html).toContain(
      '.scene.presenter-information-circle { --presenter-safe-width: 100%; padding-right: 520px; }'
    )
    expect(result.html).toContain(
      '.scene.presenter-portrait-overlay { --presenter-safe-width: 100%; padding-right: 620px; }'
    )
    expect(result.html).toContain(
      '.camera.presenter-portrait-rail { top: 54px; right: 54px; bottom: auto; width: 31%; height: calc(100% - 108px); border-radius: var(--video-radius); translate: none; }'
    )
    expect(result.html).toContain(
      '.scene-kind-code.layout-split { --content-layout-width: 100%; }'
    )
    expect(result.html).toContain(
      '.scene-kind-code.layout-split pre { min-height: 660px; }'
    )
    expect(result.html).toContain(
      '.camera.camera-kind-code.presenter-portrait-rail { width: 23%; }'
    )
    expect(result.html).toContain(
      '.scene.scene-kind-code.presenter-portrait-rail { padding-right: 540px; padding-left: 72px; }'
    )
    expect(result.html).toContain(
      'width: min(100%, var(--content-layout-width), var(--presenter-safe-width))'
    )
    expect(result.html).toContain(
      'grid-template-columns: repeat(2, minmax(0, 1fr))'
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
    expect(result.html).toContain('class="code-token-keyword">const</span>')
    expect(result.html).toContain('data-code-theme="dark_plus"')
    expect(result.html).toContain('data-code-animation="type-lines"')
    expect(result.html).toContain('#scene-2 .content li')
    expect(result.html).toContain('#scene-3 .content .code-line')
    expect(result.html).toContain('stagger:')
    expect(result.html).toContain('ease: "steps(12)"')
  })

  it('compiles the expanded motion catalog into seekable GSAP timelines', () => {
    const motions = project()
    motions.blocks.intro.reveal = 'blur'
    motions.blocks.body.reveal = 'pop'

    const result = compileProject(motions)
    expect(result.html).toContain('filter: "blur(24px)"')
    expect(result.html).toContain('ease: "back.out(1.7)"')
  })

  it('keeps Studio appearance choices scoped to the selected Markdown block', () => {
    const directed = project()
    directed.blocks.intro.appearance.layout = 'split-left'
    directed.blocks.intro.appearance.render = 'gradient'
    directed.blocks.body.appearance.layout = 'right'
    directed.blocks.body.appearance.render = 'card'
    directed.blocks.body.appearance.codeTheme = 'monokai'
    directed.blocks.body.appearance.codeAnimation = 'highlight-lines'

    const result = compileProject(directed)
    expect(result.html).toContain(
      'theme-layout-split-left theme-render-gradient'
    )
    expect(result.html).toContain('theme-layout-right theme-render-card')
    expect(result.html).toContain(
      'code-theme-monokai code-animation-highlight-lines'
    )
    expect(result.html).toContain('data-render-style="gradient"')
    expect(result.html).toContain('data-block-layout="right"')
  })

  it('keeps every canvas placement geometrically distinct', () => {
    const result = compileProject(project())

    expect(result.html).toContain(
      '.scene.theme-layout-center { --content-layout-width: 72%; }'
    )
    expect(result.html).toContain(
      '.scene.theme-layout-right .content { margin-left: auto; margin-right: 0; text-align: right; }'
    )
    expect(result.html).toContain(
      '.scene.theme-layout-left, .scene.theme-layout-right { --content-layout-width: 62%; }'
    )
    expect(result.html).toContain(
      '.scene.theme-layout-upper, .scene.theme-layout-lower { --content-layout-width: 78%; }'
    )
    expect(result.html).toContain(
      '.scene.theme-layout-split-left { --content-layout-width: 44%; }'
    )
    expect(result.html).toContain(
      '.scene.theme-layout-split-right { --content-layout-width: 44%; }'
    )
    expect(result.html).toContain(
      '.scene.theme-layout-full { --content-layout-width: 100%; }'
    )
  })

  it('compiles every Studio choice without fallback or invalid output', () => {
    const ids: Record<ThemeBlockKind, string> = {
      title: 'title',
      content: 'content',
      list: 'list',
      code: 'code',
      quote: 'quote',
    }
    const sceneLayouts: Record<ThemeBlockKind, SceneLayout[]> = {
      title: ['title', 'prose', 'split'],
      content: ['prose', 'title', 'split'],
      list: ['prose', 'split'],
      code: ['code', 'split'],
      quote: ['prose', 'title', 'split'],
    }
    const renderings: Record<ThemeBlockKind, ThemeBlockRendering[]> = {
      title: [
        'statement',
        'split',
        'lower-third',
        'editorial',
        'framed',
        'gradient',
        'outline',
        'highlight',
        'compact',
      ],
      content: [
        'editorial',
        'card',
        'columns',
        'lede',
        'callout',
        'minimal',
        'highlight',
        'caption',
      ],
      list: [
        'bullets',
        'cards',
        'timeline',
        'steps',
        'pills',
        'checklist',
        'number-grid',
        'spotlight',
        'columns',
        'compact',
      ],
      code: [
        'panel',
        'terminal',
        'full',
        'editor',
        'glass',
        'minimal',
        'spotlight',
        'split',
        'paper',
      ],
      quote: [
        'bar',
        'card',
        'statement',
        'pull',
        'speech',
        'highlight',
        'framed',
        'minimal',
        'oversized',
      ],
    }
    const placements: ThemeBlockLayout[] = [
      'center',
      'left',
      'right',
      'upper',
      'lower',
      'split-left',
      'split-right',
      'full',
    ]
    const alignments: Array<'left' | 'center'> = ['left', 'center']
    const backgrounds: BlockBackgroundPreset[] = [
      'brand',
      'violet',
      'sunset',
      'ocean',
      'mint',
      'rose',
      'paper',
      'charcoal',
      'custom',
    ]
    const commonMotions: RevealStyle[] = [
      'none',
      'fade',
      'rise',
      'fall',
      'slide-left',
      'slide-right',
      'scale',
      'blur',
      'type',
      'wipe',
      'pop',
    ]
    const motions: Record<ThemeBlockKind, RevealStyle[]> = {
      title: commonMotions,
      content: commonMotions,
      list: [...commonMotions, 'line-by-line'],
      code: [...commonMotions, 'line-by-line'],
      quote: commonMotions,
    }
    const presenters: Array<{
      mode: PresenterLayoutMode
      position: CameraPosition
      shape: 'circle' | 'rounded-rectangle'
    }> = [
      { mode: 'information-circle', position: 'hidden', shape: 'circle' },
      { mode: 'information-circle', position: 'bottom-right', shape: 'circle' },
      {
        mode: 'information-tile',
        position: 'bottom-right',
        shape: 'rounded-rectangle',
      },
      {
        mode: 'portrait-overlay',
        position: 'overlay-right',
        shape: 'rounded-rectangle',
      },
      {
        mode: 'portrait-rail',
        position: 'overlay-right',
        shape: 'rounded-rectangle',
      },
      { mode: 'split', position: 'split-right', shape: 'rounded-rectangle' },
      {
        mode: 'person-background-left',
        position: 'full',
        shape: 'rounded-rectangle',
      },
      {
        mode: 'person-background-right',
        position: 'full',
        shape: 'rounded-rectangle',
      },
      { mode: 'person-only', position: 'full', shape: 'rounded-rectangle' },
    ]
    const codeThemes: ThemeCodeSyntax[] = [
      'light_vs',
      'light_plus',
      'quietlight',
      'solarized_light',
      'abyss',
      'dark_vs',
      'dark_plus',
      'kimbie_dark',
      'monokai',
      'monokai_dimmed',
      'red',
      'solarized_dark',
      'tomorrow_night_blue',
      'hc_black',
    ]
    const codeAnimations: ThemeCodeAnimation[] = [
      'type-lines',
      'highlight-lines',
    ]

    const compileChoice = (
      kind: ThemeBlockKind,
      update: (config: ProjectDocumentV1['blocks'][string]) => void
    ) => {
      const configured = projectWithEveryBlockKind()
      update(configured.blocks[ids[kind]])
      const result = compileProject(configured, {
        previewPresenter: { imageUrl: '/presenter.jpg', name: 'Presenter' },
      })
      expect(result.html).not.toMatch(/\b(?:undefined|NaN)\b/)
      expect(result.scenes).toHaveLength(5)
      return result
    }

    ;(Object.keys(ids) as ThemeBlockKind[]).forEach(kind => {
      sceneLayouts[kind].forEach(layout => {
        const result = compileChoice(kind, config => {
          config.layout = layout
        })
        expect(
          result.scenes.find(scene => scene.id === ids[kind])?.config.layout
        ).toBe(layout)
        expect(result.html).toContain(`layout-${layout}`)
      })
      renderings[kind].forEach(rendering => {
        const result = compileChoice(kind, config => {
          config.appearance.render = rendering
        })
        expect(
          result.scenes.find(scene => scene.id === ids[kind])?.config.appearance
            .render
        ).toBe(rendering)
        expect(result.html).toContain(`theme-render-${rendering}`)
      })
      placements.forEach(placement => {
        const result = compileChoice(kind, config => {
          config.appearance.layout = placement
        })
        expect(
          result.scenes.find(scene => scene.id === ids[kind])?.config.appearance
            .layout
        ).toBe(placement)
        expect(result.html).toContain(`theme-layout-${placement}`)
      })
      alignments.forEach(alignment => {
        const result = compileChoice(kind, config => {
          config.alignment = alignment
        })
        expect(
          result.scenes.find(scene => scene.id === ids[kind])?.config.alignment,
        ).toBe(alignment)
        expect(result.html).toContain(`align-${alignment}`)
      })
      backgrounds.forEach(background => {
        const result = compileChoice(kind, config => {
          config.background.preset = background
        })
        expect(
          result.scenes.find(scene => scene.id === ids[kind])?.config.background
            .preset
        ).toBe(background)
        expect(result.html).toContain(`data-background-preset="${background}"`)
      })
      motions[kind].forEach(motion => {
        const result = compileChoice(kind, config => {
          config.reveal = motion
        })
        expect(
          result.scenes.find(scene => scene.id === ids[kind])?.config.reveal
        ).toBe(motion)
        expect(result.html).toContain(`data-reveal="${motion}"`)
      })
      presenters.forEach(presenter => {
        const result = compileChoice(kind, config => {
          config.camera = { ...config.camera, ...presenter }
        })
        const config = result.scenes.find(
          scene => scene.id === ids[kind]
        )?.config
        expect(config?.camera).toMatchObject(presenter)
        expect(result.html).toContain(`presenter-${presenter.mode}`)
        expect(result.html).toContain(`camera-position-${presenter.position}`)
      })
    })

    codeThemes.forEach(codeTheme => {
      const result = compileChoice('code', config => {
        config.appearance.codeTheme = codeTheme
      })
      expect(
        result.scenes.find(scene => scene.id === 'code')?.config.appearance
          .codeTheme
      ).toBe(codeTheme)
      expect(result.html).toContain(`code-theme-${codeTheme}`)
    })
    codeAnimations.forEach(codeAnimation => {
      const result = compileChoice('code', config => {
        config.appearance.codeAnimation = codeAnimation
      })
      expect(
        result.scenes.find(scene => scene.id === 'code')?.config.appearance
          .codeAnimation
      ).toBe(codeAnimation)
      expect(result.html).toContain(`code-animation-${codeAnimation}`)
    })
  })

  const projectWithScreenRecording = (
    attrs: Record<string, unknown>,
  ): ProjectDocumentV1 => {
    const screen: TiptapNode = {
      type: 'screenRecording',
      attrs: { id: 'screen', title: 'Screen recording', ...attrs },
    }
    return {
      version: 1,
      id: 'screen-project',
      title: 'Screen',
      notebook: { type: 'doc', content: [screen] },
      fps: 30,
      width: 1920,
      height: 1080,
      blocks: { screen: createDefaultBlockConfig('screen', screen) },
      presenterTracks: {},
      brand: defaultBrand,
    }
  }

  it('authors screen-recording audio only when the capture has an audio track', () => {
    const silent = compileProject(
      projectWithScreenRecording({ src: 'https://cdn.example/take.webm' }),
    )
    expect(silent.html).toContain('media-screen')
    expect(silent.html).not.toContain('data-track-index="40"')

    const withAudio = compileProject(
      projectWithScreenRecording({
        src: 'https://cdn.example/take.webm',
        hasAudio: true,
      }),
    )
    expect(withAudio.html).toContain(
      'data-track-index="40" src="https://cdn.example/take.webm"></audio>',
    )
  })

  it('composes a saved recorded take in place of the live scene', () => {
    const withTake = project()
    withTake.recordedBlocks = {
      intro: {
        blockId: 'intro',
        recordingId: 'rec-1',
        videoUrl: 'https://cdn.example/take-intro.mp4',
        durationMs: 8000,
        recordedAt: '2026-08-20T00:00:00.000Z',
        storage: 'minio',
      },
    }
    const compiled = compileProject(withTake)
    expect(compiled.html).toContain('has-recorded-take"')
    expect(compiled.html).toContain(
      'class="recorded-take clip" data-start="0" data-duration="8" data-track-index="50" src="https://cdn.example/take-intro.mp4" muted playsinline',
    )
    expect(compiled.html).toContain(
      'data-track-index="70" src="https://cdn.example/take-intro.mp4"></audio>',
    )
    const introScene = compiled.scenes.find(scene => scene.id === 'intro')
    const bodyScene = compiled.scenes.find(scene => scene.id === 'body')
    expect(introScene?.durationSeconds).toBe(8)
    expect(bodyScene?.startSeconds).toBe(8)
    const withoutTake = compileProject(project())
    expect(withoutTake.html).not.toContain('has-recorded-take"')
    expect(withoutTake.html).not.toContain('recorded-take clip')
  })

  it('honours a chosen transition duration and clamps it', () => {
    const timed = project()
    timed.blocks.intro.reveal = 'fade'
    timed.blocks.intro.revealDurationSeconds = 2
    timed.blocks.body.reveal = 'wipe'
    timed.blocks.body.revealDurationSeconds = 99
    const compiled = compileProject(timed)
    expect(compiled.html).toContain('{ opacity: 1, duration: 2, ease: "power2.out" }')
    expect(compiled.html).toContain('duration: 3, ease: "power3.inOut"')
    const untimed = compileProject(project())
    expect(untimed.html).toContain('duration: 0.75')
  })

  it('compiles frame switchovers with visibility overlap', () => {
    const framed = project()
    framed.blocks.body.frameTransition = { style: 'crossfade', durationSeconds: 0.8 }
    const compiled = compileProject(framed)
    // The incoming frame animates as a whole section…
    expect(compiled.html).toContain(
      'tl.fromTo("#scene-1", { opacity: 0 }, { opacity: 1, duration: 0.8, ease: "power2.inOut" }, 5);',
    )
    // …while the outgoing scene stays visible underneath for the overlap.
    expect(compiled.html).toContain('data-start="0"\n        data-duration="5.8"')
    const plain = compileProject(project())
    expect(plain.html).not.toContain('tl.fromTo("#scene-1", { opacity: 0 }, { opacity: 1, duration: 0.8')
    expect(plain.html).toContain('data-start="0"\n        data-duration="5"')
  })

  it('pushes both frames on slide switchovers', () => {
    const framed = project()
    framed.blocks.body.frameTransition = { style: 'slide-left', durationSeconds: 0.5 }
    const compiled = compileProject(framed)
    // The incoming frame pushes in…
    expect(compiled.html).toContain(
      'tl.fromTo("#scene-1", { xPercent: 100 }, { xPercent: 0, duration: 0.5, ease: "power2.inOut" }, 5);',
    )
    // …and shoves the outgoing frame out with it, both moving together.
    expect(compiled.html).toContain(
      'tl.fromTo("#scene-0", { xPercent: 0 }, { xPercent: -100, duration: 0.5, ease: "power2.inOut" }, 5);',
    )
  })

  it('omits the recorded take for the content-view block only', () => {
    const withTake = project()
    withTake.recordedBlocks = {
      intro: {
        blockId: 'intro',
        recordingId: 'rec-3',
        videoUrl: 'https://cdn.example/take-intro.mp4',
        durationMs: 8000,
        recordedAt: '2026-08-20T00:00:00.000Z',
        storage: 'minio',
      },
    }
    const contentView = compileProject(withTake, { contentViewNodeId: 'intro' })
    expect(contentView.html).not.toContain('recorded-take clip')
    const otherBlockView = compileProject(withTake, {
      contentViewNodeId: 'body',
    })
    expect(otherBlockView.html).toContain('recorded-take clip')
  })

  it('replaces presenter tracks with the recorded take for the same block', () => {
    const withBoth = project()
    withBoth.presenterTracks = {
      intro: [
        {
          kind: 'human-camera',
          videoUrl: 'https://cdn.example/presenter.mp4',
          audioKind: 'recorded-mic',
        },
      ],
    }
    withBoth.recordedBlocks = {
      intro: {
        blockId: 'intro',
        recordingId: 'rec-2',
        videoUrl: 'https://cdn.example/take-intro.mp4',
        durationMs: 8000,
        recordedAt: '2026-08-20T00:00:00.000Z',
        storage: 'minio',
      },
    }
    const compiled = compileProject(withBoth)
    expect(compiled.html).toContain('take-intro.mp4')
    expect(compiled.html).not.toContain('presenter.mp4')
  })
})
