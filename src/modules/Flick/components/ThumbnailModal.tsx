/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import { css, cx } from '@emotion/css'
import { saveAs } from 'file-saver'
import Konva from 'konva'
import React, { ChangeEvent, useEffect, useRef, useState } from 'react'
import Dropzone from 'react-dropzone'
import { IconType } from 'react-icons'
import { BsCloudCheck, BsCloudUpload } from 'react-icons/bs'
import { CgProfile } from 'react-icons/cg'
import { FiLayout, FiLoader, FiUploadCloud } from 'react-icons/fi'
import { HiOutlineDownload } from 'react-icons/hi'
import { IoCloseCircle } from 'react-icons/io5'
import { MdOutlineTextFields } from 'react-icons/md'
import { Layer, Stage } from 'react-konva'
import { Modal } from 'react-responsive-modal'
import useMeasure from 'react-use-measure'
import {
  useRecoilBridgeAcrossReactRoots_UNSTABLE,
  useRecoilState,
  useRecoilValue,
} from 'recoil'
import { useDebouncedCallback } from 'use-debounce'
import { Button, emitToast, Heading, Text } from '../../../components'
import { useUpdateThumbnailMutation } from '../../../generated/graphql'
import { useUploadFile } from '../../../hooks'
import { userState } from '../../../stores/user.store'
import {
  IntroBlockView,
  IntroBlockViewProps,
  Layout,
} from '../../../utils/configTypes'
import { CONFIG } from '../../Studio/components/Concourse'
import Thumbnail from '../../Studio/components/Thumbnail'
import { getIntegerHW } from '../../Studio/Studio'
import { newFlickStore } from '../store/flickNew.store'
import { LayoutSelector } from './BlockPreview'

interface Tab {
  name: string
  id: string
  Icon: IconType
}

const tabs: Tab[] = [
  {
    id: 'Layout',
    name: 'Layout',
    Icon: FiLayout,
  },
  {
    id: 'Content',
    name: 'Content',
    Icon: MdOutlineTextFields,
  },
  {
    id: 'Picture',
    name: 'Picture',
    Icon: CgProfile,
  },
]

type ThumbnailProps = IntroBlockViewProps & { layout: Layout }

const ThumbnailModal = ({
  open,
  handleClose,
}: {
  open: boolean
  handleClose: () => void
}) => {
  Konva.pixelRatio = 2
  const stageRef = useRef<Konva.Stage>(null)

  const Bridge = useRecoilBridgeAcrossReactRoots_UNSTABLE()

  const [activeTab, setActiveTab] = useState<Tab>(tabs[0])
  const user = useRecoilValue(userState)

  const [thumbnailConfig, setThumbnailConfig] = useState<ThumbnailProps>({
    heading: '',
    name: '',
    designation: '',
    layout: 'bottom-right-tile',
    organization: '',
    displayPicture: user?.picture || undefined,
  })

  const [{ flick, activeFragmentId }, setStore] = useRecoilState(newFlickStore)
  const fragment = flick?.fragments.find((f) => f.id === activeFragmentId)
  const [updatingThumbnail, setUpdatingThumbnail] = useState(false)
  const [updateThumbnail] = useUpdateThumbnailMutation()

  const initialLoad = useRef<boolean>(true)
  const debounced = useDebouncedCallback(() => {
    updateConfig()
  }, 400)

  const updateConfig = async () => {
    setUpdatingThumbnail(true)
    try {
      if (flick)
        setStore((prev) => ({
          ...prev,
          flick: {
            ...flick,
            fragments: flick.fragments.map((fragment) => {
              if (fragment.id === activeFragmentId) {
                return {
                  ...fragment,
                  thumbnailConfig,
                }
              }
              return fragment
            }),
          },
        }))
      await updateThumbnail({
        variables: {
          id: fragment?.id,
          thumbnailConfig,
        },
      })
    } catch (e) {
      emitToast({
        title: 'Failed to update thumbnail',
        description: 'Click here to retry',
        type: 'error',
        onClick: () => updateConfig(),
        autoClose: 5000,
      })
    } finally {
      setUpdatingThumbnail(false)
    }
  }

  useEffect(() => {
    if (initialLoad.current) {
      initialLoad.current = false
      return
    }
    debounced()
  }, [thumbnailConfig])

  useEffect(() => {
    const config = flick?.fragments.find(
      (f) => f.id === activeFragmentId
    )?.thumbnailConfig
    if (config) {
      setThumbnailConfig(config)
    }
  }, [fragment?.thumbnailConfig])

  const [ref, bounds] = useMeasure()

  const { height, width } = getIntegerHW({
    maxH: bounds.height / 1.1,
    maxW: bounds.width / 1.1,
    aspectRatio: 16 / 9,
    isShorts: false,
  })

  return (
    <Modal
      open={open}
      onClose={() => {
        handleClose()
      }}
      center
      styles={{
        modal: {
          height: '100%',
          maxHeight: '90vh',
          maxWidth: '90%',
          padding: 0,
        },
      }}
      classNames={{
        modal: cx(
          'rounded-md w-full',
          css`
            background-color: #ffffff !important;
          `
        ),
        closeButton: css`
          svg {
            fill: #000000;
          }
        `,
      }}
      showCloseIcon={false}
    >
      <div className="w-full h-full flex flex-col">
        <div>
          <div className="flex justify-between items-center pl-4 pr-2 py-2">
            <div className="flex items-center gap-x-4">
              <Heading>Thumbnail</Heading>
              {updatingThumbnail ? (
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
            <Button
              appearance="none"
              type="button"
              icon={HiOutlineDownload}
              iconSize={20}
              onClick={() => {
                if (!stageRef.current) return
                const dataURL = stageRef.current.toDataURL({
                  pixelRatio: 1920 / width,
                })
                saveAs(dataURL, 'thumbnail.png')
              }}
            />
          </div>
          <hr className="w-full h-0.5 bg-gray-300" />
        </div>
        <section className="flex flex-1 justify-between w-full">
          <div
            ref={ref}
            className="relative flex items-center justify-center w-full bg-gray-100"
          >
            <Stage
              ref={stageRef}
              className="border"
              height={height || 1}
              width={width || 1}
              scale={{
                x: height / CONFIG.height,
                y: width / CONFIG.width,
              }}
            >
              <Bridge>
                <Layer>
                  <Thumbnail
                    viewConfig={{
                      layout: thumbnailConfig.layout,
                      view: {
                        type: 'introBlock',
                        intro: {
                          ...thumbnailConfig,
                        },
                      } as IntroBlockView,
                    }}
                    isShorts={false}
                  />
                </Layer>
              </Bridge>
            </Stage>
          </div>
          <div className="flex">
            <div className="w-64 bg-white">
              {activeTab === tabs[0] && (
                <LayoutSelector
                  mode="Landscape"
                  layout={thumbnailConfig.layout}
                  updateLayout={(layout: Layout) => {
                    setThumbnailConfig({
                      ...thumbnailConfig,
                      layout,
                    })
                  }}
                  type="introBlock"
                />
              )}
              {activeTab === tabs[1] && (
                <ContentView
                  thumbnailConfig={thumbnailConfig}
                  setThumbnailConfig={setThumbnailConfig}
                />
              )}
              {activeTab === tabs[2] && (
                <PictureTab
                  thumbnailConfig={thumbnailConfig}
                  setThumbnailConfig={setThumbnailConfig}
                />
              )}
            </div>
            <div className="flex flex-col px-2 pt-4 bg-gray-50 gap-y-2 w-24">
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
                  <tab.Icon size={21} />
                  <Text className="text-xs font-normal font-body">
                    {tab.name}
                  </Text>
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>
    </Modal>
  )
}

const PictureTab = ({
  thumbnailConfig,
  setThumbnailConfig,
}: {
  thumbnailConfig: ThumbnailProps
  setThumbnailConfig: (thumbnailConfig: ThumbnailProps) => void
}) => {
  const [uploadFile] = useUploadFile()
  const [fileUploading, setFileUploading] = useState(false)

  const handleUploadFile = async (files: File[]) => {
    const file = files?.[0]
    if (!file) return

    setFileUploading(true)
    const { url } = await uploadFile({
      extension: file.name.split('.').pop() as any,
      file,
    })

    setFileUploading(false)
    setThumbnailConfig({
      ...thumbnailConfig,
      displayPicture: url,
    })
  }
  return (
    <div className="flex flex-col pt-6 px-4">
      <Heading fontSize="small" className="font-bold">
        Picture
      </Heading>
      {thumbnailConfig.displayPicture ? (
        <div className="relative rounded-sm ring-1 ring-offset-1 ring-gray-100 w-1/2 mt-2">
          <IoCloseCircle
            className="absolute top-0 right-0 text-red-500 -m-1.5 cursor-pointer block z-10 bg-white rounded-full"
            size={16}
            onClick={() => {
              setThumbnailConfig({
                ...thumbnailConfig,
                displayPicture: undefined,
              })
            }}
          />
          <img
            src={thumbnailConfig.displayPicture || ''}
            alt="backgroundImage"
            className="object-contain w-full h-full rounded-md"
          />
        </div>
      ) : (
        <Dropzone onDrop={handleUploadFile} accept={['image/*']} maxFiles={1}>
          {({ getRootProps, getInputProps }) => (
            <div
              tabIndex={-1}
              onKeyUp={() => {}}
              role="button"
              className="flex flex-col items-center p-3 mt-2 border border-gray-200 border-dashed rounded-md cursor-pointer"
              {...getRootProps()}
            >
              <input {...getInputProps()} />
              {fileUploading ? (
                <FiLoader className={cx('animate-spin my-6')} size={16} />
              ) : (
                <>
                  <FiUploadCloud size={21} className="my-2 text-gray-600" />

                  <div className="z-50 text-center ">
                    <Text className="text-xs text-gray-600 font-body">
                      Drag and drop or
                    </Text>
                    <Text className="text-xs font-semibold text-gray-800">
                      browse
                    </Text>
                  </div>
                </>
              )}
            </div>
          )}
        </Dropzone>
      )}
    </div>
  )
}

const ContentView = ({
  thumbnailConfig,
  setThumbnailConfig,
}: {
  thumbnailConfig: ThumbnailProps
  setThumbnailConfig: (thumbnailConfig: ThumbnailProps) => void
}) => {
  return (
    <div className="flex flex-col pt-6 px-4">
      <Heading fontSize="small" className="font-bold">
        Heading
      </Heading>
      <textarea
        value={thumbnailConfig.heading}
        onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
          setThumbnailConfig({
            ...thumbnailConfig,
            heading: e.target.value,
          })
        }
        className={cx(
          'mt-2 font-body text-sm rounded-sm border border-transparent outline-none flex-1 focus:ring-0 p-2 focus:border-brand resize-none w-full bg-gray-100'
        )}
      />
      <Heading fontSize="small" className="font-bold mt-8">
        Name
      </Heading>
      <input
        className="bg-gray-100 mt-1.5 border border-transparent py-2 px-2 rounded-sm w-full h-full focus:border-brand focus:outline-none font-body text-sm placeholder-gray-400"
        value={thumbnailConfig.name}
        onChange={(e: ChangeEvent<HTMLInputElement>) =>
          setThumbnailConfig({
            ...thumbnailConfig,
            name: e.target.value,
          })
        }
      />
      <Heading fontSize="small" className="font-bold mt-8">
        Designation
      </Heading>
      <textarea
        value={thumbnailConfig.designation}
        onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
          setThumbnailConfig({
            ...thumbnailConfig,
            designation: e.target.value,
          })
        }
        className={cx(
          'mt-2 font-body text-sm rounded-sm border border-transparent outline-none flex-1 focus:ring-0 p-2 focus:border-brand resize-none w-full bg-gray-100'
        )}
      />
      <Heading fontSize="small" className="font-bold mt-8">
        Organization
      </Heading>
      <input
        className="bg-gray-100 mt-1.5 border border-transparent py-2 px-2 rounded-sm w-full h-full focus:border-brand focus:outline-none font-body text-sm placeholder-gray-400"
        value={thumbnailConfig.organization}
        onChange={(e: ChangeEvent<HTMLInputElement>) =>
          setThumbnailConfig({
            ...thumbnailConfig,
            organization: e.target.value,
          })
        }
      />
    </div>
  )
}

export default ThumbnailModal
