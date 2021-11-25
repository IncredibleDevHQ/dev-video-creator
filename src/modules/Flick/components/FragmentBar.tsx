import { cx } from '@emotion/css'
import { TNode } from '@udecode/plate'
import React, { useEffect, useState } from 'react'
import { BiPlayCircle } from 'react-icons/bi'
import { BsCameraVideo } from 'react-icons/bs'
import { FiPlus } from 'react-icons/fi'
import { HiOutlinePencilAlt, HiOutlineTemplate } from 'react-icons/hi'
import { useHistory } from 'react-router-dom'
import { useRecoilState, useRecoilValue } from 'recoil'
import { FragmentVideoModal, UpdateFragmentParticipantsModal } from '.'
import {
  Avatar,
  Button,
  dismissToast,
  emitToast,
  Text,
  updateToast,
} from '../../../components'
import {
  FlickFragmentFragment,
  useCreateFragmentMutation,
  useGetFlickFragmentsLazyQuery,
  useGetFragmentParticipantsLazyQuery,
  UserAssetQuery,
  useUpdateFragmentMutation,
  useUpdateFragmentStateMutation,
} from '../../../generated/graphql'
import firebaseState from '../../../stores/firebase.store'
import { User, userState } from '../../../stores/user.store'
import { Config } from '../../../utils/configTypes'
import { serializeDataConfig } from '../../../utils/plateConfig/serializer/config-serialize'
import { generateViewConfig } from '../../../utils/plateConfig/serializer/generateViewConfig'
import { studioStore } from '../../Studio/stores'
import { newFlickStore } from '../store/flickNew.store'

const FragmentBar = ({
  initialPlateValue,
  plateValue,
  config,
  setSerializing,
  setConfig,
  setSelectedLayoutId,
  setInitialPlateValue,
  assetsData,
}: {
  initialPlateValue: TNode<any>[] | undefined
  plateValue?: TNode<any>[]
  config: Config
  setSerializing: React.Dispatch<React.SetStateAction<boolean>>
  setConfig: React.Dispatch<React.SetStateAction<Config>>
  setSelectedLayoutId: React.Dispatch<React.SetStateAction<string>>
  setInitialPlateValue: React.Dispatch<
    React.SetStateAction<TNode<any>[] | undefined>
  >
  assetsData: UserAssetQuery | undefined
}) => {
  const [fragmentVideoModal, setFragmetVideoModal] = useState(false)
  const fbState = useRecoilValue(firebaseState)
  const [{ flick, activeFragmentId, isMarkdown }, setFlickStore] =
    useRecoilState(newFlickStore)
  const history = useHistory()

  const [fragment, setFragment] = useState<FlickFragmentFragment | undefined>(
    flick?.fragments.find((f) => f.id === activeFragmentId)
  )
  const [createFragment] = useCreateFragmentMutation()
  const { sub } = (useRecoilValue(userState) as User) || {}
  const [
    GetFlickFragments,
    { data: fragmentData, error: fragmentError, refetch },
  ] = useGetFlickFragmentsLazyQuery({
    variables: {
      flickId: flick?.id,
    },
  })

  const [updateFragmentMutation, { data: updateFragmentData }] =
    useUpdateFragmentMutation()

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

  useEffect(() => {
    if (!fragmentData || !flick) return
    setFlickStore((store) => ({
      ...store,
      flick: {
        ...flick,
        fragments: [...fragmentData.Fragment],
      },
    }))
  }, [fragmentData])

  useEffect(() => {
    if (!fragmentError || !refetch) return
    emitToast({
      title: "We couldn't fetch your new fragment",
      type: 'error',
      description: 'Click this toast to give it another try',
      onClick: () => refetch(),
    })
  }, [fragmentError])

  const generateConfig = async () => {
    try {
      if (!plateValue || plateValue?.length === 0) return
      if (JSON.stringify(plateValue) !== JSON.stringify(initialPlateValue)) {
        setSerializing(true)

        const { token } = fbState
        const dataConfig = await serializeDataConfig(
          plateValue,
          token || '',
          assetsData
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
      if (!plateValue || plateValue?.length === 0) return
      if (JSON.stringify(plateValue) !== JSON.stringify(initialPlateValue)) {
        const { token } = fbState

        dc = await serializeDataConfig(plateValue, token || '', assetsData)
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

  const handleCreateFragment = async () => {
    if (flick?.owner?.userSub !== sub) return
    let toast
    try {
      toast = emitToast({
        type: 'info',
        title: 'Creating...',
        autoClose: false,
      })

      const res = await createFragment({
        variables: {
          flickId: flick?.id,
          name: 'Untitled',
          creatorPid: flick?.participants.find((p) => p.userSub === sub)?.id,
        },
      })

      if (res.errors) {
        throw Error(res.errors[0].message)
      }

      setFlickStore((prev) => ({
        ...prev,
        activeFragmentId: res.data?.CreateFragment?.id,
      }))

      GetFlickFragments?.()

      dismissToast(toast)
    } catch (e) {
      if (toast) {
        updateToast({
          id: toast,
          type: 'error',
          title: 'There was an error creating a fragment.',
          autoClose: 5000,
        })
      }
    }
  }

  return (
    <div className="flex items-center bg-gray-50 justify-between pr-4 border-b border-gray-300">
      <div className="flex items-center">
        <div
          role="button"
          onKeyUp={() => {}}
          tabIndex={-1}
          className={cx(
            'w-48 bg-gray-50 flex items-center justify-center cursor-pointer border-r border-gray-300 mr-4 py-2',
            {
              'cursor-not-allowed': flick?.owner?.userSub !== sub,
            }
          )}
          onClick={handleCreateFragment}
        >
          <Button
            type="button"
            className={cx('text-green-600 -ml-4')}
            disabled={flick?.owner?.userSub !== sub}
            appearance="link"
            size="small"
            icon={FiPlus}
          >
            <Text className="text-sm">New Fragment</Text>
          </Button>
        </div>
        {flick && flick?.fragments?.length > 0 && (
          <>
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
            <input
              type="text"
              value={fragment?.name || ''}
              className="text-xs font-bold text-gray-800 cursor-text rounded-md p-1 hover:bg-gray-200 bg-transparent focus:outline-none"
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
          </>
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
