import { mergeAttributes, Node } from '@tiptap/core'
import {
  NodeViewContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
} from '@tiptap/react'
import React from 'react'

const Slab = () => {
  return (
    <NodeViewWrapper className="py-4 border-b">
      <NodeViewContent />
    </NodeViewWrapper>
  )
}

export default Node.create({
  name: 'slab',

  group: 'block',

  content: 'block+',

  // atom: true,

  addAttributes() {
    return {
      type: null,
    }
  },

  parseHTML() {
    return [
      {
        tag: 'slab',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['slab', mergeAttributes(HTMLAttributes), 0]
  },

  addNodeView() {
    return ReactNodeViewRenderer(Slab)
  },
})
