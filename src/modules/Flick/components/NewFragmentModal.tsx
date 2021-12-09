import { cx } from '@emotion/css'
import { Switch } from '@headlessui/react'
import React, { useEffect, useState } from 'react'
import Modal from 'react-responsive-modal'
import Select from 'react-select'
import { useRecoilState, useRecoilValue } from 'recoil'
import {
  Button,
  emitToast,
  Heading,
  Tab,
  TabBar,
  Text,
  TextField,
} from '../../../components'
import {
  CreateFragmentMutationVariables,
  useCreateFragmentMutation,
  useGetFlickFragmentsLazyQuery,
  User,
} from '../../../generated/graphql'
import { userState } from '../../../stores/user.store'
import { newFlickStore } from '../store/flickNew.store'

const tabs: Tab[] = [
  {
    name: 'New fragment',
    value: 'New fragment',
  },
]

const NewFragmentModal = ({
  open,
  handleClose,
}: {
  open: boolean
  handleClose: () => void
}) => {
  const [{ flick }, setFlickStore] = useRecoilState(newFlickStore)
  const { sub } = (useRecoilValue(userState) as User) || {}
  const [enabled, setEnabled] = useState(false)

  const [creating, setCreating] = useState(false)

  const [inputState, setInputState] =
    useState<CreateFragmentMutationVariables>()

  const reset = () => {
    setInputState({
      flickId: flick?.id,
      name: '',
      creatorPid: flick?.participants.find((p) => p.userSub === sub)?.id,
      speakerIds: [
        flick?.participants.find((p) => p.userSub === sub)?.userSub || '',
      ],
    })
  }

  useEffect(() => {
    reset()
  }, [])

  const [createFragment] = useCreateFragmentMutation()
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [getFragments, { data: fragmentData, error: fragmentError, refetch }] =
    useGetFlickFragmentsLazyQuery({
      fetchPolicy: 'network-only',
      variables: {
        flickId: flick?.id,
      },
    })

  useEffect(() => {
    if (!fragmentError || !refetch) return
    emitToast({
      title: "We couldn't fetch your new fragment",
      type: 'error',
      description: 'Click this toast to give it another try',
      onClick: () => refetch(),
    })
  }, [fragmentError])

  useEffect(() => {
    if (!fragmentData?.Fragment || fragmentData.Fragment.length < 1 || !flick)
      return
    const newFragments = [...fragmentData.Fragment]
    setFlickStore((store) => ({
      ...store,
      flick: {
        ...flick,
        fragments: newFragments,
      },
    }))
    if (enabled) {
      reset()
    } else {
      handleClose()
      emitToast({
        title: 'Fragment created',
        type: 'success',
        description: 'Your fragment has been created',
      })
    }
  }, [fragmentData])

  const handleCreateFragment = async () => {
    if (flick?.owner?.userSub !== sub) return
    setCreating(true)
    try {
      const { data, errors } = await createFragment({
        variables: {
          ...inputState,
          name: inputState?.name === '' ? 'Untitled' : inputState?.name,
        } as CreateFragmentMutationVariables,
      })

      if (errors) {
        throw Error(errors[0].message)
      }

      if (data?.CreateFragment?.id) {
        setFlickStore((store) => ({
          ...store,
          activeFragmentId: data.CreateFragment?.id,
        }))
        await refetch({ flickId: flick?.id })
      }
    } catch (e) {
      emitToast({
        type: 'error',
        title: 'There was an error creating a fragment.',
        autoClose: 5000,
      })
    } finally {
      setCreating(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        handleClose()
      }}
      classNames={{
        modal: cx('rounded-md w-full md:w-1/3'),
      }}
      center
      showCloseIcon={false}
    >
      <div className="flex flex-col divide-y divide-gray-200 ">
        <div className="mb-4">
          <TabBar onTabChange={() => {}} tabs={tabs} current={tabs[0]} />
          <Heading className="mt-6 text-base">Give a title</Heading>
          <TextField
            onChange={(e) => {
              if (inputState)
                setInputState({
                  ...inputState,
                  name: e.currentTarget.value,
                })
            }}
            value={inputState?.name}
            className="pt-1 text-sm font-body"
            placeholder="Title"
          />
          <Text className="mt-1 text-xs text-gray-600 font-body">
            Title of the fragment will be part of the video
          </Text>
          <Heading className="mt-6 text-base ">Add speakers</Heading>
          <Select
            isMulti
            styles={colourStyles}
            className="col-span-4 mt-2 text-xs placeholder-gray-200 font-body"
            value={Array.from(inputState?.speakerIds || []).map((id) => ({
              value: id,
              label: flick?.participants.find((p) => p.userSub === id)?.user
                .displayName,
            }))}
            onChange={(value) => {
              if (inputState)
                setInputState({
                  ...inputState,
                  speakerIds: value.map((v) => v.value),
                })
            }}
            formatOptionLabel={(option) => (
              <div className="flex items-center">
                <img
                  className="w-6 h-6 mr-2 rounded-full"
                  src={
                    flick?.participants.find((p) => p.userSub === option.value)
                      ?.user.picture || ''
                  }
                  alt={option.label || ''}
                />
                <Text className="text-xs text-gray-600 font-body">
                  {option.label}
                </Text>
              </div>
            )}
            options={flick?.participants
              .filter((p) => !inputState?.speakerIds?.includes(p.id))
              .map((p) => ({
                value: p.user.sub,
                label: p.user.displayName,
              }))}
            placeholder="Add speakers (You can add them later too)"
          />
        </div>
        <div className="flex items-center justify-end pt-4 gap-x-4">
          <Switch.Group>
            <Switch
              checked={enabled}
              onChange={setEnabled}
              className={`${
                enabled ? 'bg-brand' : 'bg-gray-200'
              } relative inline-flex items-center h-5 rounded-full w-8`}
            >
              <span
                className={`${
                  enabled ? 'translate-x-4' : 'translate-x-1'
                } inline-block w-3 h-3 transform bg-white rounded-full`}
              />
            </Switch>
            <Switch.Label className="-ml-2.5 text-xs text-gray-400 font-body">
              Create more
            </Switch.Label>
          </Switch.Group>
          <Button
            type="button"
            appearance="primary"
            loading={creating}
            size="small"
            disabled={creating}
            onClick={() => {
              if (!creating) handleCreateFragment()
            }}
          >
            <Text className="text-sm">Add Fragment</Text>
          </Button>
        </div>
      </div>
    </Modal>
  )
}

const colourStyles = {
  multiValue: (styles: any) => {
    return {
      ...styles,
      backgroundColor: '#00000000',
      border: '1px solid #eaeaea',
    }
  },
}

export default NewFragmentModal
