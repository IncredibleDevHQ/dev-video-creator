import { mergeAttributes, Node } from '@tiptap/core'

const sharedAttributes = () => ({
  src: { default: '' },
  title: { default: '' },
  uploadKey: { default: '' },
  status: { default: 'ready' },
})

export const ImageBlock = Node.create({
  name: 'image',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      ...sharedAttributes(),
      alt: { default: 'Image' },
    }
  },

  parseHTML() {
    return [{ tag: 'figure[data-block-type="image"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    const { src, alt, title, status, uploadKey, ...attributes } = HTMLAttributes
    return [
      'figure',
      mergeAttributes(attributes, {
        'data-block-type': 'image',
        'data-media-status': status,
        'data-upload-key': uploadKey,
        class: 'notebook-media-block notebook-image-block',
      }),
      src
        ? ['img', { src, alt: alt || title || 'Notebook image' }]
        : [
            'div',
            { class: 'notebook-media-placeholder' },
            ['span', {}, '▧'],
            [
              'strong',
              {},
              status === 'uploading'
                ? 'Uploading image…'
                : status === 'error'
                  ? 'Upload failed — choose again'
                  : 'Choose an image',
            ],
          ],
      [
        'button',
        {
          type: 'button',
          class: 'notebook-image-action',
          'data-image-action': 'replace',
        },
        src ? 'Replace image' : 'Choose image',
      ],
      ['figcaption', {}, title || alt || 'Image'],
    ]
  },
})

export const ExplainerBlock = Node.create({
  name: 'explainer',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      topic: { default: '' },
      verbosity: { default: 'standard' },
      abstract: { default: '' },
      plan: { default: null },
      // The canvas-agent's program; rendered instead of the SVG plan.
      canvasCode: { default: null },
    }
  },

  parseHTML() {
    return [{ tag: 'figure[data-block-type="explainer"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    const { topic, plan, abstract, verbosity, canvasCode, ...attributes } =
      HTMLAttributes
    const planValue = plan as {
      entities?: unknown[]
      steps?: Array<{ title?: string; explanation?: string }>
    } | null
    const entityCount = planValue?.entities?.length || 0
    const steps = Array.isArray(planValue?.steps) ? planValue.steps : []
    // The notebook shows the block as a readable script: the prompt that
    // seeded it, then each animation step's spoken line — the same dialogue
    // the teleprompter shows while stepping the canvas.
    const stepList = steps.length
      ? [
          'ol',
          { class: 'notebook-explainer-steps' },
          ...steps.map((step, index) => [
            'li',
            {},
            ['strong', {}, String(step?.title || `Step ${index + 1}`)],
            ['p', {}, String(step?.explanation || '')],
          ]),
        ]
      : [
          'div',
          { class: 'notebook-media-placeholder' },
          ['span', {}, '◈'],
          ['strong', {}, 'Not planned yet'],
          [
            'em',
            { class: 'notebook-explainer-meta' },
            'Open the editor to generate the explanation and diagram',
          ],
        ]
    return [
      'figure',
      mergeAttributes(attributes, {
        'data-block-type': 'explainer',
        class: 'notebook-media-block notebook-explainer-block',
      }),
      [
        'div',
        { class: 'notebook-explainer-prompt' },
        ['span', { class: 'notebook-explainer-glyph' }, '◈'],
        ['strong', {}, topic ? String(topic) : 'Explainer'],
        [
          'button',
          {
            type: 'button',
            class: 'notebook-image-action',
            'data-explainer-action': 'edit',
          },
          'Edit explainer',
        ],
      ],
      stepList,
      [
        'figcaption',
        {},
        steps.length
          ? `${entityCount} entities · ${steps.length} animated steps${canvasCode ? ' · canvas program' : ''}`
          : String(topic || 'Explainer'),
      ],
    ]
  },
})

export const SlideBlock = Node.create({
  name: 'slide',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      title: { default: '' },
      // Authored SVG markup (sanitised and id-prefixed by the compiler).
      svg: { default: '' },
      // Raster preview for the notebook and thumbnails.
      poster: { default: '' },
      source: { default: '' },
      // [{ title, explanation, reveals: [groupId], verb }]
      steps: { default: [] },
    }
  },

  parseHTML() {
    return [{ tag: 'figure[data-block-type="slide"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    const { title, svg, poster, source, steps, ...attributes } = HTMLAttributes
    const stepList = Array.isArray(steps) ? (steps as Array<{ title?: string; explanation?: string }>) : []
    return [
      'figure',
      mergeAttributes(attributes, {
        'data-block-type': 'slide',
        class: 'notebook-media-block notebook-slide-block',
      }),
      [
        'div',
        { class: 'notebook-explainer-prompt' },
        ['span', { class: 'notebook-explainer-glyph' }, '▤'],
        ['strong', {}, title ? String(title) : 'Slide'],
      ],
      poster
        ? ['img', { src: String(poster), alt: String(title || 'Slide') }]
        : ['div', { class: 'notebook-media-placeholder' }, ['span', {}, '▤'], ['strong', {}, 'Slide without a preview']],
      stepList.length
        ? [
            'ol',
            { class: 'notebook-explainer-steps' },
            ...stepList.map((step, index) => [
              'li',
              {},
              ['strong', {}, String(step?.title || `Step ${index + 1}`)],
              ['p', {}, String(step?.explanation || '')],
            ]),
          ]
        : ['div', { class: 'notebook-explainer-meta' }, 'No steps yet — the whole slide shows at once'],
      [
        'figcaption',
        {},
        `${stepList.length} animated step${stepList.length === 1 ? '' : 's'}${source ? ' · SVG source' : ''}`,
      ],
    ]
  },
})

export const ScreenRecordingBlock = Node.create({
  name: 'screenRecording',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      ...sharedAttributes(),
      title: { default: 'Screen recording' },
      hasAudio: { default: false },
    }
  },

  parseHTML() {
    return [{ tag: 'figure[data-block-type="screen-recording"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    const { src, title, status, ...attributes } = HTMLAttributes
    return [
      'figure',
      mergeAttributes(attributes, {
        'data-block-type': 'screen-recording',
        'data-media-status': status,
        class: 'notebook-media-block notebook-screen-block',
      }),
      src
        ? ['video', { src, controls: 'true', playsinline: 'true', preload: 'metadata' }]
        : [
            'div',
            { class: 'notebook-media-placeholder' },
            ['span', {}, status === 'recording' ? '●' : '▰'],
            [
              'strong',
              {},
              status === 'recording'
                ? 'Recording your screen…'
                : status === 'uploading'
                  ? 'Preparing recording…'
                  : 'Start a screen recording',
            ],
          ],
      ['figcaption', {}, title || 'Screen recording'],
    ]
  },
})
