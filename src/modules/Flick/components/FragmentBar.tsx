import React, { useEffect, useState } from 'react'
import { BiPlayCircle } from 'react-icons/bi'
import { BsDot } from 'react-icons/bs'
import { HiOutlineSparkles } from 'react-icons/hi'
import { IoIosCheckmarkCircle } from 'react-icons/io'
import { IoPlayOutline } from 'react-icons/io5'
import { MdRadioButtonUnchecked } from 'react-icons/md'
import { useHistory } from 'react-router-dom'
import { useRecoilState } from 'recoil'
import { FragmentVideoModal } from '.'
import { ReactComponent as ReRecordIcon } from '../../../assets/ReRecord.svg'
import { ReactComponent as RecordIcon } from '../../../assets/StartRecord.svg'
import { Button, emitToast, Text, Tooltip } from '../../../components'
import { TextEditorParser } from '../../../components/TempTextEditor/utils'
import {
  Content_Type_Enum_Enum,
  FlickFragmentFragment,
  Fragment_Type_Enum_Enum,
  useUpdateFlickMarkdownMutation,
  useUpdateFragmentMarkdownMutation,
  useUpdateFragmentStateMutation,
} from '../../../generated/graphql'
import { ViewConfig } from '../../../utils/configTypes'
import { newFlickStore } from '../store/flickNew.store'
import { IntroOutroConfiguration } from './IntroOutroView'

// const dashArray = 10 * Math.PI * 2

const FragmentBar = ({
  config,
  markdown,
  editorValue,
  setViewConfig,
  plateValue,
  introConfig,
}: {
  editorValue?: string
  markdown?: string
  config: ViewConfig
  plateValue?: any
  setViewConfig: React.Dispatch<React.SetStateAction<ViewConfig>>
  introConfig: IntroOutroConfiguration
}) => {
  const [fragmentVideoModal, setFragmentVideoModal] = useState(false)
  const [{ flick, activeFragmentId }, setFlickStore] =
    useRecoilState(newFlickStore)
  const history = useHistory()

  const [fragment, setFragment] = useState<FlickFragmentFragment | undefined>(
    flick?.fragments.find((f) => f.id === activeFragmentId)
  )

  const [updateFragmentMarkdown] = useUpdateFragmentMarkdownMutation()
  const [updateFlickMarkdown] = useUpdateFlickMarkdownMutation()

  const [updateFragmentState, { data, error }] =
    useUpdateFragmentStateMutation()

  const [savingConfig, setSavingConfig] = useState(false)

  useEffect(() => {
    const f = flick?.fragments.find((f) => f.id === activeFragmentId)
    setFragment(f)
  }, [activeFragmentId, flick])

  useEffect(() => {
    if (!data) return
    emitToast({
      type: 'success',
      title: 'Configuration saved',
    })
  }, [data])

  useEffect(() => {
    if (!error) return
    emitToast({
      type: 'error',
      title: 'Error saving configuration',
    })
  }, [error])

  const updateConfig = async () => {
    setSavingConfig(true)
    try {
      if (
        fragment &&
        (fragment?.type === Fragment_Type_Enum_Enum.Intro ||
          fragment?.type === Fragment_Type_Enum_Enum.Outro)
      ) {
        await updateFragmentState({
          variables: {
            editorState: {},
            id: activeFragmentId,
            configuration: introConfig,
          },
        })
        if (flick)
          setFlickStore((store) => ({
            ...store,
            flick: {
              ...flick,
              fragments: flick.fragments.map((f) =>
                f.id === activeFragmentId
                  ? {
                      ...f,
                      configuration: config,
                    }
                  : f
              ),
            },
          }))
      } else {
        if (!editorValue || editorValue?.length === 0) return
        await updateFragmentMarkdown({
          variables: {
            fragmentId: activeFragmentId,
            md: markdown,
          },
        })
        await updateFlickMarkdown({
          variables: {
            id: flick?.id,
            md: editorValue,
          },
        })
        await updateFragmentState({
          variables: {
            editorState: plateValue,
            id: activeFragmentId,
            configuration: config,
          },
        })
        if (flick)
          setFlickStore((store) => ({
            ...store,
            flick: {
              ...flick,
              fragments: flick.fragments.map((f) =>
                f.id === activeFragmentId
                  ? {
                      ...f,
                      configuration: config,
                      editorState: editorValue,
                    }
                  : f
              ),
            },
          }))
      }
    } catch (error) {
      emitToast({
        type: 'error',
        title: 'Error updating fragment',
      })
    } finally {
      setSavingConfig(false)
    }
  }

  // const [blockLength, setBlockLength] = useState(0)
  // const utils = useUtils()

  // useEffect(() => {
  //   if (!editorValue) return
  //   const { blocks } = utils.getSimpleAST(editorValue)
  //   setBlockLength(blocks.length)
  // }, [editorValue])

  const [isOpen, setIsOpen] = useState(false)

  const [mode, setMode] = useState<Content_Type_Enum_Enum>(
    Content_Type_Enum_Enum.Video
  )

  useEffect(() => {
    if (config.mode === 'Portrait') {
      setMode(Content_Type_Enum_Enum.VerticalVideo)
    } else {
      setMode(Content_Type_Enum_Enum.Video)
    }
  }, [config.mode])

  return (
    <div className="sticky flex items-center justify-between p-2 pl-5 pr-4">
      {/* {fragment &&
      fragment?.type !== Fragment_Type_Enum_Enum.Intro &&
      fragment?.type !== Fragment_Type_Enum_Enum.Outro ? (
        <Text className="flex items-center text-sm text-gray-600 transition-all duration-1000 ease-in-out font-body">
          <svg className="w-10 h-10">
            <circle
              className="text-gray-300"
              strokeWidth="2"
              stroke="currentColor"
              fill="transparent"
              r="10"
              cx="20"
              cy="20"
            />
            <circle
              className={cx('text-brand transition-all duration-500', {
                'text-red-600': Object.keys(config.blocks).length >= 3,
              })}
              strokeWidth="2"
              style={{
                strokeDasharray: 10 * Math.PI * 2,
                strokeDashoffset:
                  dashArray +
                  (dashArray * (blockLength < 4 ? blockLength : 4) * 25) / 100,
              }}
              transform="rotate(-90 20 20)"
              strokeLinecap="round"
              stroke="currentColor"
              fill="transparent"
              r="10"
              cx="20"
              cy="20"
            />
          </svg>
          {(() => {
            if (blockLength >= 4) return 'Large'
            if (blockLength === 3) return 'Big'
            if (blockLength === 2) return 'Great'
            if (blockLength === 1) return 'Small'
            if (blockLength === 0) return 'Empty'
            return 'Great'
          })()}
        </Text>
      ) : (
        <div />
      )} */}
      <div />
      {flick && flick?.fragments?.length > 0 && (
        <Tooltip
          isOpen={isOpen}
          setIsOpen={setIsOpen}
          content={
            <div className="flex flex-col mt-2 bg-white border border-gray-100 rounded-md shadow-lg gap-y-1">
              <button
                type="button"
                onClick={() => {
                  setViewConfig({ ...config, mode: 'Landscape' })
                  setIsOpen(false)
                }}
                className="flex items-center px-4 py-3 cursor-pointer gap-x-4 hover:bg-gray-100"
              >
                <div className="bg-brand bg-opacity-10 p-2.5 rounded-sm">
                  <IoPlayOutline size={18} className="text-brand " />
                </div>
                <div>
                  <Text className="flex items-center font-bold font-main gap-x-3">
                    Flick
                    {fragment?.producedLink ? (
                      <IoIosCheckmarkCircle className="text-brand" size={18} />
                    ) : (
                      <MdRadioButtonUnchecked className="text-gray-300" />
                    )}
                  </Text>
                  <div className="flex items-center text-sm text-gray-600 font-body gap-x-1">
                    <Text className="text-sm">16:9</Text>
                    <BsDot className="text-gray-400" size={21} />
                    <Text className="text-sm">Max 3m</Text>
                    <BsDot className="text-gray-400" size={21} />
                    <Text className="text-sm">Good for youtube</Text>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setViewConfig({ ...config, mode: 'Portrait' })
                  setIsOpen(false)
                }}
                className="flex items-center px-4 py-3 cursor-pointer gap-x-4 hover:bg-gray-100"
              >
                <div className="bg-cyan-600 bg-opacity-10 p-2.5 rounded-sm">
                  <HiOutlineSparkles size={18} className="text-cyan-600" />
                </div>
                <div>
                  <Text className="flex items-center font-bold font-main gap-x-3">
                    Highlight
                    {fragment?.producedShortsLink ? (
                      <IoIosCheckmarkCircle className="text-brand" size={18} />
                    ) : (
                      <MdRadioButtonUnchecked className="text-gray-300" />
                    )}
                  </Text>
                  <div className="flex items-center text-sm text-gray-600 font-body gap-x-1">
                    <Text className="text-sm">9:16</Text>
                    <BsDot className="text-gray-400" size={21} />
                    <Text className="text-sm">Max 1m</Text>
                    <BsDot className="text-gray-400" size={21} />
                    <Text className="text-sm">
                      Good for stories, shorts and Tiktok
                    </Text>
                  </div>
                </div>
              </button>
            </div>
          }
          placement="bottom-end"
        >
          <div className="flex items-center px-4 py-1 border border-gray-100 rounded-sm bg-gray-50 gap-x-4">
            {fragment &&
              fragment?.type !== Fragment_Type_Enum_Enum.Intro &&
              fragment?.type !== Fragment_Type_Enum_Enum.Outro && (
                <button
                  onClick={() => setIsOpen(!isOpen)}
                  type="button"
                  className="flex items-center p-1 rounded-sm cursor-pointer gap-x-2 hover:bg-gray-100"
                >
                  {config.mode === 'Landscape' ? (
                    <div className="bg-brand bg-opacity-10 p-2.5 rounded-sm">
                      <IoPlayOutline size={18} className="text-brand " />
                    </div>
                  ) : (
                    <div className="bg-cyan-600 bg-opacity-10 p-2.5 rounded-sm">
                      <HiOutlineSparkles size={18} className="text-cyan-600" />
                    </div>
                  )}
                  <Text className="font-bold font-main">
                    {config.mode === 'Landscape' ? 'Flick' : 'Highlight'}
                  </Text>
                  {checkHasContent(fragment, mode) ? (
                    <IoIosCheckmarkCircle className="text-brand" size={18} />
                  ) : (
                    <MdRadioButtonUnchecked className="text-gray-300" />
                  )}
                </button>
              )}
            <Button
              appearance="primary"
              size="small"
              type="button"
              loading={savingConfig}
              onClick={() => updateConfig()}
            >
              <Text className="text-sm">Save</Text>
            </Button>
            {fragment?.producedLink && mode === Content_Type_Enum_Enum.Video && (
              <div
                tabIndex={-1}
                role="button"
                onKeyDown={() => {}}
                className="flex items-center px-2 bg-gray-600 border rounded-sm cursor-pointer"
                onClick={() => {
                  setFragmentVideoModal(true)
                }}
              >
                <BiPlayCircle size={36} className="py-1 text-gray-200" />
              </div>
            )}
            {fragment?.producedShortsLink &&
              mode === Content_Type_Enum_Enum.VerticalVideo && (
                <div
                  tabIndex={-1}
                  role="button"
                  onKeyDown={() => {}}
                  className="flex items-center bg-gray-600 border rounded-sm cursor-pointer h-9"
                  onClick={() => {
                    setFragmentVideoModal(true)
                  }}
                >
                  <BiPlayCircle
                    size={21}
                    className="p-px mx-px text-gray-200"
                  />
                </div>
              )}
            <button
              className="border-red-600 text-red-600 border rounded-sm py-1.5 px-2.5 flex items-center gap-x-2 font-bold hover:shadow-md text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              type="button"
              onClick={() => {
                history.push(`/${activeFragmentId}/studio`)
              }}
              disabled={checkDisabledState(fragment, plateValue)}
            >
              {checkHasContent(fragment, mode) ? (
                <ReRecordIcon className="w-6 h-6 " />
              ) : (
                <RecordIcon className="w-6 h-6" />
              )}
              {!checkHasContent(fragment, mode) && 'Record'}
            </button>
          </div>
        </Tooltip>
      )}
      {fragmentVideoModal && (
        <FragmentVideoModal
          open={fragmentVideoModal}
          handleClose={() => {
            setFragmentVideoModal(false)
          }}
          contentType={mode}
        />
      )}
    </div>
  )
}

const checkDisabledState = (
  fragment: FlickFragmentFragment | undefined,
  editorValue: any
) => {
  if (!fragment) return true
  if (
    fragment.type === Fragment_Type_Enum_Enum.Intro ||
    fragment.type === Fragment_Type_Enum_Enum.Outro
  ) {
    if (fragment.configuration) return false
    return true
  }

  if (
    editorValue &&
    new TextEditorParser(editorValue).isValid() &&
    editorValue.blocks.length > 0
  )
    return false

  return true
}

const checkHasContent = (
  fragment: FlickFragmentFragment | undefined,
  mode: Content_Type_Enum_Enum
) => {
  switch (mode) {
    case Content_Type_Enum_Enum.Video:
      if (fragment?.producedLink) return true
      break

    case Content_Type_Enum_Enum.VerticalVideo:
      if (fragment?.producedShortsLink) return true
      break

    default:
      return false
  }
  return false
}

export default FragmentBar
