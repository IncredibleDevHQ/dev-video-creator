import { css, cx } from '@emotion/css'
import { Node, nodeInputRule } from '@tiptap/core'
import {
  mergeAttributes,
  NodeViewWrapper,
  ReactNodeViewRenderer,
} from '@tiptap/react'
import React, { useState } from 'react'
import { buildStyles, CircularProgressbar } from 'react-circular-progressbar'
import Dropzone from 'react-dropzone'
import { FiUploadCloud } from 'react-icons/fi'
import { emitToast, Text } from '../../../../components'
import config from '../../../../config'
import { useUploadFile } from '../../../../hooks'
import { AllowedFileExtensions } from '../../../../hooks/use-upload-file'
import { uploadImagePlugin } from '../utils/upload_image'

interface ImageOptions {
  inline: boolean
  HTMLAttributes: Record<string, any>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    image: {
      /**
       * Add an image
       */
      setImage: (options: {
        src: string
        alt?: string
        title?: string
      }) => ReturnType
    }
  }
}

const IMAGE_INPUT_REGEX = /!\[(.+|:?)\]\((\S+)(?:(?:\s+)["'](\S+)["'])?\)/

export default Node.create<ImageOptions>({
  name: 'image',

  addOptions() {
    return {
      ...this.parent?.(),
      inline: false,
      HTMLAttributes: {},
    }
  },

  inline() {
    return this.options.inline
  },

  group() {
    return this.options.inline ? 'inline' : 'block'
  },

  addAttributes() {
    return {
      src: {
        default: null,
      },
      localSrc: {
        default: null,
      },
      alt: {
        default: null,
      },
      title: {
        default: null,
      },
    }
  },
  parseHTML: () => [
    {
      tag: 'img[src]',
      getAttrs: (dom) => {
        if (typeof dom === 'string') return {}
        const element = dom as HTMLImageElement

        const obj = {
          src: element.getAttribute('src'),
          title: element.getAttribute('title'),
          alt: element.getAttribute('alt'),
        }
        return obj
      },
    },
  ],
  renderHTML: ({ HTMLAttributes }) => ['img', mergeAttributes(HTMLAttributes)],

  addNodeView() {
    return ReactNodeViewRenderer(Image)
  },

  addCommands() {
    return {
      setImage:
        (attrs) =>
        ({ state, dispatch }) => {
          const { selection } = state
          const position = selection.$head
            ? selection.$head.pos
            : selection.$to.pos

          const node = this.type.create(attrs)
          const transaction = state.tr.insert(position - 1, node)
          return dispatch?.(transaction)
        },
    }
  },
  addInputRules() {
    return [
      nodeInputRule({
        find: IMAGE_INPUT_REGEX,
        type: this.type,
        getAttributes: (match) => {
          const [, alt, src, title] = match
          return {
            src,
            alt,
            title,
          }
        },
      }),
    ]
  },
  addProseMirrorPlugins() {
    return [uploadImagePlugin()]
  },
})

const Image = (props: any) => {
  const { src, alt, title, localSrc } = props.node.attrs
  const [upload] = useUploadFile()
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)

  const uploadMedia = async (files: File[]) => {
    try {
      setLoading(true)
      const file = files?.[0]
      if (!file) throw new Error('No file selected')
      setMedia(file)
      const { uuid } = await upload({
        file,
        extension: file.name.split('.').pop() as AllowedFileExtensions,
        handleProgress: ({ percentage }) => {
          setProgress(percentage)
        },
      })
      props.updateAttributes({
        src: `${config.storage.baseUrl}${uuid}`,
      })
      setLoading(false)
      setProgress(0)
    } catch (error: any) {
      setLoading(false)
      setProgress(0)
      emitToast({
        type: 'error',
        title: 'Failed to upload thumbnail',
        description: error.message,
        autoClose: 500,
      })
    }
  }

  const setMedia = (file: File) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = (readerEvent) => {
      props.updateAttributes({
        localSrc: readerEvent.target?.result as string,
      })
    }
  }

  return (
    <NodeViewWrapper as="div" id={props.node.attrs.id}>
      {src && (
        <img
          className="cursor-pointer"
          src={localSrc || src}
          alt={alt}
          title={title}
        />
      )}

      {loading && (
        <div className="relative">
          {localSrc && <img src={localSrc} alt="img" />}
          <div className="absolute bottom-4 right-4 flex items-center justify-between px-1.5 rounded-sm gap-x-2 bg-black bg-opacity-60 w-20">
            <div className="w-4 h-4">
              <CircularProgressbar
                styles={buildStyles({
                  rotation: 0.25,
                  strokeLinecap: 'round',
                  textSize: '12px',
                  pathColor: `rgba(22, 163, 74, ${progress / 100})`,
                  textColor: '#f88',
                  trailColor: '#fafafa',
                })}
                value={progress}
              />
            </div>
            <Text
              className={cx(
                css`
                  color: #fefefe !important;
                  font-size: 0.875rem !important;
                  line-height: 1.25rem !important;
                  margin: 3px !important;
                `
              )}
              contentEditable={false}
            >
              {progress}%
            </Text>
          </div>
        </div>
      )}

      {!src && !loading && (
        <Dropzone onDrop={uploadMedia} accept="image/*" maxFiles={1}>
          {({ getRootProps, getInputProps }) => (
            <div
              tabIndex={-1}
              onKeyUp={() => {}}
              role="button"
              className="flex flex-col items-center p-12 my-3 border border-gray-200 border-dashed rounded-md cursor-pointer"
              {...getRootProps()}
            >
              <input {...getInputProps()} />
              <FiUploadCloud size={24} className="my-2" />

              <div className="z-50 text-center text-black">
                <Text contentEditable={false} fontSize="small">
                  Drag and drop image or
                </Text>
                <Text
                  contentEditable={false}
                  fontSize="small"
                  className="font-semibold"
                >
                  browse
                </Text>
              </div>
            </div>
          )}
        </Dropzone>
      )}
    </NodeViewWrapper>
  )
}
