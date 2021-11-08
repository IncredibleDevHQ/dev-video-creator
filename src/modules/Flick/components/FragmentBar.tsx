import { cx } from '@emotion/css'
import { TNode } from '@udecode/plate'
import React, { useEffect, useState } from 'react'
import { BiPlayCircle } from 'react-icons/bi'
import { BsCameraVideo } from 'react-icons/bs'
import { FiPlus } from 'react-icons/fi'
import { HiOutlinePencilAlt, HiOutlineTemplate } from 'react-icons/hi'
import { useHistory } from 'react-router-dom'
import { useRecoilState } from 'recoil'
import { FragmentVideoModal, UpdateFragmentParticipantsModal } from '.'
import { Avatar, Button, emitToast, Text } from '../../../components'
import {
  useGetFragmentParticipantsLazyQuery,
  useUpdateFragmentMutation,
  useUpdateFragmentStateMutation,
} from '../../../generated/graphql'
import { authState } from '../../../stores/auth.store'
import { Config } from '../../../utils/configTypes'
import { serializeDataConfig } from '../../../utils/plateConfig/serializer/config-serialize'
import { generateViewConfig } from '../../../utils/plateConfig/serializer/generateViewConfig'
import { newFlickStore } from '../store/flickNew.store'

const FragmentBar = ({
  initialPlateValue,
  plateValue,
  config,
  setSerializing,
  setConfig,
  setSelectedLayoutId,
  setInitialPlateValue,
}: {
  initialPlateValue: TNode<any>[] | undefined
  plateValue: TNode<any>[] | undefined
  config: Config
  setSerializing: React.Dispatch<React.SetStateAction<boolean>>
  setConfig: React.Dispatch<React.SetStateAction<Config>>
  setSelectedLayoutId: React.Dispatch<React.SetStateAction<string>>
  setInitialPlateValue: React.Dispatch<
    React.SetStateAction<TNode<any>[] | undefined>
  >
}) => {
  const [fragmentVideoModal, setFragmetVideoModal] = useState(false)
  const [auth] = useRecoilState(authState)
  const [{ flick, activeFragmentId, isMarkdown }, setFlickStore] =
    useRecoilState(newFlickStore)
  const history = useHistory()

  const fragment = flick?.fragments.find((f) => f.id === activeFragmentId)

  const [editFragmentName, setEditFragmentName] = useState(false)

  const [updateFragmentMutation, { data: updateFragmentData }] =
    useUpdateFragmentMutation()

  const [updateFragmentState, { data, error }] =
    useUpdateFragmentStateMutation()
  const [savingConfig, setSavingConfig] = useState(false)

  useEffect(() => {
    if (!updateFragmentData) return
    setEditFragmentName(false)
  }, [updateFragmentData])

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

  const generateConfig = async () => {
    try {
      if (JSON.stringify(plateValue) !== JSON.stringify(initialPlateValue)) {
        setSerializing(true)

        const dataConfig = await serializeDataConfig(
          plateValue || [],
          auth?.token || ''
        )
        const viewConfig = generateViewConfig({
          dataConfig,
          viewConfig: config.viewConfig,
        })
        setConfig({ dataConfig, viewConfig })
        if (dataConfig.length > 0) {
          setSelectedLayoutId(dataConfig[0].id)
        }

        const result = await updateFragmentState({
          variables: {
            editorState: plateValue,
            id: activeFragmentId,
            configuration: { dataConfig, viewConfig },
          },
        })

        if (result.errors) {
          throw Error(result.errors[0].message)
        }

        if (flick)
          setFlickStore((store) => ({
            ...store,
            flick: {
              ...flick,
              fragments: flick.fragments.map((f) =>
                f.id === activeFragmentId
                  ? {
                      ...f,
                      configuration: {
                        dataConfig,
                        viewConfig,
                      },
                      editorState: plateValue,
                    }
                  : f
              ),
            },
          }))
        setInitialPlateValue(plateValue)
      }
    } catch (error) {
      emitToast({
        type: 'error',
        title: 'Error updating fragment',
      })
    } finally {
      setSerializing(false)
    }
  }

  const updateConfig = async () => {
    setSavingConfig(true)
    try {
      let dc = config.dataConfig
      let vc = config.viewConfig
      if (JSON.stringify(plateValue) !== JSON.stringify(initialPlateValue)) {
        dc = await serializeDataConfig(plateValue || [], auth?.token || '')
        vc = generateViewConfig({
          dataConfig: dc,
          viewConfig: vc,
        })
        setConfig({ dataConfig: dc, viewConfig: vc })
        if (dc.length > 0) {
          setSelectedLayoutId(dc[0].id)
        }
        setInitialPlateValue(plateValue)
      }
      if (flick)
        setFlickStore((store) => ({
          ...store,
          flick: {
            ...flick,
            fragments: flick.fragments.map((f) =>
              f.id === activeFragmentId
                ? {
                    ...f,
                    configuration: {
                      dataConfig: dc,
                      viewConfig: vc,
                    } as Config,
                    editorState: plateValue,
                  }
                : f
            ),
          },
        }))
      await updateFragmentState({
        variables: {
          editorState: plateValue,
          id: activeFragmentId,
          configuration: { dataConfig: dc, viewConfig: vc } as Config,
        },
      })
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
    if (editFragmentName) {
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
  }

  return (
    <div className="flex items-center bg-gray-50 justify-between pr-4 pl-6 py-1.5  border-b border-gray-300">
      <div className="flex items-center">
        <div className="flex bg-gray-100 items-center rounded-md mr-6 ">
          <div
            role="button"
            onKeyUp={() => {}}
            tabIndex={0}
            onClick={() =>
              setFlickStore((store) => ({
                ...store,
                isMarkdown: true,
              }))
            }
            className={cx(
              'bg-gray-100 p-1.5 rounded-tl-md rounded-bl-md text-gray-600',
              {
                'bg-gray-200': isMarkdown,
              }
            )}
          >
            <HiOutlinePencilAlt size={18} />
          </div>
          <div
            role="button"
            onKeyUp={() => {}}
            tabIndex={0}
            onClick={() => {
              setFlickStore((store) => ({
                ...store,
                isMarkdown: false,
              }))
              generateConfig()
            }}
            className={cx(
              'bg-gray-100 p-1.5 rounded-tr-md rounded-br-md text-gray-600',
              {
                'bg-gray-200': !isMarkdown,
              }
            )}
          >
            <HiOutlineTemplate size={18} />
          </div>
        </div>
        <Text
          className="text-sm font-bold text-gray-800 truncate overflow-ellipsis cursor-text rounded-md p-1 hover:bg-gray-100"
          contentEditable={editFragmentName}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={() => {
            setEditFragmentName(true)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              setEditFragmentName(false)
              updateFragment(e.currentTarget.innerText)
            }
            if (e.key === 'Escape') {
              e.preventDefault()
              e.currentTarget.innerText = fragment?.name || ''
              setEditFragmentName(false)
            }
          }}
        >
          {fragment?.name}
        </Text>
      </div>
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
