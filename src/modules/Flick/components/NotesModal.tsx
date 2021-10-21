import { cx } from '@emotion/css'
import React from 'react'
import Modal from 'react-responsive-modal'
import { useRecoilValue } from 'recoil'
import { Notes } from '.'
import { User, userState } from '../../../stores/user.store'
import { newFlickStore } from '../store/flickNew.store'

const NotesModal = ({
  open,
  handleClose,
}: {
  open: boolean
  handleClose: () => void
}) => {
  const { activeFragmentId, flick } = useRecoilValue(newFlickStore)
  const { sub } = (useRecoilValue(userState) as User) || {}

  const fragment = flick?.fragments.find((frag) => frag.id === activeFragmentId)
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
      {flick && fragment && (
        <Notes
          flickId={flick.id}
          participantId={
            fragment.participants.find(
              ({ participant }) => participant.userSub === sub
            )?.participant.id
          }
        />
      )}
    </Modal>
  )
}

export default NotesModal
