/* eslint-disable jsx-a11y/media-has-caption */
import { mergeAttributes, Node } from '@tiptap/core'
import {
  NodeViewContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
} from '@tiptap/react'
import React from 'react'

const VideoBlock = (props: any) => {
  return (
    <NodeViewWrapper>
      <div className="w-full py-3">
        {props.node.attrs.src && (
          <video
            controls
            src={props.node.attrs.src as string}
            className="w-full rounded-sm"
          />
        )}
        <div className="hidden">
          <NodeViewContent />
        </div>
      </div>
    </NodeViewWrapper>
  )
}

export default Node.create({
  name: 'video',

  group: 'block',

  content: 'block',

  // atom: true,

  parseHTML() {
    return [
      {
        tag: 'video',
      },
    ]
  },

  addAttributes() {
    return {
      src: {
        default: null,
      },
      'data-transformations': {
        default: null,
      },
    }
  },

  renderHTML({ HTMLAttributes }) {
    return ['video', mergeAttributes(HTMLAttributes), 0]
  },

  addNodeView() {
    return ReactNodeViewRenderer(VideoBlock)
  },
})
