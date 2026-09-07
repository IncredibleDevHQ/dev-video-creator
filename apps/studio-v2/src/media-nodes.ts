import { mergeAttributes, Node } from '@tiptap/core'
import { dialogueCaption, dialogueSection } from './dialogue-card'

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
      // Script-first: the script (one paragraph per beat) is the source of
      // truth; the motion plan (V2) is derived from it and runs the driver.
      script: { default: '' },
      motion: { default: null },
      // The workflow state: the dialogue is approved before it is broken down
      // into windows of attention; the windows are approved before motion is
      // planned from them. pace = { granularity, wpm }.
      scriptApproved: { default: false },
      pace: { default: null },
      windows: { default: [] },
      breakdownApproved: { default: false },
      // The user approved the base page structure; Plan motion (assist)
      // refuses to run before this is set.
      structureApproved: { default: false },
      // Heuristic director's brief written when an assist plan is applied;
      // replaced by stage-director harness runs once rate_layout /
      // layout_track land as MCP tools.
      directorBrief: { default: null },
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
        [
          'button',
          {
            type: 'button',
            class: 'notebook-image-action',
            'data-slide-action': 'edit',
          },
          'Dialogue & motion',
        ],
      ],
      poster
        ? ['img', { src: String(poster), alt: String(title || 'Slide') }]
        : ['div', { class: 'notebook-media-placeholder' }, ['span', {}, '▤'], ['strong', {}, 'Slide without a preview']],
      dialogueSection(HTMLAttributes as Record<string, unknown>),
      [
        'figcaption',
        {},
        `${dialogueCaption(HTMLAttributes as Record<string, unknown>)}${stepList.length && !(HTMLAttributes.windows as unknown[] | undefined)?.length ? ` · ${stepList.length} step${stepList.length === 1 ? '' : 's'}` : ''}${source ? ' · SVG source' : ''}`,
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
