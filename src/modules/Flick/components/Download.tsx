/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import { css, cx } from '@emotion/css'
import { Listbox, Transition } from '@headlessui/react'
import axios from 'axios'
import React, { Fragment, HTMLAttributes, useEffect, useState } from 'react'
import { HiSelector } from 'react-icons/hi'
import Modal from 'react-responsive-modal'
import { useRecoilValue } from 'recoil'
import { Button, emitToast, ThumbnailPreview } from '../../../components'
import config from '../../../config'
import { ASSETS } from '../../../constants'
import {
  OrientationEnum,
  useDownloadZipMutation,
  useZipStatusQuery,
} from '../../../generated/graphql'
import { newFlickStore } from '../store/flickNew.store'

interface Resolution {
  id: string
  name: string
  description: string
  isRecommended: boolean
}

const resolutions: Resolution[] = [
  {
    id: '1080',
    name: 'Youtube 1080p',
    description: 'Good for social media and streaming sites',
    isRecommended: true,
  },
  {
    id: '960',
    name: 'Medium 960p',
    description: 'Good for local viewing',
    isRecommended: false,
  },
]

const HorizontalContainer = ({
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cx(
      'flex items-center overflow-x-scroll overflow-y-hidden',
      css`
        -ms-overflow-style: none;
        scrollbar-width: none;
        ::-webkit-scrollbar {
          display: none;
        }
      `,
      className
    )}
    {...rest}
  />
)

const Download = ({
  open,
  handleClose,
}: {
  open: boolean
  handleClose: (refresh?: boolean) => void
}) => {
  const [selectedResolution, setSelectedResolution] = useState(resolutions[0])
  const [selectedFormats, setSelectedFormats] = useState<string[]>([])
  const { flick, activeFragmentId } = useRecoilValue(newFlickStore)
  const [isDownloading, setIsDownloading] = useState(false)

  const { baseUrl } = config.storage

  const [downloadZip, { data: downloadZipData }] = useDownloadZipMutation()
  const {
    data: zipSubscription,
    startPolling,
    stopPolling,
  } = useZipStatusQuery({
    variables: { flickId: flick?.id },
  })

  const activeFragment = flick?.fragments.find(
    (fragment) => fragment.id === activeFragmentId
  )

  const video = activeFragment?.producedLink
  const shorts = activeFragment?.producedShortsLink

  useEffect(() => {
    if (
      zipSubscription?.Flick[0]?.downloadTasks?.status === 'Completed' &&
      zipSubscription?.Flick[0]?.downloadTasks?.zip &&
      downloadZipData?.DownloadFlick?.success
    ) {
      ;(async () => {
        try {
          axios({
            url: `${baseUrl}tmp/${zipSubscription?.Flick[0].downloadTasks.zip}`,
            method: 'GET',
            responseType: 'blob',
          }).then((response) => {
            const url = window.URL.createObjectURL(new Blob([response.data]))
            const link = document.createElement('a')
            link.href = url
            link.setAttribute('download', 'videos.zip')
            document.body.appendChild(link)
            link.click()
          })
        } catch (error: any) {
          console.error(error)
          emitToast({
            type: 'error',
            title: 'Something went wrong!',
            description: error.message,
          })
        } finally {
          setIsDownloading(false)
          stopPolling()
          handleClose(true)
        }
      })()
    }
  }, [zipSubscription?.Flick[0].downloadTasks?.status, downloadZipData])

  useEffect(() => {
    return () => {
      setSelectedResolution(resolutions[0])
      setSelectedFormats([])
      setIsDownloading(false)
    }
  }, [])

  const downloadVideos = async () => {
    if (selectedFormats.length < 1) return
    try {
      setIsDownloading(true)

      if (selectedFormats.length === 1) {
        axios({
          url: baseUrl + selectedFormats[0],
          method: 'GET',
          responseType: 'blob',
        }).then((response) => {
          const url = window.URL.createObjectURL(new Blob([response.data]))
          const link = document.createElement('a')
          link.href = url
          link.setAttribute('download', selectedFormats[0])
          document.body.appendChild(link)
          link.click()
          setIsDownloading(true)
          handleClose(true)
        })
      } else {
        await downloadZip({
          variables: {
            flickId: flick?.id,
            objectNames: selectedFormats,
          },
        })

        startPolling(5000)
      }
    } catch (error: any) {
      emitToast({
        type: 'error',
        title: 'Something went wrong!',
        description: error.message,
      })
      setIsDownloading(false)
      console.error(error)
    }
  }

  if (!activeFragment) return null

  return (
    <Modal
      open={open}
      onClose={handleClose}
      center
      classNames={{
        modal: cx(
          'rounded-lg w-1/2 max-w-md mx-auto p-4',
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
      <div>
        <h2>Download</h2>
        <hr />
        <h4 className="mt-2">Landscape</h4>
        <HorizontalContainer>
          <div
            className={cx(
              'flex justify-center items-center rounded-md border-2 border-transparent hover:border-gray-400',
              {
                'opacity-60 cursor-not-allowed': !video,
                'border-brand hover:border-brand':
                  !!video && !!selectedFormats.includes(video),
              }
            )}
            onClick={() => {
              if (video) {
                const isVideo = !!selectedFormats.includes(video)
                if (isVideo) {
                  setSelectedFormats((prev) =>
                    prev.filter((format) => format !== video)
                  )
                } else setSelectedFormats([...selectedFormats, video])
              }
            }}
          >
            <ThumbnailPreview
              backgroundImageSource={`${baseUrl}meta/${flick?.id}/${activeFragment?.id}-storyboard-${OrientationEnum.Landscape}.png`}
              posterImageSource={`${baseUrl}meta/${flick?.id}/${activeFragment?.id}-thumbnail-${OrientationEnum.Landscape}.png`}
              className="rounded-md"
              orientation={OrientationEnum.Landscape}
              totalImages={50}
              size={{
                width: 150,
                height: 84,
              }}
              scale={1.5}
            />
          </div>
        </HorizontalContainer>
        <h4 className="mt-2">Portrait</h4>
        <HorizontalContainer>
          <div
            className={cx(
              'flex justify-center items-center rounded-md border-2 border-transparent hover:border-gray-400',
              {
                'opacity-60 cursor-not-allowed': !shorts,
                'border-brand hover:border-brand':
                  !!shorts && !!selectedFormats.includes(shorts),
              }
            )}
            onClick={() => {
              if (shorts) {
                const isShorts = !!selectedFormats.includes(shorts)
                if (isShorts) {
                  setSelectedFormats((prev) =>
                    prev.filter((format) => format !== shorts)
                  )
                } else setSelectedFormats([...selectedFormats, shorts])
              }
            }}
          >
            <ThumbnailPreview
              backgroundImageSource={`${baseUrl}meta/${flick?.id}/${activeFragment?.id}-storyboard-${OrientationEnum.Portrait}.png`}
              posterImageSource={`${baseUrl}meta/${flick?.id}/${activeFragment?.id}-thumbnail-${OrientationEnum.Portrait}.png`}
              className="rounded-md"
              orientation={OrientationEnum.Landscape}
              totalImages={50}
              size={{
                width: 150,
                height: 84,
              }}
              scale={1.5}
            />
          </div>
        </HorizontalContainer>
        <h4 className="mt-2">Resolution</h4>
        <Listbox value={selectedResolution} onChange={setSelectedResolution}>
          <div className="relative my-2">
            <Listbox.Button className="relative w-full flex justify-between items-center rounded-md border-2 border-dark-200 p-2">
              <div className="text-left">
                <h3 className="block truncate text-gray-900 font-bold text-lg">
                  {selectedResolution.name}
                  {selectedResolution.isRecommended && (
                    <span className="ml-2 bg-brand-10 rounded-md text-brand p-0.5 text-sm">
                      Recommended
                    </span>
                  )}
                </h3>
                <p className="text-gray-800 text-sm">
                  {selectedResolution.description}
                </p>
              </div>
              <HiSelector className="text-gray-600" size={20} />
            </Listbox.Button>
            <Transition
              as={Fragment}
              leave="transition ease-in duration-100"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <Listbox.Options className="w-full mt-1 overflow-auto bg-white rounded-md shadow-lg max-h-60 ring-1 ring-black ring-opacity-5 focus:outline-none">
                {resolutions.map((resolution) => (
                  <Listbox.Option
                    key={resolution.id}
                    value={resolution}
                    disabled={resolution.id !== '1080'}
                  >
                    {({ selected, active }) => (
                      <div
                        className={cx('p-2', {
                          'bg-gray-200': selected,
                          'bg-gray-100': !selected && active,
                          'opacity-60 cursor-not-allowed':
                            resolution.id !== '1080',
                        })}
                      >
                        <h3 className="block truncate text-gray-900 font-bold text-lg">
                          {resolution.name}
                          {resolution.isRecommended ? (
                            <span className="ml-2 bg-brand-10 rounded-md text-brand p-0.5 text-sm">
                              Recommended
                            </span>
                          ) : (
                            <span className="ml-2 bg-warning rounded-md text-white opacity-75 p-0.5 text-sm">
                              Coming Soon
                            </span>
                          )}
                        </h3>
                        <p className="text-gray-800 text-sm">
                          {resolution.description}
                        </p>
                      </div>
                    )}
                  </Listbox.Option>
                ))}
              </Listbox.Options>
            </Transition>
          </div>
        </Listbox>
        <Button
          type="button"
          appearance="primary"
          className="w-full"
          loading={isDownloading}
          disabled={selectedFormats.length < 1}
          onClick={downloadVideos}
        >
          Download {selectedFormats.length > 0 ? selectedFormats.length : null}{' '}
          videos
        </Button>
      </div>
    </Modal>
  )
}

export default Download
