/* eslint-disable jsx-a11y/media-has-caption */
/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import { css, cx } from '@emotion/css'
import React, { useCallback, useEffect, useState } from 'react'
import Dropzone from 'react-dropzone'
import { BsRecordCircleFill } from 'react-icons/bs'
import {
  FiUploadCloud,
  FiMonitor,
  FiCheck,
  FiX,
  FiVideoOff,
  FiMicOff,
} from 'react-icons/fi'
import { IoChevronBack } from 'react-icons/io5'
import Modal from 'react-responsive-modal'
import useScreenRecorder from 'use-screen-recorder'
import { emitToast, Heading, Text } from '../../../../components'
import { useUploadFile, useTimekeeper } from '../../../../hooks'
import { AllowedFileExtensions } from '../../../../hooks/use-upload-file'
import { getSeekableWebM } from '../../../../utils/helpers'
import { VideoBlockProps } from '../utils/utils'
import VideoEditor, { Transformations } from './VideoEditor'
import loadingImg from '../../../../assets/loading.svg'
import { ASSETS } from '../../../../constants'

const formatTime = (timer: number) => {
  const getSeconds = `0${timer % 60}`.slice(-2)
  const minutes = `${Math.floor(timer / 60)}`
  const getMinutes = `0${+minutes % 60}`.slice(-2)

  return `${getMinutes}:${getSeconds}`
}

const AddVideo = ({
  open,
  block,
  handleClose,
  initialValue,
  handleUpdateVideo,
  shouldResetWhenOpened = false,
}: {
  open: boolean
  block?: VideoBlockProps
  shouldResetWhenOpened?: boolean
  initialValue?: {
    url: string
    transformations?: Transformations
  }
  handleClose: (shouldRefetch?: boolean) => void
  handleUpdateVideo?: (url: string, transformations?: Transformations) => void
}) => {
  const [currentView, setCurrentView] = useState<
    'select' | 'record-or-upload' | 'preview' | 'upload-s3' | 'transform'
  >('select')
  const [video, setVideo] = useState<Blob | File>()
  const [videoType, setVideoType] = useState<'blob' | 'file'>()
  const [progress, setProgress] = useState(0)
  const [videoURL, setVideoURL] = useState<string>('')

  const { startRecording, stopRecording, status, resetRecording, blob, error } =
    useScreenRecorder({ audio: true })

  const [uploadVideo] = useUploadFile()

  const { timer, handleStart, handleReset } = useTimekeeper(0)

  useEffect(() => {
    if (shouldResetWhenOpened) {
      setCurrentView('select')
      setVideo(undefined)
      setVideoType(undefined)
      setProgress(0)
      setVideoURL('')
    }
  }, [shouldResetWhenOpened])

  useEffect(() => {
    if (!initialValue || shouldResetWhenOpened) return
    setVideoURL(initialValue.url)
    setCurrentView('transform')
  }, [initialValue, shouldResetWhenOpened])

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

      const { url } = await uploadVideo({
        // @ts-ignore
        extension,
        file: video,
        handleProgress: ({ percentage }) => {
          setProgress(percentage)
        },
      })

      if (url) {
        setVideoURL(url)
        setCurrentView('transform')
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
        if (status === 'recording') stopRecording()
        handleReset()
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
                    className="mx-1 border-b-2 border-dotted cursor-pointer text-brand-75 hover:text-brand border-brand-75 hover:border-brand"
                    onClick={() => {
                      setVideoType('file')
                      setCurrentView('record-or-upload')
                    }}
                  >
                    locally
                  </span>{' '}
                  or{' '}
                  <span
                    className="mx-1 border-b-2 border-dotted cursor-pointer text-brand-75 hover:text-brand border-brand-75 hover:border-brand"
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
                    className="flex flex-col items-center justify-center w-40 h-32 p-2 mx-4 text-gray-400 border-2 border-gray-400 rounded-md cursor-pointer hover:border-gray-50 hover:text-gray-50"
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
                    className="flex flex-col items-center justify-center w-40 h-32 p-2 mx-4 text-gray-400 border-2 border-gray-400 rounded-md cursor-pointer hover:border-gray-50 hover:text-gray-50"
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
                      className="flex flex-col items-center px-2 py-8 mx-8 my-auto border border-gray-200 border-dashed rounded-md cursor-pointer h-1/3"
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
                  className="absolute flex items-center justify-start cursor-pointer top-4 left-4"
                  onClick={() => setCurrentView('select')}
                >
                  <IoChevronBack />
                  <Text>Back</Text>
                </div>
              </>
            ) : (
              <>
                <div className="relative flex flex-col items-center justify-center w-full h-full text-gray-100 rounded-md">
                  <img
                    src={ASSETS.ICONS.RECORD_SCREEN}
                    alt="unsplash-img"
                    className="w-1/3 h-auto rounded-md"
                  />
                  <Heading fontSize="medium" className="my-1">
                    Screen Only
                  </Heading>
                  <div className="flex flex-col items-center justify-center text-gray-400 my-4">
                    <div className="flex items-center justify-center my-2">
                      <FiMicOff size={20} className="mx-2" />
                      <FiVideoOff size={20} className="mx-2" />
                    </div>
                    <Text fontSize="normal" className="text-center w-2/3">
                      The screengrab doesn’t record camera or mic. You can talk
                      over the screengrab during video recording.{' '}
                    </Text>
                  </div>
                  <Text className="my-1">
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
                  </Text>
                  <div
                    className="absolute flex items-center justify-start cursor-pointer top-4 left-4"
                    onClick={() => setCurrentView('select')}
                  >
                    <IoChevronBack />
                    <Text>Back</Text>
                  </div>
                </div>
                <div className="flex items-center justify-center w-full p-4 bg-gray-600 text-gray-50">
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
                  className="my-auto w-full h-3/4 rounded-md"
                />
                <div className="flex items-center justify-center w-full p-4 bg-gray-600 text-gray-50 absolute z-10 bottom-0 left-0">
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
                  src={URL.createObjectURL(video as Blob)}
                  className="my-auto w-full h-3/4 rounded-md"
                  controls
                />
                <div className="flex items-center justify-center w-full p-4 bg-gray-600 text-gray-50 absolute z-10 bottom-0 left-0">
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
              <div className="flex flex-col items-center justify-center w-full h-full py-40 text-gray-50">
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
                <div className="relative w-1/2 h-2 my-2 overflow-hidden bg-gray-700 rounded-md">
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
            if (!videoURL) {
              setCurrentView('record-or-upload')
              return null
            }

            return (
              <div className="flex-1 my-auto flex items-center justify-center w-full h-full">
                <VideoEditor
                  handleAction={(transformations) => {
                    handleUpdateVideo?.(videoURL, transformations)
                    handleClose(true)
                  }}
                  url={videoURL}
                  width={720}
                  action="Save"
                  transformations={{
                    clip: initialValue?.transformations?.clip || {},
                    crop: initialValue?.transformations?.crop,
                  }}
                />
              </div>
            )
          default:
            return null
        }
      })()}
    </Modal>
  )
}

export default AddVideo
