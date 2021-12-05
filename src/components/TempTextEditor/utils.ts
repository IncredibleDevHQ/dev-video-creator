/* eslint-disable @typescript-eslint/dot-notation */
/* eslint-disable no-param-reassign */
/* eslint-disable class-methods-use-this */
import { SimpleAST } from './types'

export function getCursorCoordinates(
  elem: HTMLDivElement,
  x: number,
  y: number
) {
  const { left, top } = elem.getBoundingClientRect()

  return { x: x - left, y: y - top }
}

export class TextEditorParser {
  ast: SimpleAST

  constructor(ast: SimpleAST) {
    this.ast = ast
  }

  private getCommonMd(title?: string, description?: string) {
    if (title) {
      title = `### ${title}`
    }
    return [title, description]
      .filter((item) => typeof item !== 'undefined')
      .join('\n\n ')
  }

  getMarkdown() {
    const blocks = this.ast.blocks.filter(
      (block) => typeof block.type !== 'undefined'
    )

    return blocks
      .map((block) => {
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
              block.codeBlock.code
            }\n\`\`\``
            break
          case 'imageBlock':
            md += `\n\n![${block.imageBlock.title}](${block.imageBlock.url})`
            break
          case 'listBlock':
            md += `\n\n${block.listBlock?.list
              ?.map((item) => `- ${item.text}`)
              .join('\n')}`
            break
          case 'videoBlock':
            md += `\n\n![${block.videoBlock.title}](${block.videoBlock.url})`
            break
          default:
            break
        }

        return md
      })
      .join('\n\n')
  }
}
