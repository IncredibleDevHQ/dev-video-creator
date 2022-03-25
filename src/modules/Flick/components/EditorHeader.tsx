import { cx } from '@emotion/css'
import React, { useState } from 'react'
import { FiX } from 'react-icons/fi'
import { IoPersonCircleOutline } from 'react-icons/io5'
import { useRecoilState, useRecoilValue } from 'recoil'
import { useDebouncedCallback } from 'use-debounce'
import { Text, Tooltip } from '../../../components'
import {
  FlickFragmentFragment,
  FlickParticipantsFragment,
  useUpdateFlickMutation,
} from '../../../generated/graphql'
import { logEvent } from '../../../utils/analytics'
import { PageEvent } from '../../../utils/analytics-types'
import { ViewConfig } from '../../../utils/configTypes'
import { studioStore } from '../../Studio/stores'
import { Block, Position } from '../editor/utils/utils'
import { newFlickStore } from '../store/flickNew.store'

const SpeakersTooltip = ({
  speakers,
  addSpeaker,
  close,
}: {
  speakers: FlickParticipantsFragment[]
  addSpeaker: (speaker: FlickParticipantsFragment) => void
  close?: () => void
}) => {
  const { flick } = useRecoilValue(newFlickStore)

  return (
    <div className="flex flex-col bg-white rounded-lg shadow-2xl font-body">
      {flick?.participants
        .filter((p) => !speakers?.some((s) => s.id === p.id))
        .map((participant, index) => (
          <div
            role="button"
            tabIndex={0}
            onKeyDown={() => null}
            className={cx(
              'flex items-center px-4 transition-colors hover:bg-gray-100 gap-x-2 py-2',
              {
                'rounded-t-lg': index === 0,
                'rounded-b-lg': index === flick.participants.length - 1,
              }
            )}
            key={participant.id}
            onClick={() => {
              if (participant) {
                addSpeaker(participant)
                close?.()
              }
            }}
          >
            <img
              src={participant.user.picture as string}
              alt={participant.user.displayName as string}
              className="w-6 h-6 rounded-full"
            />
            <Text className="text-sm">{participant.user.displayName}</Text>
          </div>
        ))}
    </div>
  )
}

const EditorHeader = ({
  viewConfig,
  setViewConfig,
  activeFragment,
  blocks,
  setCurrentBlock,
  setPreviewPosition,
}: {
  blocks: Block[]
  setCurrentBlock: React.Dispatch<React.SetStateAction<Block | undefined>>
  viewConfig: ViewConfig
  setViewConfig: React.Dispatch<React.SetStateAction<ViewConfig>>
  activeFragment: FlickFragmentFragment | undefined
  setPreviewPosition: (
    value: React.SetStateAction<Position | undefined>
  ) => void
}) => {
  const [isSpeakersTooltip, setSpeakersTooltip] = useState(false)
  const [{ flick }, setFlickStore] = useRecoilState(newFlickStore)
  const [{ fragment, updatePayload }, setStudio] = useRecoilState(studioStore)

  const [updateFlickMutation] = useUpdateFlickMutation()

  const updateStoreViewConfig = (vc: ViewConfig) => {
    if (!fragment || !flick) return
    setFlickStore((store) => ({
      ...store,
      flick: {
        ...flick,
        fragments: flick.fragments.map((frag) => {
          if (frag.id === fragment.id) {
            return {
              ...frag,
              configuration: vc,
            }
          }
          return frag
        }),
      },
    }))
    setStudio((store) => ({
      ...store,
      fragment: {
        ...fragment,
        configuration: vc,
      },
    }))
  }

  const addSpeaker = (speaker: FlickParticipantsFragment) => {
    setViewConfig({
      ...viewConfig,
      speakers: [...viewConfig?.speakers, speaker],
    })
    updateStoreViewConfig({
      ...viewConfig,
      speakers: [...viewConfig?.speakers, speaker],
    })
  }

  const deleteSpeaker = (speaker: FlickParticipantsFragment) => {
    setViewConfig({
      ...viewConfig,
      speakers: viewConfig?.speakers?.filter(
        (s) => s.user.sub !== speaker.user.sub
      ),
    })
    updateStoreViewConfig({
      ...viewConfig,
      speakers: viewConfig?.speakers?.filter(
        (s) => s.user.sub !== speaker.user.sub
      ),
    })
  }

  const debounceUpdateFlickName = useDebouncedCallback((value) => {
    if (value !== activeFragment?.name) {
      updateFlickMutation({
        variables: {
          name: value,
          flickId: flick?.id,
        },
      })
    }
  }, 1000)

  const updateFlickName = async (newName: string) => {
    if (flick) {
      setFlickStore((store) => ({
        ...store,
        flick: {
          ...flick,
          name: newName,
        },
      }))
    }
    if (fragment)
      setStudio((store) => ({
        ...store,
        fragment: {
          ...fragment,
          flick: {
            ...fragment.flick,
            name: newName,
          },
        },
      }))
    debounceUpdateFlickName(newName)
  }

  if (!flick) return null

  return (
    <div className="border-b pb-4">
      <input
        onFocus={(e) => {
          setCurrentBlock(blocks?.[0])
          setPreviewPosition({
            x: e.currentTarget.getBoundingClientRect().x,
            y: e.currentTarget.offsetTop,
          })
          updatePayload?.({
            activeIntroIndex: flick.branding?.branding?.introVideoUrl ? 2 : 1,
          })
        }}
        maxLength={50}
        onChange={(e) => {
          updateFlickName(e.target.value)
        }}
        style={{
          fontSize: '2.35rem',
        }}
        placeholder="Add a title"
        className="w-full  font-extrabold text-gray-800 resize-none font-main focus:outline-none placeholder-gray-300"
        value={flick?.name || ''}
      />

      <div className="flex items-center justify-start mt-2">
        {viewConfig?.speakers?.map((s) => (
          <div
            className="flex items-center px-2 py-1 mr-2 border border-gray-300 rounded-md font-body"
            key={s.user.sub}
          >
            <img
              src={s.user.picture as string}
              alt={s.user.displayName as string}
              className="w-5 h-5 rounded-full"
            />
            <Text className="ml-1.5 mr-2 text-xs text-gray-600 font-medium">
              {s.user.displayName}
            </Text>
            <FiX className="cursor-pointer" onClick={() => deleteSpeaker(s)} />
          </div>
        ))}
        {viewConfig.speakers?.length < 1 && (
          <Tooltip
            containerOffset={8}
            isOpen={isSpeakersTooltip}
            setIsOpen={() => setSpeakersTooltip(false)}
            placement="bottom-start"
            content={
              <SpeakersTooltip
                speakers={viewConfig.speakers}
                addSpeaker={addSpeaker}
                close={() => setSpeakersTooltip(false)}
              />
            }
          >
            <button
              type="button"
              onClick={() => {
                // Segment Tracking
                logEvent(PageEvent.AddSpeaker)

                setSpeakersTooltip(true)
              }}
              className="flex items-center py-1 px-2 text-gray-400 text-sm rounded-sm border border-transparent transition-all bg-gray-100 hover:bg-gray-200 hover:text-gray-500 gap-x-2 font-body"
            >
              <IoPersonCircleOutline size={18} /> Add speaker
            </button>
          </Tooltip>
        )}
      </div>
    </div>
  )
}

export default EditorHeader
