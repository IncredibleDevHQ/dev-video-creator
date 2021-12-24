/* eslint-disable jsx-a11y/media-has-caption */
import { css, cx } from '@emotion/css'
import { mergeAttributes, Node } from '@tiptap/core'
import {
  NodeViewContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
} from '@tiptap/react'
import Konva from 'konva'
import React, { useEffect, useState } from 'react'
import { FiPause, FiPlay, FiRepeat, FiEdit, FiTrash } from 'react-icons/fi'
import { Group, Layer, Stage } from 'react-konva'
import AddVideo from './AddVideo'
import Tooltip from '../../../../components/Tooltip'
import { Video, VideoConfig } from '../../../Studio/components/Video'

const size = {
  width: 960,
  height: 540,
}

const translateXY = css`
  transform: translate(-50%, -50%);
`

const VideoTooltip = ({
  editVideo,
  retakeVideo,
  deleteVideo,
}: {
  deleteVideo: () => void
  editVideo: (val: boolean) => void
  retakeVideo: (val: boolean) => void
}) => {
  return (
    <div className="bg-gray-800 flex items-center p-2 text-gray-200 rounded-md">
      <FiEdit
        size={20}
        className="mx-1 cursor-pointer hover:text-gray-50"
        onClick={() => editVideo(true)}
      />
      <FiRepeat
        size={20}
        className="mx-1 cursor-pointer hover:text-gray-50"
        onClick={() => retakeVideo(true)}
      />
      <FiTrash
        size={20}
        className="mx-1 cursor-pointer hover:text-gray-50"
        onClick={deleteVideo}
      />
    </div>
  )
}

const VideoBlock = (props: any) => {
  const stageRef = React.useRef<Konva.Stage | null>(null)
  const videoRef = React.useRef<HTMLVideoElement | null>(null)

  const [isOpen, setOpen] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [editVideo, setEditVideo] = useState(false)
  const [retakeVideo, setRetakeVideo] = useState(false)
  const [videoConfig, setVideoConfig] = useState<VideoConfig>()

  const deleteVideo = () => {
    props.deleteNode()
  }

  useEffect(() => {
    const video = document.createElement('video')
    video.src = props.node.attrs.src as string
    video.width = size.width
    video.height = size.height
    video.addEventListener('loadedmetadata', () => {
      video.currentTime = 0.1
    })
    videoRef.current = video

    const transformations = JSON.parse(props.node.attrs['data-transformations'])
    const videoConfig: VideoConfig = {
      x: 0,
      y: 0,
      width: size.width,
      height: size.height,
      videoFill: '#1F2937',
      performClip: true,
      cornerRadius: 8,
      clipVideoConfig: {
        x: transformations?.crop?.x || 0,
        y: transformations?.crop?.y || 0,
        width: transformations?.crop?.width || 1,
        height: transformations?.crop?.height || 1,
      },
    }

    setVideoConfig(videoConfig)
  }, [props])

  useEffect(() => {
    if (playing) {
      videoRef.current?.play()
    } else {
      videoRef.current?.pause()
    }
  }, [playing])

  return (
    <NodeViewWrapper>
      <div
        className="w-full py-8"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        <Tooltip
          isOpen={isOpen}
          setIsOpen={setOpen}
          content={
            <VideoTooltip
              editVideo={setEditVideo}
              retakeVideo={setRetakeVideo}
              deleteVideo={deleteVideo}
            />
          }
          placement="top-start"
          triggerOffset={10}
        >
          <div
            className="relative"
            style={{
              width: size.width,
              height: size.height,
            }}
          >
            <Stage {...size} ref={stageRef}>
              <Layer>
                <Group zIndex={-1}>
                  {videoRef.current && videoConfig && (
                    <Video
                      videoElement={videoRef.current}
                      videoConfig={videoConfig}
                    />
                  )}
                </Group>
              </Layer>
            </Stage>
            <div
              className={cx(
                'absolute top-0 left-0 w-full h-full transition-all ease-in-out',
                {
                  'bg-gray-900 opacity-50': !playing,
                }
              )}
            />
            <div
              className={cx(
                'absolute top-1/2 left-1/2 text-gray-50 flex items-center justify-center p-4',
                { 'bg-gray-800 opacity-50 rounded-full': playing },
                translateXY
              )}
            >
              <button
                type="button"
                onClick={() => setPlaying((playing) => !playing)}
              >
                {playing ? <FiPause size={64} /> : <FiPlay size={64} />}
              </button>
            </div>
          </div>
        </Tooltip>
        {(editVideo || retakeVideo) && (
          <AddVideo
            open={editVideo || retakeVideo}
            initialValue={{
              url: props.node.attrs.src as string,
              transformations: JSON.parse(
                props.node.attrs['data-transformations']
              ),
            }}
            shouldResetWhenOpened={retakeVideo}
            handleClose={() => {
              setEditVideo(false)
              setRetakeVideo(false)
            }}
            handleUpdateVideo={(url, transformations) => {
              props.updateAttributes({
                src: url,
                'data-transformations': JSON.stringify(transformations),
              })
            }}
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
