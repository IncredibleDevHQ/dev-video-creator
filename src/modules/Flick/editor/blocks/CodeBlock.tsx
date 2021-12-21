import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import {
  NodeViewContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
} from '@tiptap/react'
import * as lowlight from 'lowlight'
import React from 'react'

export default CodeBlockLowlight.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockComponent)
  },
}).configure({ lowlight: lowlight.lowlight })

const CodeBlockComponent = ({
  node: {
    attrs: { language: defaultLanguage },
  },
  updateAttributes,
  extension,
}: any) => (
  <NodeViewWrapper className="relative flex flex-col">
    <select
      className="absolute top-0 right-0 px-1 py-1 mt-4 mr-3 text-sm text-gray-600 bg-gray-200 rounded-sm focus:outline-none"
      contentEditable={false}
      defaultValue={defaultLanguage}
      onChange={(event) => updateAttributes({ language: event.target.value })}
    >
      <option value="null">auto</option>
      <option disabled>—</option>
      {extension.options.lowlight.listLanguages().map((lang: string) => (
        <option key={lang} value={lang}>
          {lang}
        </option>
      ))}
    </select>
    <pre>
      <NodeViewContent as="code" />
    </pre>
    <span className="ml-auto -mt-1 text-xs text-gray-400">
      Shift + Enter to exit code
    </span>
  </NodeViewWrapper>
)
