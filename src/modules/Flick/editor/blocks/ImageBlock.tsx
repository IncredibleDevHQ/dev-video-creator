import { Node, nodeInputRule } from '@tiptap/core'
import { mergeAttributes } from '@tiptap/react'
import { uploadImagePlugin } from '../utils/upload_image'

interface ImageOptions {
  inline: boolean
  HTMLAttributes: Record<string, any>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    image: {
      /**
       * Add an image
       */
      setImage: (options: {
        src: string
        alt?: string
        title?: string
      }) => ReturnType
    }
  }
}

const IMAGE_INPUT_REGEX = /!\[(.+|:?)\]\((\S+)(?:(?:\s+)["'](\S+)["'])?\)/

export default Node.create<ImageOptions>({
  name: 'image',

  addOptions() {
    return {
      ...this.parent?.(),
      inline: false,
      HTMLAttributes: {},
    }
  },

  inline() {
    return this.options.inline
  },

  group() {
    return this.options.inline ? 'inline' : 'block'
  },

  draggable: true,

  addAttributes() {
    return {
      src: {
        default: null,
      },
      alt: {
        default: null,
      },
      title: {
        default: null,
      },
    }
  },
  parseHTML: () => [
    {
      tag: 'img[src]',
      getAttrs: (dom) => {
        if (typeof dom === 'string') return {}
        const element = dom as HTMLImageElement

        const obj = {
          src: element.getAttribute('src'),
          title: element.getAttribute('title'),
          alt: element.getAttribute('alt'),
        }
        return obj
      },
    },
  ],
  renderHTML: ({ HTMLAttributes }) => ['img', mergeAttributes(HTMLAttributes)],

  addCommands() {
    return {
      setImage:
        (attrs) =>
        ({ state, dispatch }) => {
          const { selection } = state
          const position = selection.$head
            ? selection.$head.pos
            : selection.$to.pos

          const node = this.type.create(attrs)
          const transaction = state.tr.insert(position, node)
          return dispatch?.(transaction)
        },
    }
  },
  addInputRules() {
    return [
      nodeInputRule({
        find: IMAGE_INPUT_REGEX,
        type: this.type,
        getAttributes: (match) => {
          const [, alt, src, title] = match
          return {
            src,
            alt,
            title,
          }
        },
      }),
    ]
  },
  addProseMirrorPlugins() {
    return [uploadImagePlugin()]
  },
})
