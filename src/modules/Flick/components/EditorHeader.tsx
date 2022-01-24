import { cx } from '@emotion/css'
import React, { useState } from 'react'
import { FiX } from 'react-icons/fi'
import { IoPersonOutline } from 'react-icons/io5'
import { useRecoilState, useRecoilValue } from 'recoil'
import { useDebouncedCallback } from 'use-debounce'
import { Text, Tooltip } from '../../../components'
import {
  FlickFragmentFragment,
  FlickParticipantsFragment,
  useUpdateFragmentMutation,
} from '../../../generated/graphql'
import { ViewConfig } from '../../../utils/configTypes'
import { studioStore } from '../../Studio/stores'
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
}: {
  viewConfig: ViewConfig
  setViewConfig: React.Dispatch<React.SetStateAction<ViewConfig>>
  activeFragment: FlickFragmentFragment | undefined
}) => {
  const [isSpeakersTooltip, setSpeakersTooltip] = useState(false)
  const [{ flick, activeFragmentId }, setFlickStore] =
    useRecoilState(newFlickStore)
  const [{ fragment }, setStudio] = useRecoilState(studioStore)

  const [updateFragmentMutation] = useUpdateFragmentMutation()

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

  const debounceUpdateFragmentName = useDebouncedCallback((value) => {
    if (value !== activeFragment?.name) {
      updateFragmentMutation({
        variables: {
          fragmentId: fragment?.id,
          name: value,
        },
      })
    }
  }, 1000)

  const updateFragment = async (newName: string) => {
    if (flick) {
      setFlickStore((store) => ({
        ...store,
        flick: {
          ...flick,
          fragments: flick.fragments.map((f) => {
            if (f.id === fragment?.id) {
              return { ...f, name: newName }
            }
            return f
          }),
        },
      }))
    }
    debounceUpdateFragmentName(newName)
  }

  if (!flick) return null

  return (
    <div>
      <input
        maxLength={50}
        onChange={(e) => {
          updateFragment(e.target.value)
        }}
        className="w-full text-4xl font-bold text-gray-800 resize-none font-main focus:outline-none"
        value={
          flick.fragments.find((f) => f.id === activeFragmentId)?.name || ''
        }
      />

      <div className="flex items-center justify-start mt-4">
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
        {viewConfig.speakers?.length < flick.participants.length && (
          <Tooltip
            containerOffset={8}
            isOpen={isSpeakersTooltip}
            setIsOpen={() => setSpeakersTooltip(false)}
            placement="bottom-center"
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
              onClick={() => setSpeakersTooltip(true)}
              className="flex items-center px-2 py-1 text-gray-400 rounded-sm hover:bg-gray-100 gap-x-2 font-body"
            >
              <IoPersonOutline /> Add speakers
            </button>
          </Tooltip>
        )}
      </div>
    </div>
  )
}

export default EditorHeader
