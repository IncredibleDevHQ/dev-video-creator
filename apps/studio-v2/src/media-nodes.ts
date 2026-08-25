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
    const { topic, plan, abstract, verbosity, ...attributes } = HTMLAttributes
    const planValue = plan as
      | { entities?: unknown[]; steps?: unknown[] }
      | null
    const entityCount = planValue?.entities?.length || 0
    const stepCount = planValue?.steps?.length || 0
    return [
      'figure',
      mergeAttributes(attributes, {
        'data-block-type': 'explainer',
        class: 'notebook-media-block notebook-explainer-block',
      }),
      [
        'div',
        { class: 'notebook-media-placeholder' },
        ['span', {}, '◈'],
        ['strong', {}, topic ? String(topic) : 'Explainer'],
        [
          'em',
          { class: 'notebook-explainer-meta' },
          stepCount
            ? `${entityCount} entities · ${stepCount} animated steps`
            : 'Not planned yet',
        ],
      ],
      [
        'button',
        {
          type: 'button',
          class: 'notebook-image-action',
          'data-explainer-action': 'edit',
        },
        'Edit explainer',
      ],
      ['figcaption', {}, topic ? String(topic) : 'Explainer'],
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
