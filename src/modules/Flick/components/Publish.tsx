/* eslint-disable jsx-a11y/media-has-caption */
import { css, cx } from '@emotion/css'
import { Listbox, Switch } from '@headlessui/react'
import * as Sentry from '@sentry/react'
import axios from 'axios'
import React, { ChangeEvent, useEffect, useRef, useState } from 'react'
import Dropzone from 'react-dropzone'
import { BiCheck } from 'react-icons/bi'
import { BsCloudCheck, BsCloudUpload } from 'react-icons/bs'
import {
  FiExternalLink,
  FiLoader,
  FiRefreshCw,
  FiUploadCloud,
} from 'react-icons/fi'
import { HiOutlineClock, HiOutlineDownload } from 'react-icons/hi'
import {
  IoAddOutline,
  IoChevronDownOutline,
  IoChevronUpOutline,
  IoCloseOutline,
  IoImageOutline,
  IoReloadOutline,
} from 'react-icons/io5'
import { MdOutlineTextFields } from 'react-icons/md'
import Modal from 'react-responsive-modal'
import useMeasure from 'react-use-measure'
import { useRecoilState, useRecoilValue } from 'recoil'
import { useDebouncedCallback } from 'use-debounce'
import { ReactComponent as CallToActionIcon } from '../../../assets/CallToAction.svg'
import {
  Button,
  Confetti,
  emitToast,
  Heading,
  Image,
  Text,
  TextField,
  Tooltip,
} from '../../../components'
import config from '../../../config'
import {
  FlickFragmentFragment,
  Fragment_Type_Enum_Enum,
  RecordingFragment,
  Recording_Status_Enum_Enum,
  useCompleteRecordingMutation,
  useGetRecordingsQuery,
  useGetUserYtIntegrationSubscription,
  usePublishVideoActionMutation,
  useUpdatePublishMutation,
  useUpdateThumbnailObjectMutation,
} from '../../../generated/graphql'
import { useUploadFile } from '../../../hooks'
import firebaseState from '../../../stores/firebase.store'
import { SimpleAST } from '../editor/utils/utils'
import { newFlickStore } from '../store/flickNew.store'
import { useGetHW } from './BlockPreview'
import ThumbnailModal from './ThumbnailModal'

interface CallToAction {
  seconds: number
  text?: string
  url?: string
}

export interface IPublish {
  title?: string
  description?: string
  thumbnail?: {
    objectId?: string
    method?: 'generated' | 'uploaded'
  }
  ctas: CallToAction[]
  discordCTA?: { url: string; text: string }
}
interface Tab {
  name: string
  id: string
}

const tabs: Tab[] = [
  {
    name: 'Details',
    id: 'Details',
  },
  {
    name: 'Thumbnail',
    id: 'Thumbnail',
  },
  {
    name: 'Call to action',
    id: 'CallToAction',
  },
]

const getIcon = (tabId: string) => {
  switch (tabId) {
    case 'Details':
      return <MdOutlineTextFields size={21} />
    case 'Thumbnail':
      return <IoImageOutline size={21} />
    case 'CallToAction':
      return <CallToActionIcon className="transform scale-150" />
    default:
      return null
  }
}

const initialState: IPublish = {
  ctas: [],
  thumbnail: {
    method: 'generated',
  },
}

const noArrowInput = css`
  ::-webkit-outer-spin-button,
  ::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  [type='number'] {
    -moz-appearance: textfield;
  }
`

export interface YTIntegration {
  name: string
  picture: string
}

const Publish = ({
  open,
  simpleAST,
  activeFragment,
  handleClose,
}: {
  open: boolean
  simpleAST?: SimpleAST
  activeFragment: FlickFragmentFragment | undefined
  handleClose: (refresh?: boolean) => void
}) => {
  const [activeTab, setActiveTab] = useState<Tab>(tabs[0])
  const [ref, bounds] = useMeasure()
  const [downloading, setDownloading] = useState(false)

  const [showConfetti, setShowConfetti] = useState(false)

  const [enablePublishToYT, setEnablePublishToYT] = useState(false)

  const [{ flick, activeFragmentId }, setStore] = useRecoilState(newFlickStore)

  const fragment = flick?.fragments?.find((f) => f.id === activeFragmentId)

  const [publish, setPublish] = useState<IPublish>(
    fragment?.publishConfig || {
      ...initialState,
      title: fragment?.name,
      thumbnail: {
        ...initialState.thumbnail,
        objectId:
          flick?.fragments?.find((fragment) => fragment.id === activeFragmentId)
            ?.thumbnailObject || undefined,
      },
    }
  )

  const [
    doPublish,
    { data: doPublishData, loading: publishing, error: errorPublishing },
  ] = usePublishVideoActionMutation()

  useEffect(() => {
    if (!doPublishData) return
    setShowConfetti(true)
    setTimeout(() => {
      setShowConfetti(false)
    }, 5000)
  }, [doPublishData])

  useEffect(() => {
    if (!errorPublishing) return
    emitToast({
      type: 'error',
      title: 'Error publishing',
    })
    Sentry.captureException(updatePublishError)
  }, [errorPublishing])

  const [
    updatePublishConfig,
    { loading: updatePublishLoading, error: updatePublishError },
  ] = useUpdatePublishMutation({
    variables: {
      id: fragment?.id,
      publishConfig: publish,
    },
  })

  const {
    data: ytData,
    error: ytError,
    loading: ytLoading,
  } = useGetUserYtIntegrationSubscription()

  const [ytIntegration, setYtIntegration] = useState<YTIntegration>()

  const auth = useRecoilValue(firebaseState)

  useEffect(() => {
    if (!updatePublishError) return
    emitToast({
      type: 'error',
      title: "Couldn't update publish config",
      description: updatePublishError.message,
    })
  }, [updatePublishError])

  const initialLoad = useRef<boolean>(true)
  const debounced = useDebouncedCallback(() => {
    updatePublishConfig()
  }, 400)

  useEffect(() => {
    if (initialLoad.current) {
      initialLoad.current = false
      return
    }
    debounced()
    if (!flick) return
    setStore((prev) => ({
      ...prev,
      flick: {
        ...flick,
        fragments: flick.fragments.map((fragment) => {
          if (fragment.id === activeFragmentId) {
            return {
              ...fragment,
              publishConfig: publish,
            }
          }
          return fragment
        }),
      },
    }))
  }, [publish])

  const { baseUrl } = config.storage

  const { height, width } = useGetHW({
    maxH: bounds.height / 1.1,
    maxW: bounds.width / 1.1,
    aspectRatio:
      fragment?.type === Fragment_Type_Enum_Enum.Portrait ? 9 / 16 : 16 / 9,
  })

  const [recording, setRecording] = useState<RecordingFragment>()

  const videoRef = useRef<HTMLVideoElement>(null)
  const currentTime = useRef<number>(0)

  videoRef.current?.addEventListener('timeupdate', () => {
    currentTime.current = videoRef.current?.currentTime || 0
  })

  videoRef.current?.addEventListener('seeked', () => {
    currentTime.current = videoRef.current?.currentTime || 0
  })

  const updateCurrentTime = (time: number) => {
    if (!videoRef.current) return
    currentTime.current = time
  }

  useEffect(() => {
    if (!recording) return
    if (recording.status === Recording_Status_Enum_Enum.Processing) {
      startPolling(5000)
    } else {
      stopPolling()
    }
  }, [recording?.status])

  const downloadVideo = async () => {
    if (!recording) return
    setDownloading(true)
    axios({
      url: baseUrl + recording.url,
      method: 'GET',
      responseType: 'blob',
    }).then((response) => {
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `${recording.id}.mp4`)
      document.body.appendChild(link)
      link.click()
      setDownloading(false)
    })
  }

  const {
    data: recordingsData,
    error: getRecordingsError,
    loading: getRecordingsLoading,
    refetch,
    startPolling,
    stopPolling,
  } = useGetRecordingsQuery({
    variables: {
      flickId: activeFragment?.flickId,
      fragmentId: activeFragment?.id,
    },
  })

  const [
    completeRecording,
    { error: errorCompletingRecording, loading: loadingCompleteRecording },
  ] = useCompleteRecordingMutation()

  const completeFragmentRecording = async (recordingId: string) => {
    const { data } = await completeRecording({
      variables: {
        editorState: JSON.stringify(simpleAST),
        recordingId,
      },
    })
    if (data?.CompleteRecording?.success) await refetch()
  }

  useEffect(() => {
    if (!recordingsData?.Recording) return
    if (recordingsData.Recording.length < 1) return
    setRecording(recordingsData.Recording[0])
  }, [recordingsData])

  useEffect(() => {
    if (errorCompletingRecording) {
      emitToast({
        title: 'Error producing recording',
        description: errorCompletingRecording.message,
        type: 'error',
      })
    } else if (getRecordingsError) {
      emitToast({
        title: 'Error fetching recordings',
        description: getRecordingsError.message,
        type: 'error',
      })
    }
  }, [errorCompletingRecording, getRecordingsError])

  useEffect(() => {
    if (ytError || !ytData || ytData?.YoutubeIntegration.length === 0) {
      if (ytError)
        emitToast({
          title: 'Ops something is wrong with your Youtube Integration',
          type: 'error',
          autoClose: 5000,
        })
      return
    }
    setYtIntegration(ytData?.YoutubeIntegration[0].userInfo as YTIntegration)
    if (openIntegrationModal) setOpenIntegrationModal(false)
  }, [ytLoading, ytData])

  const [openIntegrationModal, setOpenIntegrationModal] = useState(false)

  return (
    <Modal
      open={open}
      onClose={() => {
        handleClose()
      }}
      styles={{
        modal: {
          maxWidth: '90%',
          width: '100%',
          maxHeight: '90vh',
          height: '100%',
          padding: '0',
        },
      }}
      classNames={{
        modal: cx('rounded-md m-0 p-0'),
      }}
      center
      showCloseIcon={false}
    >
      <Modal
        open={openIntegrationModal}
        onClose={() => {
          setOpenIntegrationModal(false)
        }}
        styles={{
          modal: {
            maxWidth: '90%',
            width: '320px',
            maxHeight: '90vh',
            height: '330px',
            padding: '32px',
          },
        }}
        classNames={{
          modal: cx('rounded-md m-0 p-0'),
        }}
        center
        showCloseIcon={false}
      >
        <div className=" flex flex-col items-center text-center w-full h-full">
          <Text>
            <Heading className="font-main text-2xl">
              Automatically share to Youtube
            </Heading>
            <Text className="font-body text-base pt-4">
              Publish videos you post on Incredible on Youtube too. You can
              disable this anytime.
            </Text>
          </Text>
          <div className="flex flex-col items-center mt-auto ">
            <Button
              appearance="primary"
              type="button"
              size="small"
              onClick={async () => {
                const res = await axios.get(
                  `${config.integrations.serverURL}/youtube/authorize`,
                  {
                    headers: {
                      Authorization: `Bearer ${auth.token}`,
                    },
                  }
                )
                setOpenIntegrationModal(false)
                window.open(res.data, '_blank')
              }}
            >
              Integrate Youtube
            </Button>

            <Button
              appearance="none"
              type="button"
              size="small"
              className="mt-2.5"
              onClick={() => {
                setOpenIntegrationModal(false)
              }}
            >
              Not Now
            </Button>
          </div>
        </div>
      </Modal>
      {doPublishData && (
        <>
          <Confetti fire={showConfetti} />
          <div className="flex w-full h-full items-center justify-center">
            <div
              className="flex flex-col w-full h-full items-start justify-center"
              style={{
                maxWidth: '420px',
                width: '100%',
              }}
            >
              <div className="flex mx-auto">
                <div className="h-32 w-32 bg-gray-100 rounded-full z-0" />
                <div className="z-20 w-32 h-32 -ml-32 rounded-full backdrop-filter backdrop-blur-xl" />
                <div className="z-10 w-24 h-24 -ml-10 rounded-full bg-brand" />
              </div>
              <Heading className="mb-4 font-bold text-3xl mt-12">
                Congratulations! your story is out.
              </Heading>
              <Text className="font-body">
                Your story is available in this link. You can share it with the
                world.
              </Text>
              <a
                href={`${config.auth.endpoint}/watch/${flick?.joinLink}`}
                target="_blank"
                rel="noreferrer noopener"
                className="w-full flex my-4 border p-2 rounded-md items-center justify-between text-sm gap-x-12 text-gray-600 px-4"
              >
                {`${config.auth.endpoint}/watch/${flick?.joinLink}`}
                <FiExternalLink size={21} className="mx-2" />
              </a>
            </div>
          </div>
        </>
      )}
      {!doPublishData && (
        <div className="flex flex-col w-full h-full">
          {/* Top bar */}
          <div className="flex items-center justify-between w-full pl-4 pr-2 py-2 border-b border-gray-300">
            <div className="flex items-center gap-x-4">
              <Heading>Publish</Heading>
              {updatePublishLoading ? (
                <div className="flex items-center mt-px mr-4 text-gray-400">
                  <BsCloudUpload className="mr-1" />
                  <Text fontSize="small">Saving...</Text>
                </div>
              ) : (
                <div className="flex items-center mt-px mr-4 text-gray-400">
                  <BsCloudCheck className="mr-1" />
                  <Text fontSize="small">Saved</Text>
                </div>
              )}
            </div>
            <div className="flex items-center gap-x-4">
              {flick && flick.contents.length > 0 && (
                <a
                  rel="noopener noreferrer"
                  target="_blank"
                  href={`${config.auth.endpoint}/watch/${flick?.joinLink}`}
                  className="flex items-center gap-x-2 text-sm hover:underline"
                >
                  Story page
                </a>
              )}
              {ytIntegration?.picture && (
                <Image
                  className="rounded-full h-5 w-5"
                  mainSrc={ytIntegration?.picture}
                  alt=" "
                  fallbackSrc="https://via.placeholder.com/150"
                />
              )}
              <Text> Publish to Youtube</Text>
              <Switch
                checked={enablePublishToYT}
                onClick={() => {
                  // TODO: Remove this once we have public access to the youtube data API
                  // As of now we only have added @incredible.dev to tester group
                  if (
                    !auth.auth.currentUser?.email?.includes('@incredible.dev')
                  ) {
                    emitToast({
                      title: 'Coming soon!',
                      type: 'info',
                      description: 'Publishing to Youtube is coming soon!',
                      autoClose: 5000,
                    })
                    return
                  }
                  if (!ytIntegration) {
                    setOpenIntegrationModal(true)
                  }
                }}
                onChange={() => {
                  if (ytIntegration) setEnablePublishToYT(!enablePublishToYT)
                }}
                className={`${
                  enablePublishToYT ? 'bg-green-500' : 'bg-gray-200'
                } relative inline-flex h-6 w-11 items-center rounded-full`}
                disabled={
                  !publish.title ||
                  (fragment?.type !== Fragment_Type_Enum_Enum.Portrait &&
                    !publish.description) ||
                  !recording?.id ||
                  !recording.url ||
                  recording?.status !== Recording_Status_Enum_Enum.Completed ||
                  updatePublishLoading
                }
              >
                <span
                  className={`${
                    enablePublishToYT ? 'translate-x-6' : 'translate-x-1'
                  } inline-block h-4 w-4 transform rounded-full bg-white`}
                />
              </Switch>
              <Button
                appearance="primary"
                type="button"
                size="small"
                disabled={
                  !publish.title ||
                  (fragment?.type !== Fragment_Type_Enum_Enum.Portrait &&
                    !publish.description) ||
                  !recording?.id ||
                  !recording.url ||
                  recording?.status !== Recording_Status_Enum_Enum.Completed ||
                  updatePublishLoading
                }
                loading={publishing}
                onClick={() => {
                  doPublish({
                    variables: {
                      data: publish,
                      fragmentId: activeFragmentId,
                      recordingId: recording?.id,
                      publishToYoutube: enablePublishToYT,
                    },
                  })
                }}
              >
                Publish
              </Button>
            </div>
          </div>

          <div className="flex justify-between flex-1 w-full">
            {/* Video Section */}
            <div
              className="relative flex items-center justify-center w-full bg-gray-100 "
              ref={ref}
            >
              {recording &&
              ((recording.url &&
                recording.status !== Recording_Status_Enum_Enum.Processing &&
                !getRecordingsLoading &&
                !loadingCompleteRecording) ||
                loadingCompleteRecording) ? (
                <div className="flex flex-col items-end gap-y-4">
                  <video
                    ref={videoRef}
                    height={height}
                    width={width}
                    style={{
                      minWidth: width,
                      minHeight: height,
                    }}
                    className="flex-shrink-0"
                    controls
                    autoPlay={false}
                    src={config.storage.baseUrl + recording.url}
                  />
                  <div className="flex items-center gap-x-2">
                    <Button
                      icon={IoReloadOutline}
                      appearance="gray"
                      type="button"
                      size="small"
                      onClick={() => completeFragmentRecording(recording.id)}
                      loading={loadingCompleteRecording}
                    />

                    <Button
                      size="small"
                      appearance="gray"
                      icon={HiOutlineDownload}
                      type="button"
                      onClick={downloadVideo}
                      loading={downloading}
                    />
                  </div>
                </div>
              ) : (
                recording && (
                  <div
                    className="bg-gray-300 flex items-center justify-center gap-y-4 flex-col"
                    style={{
                      width: `${width}px`,
                      height: `${height}px`,
                    }}
                  >
                    {(() => {
                      switch (recording.status) {
                        case Recording_Status_Enum_Enum.Pending:
                        case Recording_Status_Enum_Enum.Completed:
                          return (
                            <>
                              <Text className="font-body">
                                Produce video to see it here
                              </Text>
                              <Button
                                appearance="primary"
                                type="button"
                                size="small"
                                onClick={() =>
                                  completeFragmentRecording(recording.id)
                                }
                                loading={loadingCompleteRecording}
                              >
                                Produce
                              </Button>
                            </>
                          )
                        case Recording_Status_Enum_Enum.Processing:
                          return (
                            <>
                              <FiRefreshCw size={21} className="animate-spin" />
                              <Text className="font-body">Processing</Text>
                            </>
                          )
                        default:
                          return <></>
                      }
                    })()}
                  </div>
                )
              )}
            </div>
            {/* Sidebar */}
            <div className="flex">
              <div className="w-64 px-4 pt-6 bg-white">
                {activeTab.id === tabs[0].id && (
                  <DetailsTab publish={publish} setPublish={setPublish} />
                )}
                {activeTab.id === tabs[1].id && (
                  <ThumbnailTab publish={publish} setPublish={setPublish} />
                )}
                {activeTab.id === tabs[2].id && (
                  <CTATab
                    publish={publish}
                    setPublish={setPublish}
                    currentTime={currentTime.current}
                    setCurrentTime={updateCurrentTime}
                  />
                )}
              </div>
              <div
                style={{
                  width: '100px',
                }}
                className="flex h-full flex-col px-2 pt-4 bg-gray-50 gap-y-2"
              >
                {tabs.map((tab) => (
                  <button
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={cx(
                      'flex flex-col items-center bg-transparent py-4 px-1 rounded-md text-gray-500 gap-y-2 transition-all',
                      {
                        'bg-gray-200 text-gray-800': activeTab.id === tab.id,
                        'hover:bg-gray-100': activeTab.id !== tab.id,
                      }
                    )}
                    key={tab.id}
                  >
                    {getIcon(tab.id)}
                    <Text className="text-xs font-normal font-body">
                      {tab.name}
                    </Text>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}

const CTA = ({
  publish,
  setPublish,
  currentTime,
  cta,
  index,
}: {
  cta: CallToAction
  index: number
  publish: IPublish
  setPublish: React.Dispatch<React.SetStateAction<IPublish>>
  currentTime: number
}) => {
  const [time, setTime] = useState<{
    min: string | undefined
    sec: string | undefined
  }>({
    min: '00',
    sec: '00',
  })

  const [ctaPopover, setCTAPopover] = useState(false)

  const getMinuteAndSecondsFromSeconds = (s: number) => {
    const minutes = Math.floor(s / 60)
    const seconds = Math.floor(s % 60)
    return {
      minutes,
      seconds,
    }
  }
  useEffect(() => {
    const { minutes, seconds } = getMinuteAndSecondsFromSeconds(
      cta?.seconds || currentTime
    )
    setTime({
      min: minutes.toLocaleString('en-US', {
        minimumIntegerDigits: 2,
        useGrouping: false,
      }),
      sec: seconds.toLocaleString('en-US', {
        minimumIntegerDigits: 2,
        useGrouping: false,
      }),
    })
  }, [])

  const convertToSecondsAndSet = (minutes: number, seconds: number) => {
    // convert time to seconds
    const sec = minutes * 60 + seconds
    setPublish({
      ...publish,
      ctas: publish.ctas?.map((cta, i) => {
        if (i === index) {
          return {
            ...cta,
            seconds: sec,
          }
        }
        return cta
      }),
    })
  }

  return (
    <div className="mt-2">
      <Tooltip
        isOpen={ctaPopover}
        setIsOpen={setCTAPopover}
        placement="left-start"
        className="z-50"
        content={
          <div
            style={{
              width: '300px',
            }}
            className="px-4 pb-4 mr-6 bg-white border border-gray-200 rounded-sm shadow-sm z-50"
          >
            <div className="flex items-center justify-between py-2 border-b">
              <Heading className="text-sm font-bold">
                Add call to action
              </Heading>
              <IoCloseOutline
                className="ml-auto cursor-pointer"
                size={16}
                onClick={() => setCTAPopover(false)}
              />
            </div>
            <div className="flex flex-col gap-y-2 mt-2">
              <Text className="flex items-center gap-x-2 font-body text-sm">
                <HiOutlineClock />
                {time.min}:{time.sec}
              </Text>
              <Heading className="text-sm font-bold mt-2">Button text</Heading>
              <input
                className="bg-gray-100 border border-transparent py-2 px-2 rounded-sm w-full h-full focus:border-brand focus:outline-none font-body text-sm placeholder-gray-400"
                value={cta?.text}
                placeholder="Join Community"
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setPublish({
                    ...publish,
                    ctas: publish.ctas?.map((cta, i) => {
                      if (i === index) {
                        return {
                          ...cta,
                          text: e.target.value,
                        }
                      }
                      return cta
                    }),
                  })
                }
              />
              <Heading className="text-sm font-bold mt-2">Button URL</Heading>
              <input
                className="bg-gray-100 border border-transparent py-2 px-2 rounded-sm w-full h-full focus:border-brand focus:outline-none font-body text-sm placeholder-gray-400"
                value={cta?.url}
                placeholder="https://discord.gg/jJQWQs8Fh2"
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setPublish({
                    ...publish,
                    ctas: publish.ctas?.map((cta, i) => {
                      if (i === index) {
                        return {
                          ...cta,
                          url: e.target.value,
                        }
                      }
                      return cta
                    }),
                  })
                }
              />
            </div>
          </div>
        }
      >
        <div className="flex items-center bg-gray-100 w-full pr-2 rounded-sm border border-transparent justify-between focus-within:border-brand relative">
          <div className="flex items-center w-min flex-grow-0 px-3 py-1.5">
            <input
              value={time.min}
              type="number"
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                const min = e.target.value
                setTime({
                  ...time,
                  min,
                })
                if (Number.isNaN(min)) return
                convertToSecondsAndSet(Number(min), Number(time.sec))
              }}
              className={cx(
                'border-none bg-transparent text-sm font-body outline-none  focus:outline-none focus:ring-0 w-5 text-center p-0 px-px',
                noArrowInput
              )}
            />
            <span
              style={{
                marginTop: '-2px',
                marginLeft: '1px',
              }}
            >
              :
            </span>
            <input
              value={time.sec}
              type="number"
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                const sec = e.target.value
                setTime({
                  ...time,
                  sec,
                })
                if (Number.isNaN(sec)) return
                convertToSecondsAndSet(Number(time.min), Number(sec))
              }}
              className={cx(
                'border-none bg-transparent text-sm font-body outline-none focus:outline-none focus:ring-0 w-5 text-center p-0 px-px',
                noArrowInput
              )}
            />
          </div>
          <CallToActionIcon className="flex-shrink-0 absolute inset-0 m-auto right-16 top-1 opacity-50" />

          <Text
            className={cx(
              'text-sm font-body flex items-center cursor-pointer w-20 ml-1 justify-start truncate',
              {
                'text-gray-400': !cta.text,
              }
            )}
            onClick={() => {
              setCTAPopover(!ctaPopover)
            }}
          >
            {!cta.text && <IoAddOutline />}
            {cta.text || 'Add CTA'}
          </Text>
          <IoCloseOutline
            className="cursor-pointer flex-shrink-0"
            onClick={() => {
              setPublish({
                ...publish,
                ctas: publish.ctas?.filter((_, i) => i !== index),
              })
            }}
          />
        </div>
      </Tooltip>
    </div>
  )
}

const CTATab = ({
  publish,
  setPublish,
  currentTime,
  setCurrentTime,
}: {
  publish: IPublish
  setPublish: React.Dispatch<React.SetStateAction<IPublish>>
  currentTime: number
  setCurrentTime: (time: number) => void
}) => {
  return (
    <div>
      <Heading fontSize="small" className="font-bold">
        Call to action
      </Heading>
      {publish.ctas?.map((cta, index) => (
        <CTA
          publish={publish}
          setPublish={setPublish}
          currentTime={currentTime}
          cta={cta}
          index={index}
        />
      ))}
      <button
        type="button"
        className="flex items-center gap-x-2 text-gray-800 mt-4 w-max"
        onClick={() => {
          setPublish({
            ...publish,
            ctas: [
              ...(publish.ctas || []),
              {
                seconds: currentTime,
              },
            ],
          })
        }}
      >
        <IoAddOutline />
        <Text className="text-left font-main text-sm">
          Add {publish.ctas?.length > 0 && 'another'}
        </Text>
      </button>
      <Heading fontSize="small" className="mt-8 font-bold">
        Add discord link
      </Heading>
      <TextField
        placeholder="https://discord.gg/jJQWQs8Fh2"
        value={publish.discordCTA?.url}
        className="font-normal font-body text-sm"
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          setPublish({
            ...publish,
            discordCTA: {
              url: e.target.value,
              text: 'Join discord',
            },
          })
        }}
      />
    </div>
  )
}

const DetailsTab = ({
  publish,
  setPublish,
}: {
  publish: IPublish
  setPublish: React.Dispatch<React.SetStateAction<IPublish>>
}) => {
  const { flick, activeFragmentId } = useRecoilValue(newFlickStore)

  const fragment = flick?.fragments?.find((f) => f.id === activeFragmentId)

  return (
    <div>
      <Heading fontSize="small" className="font-bold">
        Title*
      </Heading>
      <textarea
        className={cx(
          'mt-2 font-body text-sm rounded-sm border border-transparent outline-none flex-1 focus:ring-0 p-2 focus:border-brand resize-none w-full bg-gray-100'
        )}
        value={publish.title}
        onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
          setPublish({
            ...publish,
            title: e.target.value,
          })
        }
      />
      {!publish.title && (
        <span className="text-xs text-red-500 italic">Title is required</span>
      )}
      {fragment?.type !== Fragment_Type_Enum_Enum.Portrait && (
        <>
          {' '}
          <Heading fontSize="small" className="font-bold mt-8">
            Description*
          </Heading>
          <textarea
            className={cx(
              'mt-2 font-body text-sm rounded-sm border border-transparent outline-none flex-1 focus:ring-0 p-2 focus:border-brand resize-none w-full bg-gray-100'
            )}
            value={publish.description}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
              setPublish({
                ...publish,
                description: e.target.value,
              })
            }
          />
          {!publish.description && (
            <span className="text-xs text-red-500 italic">
              Description is required
            </span>
          )}
        </>
      )}
    </div>
  )
}

const ThumbnailTab = ({
  publish,
  setPublish,
}: {
  publish: IPublish
  setPublish: React.Dispatch<React.SetStateAction<IPublish>>
}) => {
  const [thumbnailModal, setThumbnailModal] = useState(false)

  const [{ flick, activeFragmentId }, setStore] = useRecoilState(newFlickStore)

  const fragment = flick?.fragments?.find((f) => f.id === activeFragmentId)

  const [uploadFile] = useUploadFile()
  const [fileUploading, setFileUploading] = useState(false)
  const [updateThumbnailObject] = useUpdateThumbnailObjectMutation()

  const handleUploadFile = async (files: File[]) => {
    try {
      const file = files?.[0]
      if (!file) return

      setFileUploading(true)
      const { uuid } = await uploadFile({
        extension: file.name.split('.').pop() as any,
        file,
      })

      setFileUploading(false)
      await updateThumbnailObject({
        variables: {
          id: fragment?.id,
          thumbnailObject: uuid,
        },
      })
      setPublish({
        ...publish,
        thumbnail: {
          ...publish.thumbnail,
          objectId: uuid,
        },
      })
      if (flick)
        setStore((store) => ({
          ...store,
          flick: {
            ...flick,
            fragments: flick.fragments.map((f) => {
              if (f.id === activeFragmentId) {
                return {
                  ...f,
                  thumbnailObjectId: uuid,
                }
              }
              return f
            }),
          },
        }))
    } catch (e) {
      emitToast({
        type: 'error',
        title: 'Could not upload file',
      })
    }
  }

  const getButtonText = (method: string) => {
    if (method === 'generated') {
      return 'Generate Thumbnail'
    }
    return 'Upload Thumbnail'
  }

  return (
    <div>
      <Heading fontSize="small" className="font-bold">
        Thumbnail
      </Heading>
      <Listbox
        value={publish.thumbnail?.method || 'generated'}
        onChange={(value) =>
          setPublish({
            ...publish,
            thumbnail: {
              ...publish.thumbnail,
              method: value,
            },
          })
        }
      >
        {({ open }) => (
          <div className="relative mt-2">
            <Listbox.Button className="w-full flex gap-x-4 text-left items-center justify-between rounded-sm bg-gray-100 shadow-sm py-2 px-3 pr-8 relative text-gray-800">
              <div className="flex items-center gap-x-2 w-full">
                <Text className="text-sm block truncate font-body">
                  {getButtonText(publish.thumbnail?.method || 'generated')}
                </Text>
              </div>
              <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none ">
                {open ? <IoChevronUpOutline /> : <IoChevronDownOutline />}
              </span>
            </Listbox.Button>
            <Listbox.Options className="bg-dark-300 mt-2 rounded-md absolute w-full z-10 shadow-md">
              {['generated', 'uploaded'].map((method, index) => (
                <Listbox.Option
                  className={({ active }) =>
                    cx(
                      'flex items-center gap-x-4 py-2 px-3 pr-8 relative text-left font-body text-gray-100 cursor-pointer',
                      {
                        'bg-dark-100': active,
                        'rounded-t-md pt-3': index === 0,
                        'rounded-b-md pb-3': index === 1,
                      }
                    )
                  }
                  key={method}
                  value={method}
                >
                  {({ selected }) => (
                    <>
                      <Text className="text-sm block truncate ">
                        {getButtonText(method)}
                      </Text>
                      {selected && (
                        <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                          <BiCheck size={20} />
                        </span>
                      )}
                    </>
                  )}
                </Listbox.Option>
              ))}
            </Listbox.Options>
          </div>
        )}
      </Listbox>
      {thumbnailModal && (
        <ThumbnailModal
          open={thumbnailModal}
          handleClose={(uuid) => {
            if (uuid) {
              setPublish({
                ...publish,
                thumbnail: {
                  ...publish.thumbnail,
                  objectId: uuid,
                },
              })
              if (flick)
                setStore((store) => ({
                  ...store,
                  flick: {
                    ...flick,
                    fragments: flick.fragments.map((f) => {
                      if (f.id === activeFragmentId) {
                        return {
                          ...f,
                          thumbnailObjectId: uuid,
                        }
                      }
                      return f
                    }),
                  },
                }))
            }
            setThumbnailModal(false)
          }}
          isPublishFlow
        />
      )}

      {publish.thumbnail?.method === 'generated' && (
        <button
          className={cx(
            'flex flex-col items-center justify-center text-sm w-full  mt-2 rounded-md  gap-y-2',
            {
              'border border-dashed py-8': !publish.thumbnail?.objectId,
            }
          )}
          type="button"
          onClick={() => {
            setThumbnailModal(true)
          }}
        >
          {publish.thumbnail?.objectId ? (
            <div className="relative group flex flex-col items-center justify-center w-full h-full">
              <img
                className="w-full rounded-md"
                alt="thumbnail"
                src={`${config.storage.baseUrl}${publish.thumbnail?.objectId}`}
              />
              <div className="absolute bg-black opacity-50 w-full h-full hidden group-hover:block rounded-md" />
              <span className="absolute my-auto z-10 top-0 bottom-0 text-white w-full h-full items-center justify-center hidden group-hover:flex">
                Regenerate
              </span>
            </div>
          ) : (
            <>
              <IoImageOutline size={21} />
              Generate thumbnail
            </>
          )}
        </button>
      )}
      {publish.thumbnail?.method === 'uploaded' && (
        <Dropzone onDrop={handleUploadFile} accept={['image/*']} maxFiles={1}>
          {({ getRootProps, getInputProps }) => (
            <div
              tabIndex={-1}
              onKeyUp={() => {}}
              role="button"
              className={cx(
                'flex flex-col items-center  mt-2  rounded-md cursor-pointer',
                {
                  'p-3 border border-gray-200 border-dashed':
                    !fileUploading && !publish.thumbnail?.objectId,
                }
              )}
              {...getRootProps()}
            >
              <input {...getInputProps()} />
              {fileUploading && (
                <FiLoader className={cx('animate-spin my-6')} size={16} />
              )}
              {!fileUploading && !publish.thumbnail?.objectId && (
                <>
                  <FiUploadCloud size={21} className="my-2 text-gray-600" />

                  <div className="text-center ">
                    <Text className="text-xs text-gray-600 font-body">
                      Drag and drop or
                    </Text>
                    <Text className="text-xs font-semibold text-gray-800">
                      browse
                    </Text>
                  </div>
                </>
              )}
              {!fileUploading && publish.thumbnail?.objectId && (
                <div className="relative group flex flex-col items-center justify-center w-full h-full">
                  <img
                    className="w-full rounded-md"
                    alt="thumbnail"
                    src={`${config.storage.baseUrl}${publish.thumbnail?.objectId}`}
                  />
                  <div className="absolute bg-black opacity-50 w-full h-full hidden group-hover:block rounded-md" />
                  <span className="absolute my-auto z-10 top-0 bottom-0 text-white w-full h-full items-center justify-center hidden group-hover:flex">
                    Upload
                  </span>
                </div>
              )}
            </div>
          )}
        </Dropzone>
      )}
    </div>
  )
}

export default Publish
