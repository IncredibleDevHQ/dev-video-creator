import { EditorState, ProsemirrorNode, RemirrorJSON } from '@remirror/core'
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

export interface CommentExplanations {
  explanation: string | undefined
  from: number | undefined
  to: number | undefined
  // code: ColorCode[] | undefined
}
export interface CodeBlock {
  code?: string
  language?: string
  title?: string
  note?: string
  description?: string
  layout?: Layout
  isAutomated?: boolean
  explanations?: CommentExplanations[]
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

const getSimpleAST = (state: RemirrorJSON): SimpleAST => {
  const slabs = state.content?.filter((node) => node.type === 'slab')

  const blocks: Block[] = []

  // eslint-disable-next-line consistent-return
  slabs?.forEach((slab) => {
    const slabItems = slab.content?.map((node) => node.type)

    if (slabItems?.includes('codeBlock')) {
      console.log('Code Block!')
      let codeBlock: CodeBlock = {}

      const code = slab.content?.find((node) => node.type === 'codeBlock')
      const codeValue = code?.content?.[0].text
      const note = slab.content?.find(
        (node) => node.type === 'callout' && node.attrs?.type === 'info'
      )?.content?.[0].content?.[0].text
      const description = slab.content?.find(
        (node) => node.type === 'callout' && node.attrs?.type === 'success'
      )?.content?.[0].content?.[0].text
      const title = slab.content?.find((node) => node.type === 'heading')
        ?.content?.[0].text

      codeBlock = { code: codeValue, note, description, title }

      blocks.push({
        type: 'codeBlock',
        codeBlock,
        id: slab.attrs?.id as string,
        pos: 0,
      })
    } else if (slabItems?.includes('video')) {
      blocks.push({
        type: 'videoBlock',
        id: slab.attrs?.id as string,
        pos: 0,
        videoBlock: { key: '123' },
      })
    }
  })

  return { blocks }
}

const useUtils = () => ({
  getSimpleAST,
})

export { useUtils }
