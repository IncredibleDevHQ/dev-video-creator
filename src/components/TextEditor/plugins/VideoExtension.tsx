/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable class-methods-use-this */
import {
  ApplySchemaAttributes,
  command,
  CommandFunction,
  DOMCompatibleAttributes,
  ExtensionPriority,
  ExtensionTag,
  findParentNodeOfType,
  GetAttributes,
  getMatchString,
  InputRule,
  isElementDomNode,
  keyBinding,
  KeyBindingProps,
  NodeExtension,
  NodeExtensionSpec,
  nodeInputRule,
  NodeSpecOverride,
  NodeType,
  toggleWrap,
} from '@remirror/core'
import { MessageDescriptor } from '@lingui/core'
import { wrappingInputRule } from '@remirror/pm/inputrules'
import type { PasteRule } from '@remirror/pm/paste-rules'
import { css } from '@emotion/css'
import React from 'react'

interface VideoAttributes {
  src?: string
  controls?: boolean
}

const ExtensionVideoMessages: {
  LABEL: MessageDescriptor
  DESCRIPTION: MessageDescriptor
} = {
  LABEL: {
    id: 'remirror.extension.video.label',
    comment: 'Label for video formatting command',
    message: 'Video',
  },
  DESCRIPTION: {
    id: 'remirror.extension.video.description',
    comment: 'Description for video formatting command',
    message: 'Insert video at the cursor position',
  },
}

/**
 * Add a slab to the editor.
 */
export class VideoExtension extends NodeExtension<VideoAttributes> {
  get name() {
    return 'video' as const // Using slab since `block` is reserved for internal uses.
  }

  createTags() {
    return [ExtensionTag.Block]
  }

  ReactComponent = (props: any) => {
    console.log({ props })
    return <div>asd</div>
  }

  createNodeSpec(
    extra: ApplySchemaAttributes,
    override: NodeSpecOverride
  ): NodeExtensionSpec {
    return {
      content: 'block+',
      defining: true,
      draggable: false,
      ...override,
      attrs: extra.defaults(),
      parseDOM: [
        {
          tag: 'video',
          getAttrs: (dom) => {
            if (!isElementDomNode(dom)) {
              return false
            }

            const source = dom.querySelector('source')
            return {
              ...extra.parse(dom),
              src: source?.getAttribute('src'),
              poster: dom.getAttribute('poster'),
            }
          },
          priority: ExtensionPriority.High,
        },
        ...(override.parseDOM ?? []),
      ],
      toDOM(node) {
        const { src, poster } = node.attrs
        console.log(src, poster)
        return [
          'video',
          {
            ...extra.dom(node),
            controls: 'true',
            draggable: 'false',
            poster,
            src,
          },
          0,
        ]
      },
    }
  }

  @command({
    icon: 'mindMap',
    description: ({ t }) => t(ExtensionVideoMessages.DESCRIPTION),
    label: ({ t }) => t(ExtensionVideoMessages.LABEL),
  })
  toggleVideo(): CommandFunction {
    return toggleWrap(this.type)
  }

  // @command()
  // updateVideo(pos: number, attrs: VideoAttributes): CommandFunction {
  //   return updateNodeAttributes(this.type)(attrs)
  // }

  @keyBinding({ shortcut: 'Ctrl-V', command: 'toggleVideo' })
  shortcut(props: KeyBindingProps): boolean {
    console.log('shortcut')
    return this.toggleVideo()(props)
  }

  createInputRules(): InputRule[] {
    const regexp =
      // eslint-disable-next-line no-useless-escape
      /^!\[(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,})\]!$/

    const getAttributes: GetAttributes = (match) => {
      const attrs = { src: getMatchString(match, 1) }

      console.log(attrs)
      return attrs
    }

    return [
      nodeInputRule({
        regexp,
        type: this.type,
        getAttributes,
      }),
    ]
  }

  createPasteRules(): PasteRule {
    return {
      type: 'node',
      nodeType: this.type,
      regexp: /^\s*>>>\s$/,
      startOfTextBlock: true,
    }
  }
}

declare global {
  namespace Remirror {
    interface AllExtensions {
      video: VideoExtension
    }
  }
}
