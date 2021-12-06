/* eslint-disable no-nested-ternary */
/* eslint-disable jsx-a11y/media-has-caption */
import { css, cx } from '@emotion/css'
import React, { useCallback, useState } from 'react'
import Dropzone from 'react-dropzone'
import {
  BiCloudUpload,
  BiCrop,
  BiScreenshot,
  BiStop,
  BiTrashAlt,
  BiVideo,
  BiVideoRecording,
  BiX,
} from 'react-icons/bi'
import { FiUploadCloud } from 'react-icons/fi'
import Modal from 'react-responsive-modal'

import useScreenRecorder from 'use-screen-recorder'
import { BlockComponentContext, TabItem, Uploading } from '.'
import { Tooltip, Text, Heading } from '../..'
import { useUploadFile } from '../../../hooks'
import VideoEditor, {
  Transformations,
} from '../../../modules/Flick/components/VideoEditor'
import { VideoBlockProps } from '../types'

const Video = () => {
  const { block, handleUpdateBlock } = React.useContext(BlockComponentContext)
  const [view, setView] = useState<'transform' | 'tooltip' | 'record' | 'view'>(
    'view'
  )

  const handleUpload = ({ url, key }: { url: string; key: string }) => {
    const candidateBlock = { ...block } as VideoBlockProps

    candidateBlock.videoBlock.url = url
    candidateBlock.videoBlock.key = key

    handleUpdateBlock?.(candidateBlock)
    setView('view')
  }

  const handleRemoveVideo = () => {
    const candidateBlock = { ...block } as VideoBlockProps

    candidateBlock.videoBlock.url = undefined
    candidateBlock.videoBlock.key = undefined

    handleUpdateBlock?.(candidateBlock)
  }

  const handleDelete = () => {
    const candidateBlock = { ...block } as VideoBlockProps

    if (!candidateBlock) return

    if (candidateBlock?.videoBlock) {
      // @ts-ignore
      candidateBlock.videoBlock = undefined
    }
    // @ts-ignore
    candidateBlock.type = undefined

    handleUpdateBlock?.(candidateBlock)
  }

  const handleUpdateVideo = (
    url: string,
    transformations?: Transformations
  ) => {
    const candidateBlock = { ...block } as VideoBlockProps

    candidateBlock.videoBlock.url = url
    candidateBlock.videoBlock.transformations = transformations

    handleUpdateBlock?.(candidateBlock)
  }

  return (block as VideoBlockProps)?.videoBlock?.url ? (
    <div className="relative">
      <video
        className="w-auto max-h-40 rounded"
        src={(block as VideoBlockProps)?.videoBlock?.url}
        controls
      />
      <ul className="absolute grid-flow-col gap-x-1 left-4 bg-white shadow-md p-1 rounded text-sm grid bottom-4">
        <Tooltip
          isOpen={view === 'tooltip'}
          setIsOpen={() => setView('view')}
          content={<UploadVideo handleUpload={handleUpload} />}
          placement="top-start"
          triggerOffset={20}
        >
          <TabItem
            icon={BiVideo}
            appearance="icon"
            label="Video"
            handleClick={() => setView('tooltip')}
          />
        </Tooltip>
        <TabItem
          icon={BiCrop}
          appearance="icon"
          label="Transform"
          handleClick={() => setView('transform')}
          active={
            typeof (block as VideoBlockProps)?.videoBlock?.transformations !==
            'undefined'
          }
        />
        <TabItem
          icon={BiTrashAlt}
          appearance="icon"
          label="Delete"
          handleClick={handleRemoveVideo}
        />
      </ul>
      <VideoModal
        open={view === 'transform'}
        handleClose={() => setView('view')}
        url={(block as VideoBlockProps)?.videoBlock?.url}
        block={block as VideoBlockProps}
        handleUpdateVideo={handleUpdateVideo}
      />
    </div>
  ) : view !== 'record' ? (
    <div className="bg-gray-50 flex items-center justify-between rounded-md py-2 pl-2 pr-12">
      <div className="grid grid-flow-col gap-x-2 items-center">
        <Tooltip
          isOpen={view === 'tooltip'}
          setIsOpen={() => setView('view')}
          content={<UploadVideo handleUpload={handleUpload} />}
          placement="top-start"
          triggerOffset={20}
        >
          <button
            onClick={() => {
              setView('tooltip')
            }}
            type="button"
            className="text-sm flex items-center p-1 hover:bg-gray-200 rounded transition-colors"
          >
            <BiVideo className="mr-2" />
            Add video
          </button>
        </Tooltip>
        <span className="text-xs">OR</span>
        <button
          onClick={() => {
            setView('record')
          }}
          type="button"
          className="text-sm flex items-center p-1 hover:bg-gray-200 rounded transition-colors"
        >
          <BiScreenshot className="mr-2" />
          Record your screen
        </button>
      </div>
      <button onClick={handleDelete} type="button">
        <BiX />
      </button>
    </div>
  ) : (
    <RecordVideo handleUpload={handleUpload} />
  )
}

const UploadVideo = ({
  handleUpload,
}: {
  handleUpload: (props: { url: string; key: string }) => void
}) => {
  const [uploadVideo] = useUploadFile()

  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)

  const handleDrop = useCallback(async ([file]: File[]) => {
    setLoading(true)
    const { url, uuid } = await uploadVideo({
      // @ts-ignore
      extension: file?.name.split('.').pop(),
      file,
      handleProgress: ({ percentage }) => {
        setProgress(percentage)
      },
    }).finally(() => setLoading(false))

    handleUpload({ url, key: uuid })
  }, [])

  return (
    <div
      style={{ minWidth: 240 }}
      className="rounded-md shadow-md bg-white p-4"
    >
      <Dropzone
        disabled={loading}
        onDrop={handleDrop}
        accept="video/*"
        maxFiles={1}
      >
        {({ getRootProps, getInputProps }) => (
          <div
            className="border border-dashed border-gray-200 flex flex-col items-center p-2 rounded-md cursor-pointer"
            {...getRootProps()}
          >
            <input {...getInputProps()} />
            {loading ? (
              <div className="text-center">
                <Uploading progress={progress} />
              </div>
            ) : (
              <>
                <FiUploadCloud size={24} className="my-2" />

                <div className="text-center">
                  <Text fontSize="small">Drag and drop or</Text>
                  <Text fontSize="small" className="font-semibold">
                    browse
                  </Text>
                </div>
              </>
            )}
          </div>
        )}
      </Dropzone>
    </div>
  )
}

const RecordVideo = ({
  handleUpload,
}: {
  handleUpload: (props: { url: string; key: string }) => void
}) => {
  const {
    startRecording,
    stopRecording,
    status,
    resetRecording,
    blob,
    blobUrl,
  } = useScreenRecorder({ audio: true })

  const [uploadVideo] = useUploadFile()

  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)

  const handleUploadBlob = async () => {
    if (!blob) return
    setLoading(true)
    const { url, uuid } = await uploadVideo({
      // @ts-ignore
      extension: 'webm',
      file: blob,
      handleProgress: ({ percentage }) => {
        setProgress(percentage)
      },
    }).finally(() => setLoading(false))

    handleUpload({ url, key: uuid })
  }

  return (
    <div className="w-full max-h-64 relative">
      {!blobUrl && (
        <div className="bg-gray-100 rounded-md h-64 w-full flex items-center justify-center">
          Your recording will be available here.
        </div>
      )}
      {blobUrl && (
        <video controls src={blobUrl} className="rounded-md h-64 w-auto" />
      )}
      <ul className="absolute grid-flow-col gap-x-1 right-4 bg-white shadow-md p-1 rounded text-sm grid bottom-4">
        {loading ? (
          <Uploading progress={progress} />
        ) : (
          <>
            {status === 'idle' && !blobUrl && (
              <TabItem
                icon={BiVideoRecording}
                appearance="icon"
                label="Record"
                handleClick={startRecording}
              />
            )}
            {status === 'recording' && !blobUrl && (
              <TabItem
                icon={BiStop}
                appearance="icon"
                label="Stop Recording"
                handleClick={stopRecording}
              />
            )}
            {blobUrl && (
              <TabItem
                icon={BiTrashAlt}
                appearance="icon"
                label="Reset Recording"
                handleClick={resetRecording}
              />
            )}
            {blobUrl && (
              <TabItem
                icon={BiCloudUpload}
                appearance="icon"
                label="Upload"
                handleClick={handleUploadBlob}
              />
            )}
          </>
        )}
      </ul>
    </div>
  )
}

const VideoModal = ({
  handleClose,
  open,
  handleUpdateVideo,
  url,
  block,
}: {
  handleClose: (shouldRefetch?: boolean) => void
  open: boolean
  handleUpdateVideo?: (url: string, transformations?: Transformations) => void
  url?: string
  block?: VideoBlockProps
}) => {
  return (
    <Modal
      open={open}
      onClose={() => handleClose()}
      center
      classNames={{
        modal: cx(
          'rounded-lg w-auto md:w-1/2 m-4',
          css`
            background-color: #fffffff !important;
          `
        ),
        closeButton: css`
          svg {
            fill: #000000;
          }
        `,
      }}
    >
      <>
        <div className="flex items-center mb-2 justify-between">
          <Heading fontSize="medium">Clip and crop your video</Heading>
        </div>

        {url && (
          <VideoEditor
            handleAction={(transformations) => {
              handleUpdateVideo?.(url, transformations)
              handleClose(true)
            }}
            url={url}
            width={480}
            action="Save"
            transformations={block?.videoBlock?.transformations}
          />
        )}
      </>
    </Modal>
  )
}

export default Video
