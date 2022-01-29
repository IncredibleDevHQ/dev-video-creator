/* eslint-disable jsx-a11y/media-has-caption */
/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */

import { css, cx } from '@emotion/css'
import { Listbox } from '@headlessui/react'
import FontPicker from 'font-picker-react'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { HexColorInput, HexColorPicker } from 'react-colorful'
import Dropzone from 'react-dropzone'
import { IconType } from 'react-icons'
import { BiCheck } from 'react-icons/bi'
import { BsCloudUpload, BsCloudCheck } from 'react-icons/bs'
import { FiLoader, FiUploadCloud } from 'react-icons/fi'
import {
  IoAddOutline,
  IoChevronDownOutline,
  IoChevronUpOutline,
  IoCloseCircle,
  IoCloseOutline,
  IoColorPaletteOutline,
  IoPlayOutline,
  IoShapesOutline,
  IoTabletLandscapeOutline,
  IoTrashOutline,
} from 'react-icons/io5'
import Modal from 'react-responsive-modal'
import useMeasure from 'react-use-measure'
import { useDebouncedCallback } from 'use-debounce'
import { ReactComponent as BrandIcon } from '../../assets/BrandIcon.svg'
import { Button, Heading, Text, Tooltip } from '../../components'
import config from '../../config'
import {
  GetBrandingQuery,
  useCreateBrandingMutation,
  useDeleteBrandingMutation,
  useGetBrandingQuery,
  useUpdateBrandingMutation,
} from '../../generated/graphql'
import { useUploadFile } from '../../hooks'
import useDidUpdateEffect from '../../hooks/use-did-update-effect'
import BrandPreview from './BrandPreview'

export interface BrandingJSON {
  colors?: {
    primary?: string
    secondary?: string
    tertiary?: string
    transition?: string
    text?: string
  }
  background?: {
    type?: 'image' | 'video' | 'color'
    url?: string
    color?: {
      primary?: string
      secondary?: string
      tertiary?: string
    }
  }
  logo?: string
  companyName?: string
  font?: {
    heading?: {
      family: string
      type: 'google' | 'custom'
    }
    body?: {
      family: string
      type: 'google' | 'custom'
    }
  }
  introVideoUrl?: string
}

const initialValue: BrandingJSON = {}

type B = GetBrandingQuery['Branding'][0]

export interface BrandingInterface extends B {
  branding?: BrandingJSON | null
}

interface Tab {
  name: string
  id: string
  Icon: IconType
}

const tabs: Tab[] = [
  {
    id: 'Logo',
    name: 'Logo',
    Icon: IoShapesOutline,
  },
  {
    id: 'Background',
    name: 'Background',
    Icon: IoTabletLandscapeOutline,
  },
  {
    id: 'Color',
    name: 'Color',
    Icon: IoColorPaletteOutline,
  },
  // {
  //   id: 'Font',
  //   name: 'Font',
  //   Icon: IoTextOutline,
  // },
  {
    id: 'IntroVideo',
    name: 'Intro Video',
    Icon: IoPlayOutline,
  },
]

const colorPickerStyle = css`
  .react-colorful__saturation {
    border-radius: 4px;
    width: 268px;
  }

  .react-colorful__hue {
    margin-top: 10px;
    height: 16px;
    border-radius: 4px;
    width: 268px;
  }

  .react-colorful__saturation-pointer {
    width: 16px;
    height: 16px;
  }

  .react-colorful__hue-pointer {
    width: 16px;
    height: 16px;
  }
`

const BrandingPage = ({
  open,
  handleClose,
}: {
  open: boolean
  handleClose: () => void
}) => {
  const [ref, bounds] = useMeasure()

  const [brandingId, setBrandingId] = useState<string>()
  const [activeTab, setActiveTab] = useState<Tab>(tabs[0])

  const [brandings, setBrandings] = useState<BrandingInterface[]>([])

  const { data, loading: fetching, refetch } = useGetBrandingQuery()

  const [createBranding, { loading }] = useCreateBrandingMutation()

  const [deleteBrandingMutation, { loading: deletingBrand }] =
    useDeleteBrandingMutation()
  const deleteBranding = async () => {
    if (!branding) return
    await deleteBrandingMutation({
      variables: {
        id: branding.id,
      },
    })
    refetch()
  }

  const debounced = useDebouncedCallback(
    // function
    () => {
      handleSave()
    },
    1000
  )

  useDidUpdateEffect(() => {
    debounced()
  }, [brandings])

  const [updateBranding, { loading: updatingBrand }] =
    useUpdateBrandingMutation()

  const branding = useMemo(() => {
    return brandings.find((branding) => branding.id === brandingId)
  }, [brandings, brandingId])

  useEffect(() => {
    setBrandings(data?.Branding || [])

    if (!brandingId || !data?.Branding.find((b) => b.id === brandingId)) {
      setBrandingId(data?.Branding?.[0]?.id)
    }
  }, [data])

  const handleCreateBranding = async () => {
    const { data } = await createBranding({
      variables: { name: 'Untitled Branding', branding: initialValue },
    })
    await refetch()
    setBrandingId(data?.insert_Branding_one?.id)
  }

  const handleSave = async (cache?: boolean) => {
    if (!branding) return
    await updateBranding({
      fetchPolicy: cache ? 'network-only' : 'no-cache',
      variables: {
        branding: branding.branding,
        name: branding.name,
        id: branding.id,
      },
    })
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        handleSave(true)
        handleClose()
      }}
      styles={{
        modal: {
          maxWidth: '90%',
          width: '100%',
          maxHeight: '85vh',
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
      <div className="flex flex-col h-full w-full">
        {fetching && (
          <div className="h-full w-full flex items-center justify-center">
            <FiLoader className={cx('animate-spin my-6')} size={16} />
          </div>
        )}
        {!fetching && (
          <>
            <div className="flex justify-between items-center w-full border-b border-gray-300 py-2 px-4">
              <div className="flex items-center gap-x-4">
                <Text className="font-bold font-main">Brand assets</Text>
                {updatingBrand ? (
                  <div className="flex text-gray-400 items-center mr-4 mt-px">
                    <BsCloudUpload className="mr-1" />
                    <Text fontSize="small">Saving...</Text>
                  </div>
                ) : (
                  <div className="flex text-gray-400 items-center mr-4 mt-px">
                    <BsCloudCheck className="mr-1" />
                    <Text fontSize="small">Saved</Text>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-x-2">
                <Button
                  icon={loading ? undefined : IoAddOutline}
                  appearance="none"
                  type="button"
                  className="text-gray-800"
                  onClick={handleCreateBranding}
                  disabled={loading}
                >
                  {loading ? (
                    <FiLoader className={cx('animate-spin')} size={20} />
                  ) : (
                    <Text className="text-sm">Add new</Text>
                  )}
                </Button>
                {/* <Button
                  onClick={handleSave}
                  appearance="primary"
                  type="button"
                  size="small"
                  disabled={updatingBrand}
                  loading={updatingBrand}
                  className=""
                >
                  <Text className="text-sm">Done</Text>
                </Button> */}
              </div>
            </div>
            <div className="flex flex-1 w-full justify-between">
              <div
                className=" flex items-center justify-start pl-12 relative w-full bg-gray-100"
                ref={ref}
              >
                {branding && (
                  <BrandPreview bounds={bounds} branding={branding} />
                )}
                {brandings && (
                  <div className="absolute top-0 right-0 m-4 w-60">
                    <Listbox
                      value={branding}
                      onChange={(value) => setBrandingId(value?.id)}
                    >
                      {({ open }) => (
                        <div className="relative mt-1">
                          <Listbox.Button className="w-full flex gap-x-4 text-left items-center justify-between border rounded-sm bg-white shadow-sm py-1.5 px-3 pr-8 relative">
                            <div className="flex items-center gap-x-2 w-full">
                              <BrandIcon className="flex-shrink-0" />
                              <input
                                value={branding?.name}
                                className="text-sm block truncate border border-transparent hover:border-gray-300 focus:outline-none"
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={(e) => e.stopPropagation()}
                                onChange={(e) => {
                                  if (branding)
                                    setBrandings((brandings) => {
                                      return brandings.map((b) =>
                                        b.id === branding.id
                                          ? {
                                              ...branding,
                                              name: e.target.value,
                                            }
                                          : b
                                      )
                                    })
                                }}
                              />
                            </div>
                            <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none ">
                              {open ? (
                                <IoChevronUpOutline />
                              ) : (
                                <IoChevronDownOutline />
                              )}
                            </span>
                          </Listbox.Button>
                          <Listbox.Options className="bg-dark-300 mt-2 rounded-md">
                            {brandings.map((brand, index) => (
                              <Listbox.Option
                                className={({ active }) =>
                                  cx(
                                    'flex items-center gap-x-4 py-2 px-3 pr-8 relative text-left font-body text-gray-100 cursor-pointer',
                                    {
                                      'bg-dark-100': active,
                                      'rounded-t-md pt-3': index === 0,
                                      'rounded-b-md pb-3':
                                        index === brandings.length - 1,
                                    }
                                  )
                                }
                                key={brand.id}
                                value={brand}
                              >
                                {({ selected }) => (
                                  <>
                                    <BrandIcon className="flex-shrink-0" />
                                    <Text className="text-sm block truncate ">
                                      {brand.name}
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
                  </div>
                )}
              </div>
              <div className="flex">
                {branding && (
                  <div className="bg-white w-64 pt-6 px-4">
                    {activeTab === tabs[0] && (
                      <LogoSetting
                        branding={branding}
                        setBranding={(branding) => {
                          setBrandings((brandings) => {
                            return brandings.map((b) =>
                              b.id === branding.id ? branding : b
                            )
                          })
                        }}
                      />
                    )}
                    {activeTab === tabs[1] && (
                      <BackgroundSetting
                        branding={branding}
                        setBranding={(branding) => {
                          setBrandings((brandings) => {
                            return brandings.map((b) =>
                              b.id === branding.id ? branding : b
                            )
                          })
                        }}
                      />
                    )}
                    {activeTab === tabs[2] && (
                      <ColorSetting
                        branding={branding}
                        setBranding={(branding) => {
                          setBrandings((brandings) => {
                            return brandings.map((b) =>
                              b.id === branding.id ? branding : b
                            )
                          })
                        }}
                      />
                    )}
                    {/* {activeTab === tabs[3] && (
                      <FontSetting
                        branding={branding}
                        setBranding={(branding) => {
                          setBrandings((brandings) => {
                            return brandings.map((b) =>
                              b.id === branding.id ? branding : b
                            )
                          })
                        }}
                      />
                    )} */}
                    {activeTab === tabs[3] && (
                      <IntroVideoSetting
                        branding={branding}
                        setBranding={(branding) => {
                          setBrandings((brandings) => {
                            return brandings.map((b) =>
                              b.id === branding.id ? branding : b
                            )
                          })
                        }}
                      />
                    )}
                  </div>
                )}
                <div className="flex flex-col bg-gray-50 px-2 pt-4 gap-y-2 relative">
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
                      <Text className="font-body font-normal text-xs">
                        {tab.name}
                      </Text>
                    </button>
                  ))}
                  <div
                    onClick={deleteBranding}
                    className="-ml-2 py-2 w-full bg-red-500 bottom-0 flex items-center justify-center absolute cursor-pointer"
                  >
                    <Button
                      appearance="none"
                      icon={IoTrashOutline}
                      type="button"
                      size="extraSmall"
                      disabled={deletingBrand}
                      loading={deletingBrand}
                      className="text-white"
                    />
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}

const BackgroundSetting = ({
  branding,
  setBranding,
}: {
  branding: BrandingInterface
  setBranding: (branding: BrandingInterface) => void
}) => {
  const [colorPicker, setColorPicker] = useState(false)
  const [uploadFile] = useUploadFile()
  const [hover, setHover] = useState(false)
  const [fileUploading, setFileUploading] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (!videoRef.current) return
    if (hover) {
      videoRef.current.play()
    } else {
      videoRef.current.pause()
      videoRef.current.currentTime = 0
    }
  }, [hover])

  const handleColorChange = (color: string) => {
    setBranding({
      ...branding,
      branding: {
        ...branding.branding,
        background: {
          ...branding?.branding?.background,
          type:
            branding?.branding?.background?.type === 'video' ||
            branding?.branding?.background?.type === 'image'
              ? branding?.branding?.background?.type
              : 'color',
          color: {
            ...branding?.branding?.background?.color,
            primary: color,
          },
        },
      },
    })
  }

  const handleUploadFile = async (files: File[]) => {
    const file = files?.[0]
    if (!file) return

    let fileType: 'image' | 'video' = 'image'
    if (file.type.startsWith('image')) fileType = 'image'
    else fileType = 'video'

    setFileUploading(true)
    const { url } = await uploadFile({
      extension: file.name.split('.').pop() as any,
      file,
    })

    setFileUploading(false)
    setBranding({
      ...branding,
      branding: {
        ...branding.branding,
        background: {
          ...branding?.branding?.background,
          type: fileType,
          url,
        },
      },
    })
  }

  return (
    <div className="flex flex-col">
      <Heading fontSize="small" className="font-bold">
        Background
      </Heading>
      <Tooltip
        content={
          <div
            style={{
              width: '300px',
            }}
            className="border border-gray-200 shadow-sm bg-white mr-6 mt-1 p-4 rounded-sm"
          >
            <IoCloseOutline
              className="ml-auto cursor-pointer"
              size={16}
              onClick={() => setColorPicker(false)}
            />
            <Text className="text-sm font-bold">Custom color</Text>
            <HexColorPicker
              className={cx('mt-2', colorPickerStyle)}
              color={branding.branding?.background?.color?.primary || '#000'}
              onChange={handleColorChange}
            />
            <HexColorInput
              color={branding.branding?.background?.color?.primary || '#000'}
              className="font-body text-xs w-full text-center bg-gray-100 focus:border-brand transition-colors focus:outline-none rounded p-2 mt-3"
              onChange={handleColorChange}
            />
            <div className="border-t my-4 border-gray-200" />
            {branding.branding?.background?.url ? (
              <div
                className="relative ring-1 ring-offset-1 ring-gray-100 rounded-sm"
                style={{ height: '150px', width: '268px' }}
              >
                <IoCloseCircle
                  className="absolute top-0 right-0 text-red-500 -m-1.5 cursor-pointer block z-10 bg-white rounded-full"
                  size={16}
                  onClick={() => {
                    setBranding({
                      ...branding,
                      branding: {
                        ...branding.branding,
                        background: undefined,
                      },
                    })
                  }}
                />
                {branding.branding?.background?.type === 'image' ? (
                  <img
                    src={branding.branding?.background?.url || ''}
                    alt="backgroundImage"
                    className="w-full h-full object-contain rounded-md"
                  />
                ) : (
                  <video
                    className="rounded-sm object-cover h-full w-full"
                    src={branding.branding?.background?.url || ''}
                    controls
                  />
                )}
              </div>
            ) : (
              <>
                <Text className="text-sm font-bold">Upload image</Text>
                <Dropzone
                  onDrop={handleUploadFile}
                  accept={['image/*']}
                  maxFiles={1}
                >
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
                        <FiLoader
                          className={cx('animate-spin my-6')}
                          size={16}
                        />
                      ) : (
                        <>
                          <FiUploadCloud
                            size={21}
                            className="my-2 text-gray-600"
                          />

                          <div className="z-50 text-center ">
                            <Text className="font-body text-xs text-gray-600">
                              Drag and drop or
                            </Text>
                            <Text className="font-semibold text-xs text-gray-800">
                              browse
                            </Text>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </Dropzone>
              </>
            )}
          </div>
        }
        isOpen={colorPicker}
        setIsOpen={setColorPicker}
        placement="left-start"
      >
        <div
          onClick={() => setColorPicker(!colorPicker)}
          style={{
            backgroundColor:
              branding.branding?.background?.type === 'color'
                ? branding.branding?.background?.color?.primary
                : '#fff',
          }}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          className="flex items-center justify-center h-16 w-1/2 mt-2 cursor-pointer ring-1 ring-offset-1 ring-gray-100 rounded-sm relative"
        >
          {branding.branding?.background && (
            <IoCloseCircle
              className="absolute top-0 right-0 text-red-500 -m-1.5 cursor-pointer block z-10 bg-white rounded-full"
              size={16}
              onClick={(e) => {
                e.stopPropagation()
                setBranding({
                  ...branding,
                  branding: {
                    ...branding.branding,
                    background: undefined,
                  },
                })
              }}
            />
          )}
          {!branding.branding?.background && (
            <IoAddOutline size={21} className="text-gray-500" />
          )}
          {branding.branding?.background?.type === 'image' && (
            <img
              src={branding.branding?.background?.url || ''}
              alt="backgroundImage"
              className="w-full h-full object-contain rounded-md"
            />
          )}
          {branding.branding?.background?.type === 'video' && (
            <video
              ref={videoRef}
              className="rounded-sm object-cover h-full w-full"
              src={branding.branding?.background?.url || ''}
              muted
            />
          )}
        </div>
      </Tooltip>
    </div>
  )
}

const ColorPicker = ({
  color,
  onChange,
  setColorPicker,
}: {
  color: string
  onChange: (newColor: string) => void
  setColorPicker: React.Dispatch<React.SetStateAction<boolean>>
}) => {
  return (
    <div
      style={{
        width: '300px',
      }}
      className="border border-gray-200 shadow-sm bg-white mr-6 mt-1 p-4 rounded-sm"
    >
      <IoCloseOutline
        className="ml-auto cursor-pointer"
        size={16}
        onClick={() => setColorPicker(false)}
      />
      <Text className="text-sm font-bold">Custom color</Text>
      <HexColorPicker
        className={cx('mt-2', colorPickerStyle)}
        color={color}
        onChange={onChange}
      />
      <HexColorInput
        color={color}
        className="font-body text-xs w-full text-center bg-gray-100 focus:border-brand transition-colors focus:outline-none rounded p-2 mt-3"
        onChange={onChange}
      />
    </div>
  )
}

const settings: Setting[] = [
  {
    category: 'Surface Color',
    types: ['primary'],
  },
  {
    category: 'Text Color',
    types: ['text'],
  },
  {
    category: 'Transition Color',
    types: ['transition'],
  },
]

interface Setting {
  category: string
  types: ('primary' | 'secondary' | 'text' | 'transition')[]
}

const ColorSetting = ({
  branding,
  setBranding,
}: {
  branding: BrandingInterface
  setBranding: (branding: BrandingInterface) => void
}) => {
  const [colorPicker, setColorPicker] = useState(false)
  const [colorType, setColorType] = useState<string>()

  return (
    <div className="flex flex-col">
      {settings.map((setting, index) => {
        return (
          <div
            key={setting.category}
            className={cx('flex flex-col', {
              'mt-10': index !== 0,
            })}
          >
            <Heading fontSize="small" className="font-bold">
              {setting.category}
            </Heading>
            <div className="">
              {setting.types.map((type) => {
                return (
                  <Tooltip
                    isOpen={colorPicker && type === colorType}
                    setIsOpen={setColorPicker}
                    placement="left-start"
                    content={
                      <ColorPicker
                        color={branding.branding?.colors?.[type] || '#000'}
                        onChange={(newColor: string) => {
                          setBranding({
                            ...branding,
                            branding: {
                              ...branding.branding,
                              colors: {
                                ...branding.branding?.colors,
                                [type]: newColor,
                              },
                            },
                          })
                        }}
                        setColorPicker={setColorPicker}
                      />
                    }
                  >
                    <div
                      onClick={() => {
                        setColorType(type)
                        setColorPicker(!colorPicker)
                      }}
                      style={{
                        backgroundColor:
                          branding.branding?.colors?.[type] || '',
                      }}
                      className="relative flex items-center justify-center h-16 w-1/2 mt-2 cursor-pointer ring-1 ring-offset-1 ring-gray-100 rounded-sm"
                    >
                      {branding.branding?.colors?.[type] && (
                        <IoCloseCircle
                          className="absolute top-0 right-0 text-red-500 -m-1.5 cursor-pointer block z-10 bg-white rounded-full"
                          size={16}
                          onClick={(e) => {
                            e.stopPropagation()
                            setBranding({
                              ...branding,
                              branding: {
                                ...branding.branding,
                                colors: {
                                  ...branding.branding?.colors,
                                  [type]: undefined,
                                },
                              },
                            })
                          }}
                        />
                      )}
                      {!branding.branding?.colors?.[type] && (
                        <IoAddOutline size={21} className="text-gray-500" />
                      )}
                    </div>
                  </Tooltip>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

const LogoSetting = ({
  branding,
  setBranding,
}: {
  branding: BrandingInterface
  setBranding: (branding: BrandingInterface) => void
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null)
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
    setBranding({ ...branding, branding: { ...branding.branding, logo: url } })
  }

  return (
    <div className="flex flex-col">
      <Heading fontSize="small" className="font-bold">
        Logo
      </Heading>
      {!branding.branding?.logo ? (
        <>
          <Dropzone onDrop={handleUploadFile} accept="image/*" maxFiles={1}>
            {({ getRootProps, getInputProps }) => (
              <div
                tabIndex={-1}
                onKeyUp={() => {}}
                role="button"
                className="flex flex-col items-center p-4 my-3 border border-gray-200 border-dashed rounded-md cursor-pointer"
                {...getRootProps()}
              >
                <input {...getInputProps()} />
                {fileUploading ? (
                  <FiLoader className={cx('animate-spin my-6')} size={16} />
                ) : (
                  <>
                    <FiUploadCloud size={21} className="my-2 text-gray-600" />

                    <div className="z-50 text-center ">
                      <Text className="font-body text-xs text-gray-600">
                        Drag and drop or
                      </Text>
                      <Text className="font-semibold text-xs text-gray-800">
                        browse
                      </Text>
                    </div>
                  </>
                )}
              </div>
            )}
          </Dropzone>
        </>
      ) : (
        <>
          <div
            onClick={() => inputRef.current?.click()}
            style={{ background: branding.branding?.logo }}
            className="w-1/2 h-16 rounded-md border border-gray-200 p-4 mt-2 relative"
          >
            <IoCloseCircle
              className="absolute top-0 right-0 text-red-500 -m-1.5 cursor-pointer block z-10 bg-white rounded-full"
              size={16}
              onClick={() => {
                setBranding({
                  ...branding,
                  branding: {
                    ...branding.branding,
                    logo: undefined,
                  },
                })
              }}
            />
            {branding.branding?.logo && (
              <img
                className="h-full w-full object-contain"
                src={branding.branding.logo}
                alt="Logo"
              />
            )}
          </div>
        </>
      )}
    </div>
  )
}

const IntroVideoSetting = ({
  branding,
  setBranding,
}: {
  branding: BrandingInterface
  setBranding: (branding: BrandingInterface) => void
}) => {
  const [uploadFile] = useUploadFile()

  const [fileUploading, setFileUploading] = useState(false)

  const [hover, setHover] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (!videoRef.current) return
    if (hover) {
      videoRef.current.play()
    } else {
      videoRef.current.pause()
      videoRef.current.currentTime = 0
    }
  }, [hover])

  const handleUploadFile = async (files: File[]) => {
    const file = files?.[0]
    if (!file) return

    setFileUploading(true)
    const { url } = await uploadFile({
      extension: file.name.split('.').pop() as any,
      file,
    })

    setFileUploading(false)
    setBranding({
      ...branding,
      branding: { ...branding.branding, introVideoUrl: url },
    })
  }
  return (
    <div className="flex flex-col">
      <Heading fontSize="small" className="font-bold">
        Logo animation
      </Heading>
      {!branding.branding?.introVideoUrl ? (
        <>
          <Dropzone onDrop={handleUploadFile} accept="video/*" maxFiles={1}>
            {({ getRootProps, getInputProps }) => (
              <div
                tabIndex={-1}
                onKeyUp={() => {}}
                role="button"
                className="flex flex-col items-center p-4 my-2 border border-gray-200 border-dashed rounded-md cursor-pointer"
                {...getRootProps()}
              >
                <input {...getInputProps()} />
                {fileUploading ? (
                  <FiLoader className={cx('animate-spin my-6')} size={16} />
                ) : (
                  <>
                    <FiUploadCloud size={21} className="my-2 text-gray-600" />

                    <div className="z-50 text-center ">
                      <Text className="font-body text-xs text-gray-600">
                        Drag and drop or
                      </Text>
                      <Text className="font-semibold text-xs text-gray-800">
                        browse
                      </Text>
                    </div>
                  </>
                )}
              </div>
            )}
          </Dropzone>
        </>
      ) : (
        <>
          <div
            className="flex items-center justify-center w-1/2 h-16 rounded-md border border-gray-200 mt-2 cursor-pointer relative"
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
          >
            <IoCloseCircle
              className="absolute top-0 right-0 text-red-500 -m-1.5 cursor-pointer block z-10 bg-white rounded-full"
              size={16}
              onClick={() => {
                setBranding({
                  ...branding,
                  branding: {
                    ...branding.branding,
                    introVideoUrl: undefined,
                  },
                })
              }}
            />
            <video
              ref={videoRef}
              className="rounded-sm object-cover "
              src={branding.branding?.introVideoUrl || ''}
              muted
            />
          </div>
        </>
      )}
    </div>
  )
}

const FontSetting = ({
  branding,
  setBranding,
}: {
  branding: BrandingInterface
  setBranding: (branding: BrandingInterface) => void
}) => {
  return (
    <div className="flex flex-col">
      <Heading fontSize="small" className="font-bold mb-2">
        Heading
      </Heading>
      <FontPicker
        activeFontFamily={branding.branding?.font?.heading?.family}
        onChange={(font) => {
          setBranding({
            ...branding,
            branding: {
              ...branding.branding,
              font: {
                ...branding?.branding?.font,
                heading: {
                  type: 'google',
                  family: font.family,
                },
              },
            },
          })
        }}
        apiKey={config.googleFonts.apiKey}
      />
      <Heading fontSize="small" className="font-bold mb-2 mt-10">
        Body
      </Heading>
      <FontPicker
        activeFontFamily={branding.branding?.font?.body?.family}
        onChange={(font) => {
          setBranding({
            ...branding,
            branding: {
              ...branding.branding,
              font: {
                ...branding?.branding?.font,
                body: {
                  type: 'google',
                  family: font.family,
                },
              },
            },
          })
        }}
        apiKey={config.googleFonts.apiKey}
      />
    </div>
  )
}

export default BrandingPage
