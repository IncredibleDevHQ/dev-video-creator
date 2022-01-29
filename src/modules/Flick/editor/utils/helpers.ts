/* eslint-disable no-restricted-syntax */
/* eslint-disable @typescript-eslint/dot-notation */
/* eslint-disable no-param-reassign */
/* eslint-disable class-methods-use-this */
import { FlickFragment } from '../../../../generated/graphql'
import { SimpleAST } from './utils'

export function getCursorCoordinates(
  elem: HTMLDivElement,
  x: number,
  y: number
) {
  const { left, top } = elem.getBoundingClientRect()

  return { x: x - left, y: y - top }
}

export const mergeRefs = (...refs: any) => {
  const filteredRefs = refs.filter(Boolean)
  if (!filteredRefs.length) return null
  if (filteredRefs.length === 0) return filteredRefs[0]
  return (inst: any) => {
    for (const ref of filteredRefs) {
      if (typeof ref === 'function') {
        ref(inst)
      } else if (ref) {
        ref.current = inst
      }
    }
  }
}

export class TextEditorParser {
  ast?: SimpleAST

  constructor(ast?: SimpleAST) {
    this.ast = ast
  }

  private getCommonMd(title?: string, description?: string) {
    if (title) {
      title = `### ${title}`
    }
    return (
      [title, description || ''].filter((item) => !!item).join('\n\n ') || ''
    )
  }

  getMarkdown() {
    return this.parseMarkdown(this.ast)
  }

  /**
   * Check the validity of the AST
   *
   * @param ast Optional AST to use instead of the one stored in this class.
   * @returns A boolean indicating if the AST is valid.
   */
  isValid(ast?: SimpleAST) {
    const blocks = ast?.blocks || this.ast?.blocks
    if (!blocks || blocks.length === 0) return false

    return blocks.every((block) => typeof block.type !== 'undefined')
  }

  private parseMarkdown(ast?: SimpleAST) {
    if (!ast) return undefined
    const blocks = ast?.blocks?.filter(
      (block) => typeof block.type !== 'undefined'
    )

    return blocks
      ?.map((block) => {
        let md = ''

        md += this.getCommonMd(
          // @ts-ignore
          block[block['type']].title,
          // @ts-ignore
          block[block['type']].description
        )

        switch (block.type) {
          case 'codeBlock':
            md += `\n\n\`\`\`${block.codeBlock.language || ''}\n${
              block.codeBlock.code || ''
            }\n\`\`\``
            break
          case 'imageBlock':
            md += `\n\n![${block.imageBlock.title || ''}](${
              block.imageBlock.url || ''
            })`
            break
          case 'listBlock':
            md += `\n\n${block.listBlock?.list
              ?.map((item) => `- ${item.text || ''}`)
              .join('\n')}`
            break
          case 'videoBlock':
            md += `\n\n![${block.videoBlock.title || ''}](${
              block.videoBlock.url || ''
            })`
            break
          default:
            break
        }

        return md
      })
      .join('\n\n')
  }

  getFlickMarkdown(flick: FlickFragment) {
    let md = `# ${flick.name || ''}\n\n ${
      flick.description || ''
    }\n\n Created on Incredible \n\n ---\n\n`
    md += flick.fragments
      .map((fragment) => {
        return `--- \n\n ## ${fragment.name || ''} \n\n ${
          fragment.description || ''
        } \n\n ${this.parseMarkdown(fragment.editorState) || ''} \n\n ---`
      })
      .join('\n\n')

    md += '\n\n---\n\n'

    return md
  }
}
