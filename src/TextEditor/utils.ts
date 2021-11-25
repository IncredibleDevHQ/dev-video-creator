import { EditorState, ProsemirrorNode } from '@remirror/core'
import { Schema } from '@remirror/pm/model'

export type Layout =
  | 'top-right-circle'
  | 'top-left-circle'
  | 'bottom-left-circle'
  | 'bottom-right-circle'
  | 'top-right-square'
  | 'top-left-square'
  | 'bottom-left-square'
  | 'bottom-right-square'
  | 'right-bar'
  | 'left-bar'
  | 'right-bar-floating'
  | 'left-bar-floating'

export interface CodeBlock {
  code?: string
  language?: string
  title?: string
  note?: string
  description?: string
  layout?: Layout
}

// TODO: Improve VideoBlock interface...
export interface VideoBlock {
  key?: string
}

export interface CommonBlockProps {
  id: string
  pos: number
}

export interface CodeBlockProps extends CommonBlockProps {
  type: 'codeBlock'
  codeBlock: CodeBlock
}

export interface VideoBlockProps extends CommonBlockProps {
  type: 'videoBlock'
  videoBlock: VideoBlock
}

export type Block = CodeBlockProps | VideoBlockProps

export interface SimpleAST {
  blocks: Block[]
}

// TODO: Refactor this...

const getSimpleAST = (state: EditorState<Schema>): SimpleAST => {
  const nodes = state.doc.content

  const filteredNodes: {
    pos: number
    node: ProsemirrorNode<Schema<any, any>>
  }[] = []

  nodes.descendants((node, pos) => {
    if (node.type.name === 'slab') {
      filteredNodes.push({ node, pos })
    }
  })

  const blocks: Block[] = []

  filteredNodes.forEach(({ node, pos }) => {
    const descendants: string[] = []

    node.content.descendants((descendant) => {
      descendants.push(descendant.type.name)
    })

    if (descendants.includes('codeBlock')) {
      const codeBlock: CodeBlock = {}

      node.content.forEach((descendant) => {
        if (descendant.type.name === 'codeBlock') {
          codeBlock.code = descendant.textContent
          codeBlock.language = descendant.attrs.language
        }

        if (descendant.type.name === 'heading') {
          codeBlock.title = descendant.textContent
        }

        if (descendant.type.name === 'callout') {
          if (descendant.attrs.type === 'success') {
            codeBlock.description = descendant.textContent
          } else if (descendant.attrs.type === 'info') {
            codeBlock.note = descendant.textContent
          }
        }
      })

      blocks.push({
        type: 'codeBlock',
        id: node.attrs.id,
        pos,
        codeBlock: {
          ...codeBlock,
          layout: node.attrs.layout,
        },
      })
    } else if (descendants.includes('videoBlock')) {
      blocks.push({
        type: 'videoBlock',
        id: node.attrs.id,
        pos,
        videoBlock: {
          key: node.attrs.key,
        },
      })
    }
  })
  return { blocks }
}

const useUtils = () => ({
  getSimpleAST,
})

export { useUtils }
