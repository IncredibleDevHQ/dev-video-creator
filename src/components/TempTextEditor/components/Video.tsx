/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable no-nested-ternary */
/* eslint-disable jsx-a11y/media-has-caption */
import { css, cx } from '@emotion/css'
import React, { useCallback, useEffect, useState } from 'react'
import Dropzone from 'react-dropzone'
import { BiTrashAlt, BiVideo, BiX } from 'react-icons/bi'
import { BsRecordCircleFill } from 'react-icons/bs'
import { FiCheck, FiMonitor, FiUploadCloud, FiX } from 'react-icons/fi'
import { IoChevronBack } from 'react-icons/io5'
import Modal from 'react-responsive-modal'
import useScreenRecorder from 'use-screen-recorder'
import { BlockComponentContext, TabItem } from '.'
import { emitToast, Heading, Text } from '../..'
import loadingImg from '../../../assets/loading.svg'
import { useTimekeeper, useUploadFile } from '../../../hooks'
import { AllowedFileExtensions } from '../../../hooks/use-upload-file'
import VideoEditor, {
  Transformations,
} from '../../../modules/Flick/editor/blocks/VideoEditor'
import { getSeekableWebM } from '../../../utils/helpers'
import { VideoBlockProps } from '../types'

const formatTime = (timer: number) => {
  const getSeconds = `0${timer % 60}`.slice(-2)
  const minutes = `${Math.floor(timer / 60)}`
  const getMinutes = `0${+minutes % 60}`.slice(-2)

  return `${getMinutes}:${getSeconds}`
}

const Video = () => {
  const { block, handleUpdateBlock } = React.useContext(BlockComponentContext)
  const [view, setView] = useState<'view' | 'add'>('view')

  const handleUploadURL = ({ url, key }: { url: string; key: string }) => {
    const candidateBlock = { ...block } as VideoBlockProps
    candidateBlock.videoBlock = { ...candidateBlock.videoBlock, url, key }

    handleUpdateBlock?.(candidateBlock)
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

  return (
    <div>
      {(block as VideoBlockProps)?.videoBlock?.url ? (
        <div className="relative">
          <video
            className="w-auto max-h-40 rounded"
            src={(block as VideoBlockProps)?.videoBlock?.url}
            controls
          />
          <ul className="absolute grid-flow-col gap-x-1 left-4 bg-white shadow-md p-1 rounded text-sm grid bottom-4">
            <TabItem
              icon={BiTrashAlt}
              appearance="icon"
              label="Delete"
              handleClick={handleRemoveVideo}
            />
          </ul>
        </div>
      ) : (
        <div className="bg-gray-50 flex items-center justify-between rounded-md py-2 pl-2 pr-12">
          <div className="grid grid-flow-col gap-x-2 items-center">
            <button
              onClick={() => {
                setView('add')
              }}
              type="button"
              className="text-sm flex items-center p-1 hover:bg-gray-200 rounded transition-colors"
            >
              <BiVideo className="mr-2" />
              Add video
            </button>
          </div>
          <button onClick={handleDelete} type="button">
            <BiX />
          </button>
        </div>
      )}
      <AddVideo
        open={view === 'add'}
        handleUploadURL={handleUploadURL}
        block={block as VideoBlockProps}
        handleClose={() => setView('view')}
        handleUpdateVideo={handleUpdateVideo}
      />
    </div>
  )
}

const AddVideo = ({
  open,
  block,
  handleClose,
  handleUploadURL,
  handleUpdateVideo,
}: {
  open: boolean
  block?: VideoBlockProps
  handleClose: (shouldRefetch?: boolean) => void
  handleUploadURL: (props: { url: string; key: string }) => void
  handleUpdateVideo?: (url: string, transformations?: Transformations) => void
}) => {
  const [currentView, setCurrentView] = useState<
    'select' | 'record-or-upload' | 'preview' | 'upload-s3' | 'transform'
  >('select')
  const [video, setVideo] = useState<Blob | File>()
  const [videoType, setVideoType] = useState<'blob' | 'file'>()
  const [progress, setProgress] = useState(0)

  const { startRecording, stopRecording, status, resetRecording, blob, error } =
    useScreenRecorder({ audio: true })

  const [uploadVideo] = useUploadFile()

  const { timer, handleStart, handleReset } = useTimekeeper(0)

  useEffect(() => {
    if (status === 'recording') {
      handleStart()
    }
    if (status === 'stopped') {
      handleReset()
    }
  }, [status])

  useEffect(() => {
    ;(async () => {
      if (status !== 'stopped' || !blob) return
      try {
        const arrayBuff = await blob.arrayBuffer()
        if (!arrayBuff) setVideo(blob)
        else setVideo(getSeekableWebM(arrayBuff))
      } catch (error: any) {
        emitToast({
          title: 'Something went wrong',
          type: 'error',
          description: error?.message,
        })
      }
    })()
  }, [status, blob])

  useEffect(() => {
    if (!video) return
    setCurrentView('preview')
  }, [video])

  const handleDrop = useCallback(async ([file]: File[]) => {
    setVideo(file)
  }, [])

  const handleUpload = async () => {
    if (!video || !videoType) return
    try {
      let extension: AllowedFileExtensions

      if (videoType === 'file') {
        extension = (video as File)?.name
          .split('.')
          .pop() as AllowedFileExtensions
      } else {
        extension = 'webm'
      }

      if (!extension) throw Error('Failed to get extension')

      const { url, uuid } = await uploadVideo({
        // @ts-ignore
        extension,
        file: video,
        handleProgress: ({ percentage }) => {
          setProgress(percentage)
        },
      })
      if (url) {
        setCurrentView('transform')
        handleUploadURL({ url, key: uuid })
      }
    } catch (error: any) {
      setCurrentView('select')
      emitToast({
        title: 'Something went wrong.',
        description: error.message,
        type: 'error',
      })
    }
  }

  return (
    <Modal
      center
      open={open}
      onClose={() => {
        stopRecording()
        handleReset()
        setCurrentView('select')
        handleClose()
      }}
      classNames={{
        modal: cx(
          'rounded-lg w-auto md:w-4/5 m-4',
          css`
            display: inline-flex !important;
            flex-direction: column;
            justify-content: space-between;
            align-items: stretch;
            min-height: 70vh !important;
            background-color: #1f2937 !important;
            color: #f3f4f6 !important;
            padding: 0 !important;
            margin: 0 !important;
            position: relative !important;
            height: 100% !important;
            max-height: 85vh !important;
          `
        ),
        closeButton: css`
          svg {
            fill: #fff !important;
          }
        `,
      }}
    >
      {(() => {
        switch (currentView) {
          case 'select':
            return (
              <div className="py-32 text-center">
                <Heading fontSize="medium" className="mb-16">
                  Select a file{' '}
                  <span
                    className="text-brand-75 hover:text-brand cursor-pointer border-dotted border-b-2 border-brand-75 hover:border-brand mx-1"
                    onClick={() => {
                      setVideoType('file')
                      setCurrentView('record-or-upload')
                    }}
                  >
                    locally
                  </span>{' '}
                  or{' '}
                  <span
                    className="text-brand-75 hover:text-brand cursor-pointer border-dotted border-b-2 border-brand-75 hover:border-brand mx-1"
                    onClick={() => {
                      setVideoType('blob')
                      setCurrentView('record-or-upload')
                    }}
                  >
                    record
                  </span>{' '}
                  screen
                </Heading>
                <div className="flex items-center justify-center">
                  <div
                    className="p-2 border-2 hover:border-gray-50 border-gray-400 text-gray-400 hover:text-gray-50 rounded-md flex flex-col justify-center items-center mx-4 w-40 h-32 cursor-pointer"
                    onClick={() => {
                      setVideoType('file')
                      setCurrentView('record-or-upload')
                    }}
                  >
                    <FiUploadCloud size={32} />
                    <Text className="mt-4" fontSize="small">
                      Upload a local Video
                    </Text>
                  </div>
                  <div
                    className="p-2 border-2 hover:border-gray-50 border-gray-400 text-gray-400 hover:text-gray-50 rounded-md flex flex-col justify-center items-center mx-4 w-40 h-32 cursor-pointer"
                    onClick={() => {
                      setVideoType('blob')
                      setCurrentView('record-or-upload')
                    }}
                  >
                    <FiMonitor size={32} />
                    <Text className="mt-4" fontSize="small">
                      Record a screen
                    </Text>
                  </div>
                </div>
              </div>
            )
          case 'record-or-upload':
            return videoType === 'file' ? (
              <>
                <Dropzone onDrop={handleDrop} accept="video/*" maxFiles={1}>
                  {({ getRootProps, getInputProps }) => (
                    <div
                      className="border border-dashed border-gray-200 flex flex-col items-center px-2 py-8 h-1/3 rounded-md cursor-pointer my-auto mx-8"
                      {...getRootProps()}
                    >
                      <input {...getInputProps()} />
                      <FiUploadCloud size={32} className="my-2" />
                      <div className="text-center">
                        <Text>Drag and drop or</Text>
                        <Text className="font-semibold">browse</Text>
                      </div>
                    </div>
                  )}
                </Dropzone>
                <div
                  className="flex justify-start items-center absolute top-4 left-4 cursor-pointer"
                  onClick={() => setCurrentView('select')}
                >
                  <IoChevronBack />
                  <Text>Back</Text>
                </div>
              </>
            ) : (
              <>
                <div className="rounded-md text-gray-100 w-full h-full flex items-center justify-center relative">
                  {(() => {
                    switch (status) {
                      case 'permission-requested':
                        return 'Please allow to access your screen. Press the record button below to continue.'
                      case 'idle':
                        return 'Press the record button below to start.'
                      case 'recording':
                        return 'Recording...'
                      case 'error':
                        return `Error. ${error?.message}.`
                      case 'stopped':
                        return 'Recording stopped.'
                      default:
                        return 'initializing recorder...'
                    }
                  })()}
                  <div
                    className="flex justify-start items-center absolute top-4 left-4 cursor-pointer"
                    onClick={() => setCurrentView('select')}
                  >
                    <IoChevronBack />
                    <Text>Back</Text>
                  </div>
                </div>
                <div className="bg-gray-600 text-gray-50 flex justify-center items-center w-full p-4">
                  <button
                    type="button"
                    onClick={() => {
                      if (status === 'recording') {
                        stopRecording()
                      } else {
                        startRecording()
                      }
                    }}
                  >
                    <div className="bg-gray-700 p-1.5 rounded-sm flex justify-start items-center">
                      <BsRecordCircleFill
                        size={24}
                        fill="#fff"
                        className={cx('rounded-full', {
                          'bg-gray-300': status !== 'recording',
                          'bg-red-600': status === 'recording',
                        })}
                      />
                      {status === 'permission-requested' && (
                        <p className="ml-2 text-gray-300">Record</p>
                      )}
                      {timer && timer > 0 ? (
                        <p className="ml-2 text-gray-300">
                          {formatTime(timer)}
                        </p>
                      ) : null}
                    </div>
                  </button>
                </div>
              </>
            )
          case 'preview':
            if (!video || !videoType) {
              setCurrentView('record-or-upload')
              return null
            }
            return videoType === 'file' ? (
              <>
                <video
                  controls
                  src={URL.createObjectURL(video as File)}
                  className="rounded-md w-full h-full"
                />
                <div className="bg-gray-600 text-gray-50 flex justify-center items-center w-full p-4">
                  <button
                    type="button"
                    className="flex px-1.5 py-1 text-sm rounded-sm items-center bg-gray-700 mx-1"
                    onClick={() => {
                      handleUpload()
                      setCurrentView('upload-s3')
                    }}
                  >
                    <FiCheck size={20} className="mr-1" />
                    Looks Good
                  </button>
                  <button
                    type="button"
                    className="flex px-1.5 py-1 text-sm rounded-sm items-center bg-gray-700 mx-1"
                    onClick={() => {
                      setCurrentView('record-or-upload')
                      setVideo(undefined)
                    }}
                  >
                    <FiX size={20} className="mr-1" />
                    Reset
                  </button>
                </div>
              </>
            ) : (
              <>
                <video
                  controls
                  src={URL.createObjectURL(video as Blob)}
                  className="rounded-md w-full h-full"
                />
                <div className="bg-gray-600 text-gray-50 flex justify-center items-center w-full p-4">
                  <button
                    type="button"
                    className="flex px-1.5 py-1 text-sm rounded-sm items-center bg-gray-700 mx-1"
                    onClick={() => {
                      setCurrentView('upload-s3')
                      handleUpload()
                    }}
                  >
                    <FiCheck size={20} className="mr-1" />
                    Looks Good
                  </button>
                  <button
                    type="button"
                    className="flex px-1.5 py-1 text-sm rounded-sm items-center bg-gray-700 mx-1"
                    onClick={() => {
                      setCurrentView('record-or-upload')
                      setVideo(undefined)
                      resetRecording()
                    }}
                  >
                    <FiX size={20} className="mr-1" />
                    Reset
                  </button>
                </div>
              </>
            )
          case 'upload-s3':
            return (
              <div className="flex flex-col justify-center items-center h-full w-full py-40 text-gray-50">
                <img
                  src={loadingImg}
                  className={cx(
                    'w-14 my-4',
                    css`
                      filter: grayscale(1);
                    `
                  )}
                  alt="Logo"
                />
                <div className="w-1/2 h-2 relative rounded-md bg-gray-700 my-2 overflow-hidden">
                  <div
                    className={cx(
                      'bg-gray-50 absolute top-0 left-0 bottom-0',
                      css`
                        width: ${progress}%;
                      `
                    )}
                  />
                </div>
                <p className="my-2 text-base text-center">
                  Hold there! We are getting your video ready for configuration.{' '}
                  <br /> This might take some time.
                </p>
              </div>
            )
          case 'transform':
            if (!video || !videoType) {
              setCurrentView('record-or-upload')
              return null
            }
            // eslint-disable-next-line no-case-declarations
            const url = URL.createObjectURL(video)

            return (
              <div className="w-full h-full flex items-center justify-center">
                {url && (
                  <VideoEditor
                    handleAction={(transformations) => {
                      handleUpdateVideo?.(url, transformations)
                      handleClose(true)
                    }}
                    url={url}
                    width={720}
                    action="Save"
                    transformations={{
                      clip: block?.videoBlock?.transformations?.clip || {},
                      crop: block?.videoBlock?.transformations?.crop,
                    }}
                  />
                )}
              </div>
            )
          default:
            return null
        }
      })()}
    </Modal>
  )
}

export default Video
