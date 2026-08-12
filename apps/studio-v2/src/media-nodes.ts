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
    const { src, alt, title, status, ...attributes } = HTMLAttributes
    return [
      'figure',
      mergeAttributes(attributes, {
        'data-block-type': 'image',
        'data-media-status': status,
        class: 'notebook-media-block notebook-image-block',
      }),
      src
        ? ['img', { src, alt: alt || title || 'Notebook image' }]
        : [
            'div',
            { class: 'notebook-media-placeholder' },
            ['span', {}, '▧'],
            ['strong', {}, status === 'uploading' ? 'Uploading image…' : 'Choose an image'],
          ],
      ['figcaption', {}, title || alt || 'Image'],
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
