import {
  NodeViewContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
} from '@tiptap/react'
import React from 'react'
import { mergeAttributes, Node } from '@tiptap/core'
import { Text } from '../../../../components'

const NoteBlock = () => {
  return (
    <NodeViewWrapper className="p-2 mt-2 bg-gray-100 rounded-md">
      <Text
        contentEditable={false}
        className="px-1 py-px mb-1 text-xs text-white bg-gray-800 rounded-sm w-min font-body"
      >
        Note
      </Text>
      <NodeViewContent />
    </NodeViewWrapper>
  )
}

export default Node.create({
  name: 'note',

  group: 'block',

  content: 'paragraph+',

  parseHTML() {
    return [
      {
        tag: 'note',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['note', mergeAttributes(HTMLAttributes), 0]
  },

  addNodeView() {
    return ReactNodeViewRenderer(NoteBlock)
  },
})
