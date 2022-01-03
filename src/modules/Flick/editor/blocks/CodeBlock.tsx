/* eslint-disable import/no-extraneous-dependencies */
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

export default CodeBlockLowlight.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockComponent)
  },
}).configure({ lowlight, defaultLanguage: 'typescript' })

const CodeBlockComponent = ({
  node: {
    attrs: { language: defaultLanguage },
  },
  updateAttributes,
}: any) => (
  <NodeViewWrapper className="relative flex flex-col">
    <select
      className="absolute top-0 right-0 px-1 py-1 mt-8 mr-2 text-sm text-gray-400 transition-all duration-200 bg-transparent rounded-sm cursor-pointer hover:text-gray-600 hover:bg-gray-300 focus:outline-none"
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
    <pre>
      <NodeViewContent as="code" />
    </pre>
    <span className="ml-auto -mt-4 text-xs text-gray-400">
      Shift + Enter to exit code
    </span>
  </NodeViewWrapper>
)
