import React, { useEffect } from 'react'
import Modal from 'react-responsive-modal'
import { useHistory } from 'react-router-dom'
import { Button, emitToast, Heading, Text } from '../../../components'
import {
  MyNotificationFragment,
  Notification_Type_Enum_Enum,
  useAcceptCollaborationMutation,
} from '../../../generated/graphql'

const CollaborationRespondModal = ({
  open,
  handleClose,
  notification,
}: {
  open: boolean
  handleClose: () => void
  notification: MyNotificationFragment
}) => {
  const history = useHistory()

  const [acceptCollaboration, { data, loading }] =
    useAcceptCollaborationMutation({
      variables: {
        inviteId: notification.meta.inviteId,
        notificationId: notification.id,
      },
    })

  const respond = async () => {
    try {
      await acceptCollaboration()
      history.push(`/flick/${notification.meta?.flickId}`)
    } catch (e) {
      emitToast({ title: 'Failed to accept collaboration', type: 'error' })
    }
  }

  useEffect(() => {
    if (!data) return
    emitToast({ title: 'Collaboration accepted', type: 'success' })
    handleClose()
  }, [data])

  return (
    <Modal
      open={open}
      onClose={() => {
        handleClose()
      }}
      styles={{
        modal: {
          maxWidth: '30%',
          maxHeight: '80%',
          width: '100%',
          backgroundColor: '#2E2F34',
        },
      }}
      classNames={{
        modal: 'rounded-md bg-dark-200 font-body',
      }}
      center
      showCloseIcon={false}
    >
      <div className="flex flex-col items-center justify-center">
        <div className="flex gap-x-4">
          <img
            src={notification.sender.picture || ''}
            alt={notification.sender.displayName || ''}
            className="rounded-lg h-16"
          />
        </div>
        <Heading
          fontSize="medium"
          className="text-gray-100 mt-4 font-bold font-main text-xl"
        >
          Collaborate with {notification.sender.displayName}
        </Heading>
        <Text
          className="text-base text-gray-400 font-body mt-4"
          dangerouslySetInnerHTML={{
            __html: notification.message.replace(
              /%(.*?)%/g,
              '<span class="text-gray-100 font-main">$1</span>'
            ),
          }}
        />
        <div className="flex gap-x-4 mt-12 w-full items-center justify-center">
          <Button
            type="button"
            stretch
            appearance="gray"
            onClick={() => handleClose()}
          >
            Later
          </Button>
          <Button
            type="button"
            stretch
            appearance="primary"
            loading={loading}
            onClick={() => respond()}
          >
            {notification.type === Notification_Type_Enum_Enum.Invitation
              ? 'I am in!'
              : 'Accept'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default CollaborationRespondModal
