/* eslint-disable jsx-a11y/no-autofocus */
/* eslint-disable react/no-this-in-sfc */
/* eslint-disable react/jsx-no-bind */
/* eslint-disable jsx-a11y/media-has-caption */
import { css, cx } from '@emotion/css'
import { Editor, mergeAttributes, Node } from '@tiptap/core'
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react'
import Konva from 'konva'
import { NodeSelection } from 'prosemirror-state'
import React, { useEffect, useState } from 'react'
import Dropzone from 'react-dropzone'
import {
  FiEdit,
  FiPause,
  FiPlay,
  FiRepeat,
  FiTrash,
  FiUploadCloud,
} from 'react-icons/fi'
import { Circle, Group, Layer, Rect, Stage } from 'react-konva'
import useMeasure from 'react-use-measure'
import { Text } from '../../../../components'
import { Video, VideoConfig } from '../../../Studio/components/Video'
import { useGetHW } from '../../components/BlockPreview'
import AddVideo from './AddVideo'

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
  props,
}: {
  deleteVideo: () => void
  editVideo: (val: boolean) => void
  retakeVideo: (val: boolean) => void
  props: any
}) => {
  return (
    <div className="hidden group-hover:flex items-center gap-x-1 pl-2 text-gray-300 bg-gray-800 rounded-sm m-2 absolute z-50 shadow-md cursor-default font-body">
      <FiEdit
        size={16}
        className="mx-1 cursor-pointer hover:text-gray-50"
        onClick={() => editVideo(true)}
      />
      <FiRepeat
        size={16}
        className="mx-1 cursor-pointer hover:text-gray-50"
        onClick={() => retakeVideo(true)}
      />
      <FiTrash
        size={16}
        className="mx-1 cursor-pointer hover:text-gray-50"
        onClick={deleteVideo}
      />
      <button
        className="hidden group-hover:block hover:bg-gray-700 text-white px-2  border-gray-300 pl-2 rounded-r-sm py-1"
        type="button"
        onClick={() => {
          if (props.node.attrs.caption === null)
            props.updateAttributes({
              caption: '',
            })
          else
            props.updateAttributes({
              caption: null,
            })
        }}
      >
        {props.node.attrs.caption === null ? 'Add caption' : 'Remove Caption'}
      </button>
    </div>
  )
}

const VideoBlock = (props: any) => {
  const { caption } = props.node.attrs
  const stageRef = React.useRef<Konva.Stage | null>(null)
  const videoRef = React.useRef<HTMLVideoElement | null>(null)
  const seekbarRef = React.useRef<Konva.Rect | null>(null)
  const seekPointerRef = React.useRef<Konva.Circle | null>(null)

  const [transformations, setTransformations] = useState<any>()

  const [playing, setPlaying] = useState(false)
  const [editVideo, setEditVideo] = useState(false)
  const [retakeVideo, setRetakeVideo] = useState(false)
  const [currentSeekPosition, setCurrentSeekPosition] = useState(0)
  const [videoConfig, setVideoConfig] = useState<VideoConfig>()

  const [ref, bounds] = useMeasure()

  const { height, width } = useGetHW({
    maxH: bounds.height * 1,
    maxW: bounds.width * 1,
    aspectRatio: 16 / 9,
  })

  const { height: divHeight, width: divWidth } = useGetHW({
    maxH: bounds.height * 1,
    maxW: bounds.width * 1,
    aspectRatio: 16 / 9,
  })

  const deleteVideo = () => {
    props.updateAttributes({
      src: null,
    })
  }

  useEffect(() => {
    if (!videoRef.current) {
      const video = document.createElement('video')
      video.width = size.width
      video.height = size.height
      video.addEventListener('loadedmetadata', () => {
        video.currentTime = transformations?.clip?.start || 0.1
      })
      videoRef.current = video
    }

    const transformations = JSON.parse(props.node.attrs['data-transformations'])
    setTransformations(transformations)
    let offX = 0

    videoRef.current?.addEventListener('loadedmetadata', function () {
      const { duration, width, currentTime } = this
      offX =
        (transformations?.clip?.start || 0) *
        ((width - 20) /
          (transformations?.clip?.end - transformations?.clip?.start ||
            duration))
      const finalPos =
        (currentTime - (transformations?.clip?.start || 0)) *
        ((width - 20) /
          (transformations?.clip?.end - transformations?.clip?.start ||
            duration))
      setCurrentSeekPosition(finalPos > 0 ? finalPos : 0)
    })

    if (videoRef.current?.src !== props.node.attrs.src) {
      videoRef.current.src = props.node.attrs.src as string
    }

    videoRef.current.addEventListener('timeupdate', () => {
      if (!videoRef.current) return
      const origX =
        videoRef.current.currentTime *
        ((videoRef.current.width - 20) /
          (transformations?.clip?.end - transformations?.clip?.start ||
            videoRef.current.duration))
      setCurrentSeekPosition(origX - offX > 0 ? origX - offX : 0)
      if (
        videoRef.current.currentTime >= transformations?.clip?.end ||
        videoRef.current.currentTime >= videoRef.current.duration
      ) {
        videoRef.current.currentTime = transformations?.clip?.start || 0
        videoRef.current.pause()
        setPlaying(false)
      }
    })

    const videoConfig: VideoConfig = {
      x: 0,
      y: 0,
      width: size.width,
      height: size.height,
      videoFill: '#1F2937',
      performClip: true,
      cornerRadius: 0,
      clipVideoConfig: {
        x: transformations?.crop?.x || 0,
        y: transformations?.crop?.y || 0,
        width: transformations?.crop?.width || 1,
        height: transformations?.crop?.height || 1,
      },
    }

    setVideoConfig(videoConfig)
  }, [props?.node?.attrs])

  useEffect(() => {
    if (!stageRef.current) return
    stageRef.current.container().style.cursor = 'pointer'
  }, [stageRef])

  useEffect(() => {
    if (playing) {
      videoRef.current?.play()
    } else {
      videoRef.current?.pause()
    }
  }, [playing])

  useEffect(() => {
    return () => {
      videoRef.current?.removeEventListener('timeupdate', () => {})
      videoRef.current = null
      stageRef.current = null
      seekbarRef.current = null
      seekPointerRef.current = null
    }
  }, [])

  if (!props.node.attrs.src)
    return (
      <NodeViewWrapper>
        <Dropzone
          onDrop={undefined}
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
                setRetakeVideo(true)
              }}
            >
              <input {...getInputProps()} />
              <FiUploadCloud size={24} className="my-2" />

              <div className="z-50 text-center text-black">
                {props.node.attrs.type === 'video' ? (
                  <>
                    <Text contentEditable={false} fontSize="small">
                      Drag and drop a {props.node.attrs.type} or
                    </Text>
                    <Text
                      contentEditable={false}
                      fontSize="small"
                      className="font-semibold"
                    >
                      browse
                    </Text>
                  </>
                ) : (
                  <Text contentEditable={false} fontSize="small">
                    Click to record the screen
                  </Text>
                )}
              </div>
            </div>
          )}
        </Dropzone>
        {(editVideo || retakeVideo) && (
          <AddVideo
            open={editVideo || retakeVideo}
            initialValue={{
              url: props.node.attrs.src as string,
              transformations: JSON.parse(
                props.node.attrs['data-transformations']
              ),
            }}
            shouldResetWhenOpened={props.node.attrs.type === 'video'}
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
            recordScreenMode
          />
        )}
      </NodeViewWrapper>
    )

  return (
    <NodeViewWrapper
      as="div"
      id={props.node.attrs.id}
      className="w-full relative group"
      ref={ref}
    >
      <VideoTooltip
        editVideo={setEditVideo}
        retakeVideo={setRetakeVideo}
        deleteVideo={deleteVideo}
        props={props}
      />

      <div
        className="relative group-hover:bg-gray-200"
        style={{
          width: divWidth,
          height: divHeight,
          cursor: 'default',
        }}
      >
        <Stage
          height={height}
          width={width}
          ref={stageRef}
          className="border"
          scale={{
            x: Number((height / size.height).toFixed(2)),
            y: Number((width / size.width).toFixed(2)),
          }}
        >
          <Layer>
            <Group zIndex={-1}>
              {videoRef.current && videoConfig && (
                <Video
                  videoElement={videoRef.current}
                  videoConfig={videoConfig}
                />
              )}
              {!playing && (
                <Rect
                  x={0}
                  y={0}
                  fill="#000000"
                  opacity={0.2}
                  width={
                    videoRef.current?.width ? videoRef.current.width : width
                  }
                  height={
                    videoRef.current?.height ? videoRef.current.height : height
                  }
                />
              )}
              {videoRef.current && (
                <Group>
                  <Rect
                    fill="#D1D5DB"
                    cornerRadius={8}
                    x={10}
                    y={
                      videoRef.current?.height
                        ? videoRef.current.height - 20
                        : height
                    }
                    width={
                      videoRef.current?.width
                        ? videoRef.current.width - 20
                        : width
                    }
                    height={10}
                    opacity={1}
                  />
                  <Rect
                    x={10}
                    ref={seekbarRef}
                    width={10 + currentSeekPosition}
                    y={
                      videoRef.current?.height
                        ? videoRef.current.height - 20
                        : height
                    }
                    height={10}
                    fill="#16A34A"
                    opacity={1}
                    cornerRadius={8}
                  />
                  <Circle
                    ref={seekPointerRef}
                    x={10 + currentSeekPosition}
                    y={
                      videoRef.current?.height
                        ? videoRef.current.height - 15
                        : height
                    }
                    width={20}
                    height={20}
                    draggable
                    dragBoundFunc={function (pos) {
                      return {
                        x: pos.x,
                        y: this.absolutePosition().y,
                      }
                    }}
                    onDragMove={() => {
                      if (!seekPointerRef.current) return
                      seekPointerRef.current?.y(
                        videoRef.current?.height
                          ? videoRef.current.height - 15
                          : height
                      )
                      if (!videoRef.current) return
                      if (seekPointerRef.current.x() < 10)
                        seekPointerRef.current.x(10)
                      if (
                        seekPointerRef.current.x() >
                        videoRef.current?.width - 10
                      )
                        seekPointerRef.current.x(videoRef.current?.width - 10)
                      seekbarRef.current?.width(seekPointerRef.current.x() - 10)
                      const tt =
                        seekPointerRef.current.x() *
                        ((transformations?.clip?.end -
                          transformations?.clip?.start ||
                          videoRef.current.duration) /
                          (videoRef.current.width - 20))

                      videoRef.current.currentTime =
                        tt + (transformations?.clip?.start || 0)
                    }}
                    fill="#16A34A"
                  />
                </Group>
              )}
            </Group>
          </Layer>
        </Stage>
        <div
          className={cx(
            'absolute top-1/2 left-1/2 text-gray-50 items-center justify-center p-4 hidden group-hover:flex',
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
      {caption !== null && (
        <input
          autoFocus
          onFocus={() => {
            const editor = props.editor as Editor
            editor.view.dispatch(
              editor.view.state.tr.setSelection(
                NodeSelection.create(editor.view.state.doc, props.getPos())
              )
            )
          }}
          value={caption}
          placeholder="Write a caption..."
          className="border border-gray-200 w-full mt-1.5 group-hover:bg-gray-100 font-body px-2 py-1 focus:outline-none placeholder-italic text-black"
          onChange={(e) => {
            props.updateAttributes({ caption: e.target.value })
          }}
        />
      )}
      <div className="w-full p-1" />
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
    </NodeViewWrapper>
  )
}

export default Node.create({
  name: 'video',

  group: 'block',

  content: 'block*',

  atom: true,

  isolating: true,

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
      caption: {
        default: null,
      },
      type: {
        default: 'video', // video, screengrab
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
