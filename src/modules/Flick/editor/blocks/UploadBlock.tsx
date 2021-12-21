/* eslint-disable jsx-a11y/media-has-caption */
import { Editor, mergeAttributes, Node } from '@tiptap/core'
import {
  NodeViewContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
} from '@tiptap/react'
import React, { useEffect, useState } from 'react'
import { buildStyles, CircularProgressbar } from 'react-circular-progressbar'
import Dropzone from 'react-dropzone'
import { FiUploadCloud } from 'react-icons/fi'
import { emitToast, Text } from '../../../../components'
import config from '../../../../config'
import { useUploadFile } from '../../../../hooks'
import { AllowedFileExtensions } from '../../../../hooks/use-upload-file'
import AddVideo from './AddVideo'
import { Transformations } from './VideoEditor'

const UploadBlock = (props: any) => {
  const [upload] = useUploadFile()
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [path, setPath] = useState<string>()
  const [showAddVideo, setShowAddVideo] = useState(false)

  useEffect(() => {
    if (props.node.attrs.type) {
      setShowAddVideo(true)
    }
  }, [])

  useEffect(() => {
    if (!props.node.attrs.uri) return

    async function fetchImage() {
      const blob = await (await fetch(props.node.attrs.uri)).blob()
      const file = new File([blob], 'pasted-image.png')
      uploadMedia([file])
    }
    if (props.node.attrs.type === 'image') fetchImage()
  }, [])

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
      setPath(`${config.storage.baseUrl}${uuid}`)
      setLoading(false)
    } catch (error: any) {
      setLoading(false)
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
      setPath(readerEvent.target?.result as string)
    }
  }

  useEffect(() => {
    if (loading || !path) return
    if (path.startsWith('data:image')) return
    if (props.node.attrs.type === 'image') insertImage()
  }, [path, loading])

  const insertImage = () => {
    const editor = props.editor as Editor
    props.deleteNode()
    editor
      .chain()
      .insertContent(
        // NOTE: for insertContentAt : editor.state.selection.$anchor.start(),
        `<img src="${path}"/>`
      )
      .run()
  }

  const insertVideo = (
    url: string,
    transformations: Transformations | undefined
  ) => {
    const editor = props.editor as Editor
    console.log(JSON.stringify(transformations))
    props.deleteNode()
    editor
      .chain()
      .insertContentAt(
        editor.state.selection.$anchor.start(),
        transformations
          ? `<video src="${url}" data-transformations='${JSON.stringify(
              transformations
            )}'><p/></video>`
          : `<video src="${url}"><p/></video>`
      )
      .run()
  }

  return (
    <NodeViewWrapper>
      {loading ? (
        <div className="relative inline-block py-3">
          {path && props.node.attrs.type === 'image' && (
            <img className="brightness-50" src={path} alt="img" />
          )}
          {path && props.node.attrs.type === 'video' && (
            <video
              muted
              autoPlay
              loop
              src={path}
              className="rounded-md brightness-50"
            />
          )}
          <div className="absolute bottom-0 right-0 flex items-center justify-center p-1 m-2 bg-white border border-gray-300 rounded-sm shadow-md gap-x-2">
            <div className="w-4 h-4">
              <CircularProgressbar
                styles={buildStyles({
                  rotation: 0.25,
                  strokeLinecap: 'round',
                  textSize: '12px',
                  pathColor: `rgba(22, 163, 74, ${progress / 100})`,
                  textColor: '#f88',
                  trailColor: '#d6d6d6',
                })}
                value={progress}
              />
            </div>
            <Text
              fontSize="small"
              className="text-sm !important"
              contentEditable={false}
            >
              Uploading
            </Text>
          </div>
        </div>
      ) : (
        <Dropzone
          onDrop={props.node.attrs.type === 'image' ? uploadMedia : undefined}
          accept={`${props.node.attrs.type}/*`}
          maxFiles={1}
        >
          {({ getRootProps, getInputProps }) => (
            <div
              tabIndex={-1}
              onKeyUp={() => {}}
              role="button"
              className="flex flex-col items-center p-12 my-3 border border-gray-200 border-dashed rounded-md cursor-pointer"
              {...getRootProps()}
              onClick={() => {
                setShowAddVideo(true)
              }}
            >
              <input {...getInputProps()} />
              <FiUploadCloud size={24} className="my-2" />

              <div className="z-50 text-center text-black">
                <Text contentEditable={false} fontSize="small">
                  Drag and drop {props.node.attrs.type} or
                </Text>
                <Text
                  contentEditable={false}
                  fontSize="small"
                  className="font-semibold"
                >
                  browse
                </Text>
                <div className="hidden">
                  <NodeViewContent />
                </div>
              </div>
            </div>
          )}
        </Dropzone>
      )}
      {showAddVideo && (
        <AddVideo
          open={showAddVideo}
          handleClose={() => setShowAddVideo(false)}
          handleUploadURL={() => {}}
          handleUpdateVideo={(url, transformations) => {
            insertVideo(url, transformations)
          }}
        />
      )}
    </NodeViewWrapper>
  )
}

export default Node.create({
  name: 'upload',

  group: 'block',

  content: 'block',

  parseHTML() {
    return [
      {
        tag: 'upload',
      },
    ]
  },

  addAttributes() {
    return {
      type: {
        default: 'image',
      },
      uri: {
        default: null,
      },
    }
  },

  renderHTML({ HTMLAttributes }) {
    return ['upload', mergeAttributes(HTMLAttributes), 0]
  },

  addNodeView() {
    return ReactNodeViewRenderer(UploadBlock, {})
  },
})
