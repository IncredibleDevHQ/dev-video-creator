import { css, cx } from '@emotion/css'
import { mergeAttributes, Node } from '@tiptap/core'
import {
  NodeViewContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
} from '@tiptap/react'
import React from 'react'
import { Text } from '../../../../components'

const NoteBlock = () => {
  return (
    <NodeViewWrapper className="p-2 mt-2 bg-gray-100 rounded-md">
      <Text
        contentEditable={false}
        className={cx(
          'px-1 py-px mb-1 text-xs bg-gray-800 rounded-sm w-min font-body',
          css`
            color: #fff !important;
            font-size: 0.75rem !important;
            line-height: 1rem !important;
          `
        )}
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
