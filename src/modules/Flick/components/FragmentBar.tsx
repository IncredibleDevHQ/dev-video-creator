import { cx } from '@emotion/css'
import React, { useEffect, useState } from 'react'
import { BiPlayCircle } from 'react-icons/bi'
import { BsDot } from 'react-icons/bs'
import { HiOutlineSparkles } from 'react-icons/hi'
import { IoIosCheckmarkCircle } from 'react-icons/io'
import { IoChevronDown, IoChevronUp, IoPlayOutline } from 'react-icons/io5'
import { MdRadioButtonUnchecked } from 'react-icons/md'
import { useHistory } from 'react-router-dom'
import { useRecoilState } from 'recoil'
import { FragmentVideoModal } from '.'
import { Button, emitToast, Text, Tooltip } from '../../../components'
import {
  FlickFragmentFragment,
  Fragment_Type_Enum_Enum,
  useUpdateFragmentMarkdownMutation,
  useUpdateFragmentStateMutation,
} from '../../../generated/graphql'
import { ViewConfig } from '../../../utils/configTypes2'
import { newFlickStore } from '../store/flickNew.store'
import { IntroOutroConfiguration } from './IntroOutroView'

const dashArray = 10 * Math.PI * 2

const FragmentBar = ({
  config,
  markdown,
  plateValue,
  setViewConfig,
  introConfig,
}: {
  plateValue?: any
  markdown?: string
  config: ViewConfig
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
      } else {
        if (!plateValue || plateValue?.length === 0) return
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
                      editorState: plateValue,
                    }
                  : f
              ),
            },
          }))
        await updateFragmentMarkdown({
          variables: {
            fragmentId: activeFragmentId,
            md: markdown,
          },
        })
        await updateFragmentState({
          variables: {
            editorState: plateValue,
            id: activeFragmentId,
            configuration: config,
          },
        })
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

  const [blockLength, setBlockLength] = useState(0)

  useEffect(() => {
    if (!plateValue) return
    setBlockLength(
      plateValue.content.filter((c: any) => c.type === 'slab').length
    )
  }, [plateValue])

  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="flex items-center justify-between pr-4 pl-5 p-2">
      {fragment &&
      fragment?.type !== Fragment_Type_Enum_Enum.Intro &&
      fragment?.type !== Fragment_Type_Enum_Enum.Outro ? (
        <Text className="font-body text-gray-600 text-sm flex items-center transition-all ease-in-out duration-1000">
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
      )}
      {flick && flick?.fragments?.length > 0 && (
        <Tooltip
          isOpen={isOpen}
          setIsOpen={setIsOpen}
          content={
            <div className="bg-white rounded-md shadow-lg flex flex-col mt-2 gap-y-2 border border-gray-100">
              <button
                type="button"
                onClick={() => {
                  setViewConfig({ ...config, mode: 'Landscape' })
                }}
                className="flex gap-x-4 px-4 py-3 hover:bg-gray-100 cursor-pointer"
              >
                <div className="bg-brand bg-opacity-10 p-2.5 rounded-sm">
                  <IoPlayOutline size={24} className="text-brand " />
                </div>
                <div>
                  <Text className="font-bold font-main flex items-center gap-x-3">
                    Flick
                    {config.mode === 'Landscape' ? (
                      <IoIosCheckmarkCircle className="text-brand" size={18} />
                    ) : (
                      <MdRadioButtonUnchecked className="text-gray-300" />
                    )}
                  </Text>
                  <div className="text-sm font-body flex items-center gap-x-1 text-gray-600">
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
                }}
                className="flex gap-x-4 px-4 py-3 hover:bg-gray-100 cursor-pointer"
              >
                <div className="bg-cyan-600 bg-opacity-10 p-2.5 rounded-sm">
                  <HiOutlineSparkles size={24} className="text-cyan-600" />
                </div>
                <div>
                  <Text className="font-bold font-main flex items-center gap-x-3">
                    Highlight
                    {config.mode === 'Portrait' ? (
                      <IoIosCheckmarkCircle className="text-brand" size={18} />
                    ) : (
                      <MdRadioButtonUnchecked className="text-gray-300" />
                    )}
                  </Text>
                  <div className="text-sm font-body flex items-center gap-x-1 text-gray-600">
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
          <div className="flex rounded-sm items-center bg-gray-50 border border-gray-100 py-1 px-4 gap-x-4">
            {fragment &&
              fragment?.type !== Fragment_Type_Enum_Enum.Intro &&
              fragment?.type !== Fragment_Type_Enum_Enum.Outro && (
                <button
                  onClick={() => setIsOpen(!isOpen)}
                  type="button"
                  className="flex items-center gap-x-2 hover:bg-gray-100 rounded-sm p-1 cursor-pointer"
                >
                  {config.mode === 'Landscape' ? (
                    <div className="bg-brand bg-opacity-10 p-2.5 rounded-sm">
                      <IoPlayOutline size={24} className="text-brand " />
                    </div>
                  ) : (
                    <div className="bg-cyan-600 bg-opacity-10 p-2.5 rounded-sm">
                      <HiOutlineSparkles size={24} className="text-cyan-600" />
                    </div>
                  )}
                  <Text className="font-bold font-main">
                    {config.mode === 'Landscape' ? 'Flick' : 'Highlight'}
                  </Text>
                  {isOpen ? <IoChevronUp /> : <IoChevronDown />}
                </button>
              )}
            <Button
              appearance="primary"
              size="small"
              type="button"
              className="py-1 my-1.5"
              loading={savingConfig}
              onClick={() => updateConfig()}
            >
              Save
            </Button>
            {fragment?.producedLink && (
              <div
                tabIndex={-1}
                role="button"
                onKeyDown={() => {}}
                className="flex items-center mr-4 border border-green-600 rounded-sm px-2 cursor-pointer"
                onClick={() => {
                  setFragmentVideoModal(true)
                }}
              >
                <BiPlayCircle size={32} className="text-green-600 py-1" />
              </div>
            )}
            <button
              className="border-red-600 text-red-600 border rounded-sm py-2 px-2.5 flex items-center gap-x-2 font-bold hover:shadow-md"
              type="button"
              onClick={() => history.push(`/${activeFragmentId}/studio`)}
              disabled={!fragment?.configuration}
            >
              <img src="/src/assets/StartRecord.svg" alt="start" />
              {fragment?.producedLink ? 'Retake' : 'Record'}
            </button>
          </div>
        </Tooltip>
      )}
      <FragmentVideoModal
        open={fragmentVideoModal}
        handleClose={() => {
          setFragmentVideoModal(false)
        }}
      />
    </div>
  )
}

export default FragmentBar
