import { cx } from '@emotion/css'
import React, { useEffect, useState } from 'react'
import { BiCheckCircle, BiCircle } from 'react-icons/bi'
import Modal from 'react-responsive-modal'
import { useRecoilValue } from 'recoil'
import { Button, emitToast, Text } from '../../../components'
import { useUpdateParticipantsMutation } from '../../../generated/graphql'
import { newFlickStore } from '../store/flickNew.store'

const UpdateFragmentParticipantsModal = ({
  open,
  handleClose,
}: {
  open: boolean
  handleClose: (refresh?: boolean) => void
}) => {
  const { flick, activeFragmentId } = useRecoilValue(newFlickStore)

  const fragment = flick?.fragments.find((f) => f.id === activeFragmentId)

  const [selectedParticipants, setSelectedParticipants] = useState<string[]>(
    fragment?.participants.map((p) => p.participant.id) || []
  )

  const [UpdateParticipants, { data, loading, error }] =
    useUpdateParticipantsMutation()
  const updateParticipants = () => {
    UpdateParticipants({
      variables: {
        fragmentId: activeFragmentId,
        participantIds: selectedParticipants,
      },
    })
  }

  useEffect(() => {
    if (!error) return
    emitToast({
      title: 'Could not update participants',
      type: 'error',
      description: `Click this toast to give it another try.`,
      onClick: () => updateParticipants(),
    })
  }, [error])

  useEffect(() => {
    handleClose(true)
  }, [data])

  return (
    <Modal
      open={open}
      onClose={() => {
        handleClose()
      }}
      classNames={{
        modal: cx('rounded-md w-1/3'),
      }}
      center
      showCloseIcon={false}
    >
      <Text className="bg-gray-100 text-gray-800 mb-8 px-4 py-2 rounded-md font-semibold w-max text-sm">
        Invite to {fragment?.name}
      </Text>
      {flick?.participants.map((participant) => {
        return (
          <div className="flex items-center justify-between py-1">
            <div className="flex items-center">
              <img
                className="w-8 h-8 rounded-full border-2 mr-2"
                src={participant.user.picture || ''}
                alt={participant.user.displayName || ''}
              />
              <Text>{participant.user.displayName}</Text>
            </div>
            {selectedParticipants.find((p) => p === participant.id) ? (
              <BiCheckCircle
                size={24}
                className="text-green-600"
                onClick={() =>
                  setSelectedParticipants((participants) =>
                    participants.filter((p) => p !== participant.id)
                  )
                }
              />
            ) : (
              <BiCircle
                size={24}
                className="text-gray-400"
                onClick={() =>
                  setSelectedParticipants((participants) => [
                    ...participants,
                    participant.id,
                  ])
                }
              />
            )}
          </div>
        )
      })}
      <div className="flex mt-4 justify-end">
        <Button
          type="button"
          appearance="primary"
          size="small"
          disabled={
            JSON.stringify(
              fragment?.participants.map((p) => p.participant.id).sort()
            ) === JSON.stringify(selectedParticipants.sort())
          }
          loading={loading}
          onClick={() => {
            updateParticipants()
          }}
        >
          Update
        </Button>
      </div>
    </Modal>
  )
}

export default UpdateFragmentParticipantsModal
