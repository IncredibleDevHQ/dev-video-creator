import { JSONContent } from '@tiptap/core'
import { Transformations } from '../../components/VideoEditor'

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

export interface ListBlock {
  list?: ListItem[]
  title?: string
  note?: string
  description?: string
}

// TODO: Improve VideoBlock interface...
export interface VideoBlock {
  url?: string
  title?: string
  note?: string
  description?: string
  transformations?: Transformations
}

export interface ImageBlock {
  url?: string
  title?: string
  note?: string
  description?: string
}

export interface ListItem {
  content?: string
  items?: ListItem[]
  level?: number
  text?: string
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

export interface ListBlockProps extends CommonBlockProps {
  type: 'listBlock'
  listBlock: ListBlock
}

export interface ImageBlockProps extends CommonBlockProps {
  type: 'imageBlock'
  imageBlock: ImageBlock
}

export type Block =
  | CodeBlockProps
  | VideoBlockProps
  | ListBlockProps
  | ImageBlockProps

export interface SimpleAST {
  blocks: Block[]
}

export type Position = {
  x: number
  y: number
}

const textContent = (contentArray?: JSONContent[]) => {
  if (!contentArray) {
    return undefined
  }
  return contentArray
    .map((node) => {
      if (node.type === 'text') {
        return node.text
      }
      return ''
    })
    .join('')
}

const getSimpleAST = (state: JSONContent): SimpleAST => {
  const slabs = state?.content?.filter((node) => node.type === 'slab')

  const blocks: Block[] = []

  const getCommonProps = (slab: JSONContent) => {
    const noteNode = slab.content?.find((node) => node.type === 'note')
      ?.content?.[0].content
    const note = textContent(noteNode)

    const descriptionNode = slab.content?.find(
      (node) => node.type === 'paragraph'
    )?.content
    const description = textContent(descriptionNode)

    const titleNode = slab.content?.find(
      (node) => node.type === 'heading'
    )?.content
    const title = textContent(titleNode)

    return { note, description, title }
  }

  slabs?.forEach((slab) => {
    if (slab.attrs?.type === 'code') {
      let codeBlock: CodeBlock = {}

      const code = slab.content?.find((node) => node.type === 'codeBlock')
      const codeValue = textContent(code?.content)

      const { description, note, title } = getCommonProps(slab)

      codeBlock = {
        code: codeValue,
        language: code?.attrs?.language as string,
        note,
        description,
        title,
      }

      blocks.push({
        type: 'codeBlock',
        codeBlock,
        id: slab.attrs?.id as string,
        pos: 0,
      })
    } else if (slab.attrs?.type === 'video') {
      const { description, note, title } = getCommonProps(slab)

      const video = slab.content?.find((node) => node.type === 'video')

      blocks.push({
        type: 'videoBlock',
        id: slab.attrs?.id as string,
        pos: 0,
        videoBlock: {
          url: video?.attrs?.src as string,
          description,
          title,
          note,
          transformations: undefined,
          // iframe?.attrs?.['data-transformations'] as
          //   | Transformations
          //   | undefined,
        },
      })
    } else if (slab.attrs?.type === 'image') {
      const image = slab.content?.find((node) => node.type === 'image')

      const url = image?.attrs?.src

      const { description, note, title } = getCommonProps(slab)
      blocks.push({
        type: 'imageBlock',
        id: slab.attrs?.id as string,
        pos: 0,
        imageBlock: {
          url: url as string,
          description,
          title,
          note,
        },
      })
    } else if (slab.attrs?.type === 'list') {
      const { description, note, title } = getCommonProps(slab)

      const listItems = slab.content
        ?.find((node) => node.type === 'bulletList')
        ?.content?.filter((child) => child.type === 'listItem')

      const simplifyListItem = (listItem: JSONContent): ListItem => {
        const item: ListItem = {}

        listItem.content?.forEach((node) => {
          if (node.type === 'paragraph') {
            item.content = textContent(node.content)
            item.text = textContent(node.content)
          }
        })

        return item
      }

      const simpleListItems = listItems?.map((listItem) => {
        return simplifyListItem(listItem)
      })

      blocks.push({
        type: 'listBlock',
        id: slab.attrs?.id as string,
        pos: 0,
        listBlock: {
          description,
          title,
          note,
          list: simpleListItems,
        },
      })
    }
  })

  return { blocks }
}

const getEditorState = (ast: SimpleAST): string => {
  let state = ''

  ast.blocks.forEach((block) => {
    switch (block.type) {
      case 'codeBlock': {
        state = state.concat(`
          <slab type="code" data-id="${block.id}">
            <h2>${block.codeBlock.title}</h2>
            <p>${block.codeBlock.description}</p>
            <pre><code class="language-${block.codeBlock.language}">${block.codeBlock.code}</code></pre>
            <note><p>${block.codeBlock.note}</p></note>
          </slab>
        `)
        break
      }
      case 'videoBlock': {
        state = state.concat(`
          <slab type="video" data-id="${block.id}">
            <h2>${block.videoBlock.title}</h2>
            <p>${block.videoBlock.description}</p>
            <video src="${block.videoBlock.url}"></video>
            <note><p>${block.videoBlock.note}</p></note>
          </slab>
        `)
        break
      }
      case 'listBlock': {
        state = state.concat(`
          <slab type="list" data-id="${block.id}">
            <h2>${block.listBlock.title}</h2>
            <p>${block.listBlock.description}</p>
            <ul>
            ${block.listBlock.list
              ?.map((item) => `<li>${item.content}</li>`)
              .join('')}
            </ul>
            <note><p>${block.listBlock.note}</p></note>
          </slab>
        `)
        break
      }
      case 'imageBlock': {
        state = state.concat(`
          <slab type="image" data-id="${block.id}">
            <h2>${block.imageBlock.title}</h2>
            <p>${block.imageBlock.description}</p>
            <img src="${block.imageBlock.url}"/>
            <note><p>${block.imageBlock.note}</p></note>
          </slab>
        `)
        break
      }
      default:
        break
    }
  })

  return state
}

const useUtils = () => ({
  getSimpleAST,
  getEditorState,
})

export { useUtils }
