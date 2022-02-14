/* eslint-disable import/no-extraneous-dependencies */
import { Editor } from '@tiptap/core'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import {
  NodeViewContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
} from '@tiptap/react'
import lowlight from 'lowlight'
import { listLanguages } from 'lowlight/lib/core'
import React from 'react'
import allowedLanguages from '../../../../utils/allowedLanguages'

export const checkCurrentNode = (editor: Editor, nodeName: string) => {
  return (
    editor.state.doc.childBefore(editor.state.selection.from).node?.type
      .name === nodeName
  )
}

export default CodeBlockLowlight.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockComponent)
  },

  addKeyboardShortcuts() {
    return {
      Tab: () => {
        if (checkCurrentNode(this.editor, this.name)) {
          return this.editor.commands.insertContent('  ')
        }
        return false
      },
    }
  },
}).configure({ lowlight, defaultLanguage: 'typescript' })

const CodeBlockComponent = ({
  node: {
    attrs: { language: defaultLanguage, id },
  },
  updateAttributes,
}: any) => (
  <NodeViewWrapper id={id} className="relative flex flex-col my-6">
    <select
      className="border-none absolute top-0 right-0 px-1 py-1 mt-2 mr-2 text-sm text-gray-400 transition-all duration-200 bg-transparent rounded-sm cursor-pointer hover:text-gray-600 hover:bg-gray-300 focus:outline-none"
      contentEditable={false}
      defaultValue={
        Object.keys(allowedLanguages).find(
          (key) => (allowedLanguages as any)[key] === `.${defaultLanguage}`
        ) || defaultLanguage
      }
      onChange={(event) => updateAttributes({ language: event.target.value })}
    >
      <option value="null">auto</option>
      <option disabled>—</option>
      {listLanguages().map((lang: string) => (
        <option key={lang} value={lang}>
          {lang}
        </option>
      ))}
    </select>
    <pre spellCheck={false}>
      <NodeViewContent as="code" />
    </pre>
    <span className="ml-auto mt-1 text-xs text-gray-400">
      Shift + Enter to exit code
    </span>
  </NodeViewWrapper>
)
