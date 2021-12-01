import { cx } from '@emotion/css'
import React, { useEffect, useState } from 'react'
import { BiPlayCircle } from 'react-icons/bi'
import { BsCameraVideo } from 'react-icons/bs'
import { FiPlus } from 'react-icons/fi'
import { useHistory } from 'react-router-dom'
import { useRecoilState } from 'recoil'
import { FragmentVideoModal, UpdateFragmentParticipantsModal } from '.'
import { Avatar, Button, emitToast } from '../../../components'
import {
  FlickFragmentFragment,
  Fragment_Type_Enum_Enum,
  useGetFragmentParticipantsLazyQuery,
  useUpdateFragmentMarkdownMutation,
  useUpdateFragmentMutation,
  useUpdateFragmentStateMutation,
} from '../../../generated/graphql'
import { ViewConfig } from '../../../utils/configTypes2'
import { studioStore } from '../../Studio/stores'
import { newFlickStore } from '../store/flickNew.store'

const FragmentBar = ({
  config,
  markdown,
  plateValue,
}: {
  plateValue?: any
  markdown?: string
  config: ViewConfig
}) => {
  const [fragmentVideoModal, setFragmetVideoModal] = useState(false)
  const [{ flick, activeFragmentId }, setFlickStore] =
    useRecoilState(newFlickStore)
  const history = useHistory()

  const [fragment, setFragment] = useState<FlickFragmentFragment | undefined>(
    flick?.fragments.find((f) => f.id === activeFragmentId)
  )

  const [updateFragmentMutation] = useUpdateFragmentMutation()
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
            configuration: fragment.configuration,
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
    await updateFragmentMutation({
      variables: {
        fragmentId: fragment?.id, // value for 'fragmentId'
        name: newName,
      },
    })
  }

  return (
    <div className="flex items-center bg-gray-50 justify-between pr-4 border-b border-gray-300 p-2.5">
      <div className="flex items-center">
        {flick && flick?.fragments?.length > 0 && (
          <input
            type="text"
            value={fragment?.name || ''}
            className="text-sm font-bold text-gray-800 cursor-text rounded-md p-1 hover:bg-gray-200 bg-transparent focus:outline-none"
            onChange={(e) =>
              fragment && setFragment({ ...fragment, name: e.target.value })
            }
            onBlur={() => fragment?.name && updateFragment(fragment.name)}
            onKeyDown={(e) => {
              if (!fragment?.name) return
              if (e.key === 'Enter') {
                updateFragment(fragment.name)
              }
            }}
          />
        )}
      </div>
      {flick && flick?.fragments?.length > 0 && (
        <div className="flex items-center">
          <FragmentParticipants />
          <Button
            appearance="primary"
            size="small"
            type="button"
            className="mr-2 py-1"
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
              className="flex items-center mr-4 border border-green-600 rounded-md px-2 cursor-pointer"
              onClick={() => {
                setFragmetVideoModal(true)
              }}
            >
              <BiPlayCircle size={32} className="text-green-600 py-1" />
            </div>
          )}
          <Button
            appearance="secondary"
            size="small"
            icon={BsCameraVideo}
            type="button"
            onClick={() => history.push(`/${activeFragmentId}/studio`)}
            disabled={!fragment?.configuration}
          >
            {fragment?.producedLink ? 'Retake' : 'Record'}
          </Button>
        </div>
      )}
      <FragmentVideoModal
        open={fragmentVideoModal}
        handleClose={() => {
          setFragmetVideoModal(false)
        }}
      />
    </div>
  )
}

const FragmentParticipants = () => {
  const [{ flick, activeFragmentId }, setFlickStore] =
    useRecoilState(newFlickStore)
  const [{ fragment }, setStudio] = useRecoilState(studioStore)

  const [
    isAddFragmentParticipantModalOpen,
    setIsAddFragmentParticipantModalOpen,
  ] = useState(false)

  const [GetFragmentParticipants, { data, error }] =
    useGetFragmentParticipantsLazyQuery({
      variables: {
        fragmentId: activeFragmentId,
      },
    })

  useEffect(() => {
    if (!data || !flick) return
    const updatedFragments = flick.fragments.map((fragment) => {
      if (fragment.id === activeFragmentId) {
        return {
          ...fragment,
          participants: data.Fragment_Participant,
        }
      }
      return fragment
    })
    setFlickStore((store) => ({
      ...store,
      flick: {
        ...flick,
        fragments: updatedFragments,
      },
      activeFragmentId: store.activeFragmentId,
    }))
    if (fragment) {
      setStudio((store) => ({
        ...store,
        fragment: {
          ...fragment,
          participants: data.Fragment_Participant,
        },
      }))
    }
  }, [data])

  useEffect(() => {
    if (!error) return
    emitToast({
      title: 'Could not fetch updated participants',
      type: 'error',
      description: `Click this toast to give it another try.`,
      onClick: () => GetFragmentParticipants(),
    })
  }, [error])

  return (
    <div className="flex items-center rounded-md mr-4">
      {flick?.fragments
        .find((f) => f.id === activeFragmentId)
        ?.participants.map((p, index) => {
          return (
            <Avatar
              className={cx('w-7 h-7 rounded-full border border-gray-300', {
                '-ml-2.5': index !== 0,
              })}
              src={p.participant.user.picture as string}
              alt={p.participant.user.displayName as string}
            />
          )
        })}
      <div
        role="button"
        tabIndex={0}
        onKeyUp={() => {}}
        className="flex items-center cursor-pointer rounded-full border border-gray-300 -ml-2.5 bg-white"
        onClick={() => setIsAddFragmentParticipantModalOpen(true)}
      >
        <FiPlus size={26} className="p-2" />
      </div>
      <UpdateFragmentParticipantsModal
        key={`modal-${activeFragmentId}`}
        open={isAddFragmentParticipantModalOpen}
        handleClose={(refresh) => {
          setIsAddFragmentParticipantModalOpen(false)
          if (refresh) {
            GetFragmentParticipants()
          }
        }}
      />
    </div>
  )
}

export default FragmentBar
