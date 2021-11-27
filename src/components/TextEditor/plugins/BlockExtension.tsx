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
  InputRule,
  keyBinding,
  KeyBindingProps,
  NodeExtension,
  NodeExtensionSpec,
  NodeSpecOverride,
  NodeType,
  toggleWrap,
} from '@remirror/core'
import { MessageDescriptor } from '@lingui/core'
import { wrappingInputRule } from '@remirror/pm/inputrules'
import type { PasteRule } from '@remirror/pm/paste-rules'
import { css } from '@emotion/css'

interface SlabAttributes {
  'data-slab'?: true
  layout?: any
}

const ExtensionSlabMessages: {
  LABEL: MessageDescriptor
  DESCRIPTION: MessageDescriptor
} = {
  LABEL: {
    id: 'remirror.extension.slab.label',
    comment: 'Label for slab formatting command',
    message: 'Slab',
  },
  DESCRIPTION: {
    id: 'remirror.extension.slab.description',
    comment: 'Description for slab formatting command',
    message: 'Insert slab at the cursor position',
  },
}

const style = css`
  padding: 1em;
  border-radius: 0.5em;
  background-color: #e5e5e5;

  &:hover,
  &:active,
  &:focus,
  &:focus-within {
    background-color: #e5e5e5;
  }
`

/**
 * Add a slab to the editor.
 */
export class BlockExtension extends NodeExtension<SlabAttributes> {
  get name() {
    return 'slab' as const // Using slab since `block` is reserved for internal uses.
  }

  createTags() {
    return [ExtensionTag.Block, ExtensionTag.FormattingNode]
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
          tag: 'div[data-slab]',
          getAttrs: (dom) => {
            const attrs = {
              ...extra.parse(dom),
              'data-slab': 'true',
              class: style,
            }
            return attrs
          },
          priority: ExtensionPriority.High,
        },
        ...(override.parseDOM ?? []),
      ],
      toDOM: (node) => {
        const attrs: DOMCompatibleAttributes = {
          ...extra.dom(node),
          'data-slab': 'true',
          'data-layout': node.attrs.layout,
          class: style,
        }

        return ['div', attrs, 0]
      },
    }
  }

  @command({
    icon: 'mindMap',
    description: ({ t }) => t(ExtensionSlabMessages.DESCRIPTION),
    label: ({ t }) => t(ExtensionSlabMessages.LABEL),
  })
  toggleSlab(): CommandFunction {
    return toggleWrap(this.type)
  }

  @command()
  updateBlock(pos: number, attrs: SlabAttributes): CommandFunction {
    return updateNodeAttributes(this.type)(attrs)
  }

  @keyBinding({ shortcut: 'Ctrl-B', command: 'toggleSlab' })
  shortcut(props: KeyBindingProps): boolean {
    return this.toggleSlab()(props)
  }

  createInputRules(): InputRule[] {
    return [wrappingInputRule(/^\s*>>\s$/, this.type)]
  }

  createPasteRules(): PasteRule {
    return {
      type: 'node',
      nodeType: this.type,
      regexp: /^\s*>>\s$/,
      startOfTextBlock: true,
    }
  }
}

export function updateNodeAttributes(type: NodeType) {
  return (attributes: SlabAttributes): CommandFunction =>
    ({ state: { tr, selection }, dispatch }) => {
      const parent = findParentNodeOfType({ types: type, selection })

      if (!parent) {
        throw new Error('No parent node found')
      }
      tr.setNodeMarkup(parent.pos, type, {
        ...parent.node.attrs,
        ...attributes,
      })

      if (dispatch) {
        dispatch(tr)
      }

      return true
    }
}

declare global {
  namespace Remirror {
    interface AllExtensions {
      block: BlockExtension
    }
  }
}
